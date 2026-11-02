/* Caro Caring Cam service worker
 * NETWORK-FIRST: online always gets the newest files; the cache is only an offline fallback.
 * Only this site's own files are cached. Other origins (script.google.com, Google Fonts,
 * Drive, APIs) are never intercepted, so uploads, config and email always go straight through.
 */
const VERSION = 'caring-cam-v1';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('caring-cam-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // never touch other origins
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok && fresh.type === 'basic') {
        // store pages under one key so ?api=… links still work offline
        const key = req.mode === 'navigate' ? './index.html' : req;
        cache.put(key, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      throw err;
    }
  })());
});
