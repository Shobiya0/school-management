const CACHE = 'disha-shell-v5';
const CORE = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of CORE) {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await cache.put(path, response);
      } catch (error) {
        console.warn('Could not cache app file:', path, error);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('disha-shell-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isAppShell = ['/', '/index.html', '/app.js', '/styles.css'].includes(url.pathname);
  if (isAppShell) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(url.pathname)) || (await caches.match('/index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return caches.match('/index.html');
    }
  })());
});
