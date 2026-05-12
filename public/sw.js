const CACHE = 'poupaup-v1'
const OFFLINE_URLS = ['/dashboard', '/login']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Só intercepta GET de navegação — deixa API passar normalmente
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/dashboard')))
  )
})

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: 'PoupaUp', body: e.data.text() } }

  const { title = 'PoupaUp', body = '', icon = '/logo.png', url = '/dashboard', badge = '/logo.png' } = payload

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
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
