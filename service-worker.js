// ─── SMP Scavo — Service Worker v81 ─────────────────────────────────────────
// Strategia: Cache-first per asset statici, network-first per Google APIs.
// Aggiorna CACHE_NAME ad ogni nuova versione dell'app.

const CACHE_NAME = 'smp-scavo-v81';

// Asset locali da cachare subito all'install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-apple.png',
];

// Pattern per cui usare sempre la rete (Google APIs, Drive, Sheets, Auth, CDNs)
const NETWORK_ONLY_PATTERNS = [
  /accounts\.google\.com/,
  /googleapis\.com/,
  /docs\.google\.com/,
  /sheets\.googleapis\.com/,
  /drive\.googleapis\.com/,
  /cloudflare\.com/,
  /cdnjs\.cloudflare\.com/,
  /unpkg\.com/,
  /jsdelivr\.net/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())  // attiva subito senza aspettare reload
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))   // elimina versioni vecchie
      )
    ).then(() => self.clients.claim())      // prende controllo immediato
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo richieste GET
  if (request.method !== 'GET') return;

  // Network-only per API esterne (Google, CDN…)
  if (NETWORK_ONLY_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first per tutto il resto (app shell, icone, manifest…)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // Non in cache: scarica e salva
      return fetch(request).then(response => {
        // Cacha solo risposte valide della stessa origine
        if (
          response.ok &&
          response.type === 'basic' &&
          url.origin === self.location.origin
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: restituisce la shell
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
