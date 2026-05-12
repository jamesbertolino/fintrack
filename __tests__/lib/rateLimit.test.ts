// Tests the in-memory rate limiter (rateLimitMem) via the public rateLimit() function.
// Upstash env vars are absent in test environment, so it always falls through to mem.

import { rateLimit } from '@/lib/rateLimit'

const key = () => `test:${Math.random().toString(36).slice(2)}`

describe('rateLimit (fallback em memória)', () => {
  it('permite requisições dentro do limite', async () => {
    const k = key()
    const r1 = await rateLimit({ key: k, limit: 3, windowSec: 60 })
    const r2 = await rateLimit({ key: k, limit: 3, windowSec: 60 })
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(r1.remaining).toBe(2)
    expect(r2.remaining).toBe(1)
  })

  it('bloqueia após atingir o limite', async () => {
    const k = key()
    await rateLimit({ key: k, limit: 2, windowSec: 60 })
    await rateLimit({ key: k, limit: 2, windowSec: 60 })
    const r3 = await rateLimit({ key: k, limit: 2, windowSec: 60 })
    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('chaves diferentes têm buckets independentes', async () => {
    const k1 = key()
    const k2 = key()
    await rateLimit({ key: k1, limit: 1, windowSec: 60 })
    await rateLimit({ key: k1, limit: 1, windowSec: 60 }) // k1 bloqueada
    const r = await rateLimit({ key: k2, limit: 1, windowSec: 60 })
    expect(r.allowed).toBe(true) // k2 ainda está ok
  })

  it('resetAt está no futuro', async () => {
    const r = await rateLimit({ key: key(), limit: 5, windowSec: 60 })
    expect(r.resetAt).toBeGreaterThan(Date.now())
  })
})
