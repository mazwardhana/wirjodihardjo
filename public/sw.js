const CACHE_NAME = 'wirjodihardjo-v1';
const PRECACHE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

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
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
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
