// Mars: opens without internet. The page itself comes from the network when it answers within a few
// seconds (so updates show up at once) and from the saved copy otherwise; fonts, libraries and
// product pictures are kept after the first view. The data copy lives in IndexedDB, not here.
const V = 'mars-v1';
const IMG = 'mars-img-v1';
const IMG_MAX = 600;
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-180.png', './brand/mark-light-160.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mars-') && k !== V && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes('/astroman/store/')) return; // the register has its own worker
    if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/astroman/')) { e.respondWith(pageFirst(req)); return; }
    e.respondWith(staleWhileRevalidate(req, V)); return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com') { e.respondWith(staleWhileRevalidate(req, V)); return; }
  if (req.destination === 'image' && (url.pathname.includes('/wp-content/uploads/') || url.hostname === 'cdn.optimo.ge' || url.pathname.startsWith('/thumbnail'))) { e.respondWith(imageFirst(req)); return; }
});

async function pageFirst(req) {
  const c = await caches.open(V);
  const net = fetch(req).then(r => { if (r && r.ok) c.put('./index.html', r.clone()); return r; });
  const slow = new Promise(ok => setTimeout(ok, 3500));
  try {
    const r = await Promise.race([net, slow.then(() => null)]);
    if (r) return r;
  } catch (e) {}
  const hit = await c.match('./index.html');
  return hit || net;
}
async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(() => {}); return r; }).catch(() => hit);
  return hit || net;
}
async function imageFirst(req) {
  const c = await caches.open(IMG);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    c.put(req, r.clone()).then(() => trim(c)).catch(() => {});
    return r;
  } catch (e) { return new Response('', { status: 504 }); }
}
async function trim(c) {
  const keys = await c.keys();
  if (keys.length <= IMG_MAX) return;
  for (const k of keys.slice(0, keys.length - IMG_MAX)) await c.delete(k);
}
