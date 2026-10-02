// SVL Costing service worker: makes the web app installable and usable offline (iOS / Android / desktop).
// Same-origin files: network-first (always the latest deployed code when online), cache fallback when offline.
// Versioned third-party modules (Firebase SDK, fonts): cache-first. Cloud data (Firestore / Google sign-in) is never cached.
const VERSION = 'v1.10.0';
const CACHE = `svl-costing-${VERSION}`;
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './lib/xlsx.mjs', './lib/cpexcel.full.mjs',
  './src/app.js', './src/config.js', './src/store.js', './src/worker.js',
  './src/engine/controls.js', './src/engine/grid.js', './src/engine/step1.js', './src/engine/step2.js', './src/engine/step3.js',
  './src/engine/step3b.js', './src/engine/step4.js', './src/engine/step5.js', './src/engine/return.js', './src/engine/trace.js', './src/engine/util.js',
  './src/ui/format.js', './src/ui/table.js', './src/views/phase2.js', './src/views/phase3.js', './src/views/trace.js',
];
const CDN_CACHEABLE = [/^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('svl-costing-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (CDN_CACHEABLE.some((re) => re.test(req.url))) e.respondWith(cacheFirst(req));
  // everything else (Firestore, Google sign-in, …) goes straight to the network
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) c.put(stripQuery(req), res.clone());
    return res;
  } catch (err) {
    const hit = (await c.match(stripQuery(req))) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
  return res;
}
// "?sandbox=1" and similar query strings must still find the cached shell
function stripQuery(req) { const u = new URL(req.url); if (req.mode === 'navigate') { u.search = ''; u.hash = ''; return u.toString(); } return req; }
