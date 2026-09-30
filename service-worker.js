// ─────────────────────────────────────────────────────────────────
// SMP Scavo — Service Worker
// v111 — Risolutore conflitti: "Rimuovi" e "Inverti verso" ora agiscono su
// ENTRAMBE le schede (il rapporto e il suo reciproco), altrimenti il conflitto
// restava perché il Matrix considera valido il rapporto scritto su una
// qualsiasi delle due. Dopo ogni correzione il riquadro elenca cosa è stato
// modificato sul foglio e come è cambiato il numero di conflitti.
// Include il rilevamento cicli esaustivo (v110) e il pannello flottante (v108).
// ─────────────────────────────────────────────────────────────────
const CACHE_NAME = 'smp-scavo-v111';

// Shell dell'app da rendere disponibile offline.
const APP_SHELL = [
  './',
  './index.html'
];

// ─── INSTALL ───────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[SW] precache parziale:', err))
  );
  // Attiva subito la nuova versione senza attendere la chiusura delle tab
  self.skipWaiting();
});

// ─── ACTIVATE ──────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;

  // Gestiamo solo le GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Mai intercettare le chiamate alle API Google (Sheets / Drive / OAuth):
  // sono dinamiche e autenticate, devono sempre passare dalla rete.
  if (url.origin !== self.location.origin) return;

  // Navigazioni (apertura/refresh della pagina): network-first con
  // fallback alla shell in cache quando manca rete.
  // v105: la richiesta di rete usa un URL con parametro sempre diverso
  // (cache-busting) per essere certi di ricevere SEMPRE l'ultima versione
  // pubblicata, mai una copia salvata dal browser.
  if (req.mode === 'navigate') {
    const freshUrl = new URL('./index.html', self.location.href);
    freshUrl.searchParams.set('_sw', Date.now().toString());
    event.respondWith(
      fetch(freshUrl.toString())
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Altri asset same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Consente alla pagina di forzare l'attivazione immediata dell'aggiornamento
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
