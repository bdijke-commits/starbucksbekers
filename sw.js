// Service worker: maakt de app installeerbaar en bruikbaar zonder internet.
// Verhoog VERSIE als je bestanden aanpast, zodat telefoons de nieuwe versie ophalen.
const VERSIE = 'bekerkast-v3';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'data.json',
  'startcollectie.json', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSIE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase e.d. niet onderscheppen

  // Fotobladen: eerst uit de cache (veranderen niet)
  if (/\/s-\d+\.webp$/.test(url.pathname)) {
    e.respondWith(caches.open(VERSIE).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // Overige bestanden: eerst online, bij geen verbinding uit de cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const kopie = res.clone(); caches.open(VERSIE).then(c => c.put(e.request, kopie)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
