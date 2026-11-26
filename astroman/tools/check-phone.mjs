// Phone test (iPhone-size 390×844, touch): the register and every Mars page fit the screen with no sideways scroll,
// buttons are big enough for a thumb, text is readable, order lists turn into cards, and the bottom tab bar
// steps aside while typing. Fake backend, no real data.
// Run from the repo root:  node astroman/tools/check-phone.mjs   (screenshots go to /tmp/phone-*.png)
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const { chromium } = await import('playwright');
const cat = [['111', 'მთვარის სანათი', 'სანათები', 5, 1, 9, 32], ['222', 'Foreseen 80/600 ტელესკოპი დიდი სახელით', 'ტელესკოპი', 4, 1, 160, 499], ['333', 'Visionking Telescope', 'ტელესკოპი', 2, 1, 66, 238]]
  .map(([b, n, c, q, min, cost, price]) => ({ c: 'catalog', id: b, d: { b, n, cat: c, q, qs: q, min, cost, price, sold: 3, img: null, hidden: false, countedAt: '2026-11-06' } }));
const store = new Map(); cat.forEach(x => store.set('catalog/' + x.id, x));
let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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

// ---------------- register ----------------
await page.goto(reg + '#connect=' + link);
await page.waitForSelector('[data-login-go]');
let f = await fit(); check('register login fits the phone width', f.sw <= W && !f.over.length, f);
await page.screenshot({ path: '/tmp/phone-reg-login.png' });
await page.click('[data-login-go]');
const oc = await page.waitForSelector('#ocGo', { timeout: 5000 }).catch(() => null); if (oc) { await page.fill('#oc', '40').catch(() => {}); await page.click('#ocGo'); }
await page.waitForSelector('.card'); await page.waitForTimeout(400);
f = await fit(); check('register sale screen fits', f.sw <= W && !f.over.length, f);
check('register header buttons all on screen', await page.evaluate(w => [...document.querySelectorAll('header.top button')].every(x => x.getBoundingClientRect().right <= w), W));
await page.screenshot({ path: '/tmp/phone-reg-sale.png' });
await page.click('.card[data-add="222"]'); await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/phone-reg-cart.png' });
await page.click('[data-act="pay"]'); await page.waitForSelector('#cash');
await page.click('[data-ch="delivery"]'); await page.waitForSelector('#dlPaste');
await page.fill('#dlPaste', 'მანანა დვალიშვილი\nბარნოვის ქ. 51\n+995 599 21 42 40'); await page.waitForTimeout(200);
f = await fit(); check('register pay screen (delivery) fits', f.sw <= W && !f.over.length, f);
await page.screenshot({ path: '/tmp/phone-reg-pay.png', fullPage: true });
await page.click('[data-method="cod"]').catch(() => {}); await page.waitForTimeout(150);
await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(500);
await page.click('.done [data-act="orders"]'); await page.waitForSelector('.ord');
f = await fit(); check('register orders board fits', f.sw <= W && !f.over.length, f);
await page.screenshot({ path: '/tmp/phone-reg-orders.png' });
await page.click('[data-act="menu"]'); await page.waitForTimeout(300);
f = await fit(); check('register menu fits', f.sw <= W && !f.over.length, f);
await page.screenshot({ path: '/tmp/phone-reg-menu.png' });

// ---------------- Mars ----------------
await page.goto(mars + '#connect=' + link);
await page.waitForFunction(() => typeof S !== 'undefined' && S.pos && S.pos.size >= 1, null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => { S.animate = false; });
const pages = ['overview', 'orders', 'sales', 'expenses', 'bank', 'pl', 'imports', 'loan', 'optimo', 'store', 'count', 'tools', 'settings', 'products', 'add'];
for (const p of pages) {
  await page.evaluate(p => go(p), p); await page.waitForTimeout(450);
  f = await fit(); check('Mars ' + p + ' fits the phone width', f.sw <= W && !f.over.length, f);
  const t = await taps('#main'); check('Mars ' + p + ' buttons ≥34px tall', !t.length, t);
  const tiny = await page.evaluate(() => [...document.querySelectorAll('#main *')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && el.getBoundingClientRect().width && parseFloat(getComputedStyle(el).fontSize) < 11.5 && !el.closest('svg,.pst,.tablewrap,.thumb,.tring')).slice(0, 4).map(el => el.tagName + '.' + el.className + '<' + el.parentElement.className + ':' + getComputedStyle(el).fontSize + ' ' + el.textContent.trim().slice(0, 12)));
  check('Mars ' + p + ' text ≥11.5px', !tiny.length, tiny);
}
await page.evaluate(() => go('orders')); await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/phone-mars-orders.png' });
const card = await page.evaluate(() => { const tr = document.querySelector('table.ordt tbody tr'); return tr ? getComputedStyle(tr).display : null; });
check('Mars orders list shows cards on phone', card === 'grid', card);
await page.evaluate(() => { const b = [...document.querySelectorAll('#main .tabs button')].find(b => /Customers/.test(b.textContent)); b && b.click(); }); await page.waitForTimeout(500);
check('Mars customers list shows cards on phone', await page.evaluate(() => { const tr = document.querySelector('table.custt tbody tr'); return tr && getComputedStyle(tr).display === 'grid'; }));
await page.screenshot({ path: '/tmp/phone-mars-customers.png' });
// typing hides the tab bar; leaving the field brings it back
await page.evaluate(() => go('add')); await page.waitForTimeout(500);
const inp = page.locator('#main input[type=text],#main input:not([type]),#main input[inputmode]').first();
await inp.focus(); await page.waitForTimeout(150);
check('tab bar hides while typing', await page.evaluate(() => document.documentElement.classList.contains('typing') && getComputedStyle($('#tabbar')).display === 'none'));
await inp.evaluate(e => e.blur()); await page.waitForTimeout(250);
check('tab bar comes back after typing', await page.evaluate(() => !document.documentElement.classList.contains('typing') && getComputedStyle($('#tabbar')).display !== 'none'));
const tb = await page.evaluate(() => { const r = $('#tabbar').getBoundingClientRect(); return { bottom: Math.round(r.bottom), h: innerHeight }; });
check('tab bar sits on the bottom edge', Math.abs(tb.bottom - tb.h) <= 1, tb);
await page.evaluate(() => go('overview')); await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/phone-mars-overview.png' });

check('no page errors', !errors.length, errors);
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
