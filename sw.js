/* sw.js: makes Ultimate Drinking Cards installable and playable offline (Just Cards mode).
   Bump CACHE_VERSION whenever you change any precached file. */
const CACHE_VERSION = 'udc-v9';
const CORE = `${CACHE_VERSION}-core`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

const PRECACHE = [
  './',
  'index.html',
  'theme.js',
  'udc-online.js',
  'qrcode.js',
  'manifest.json',
  'AppFiles/Data/cards.json',
  'AppFiles/Icons/favicon.ico',
  'AppFiles/Icons/UDC - Face.svg',
  'AppFiles/Logos/AppIcon192px.png',
  'AppFiles/Logos/AppIcon512px.png',
  'AppFiles/Sounds/flip.mp3',
  'AppFiles/Sounds/black.mp3',
  'AppFiles/Sounds/red.mp3',
  'AppFiles/Sounds/click.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    // allSettled: one missing file (e.g. no qrcode.min.js) won't break the install.
    await Promise.allSettled(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network first: fresh when online, cached copy when offline.
// Used for the page, scripts and cards.json so every phone gets the host's same cards.
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true }) || await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = await caches.match('index.html', { ignoreSearch: true });
      if (page) return page;
    }
    throw e;
  }
}

// Cache first: sounds and images never change often.
async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

// Serve cached copy instantly, refresh in the background (for CDN scripts).
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fresh = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never touch Firebase realtime traffic or auth calls.
  if (/firebaseio\.com|googleapis\.com|firebaseapp\.com/.test(url.hostname)) return;

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate' || /\.(html|js|json)$/.test(url.pathname)) {
      event.respondWith(networkFirst(req, CORE));
    } else {
      event.respondWith(cacheFirst(req, RUNTIME));
    }
    return;
  }

  // Firebase SDK + header script from CDNs
  if (/gstatic\.com|jsdelivr\.net/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME));
  }
});
