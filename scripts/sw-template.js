// Templat service worker. Disalin ke public/sw.js oleh scripts/build-sw.mjs
// saat build, dengan __BUILD_ID__ diganti id build Next.js.
//
// public/sw.js TIDAK di-commit (lihat .gitignore): versi cache harus ikut
// berubah setiap build, kalau tidak perbaikan PWA tidak pernah sampai ke
// perangkat yang sudah memasang aplikasi.
const CACHE_NAME = 'wirjodihardjo-__BUILD_ID__';
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

const NEVER_CACHE_PREFIXES = ['/admin', '/api/admin', '/api/auth'];
const NEVER_CACHE_QUERY = 'status=PENDING';

function shouldNeverCache(url) {
  return NEVER_CACHE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) ||
    url.search.includes(NEVER_CACHE_QUERY);
}

function isCacheableAsset(url, request) {
  return request.mode !== 'navigate' &&
    (url.pathname.startsWith('/_next/static/') ||
      /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|mjs|woff2?|ttf|otf)$/.test(url.pathname));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll gagal seluruhnya bila satu URL 404, dan service worker tidak
      // pernah terpasang. Simpan satu per satu supaya satu aset hilang tidak
      // mematikan seluruh PWA.
      .then((cache) => Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch((err) => {
          console.warn('[sw] lewati pra-cache', url, err.message);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('wirjodihardjo-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldNeverCache(url)) return;

  if (request.mode === 'navigate') {
    // Never cache authenticated pages (dashboard, admin, etc)
    if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin')) {
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        // Halaman cadangan luring lebih ramah daripada error bawaan peramban.
        .catch(() => caches.match(request).then((cached) =>
          cached || caches.match(OFFLINE_URL) || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cacheControl = response.headers.get('cache-control');
          if (response.ok && !cacheControl?.includes('private')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (isCacheableAsset(url, request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(
          keys
            .filter((key) => key.startsWith('wirjodihardjo-'))
            .map((key) => caches.delete(key))
        ))
    );
  }
});
