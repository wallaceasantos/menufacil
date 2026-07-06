const CACHE_NAME = 'menufacil-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard/orders',
  '/dashboard',
  '/manifest.json',
  '/icon-192.svg',
]

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch - network first, fallback to cache for app shell
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip API and SSE requests
  if (url.pathname.startsWith('/api/') || url.pathname.includes('events/stream')) return

  // Skip non-GET
  if (request.method !== 'GET') return

  // Cache-first for static assets
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        return cached || fetchPromise
      })
    )
    return
  }

  // Network first for navigation, offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try {
    const raw = event.data.json()
    data = raw.data || raw
  } catch {
    data = { title: 'MenuFácil', message: 'Nova notificação' }
  }

  const title = data.title || 'MenuFácil'
  const options = {
    body: data.message || 'Você tem uma nova notificação',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: data.tag || 'menufacil-notification',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/dashboard/orders' },
    actions: [
      { action: 'open', title: 'Ver pedidos' },
      { action: 'close', title: 'Fechar' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'close') return
  const url = event.notification.data?.url || '/dashboard/orders'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url) && 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
