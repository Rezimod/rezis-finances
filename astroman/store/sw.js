// Astroman register: the app shell works offline, product pictures are kept after the first view.
const V = 'astroman-pos-v8';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png', '../brand/mark-black-160.png', '../brand/logo-full-black-240.png'];
const IMG = 'astroman-pos-img-v1';
const IMG_MAX = 900;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== V && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/wp-content/uploads/')) { e.respondWith(imageFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
});

async function networkFirst(req) {
  const c = await caches.open(V);
  try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; }
  catch (e) { const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit; if (req.mode === 'navigate') return c.match('./index.html'); throw e; }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(V);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}
async function imageFirst(req) {
  const c = await caches.open(IMG);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req, { mode: 'no-cors' });
    c.put(req, r.clone());
    trim(c);
    return r;
  } catch (e) { return new Response('', { status: 504 }); }
}
async function trim(c) {
  const keys = await c.keys();
  if (keys.length <= IMG_MAX) return;
  for (const k of keys.slice(0, keys.length - IMG_MAX)) await c.delete(k);
}
