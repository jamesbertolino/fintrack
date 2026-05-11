/**
 * Rate limiter com Upstash Redis (produção multi-instância) e fallback em memória.
 *
 * Configuração (Vercel env vars ou .env.local):
 *   UPSTASH_REDIS_REST_URL=https://...upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=AX...
 *
 * Sem as vars → cai no fallback em memória (ok para dev / instância única).
 *
 * Algoritmo: sliding window com INCR + EXPIRE no Redis.
 * Garante contagem correta em múltiplas instâncias serverless.
 */

// ─── Fallback em memória ──────────────────────────────────────────────────────

interface Bucket { count: number; resetAt: number }
const memStore = new Map<string, Bucket>()
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of memStore) if (b.resetAt < now) memStore.delete(k)
}, 60_000)

function rateLimitMem(key: string, limit: number, windowSec: number): RateLimitResult {
  const now    = Date.now()
  const window = windowSec * 1_000
  let b = memStore.get(key)
  if (!b || b.resetAt < now) { b = { count: 0, resetAt: now + window }; memStore.set(key, b) }
  b.count++
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt }
}

// ─── Redis (Upstash REST API — sem dependência do SDK para evitar edge issues) ─

async function rateLimitRedis(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`

  // Pipeline: INCR + EXPIRE em uma só round-trip
  const pipeline = [
    ['INCR', redisKey],
    ['EXPIRE', redisKey, String(windowSec), 'NX'],  // só seta se ainda não existe
    ['TTL', redisKey],
  ]

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline),
  })

  if (!res.ok) throw new Error(`Upstash error ${res.status}`)

  const results = await res.json() as Array<{ result: number }>
  const count  = results[0].result
  const ttl    = results[2].result   // segundos restantes

  const resetAt   = Date.now() + ttl * 1_000
  const remaining = Math.max(0, limit - count)

  return { allowed: count <= limit, remaining, resetAt }
}

// ─── Interface pública ────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Chave única para a janela (ex: `ia:${user.id}`) */
  key:       string
  /** Máximo de requisições permitidas */
  limit:     number
  /** Duração da janela em segundos */
  windowSec: number
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number  // timestamp ms
}

export async function rateLimit({ key, limit, windowSec }: RateLimitOptions): Promise<RateLimitResult> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      return await rateLimitRedis(url, token, key, limit, windowSec)
    } catch (err) {
      // Redis indisponível → fallback silencioso para não bloquear a requisição
      console.warn('[rateLimit] Redis falhou, usando memória:', err)
    }
  }

  return rateLimitMem(key, limit, windowSec)
}

/** Extrai IP real levando em conta proxies (Vercel / Cloudflare) */
export function getClientIp(request: Request): string {
  const headers = request.headers as Headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
