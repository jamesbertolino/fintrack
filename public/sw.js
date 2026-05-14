const CACHE_STATIC  = 'poupaup-static-v2'
const CACHE_PAGES   = 'poupaup-pages-v2'
const STATIC_ASSETS = ['/', '/dashboard', '/login', '/logo.png', '/velocimetro.png', '/manifest.json']

// ── Install: pré-cacheia assets estáticos ────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: limpa caches antigos ───────────────────────────────────────────
self.addEventListener('activate', e => {
  const keep = [CACHE_STATIC, CACHE_PAGES]
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: estratégia por tipo de recurso ────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // APIs externas (Supabase, Stripe, etc.) e rotas /api/ — sempre rede
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  if (!url.origin.startsWith(self.location.origin) && !url.hostname.endsWith('supabase.co') === false) return

  // Páginas Next.js (_next/static) — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE_STATIC).then(c => c.put(e.request, clone))
        return res
      }))
    )
    return
  }

  // Páginas de navegação — network-first, fallback para cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_PAGES).then(c => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('/dashboard')))
    )
    return
  }

  // Assets estáticos (imagens, fontes) — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => new Response('', { status: 408 })))
  )
})

// ── Mensagens do cliente ──────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: 'PoupaUp', body: e.data.text() } }

  const { title = 'PoupaUp', body = '', icon = '/logo.png', url = '/dashboard', badge = '/logo.png' } = payload

  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge,
      data: { url },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/dashboard'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else clients.openWindow(url)
    })
  )
})
