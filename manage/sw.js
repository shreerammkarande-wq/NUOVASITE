/* Shri Jagdamba — Daily Monitor
   Service worker. Bump CACHE whenever you change index.html so both
   phones pick up the new version instead of the cached one. */

const CACHE = 'sjmonitor-v3';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('Monitor precache failed', err))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Never touch anything cross-origin. Firestore, Firebase Auth, Google
     sign-in, Tailwind, Chart.js, the fonts — all of it must go straight to
     the network. Caching a Firebase response here would be a real bug:
     you could end up looking at yesterday's stock figures. */
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isPage) {
    /* Network first — a new build should appear the moment it is uploaded.
       Falls back to the cached shell when there is no signal at the unit. */
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => new Response('', { status: 504, statusText: 'Offline' })))
  );
});
