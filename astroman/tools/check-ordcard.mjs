// Register orders board: each online order shows its products on the right, big and highlighted; tapping one opens its
// picture with quantity, price and stock. Fake backend.   Run from the repo root:  node astroman/tools/check-ordcard.mjs
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const { chromium } = await import('playwright');
const cat = [['111', 'მთვარის სანათი', 'სანათები', 5, 1, 9, 32], ['222', 'Foreseen 80/600 ტელესკოპი დიდი სახელით', 'ტელესკოპი', 4, 1, 160, 499], ['333', 'Visionking Telescope', 'ტელესკოპი', 2, 1, 66, 238]]
  .map(([b, n, c, q, min, cost, price]) => ({ c: 'catalog', id: b, d: { b, n, cat: c, q, qs: q, min, cost, price, sold: 3, img: null, hidden: false, countedAt: '2026-11-06' } }));
const store = new Map(); cat.forEach(x => store.set('catalog/' + x.id, x));
let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('https://fake.backend.test/exec', r => {
  const body = JSON.parse(r.request().postData());
  const docs = () => [...store.values()];
  if (body.action === 'pos_since') return r.fulfill({ json: { docs: docs(), keys: [...store.keys()], at: Date.now(), pos: { users: [{ id: 'u1', name: 'Irakli Beridze', pin: '' }] } } });
  if (body.action === 'pos_write' || body.action === 'write') { body.ops.forEach(o => store.set(o.c + '/' + o.id, { c: o.c, id: o.id, d: o.op === 'patch' ? { ...(store.get(o.c + '/' + o.id) || {}).d, ...o.d } : o.d })); return r.fulfill({ json: { ok: true, n: body.ops.length } }); }
  if (body.action === 'all') return r.fulfill({ json: { docs: docs().concat([{ c: 'cfg', id: 'main', d: { fx: 2.7, regFrom: '2026-01', pos: { users: [] } } }]), at: Date.now() } });
  if (body.action === 'since') return r.fulfill({ json: { docs: docs(), keys: [...store.keys()], at: Date.now() } });
  return r.fulfill({ json: { error: 'mock' } });
});
await page.route('**/wp-content/uploads/**', r => r.abort());
const link = Buffer.from(JSON.stringify({ u: 'https://fake.backend.test/exec', k: 'k' })).toString('base64');
const reg = 'file://' + path.join(root, 'store/index.html');
const mars = 'file://' + path.join(root, 'index.html');
const W = 390;
const fit = () => page.evaluate(w => {
  const over = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || r.right <= w + 1) return false; const cs = getComputedStyle(e); if (cs.position === 'fixed' && cs.visibility === 'hidden') return false; let p = e.parentElement; while (p && p !== document.body && p !== document.documentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false; p = p.parentElement; } return true; });
  return { sw: document.documentElement.scrollWidth, over: over.filter(e => !over.includes(e.parentElement)).slice(0, 5).map(e => e.tagName + '.' + String(e.className).slice(0, 24) + '→' + Math.round(e.getBoundingClientRect().right)) };
}, W);
const taps = (scope) => page.evaluate(sc => [...document.querySelectorAll(sc + ' button,' + sc + ' select,' + sc + ' input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 34 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.tablewrap'); }).slice(0, 5).map(e => (e.tagName + '.' + e.className).slice(0, 26) + ':' + Math.round(e.getBoundingClientRect().height) + ' ' + e.textContent.trim().slice(0, 16)), scope);



// tiny coloured squares as product pictures
const sq = c => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${c}"/><circle cx="100" cy="100" r="60" fill="#fff" opacity=".6"/></svg>`);
store.get('catalog/222').d.img = sq('#2B4BB5'); store.get('catalog/111').d.img = sq('#F5A623');
const now = new Date().toISOString();
store.set('pos/d1', { c: 'pos', id: 'd1', d: { id: 'd1', src: 'mars', ch: 'wolt', at: now, day: now.slice(0, 10), no: 71, total: 563, pay: 'wolt', status: 'ok', paid: true, user: { name: 'Mars' }, lines: [{ b: '222', n: 'Foreseen 80/600 ტელესკოპი დიდი სახელით', q: 1, p: 499 }, { b: '111', n: 'მთვარის სანათი', q: 2, p: 32 }], dl: { name: 'მანანა დვალიშვილი', phone: '599214240', addr: 'ბარნოვის ქ. 51, მაღაზია „ოდრი“', st: 'new', seen: { at: now, by: 'Irakli' } } } });
store.set('pos/d2', { c: 'pos', id: 'd2', d: { id: 'd2', src: 'mars', ch: 'delivery', at: now, day: now.slice(0, 10), no: 72, total: 248, ship: 10, pay: 'cod', status: 'ok', paid: false, user: { name: 'Mars' }, lines: [{ b: '333', n: 'Visionking Telescope', q: 1, p: 238 }], dl: { name: 'ანი ღვედაშვილი', phone: '592180471', addr: 'სიღნაღი, წნორი', st: 'ready', seen: { at: now, by: 'Irakli' } } } });
await page.goto(reg + '#connect=' + link);
await page.waitForSelector('[data-login-go]'); await page.click('[data-login-go]');
const oc = await page.waitForSelector('#ocGo', { timeout: 5000 }).catch(() => null); if (oc) { await page.fill('#oc', '40').catch(() => {}); await page.click('#ocGo'); }
await page.waitForSelector('.card');
await page.evaluate(() => { P.view = 'orders'; render(); }); await page.waitForSelector('.oprod');
check('each order shows a product box', await page.locator('.ord .oprods').count() === 2);
const geo = await page.evaluate(() => { const o = document.querySelector('.ord'); const i = o.querySelector('.oinfo').getBoundingClientRect(), p = o.querySelector('.oprods').getBoundingClientRect(); return { infoRight: i.right, prodLeft: p.left }; });
check('products sit to the right of the customer details', geo.prodLeft >= geo.infoRight - 1, geo);
check('product pictures shown', await page.locator('.oprod img').count() === 2);
check('quantity above 1 is marked', /× 2/.test(await page.textContent('.opq.many')));
check('order type colour stripe', await page.evaluate(() => getComputedStyle(document.querySelector('.ord.ch-wolt')).borderLeftWidth) === '6px');
await page.screenshot({ path: '/tmp/ordcard-desktop.png' });
await page.click('.oprod >> nth=0');  await page.waitForSelector('.ppic img');
const t = await page.textContent('#modalRoot');
check('tapping a product opens its picture with qty, price, stock', /Foreseen/.test(t) && /499/.test(t) && /მაღაზიაში/.test(t) && /საწყობში/.test(t), t.slice(0, 200));
await page.waitForTimeout(800); await page.screenshot({ path: '/tmp/ordcard-pic.png' });
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
check('→ key shows the second product', /მთვარის/.test(await page.textContent('#modalRoot h3')));
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
const pw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.querySelector('.oprods').getBoundingClientRect().width }));
check('phone: product box full width, no sideways scroll', pw.sw <= 390 && pw.w > 300, pw);
await page.screenshot({ path: '/tmp/ordcard-phone.png' });
check('no page errors', !errors.length, errors);
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
