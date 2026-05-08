/**
 * Rate limiter em memória — adequado para instância única (Vercel serverless por região).
 * Para multi-região em produção, substituir pelo Upstash Redis.
 */

interface Bucket {
  count:     number
  resetAt:   number
}

const store = new Map<string, Bucket>()

// Limpa entradas expiradas periodicamente (evita leak de memória)
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key)
  }
}, 60_000)

export interface RateLimitOptions {
  /** Identificador único da janela (ex: ip + rota) */
  key:      string
  /** Máximo de requisições permitidas na janela */
  limit:    number
  /** Duração da janela em segundos */
  windowSec: number
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number   // timestamp ms
}

export function rateLimit({ key, limit, windowSec }: RateLimitOptions): RateLimitResult {
  const now    = Date.now()
  const window = windowSec * 1000
  let bucket   = store.get(key)

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + window }
    store.set(key, bucket)
  }

  bucket.count++
  const allowed   = bucket.count <= limit
  const remaining = Math.max(0, limit - bucket.count)

  return { allowed, remaining, resetAt: bucket.resetAt }
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
