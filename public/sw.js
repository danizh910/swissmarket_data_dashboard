// BFS Statistik Hub — Service Worker
// Handles Web Push notifications (iOS 16.4+, Android, Desktop)

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'BFS Statistik Hub', {
      body: data.body ?? 'Neue Statistikdaten verfügbar',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'bfs-refresh',
      renotify: true,
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    }),
  );
});
