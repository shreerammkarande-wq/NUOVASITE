/* Nuova customer app — service worker
   Bump CACHE version whenever you change index.html or the images,
   so every customer's phone picks up the new version. */

const CACHE = 'nuova-v5';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './img/logo.jpg',
  './img/bankqr.jpg',
  './img/groundnut.jpg',
  './img/sunflower.jpg',
  './img/safflower.jpg',
  './img/coconut.jpg',
  './img/mustard.jpg',
  './img/sesame.jpg',
  './img/flaxseed.jpg'
];

/* Install — pre-cache the shell so the app opens offline */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('Precache failed', err))
  );
});

/* Activate — drop older caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fetch strategy
   - the page itself: network first, so price updates arrive immediately
   - everything else: cache first, for speed and offline use */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let fonts etc. go straight to network

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isPage) {
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
