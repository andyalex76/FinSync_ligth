// Kill switch for the retired offline-first service worker.
// Browsers that visited the old version still have a service worker that serves a stale copy of
// the app. They re-check /sw.js, get this file, and it removes itself and the old caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
