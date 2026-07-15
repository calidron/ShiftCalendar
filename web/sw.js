const CACHE = 'shiftcalendar-v73';
const ASSETS = [
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/utils.js',
  './js/store.js',
  './js/analytics.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isAppShellRequest(request) {
  if (request.mode === 'navigate') return true;
  const { pathname } = new URL(request.url);
  return /\.(html|css|js|json)$/.test(pathname);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const { hostname } = new URL(event.request.url);
  if (hostname === 'gc.zgo.at' || hostname.endsWith('.goatcounter.com')) return;

  event.respondWith(
    isAppShellRequest(event.request)
      ? networkFirst(event.request)
      : cacheFirst(event.request)
  );
});
