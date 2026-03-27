const CACHE_NAME = 'smp-scavo-v1';

// File da cachare per uso offline (solo shell statica)
const STATIC_ASSETS = [
  '/scavo-us/',
  '/scavo-us/index.html',
  '/scavo-us/manifest.json',
  '/scavo-us/icon-192.png',
  '/scavo-us/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Per le API Google Sheets: sempre rete, mai cache
  if (event.request.url.includes('googleapis.com') ||
      event.request.url.includes('accounts.google.com')) {
    return; // lascia passare normalmente
  }

  // Per le risorse statiche: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cacha solo risposte valide
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback: restituisce la shell dell'app
      if (event.request.mode === 'navigate') {
        return caches.match('/scavo-us/index.html');
      }
    })
  );
});
