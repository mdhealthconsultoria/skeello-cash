// @ts-nocheck
/// <reference lib="webworker" />
// Service worker do Skeello Cash: cache offline (Workbox) + notificações push de verdade.

import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Skeello Cash', body: event.data?.text() }
  }

  const title = data.title || 'Skeello Cash'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: 'favicon.svg',
    badge: 'favicon.svg',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate?.(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
