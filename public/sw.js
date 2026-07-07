// Service worker mínimo: solo cachea el shell de la app (HTML/JS/CSS) para
// que el navegador considere instalable la PWA. No cachea las respuestas de
// /api — los datos siempre tienen que venir frescos de Google Sheets, nunca
// de una copia vieja en caché.
const CACHE_NAME = 'registro-difusiones-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Nunca cachear /api: los datos siempre tienen que ser en vivo.
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
