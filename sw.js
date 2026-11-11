// Service Worker - Rotador PWA
const CACHE_NAME = 'rotador-v7';

// Archivos a pre-cachear
const PRECACHE_URLS = [
  './',
  './index.html',
  './js/app.js',
  './js/store.js',
  './js/ui.js',
  './js/scanner.js',
  './js/db.js',
  './js/pdf-importer.js',
  './manifest.json',
  './icons/icon.svg'
];

// Librerías externas que la app necesita sin conexión (mejor esfuerzo al instalar).
// Si alguna no se puede descargar ahora, se guardará la primera vez que se use con internet.
const CDN_PRECACHE_URLS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@zxing/library@0.21.3',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

// Dominios CDN permitidos para cachear
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdnjs.cloudflare.com'
];

// --- Evento INSTALL ---
// Pre-cachea los assets estáticos al instalar
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-cacheando assets estáticos');
        return cache.addAll(PRECACHE_URLS).then(() =>
          Promise.allSettled(
            CDN_PRECACHE_URLS.map((url) =>
              fetch(url, { mode: 'no-cors' }).then((res) => cache.put(url, res))
            )
          )
        );
      })
      .then(() => {
        // Activar inmediatamente sin esperar a que se cierren tabs anteriores
        return self.skipWaiting();
      })
  );
});

// --- Evento ACTIVATE ---
// Limpia caches viejos de versiones anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Eliminando cache viejo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Tomar control de todas las páginas abiertas inmediatamente
        return self.clients.claim();
      })
  );
});

// --- Evento FETCH ---
// Estrategia cache-first para assets locales y CDN
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // Determinar si es un recurso CDN
  const isCDN = CDN_HOSTS.some((host) => url.hostname.includes(host));

  // Determinar si es un recurso local (mismo origen)
  const isLocal = url.origin === self.location.origin;

  // Solo cachear recursos locales y CDN
  if (!isLocal && !isCDN) return;

  // Archivos propios de la app: red primero (así los cambios llegan siempre),
  // con el cache como respaldo para uso 100% offline.
  if (isLocal) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
          })
        )
    );
    return;
  }

  // CDN: cache primero
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Recurso encontrado en cache, devolverlo directamente
          return cachedResponse;
        }

        // No está en cache, hacer fetch a la red
        return fetch(event.request)
          .then((networkResponse) => {
            // Verificar que la respuesta sea válida
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clonar la respuesta para guardarla en cache
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(() => {
            // Si falla la red y no hay cache, devolver fallback para HTML
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});
