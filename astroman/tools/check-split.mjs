// Split payment: a shop sale paid partly in cash and partly by card/transfer. Hidden behind one small link on the
// pay screen; the cash part goes to the drawer, the rest to the terminal/bank, and Mars counts each part in its place.
// Run from the repo root:  node astroman/tools/check-split.mjs
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


const pos = () => [...store.values()].filter(x => x.c === 'pos').map(x => x.d);
await page.goto(reg + '#connect=' + link);
await page.waitForSelector('[data-login-go]'); await page.click('[data-login-go]');
const oc = await page.waitForSelector('#ocGo', { timeout: 5000 }).catch(() => null); if (oc) { await page.fill('#oc', '40').catch(() => {}); await page.click('#ocGo'); }
await page.waitForSelector('.card');
await page.click('.card[data-add="222"]'); await page.click('[data-act="pay"]'); await page.waitForSelector('#cash');
check('pay screen: normal methods shown, split is one small link', await page.isVisible('[data-method="cash"]') && await page.isVisible('[data-act="splitOn"]'));
await page.click('[data-act="splitOn"]'); await page.waitForSelector('.splitbox');
check('split mode: card buttons shown, confirm locked until cash typed', await page.isVisible('[data-split-card="pos"]') && await page.isDisabled('[data-act="confirm"]'));
await page.fill('#cash', '499'); await page.waitForTimeout(100);
check('cash equal to the whole sum is refused (that is a normal cash sale)', await page.isDisabled('[data-act="confirm"]'));
await page.fill('#cash', '200'); await page.waitForTimeout(100);
let t = await page.textContent('#splitSum');
check('summary: 200 cash + 299 terminal', /200/.test(t) && /299/.test(t) && /ტერმინალი/.test(t), t);
check('header shows the card part', (await page.textContent('.pay .hdr')).includes('299'));
await page.click('[data-split-card="bog"]'); await page.waitForTimeout(100);
check('switching the rest to BOG transfer keeps the cash typed', (await page.inputValue('#cash')) === '200' && /BOG/.test(await page.textContent('#splitSum')));
await page.screenshot({ path: '/tmp/split-pay.png' });
await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(400);
let o = pos().find(x => x.pay === 'split');
check('sale saved as split with both parts', o && o.parts && o.parts.cash === 200 && o.parts.bog === 299 && o.total === 499 && o.cash === 200, o && { pay: o.pay, parts: o.parts, cash: o.cash });
check('done screen names both parts', /ნაღდი 200/.test(await page.textContent('.done')) && /BOG/.test(await page.textContent('.done')));
const exp = await page.evaluate(() => shiftStats(openShift()));
check('drawer expects only the cash part (40 + 200)', exp.cashExpected === 240 && exp.by.bog === 299 && exp.by.cash === 200, { exp: exp.cashExpected, by: exp.by });
// the next sale starts normal again
await page.click('[data-act="newSale"]'); await page.click('.card[data-add="111"]'); await page.click('[data-act="pay"]'); await page.waitForSelector('#cash');
check('next sale starts as an ordinary payment', !(await page.isVisible('.splitbox')) && await page.isVisible('[data-method="cash"]'));
await page.click('[data-act="splitOn"]'); await page.click('[data-act="splitOff"]');
check('“✕ ერთი წესით” goes back to normal methods', await page.isVisible('[data-method="cash"]'));
// delivery channel: no split link
await page.click('[data-ch="delivery"]'); await page.waitForTimeout(100);
check('split link only for shop sales', !(await page.isVisible('[data-act="splitOn"]')));

// ---------------- Mars ----------------
store.set('cfg/main', { c: 'cfg', id: 'main', d: { fx: 2.7, regFrom: '2026-01', pos: { key: 'k' } } });
await page.goto(mars + '#connect=' + link);
await page.waitForFunction(() => typeof S !== 'undefined' && S.pos && S.pos.size >= 1, null, { timeout: 30000 });
const r = await page.evaluate(() => { const o = [...S.pos.values()].find(x => x.pay === 'split'); const m = o.day.slice(0, 7); S.mc = new Map(); const row = S.sales.get(m).rows.find(x => x.reg === o.id); const P = payCheck(m); return { label: payLabel(o), row: row && row.parts, checked: (P.match || []).concat(P.miss || []).filter(x => x.reg === o.id).map(x => [x.pay, x.a]) }; });
check('Mars shows “Cash 200 + BOG transfer 299”', /Cash 200/.test(r.label) && /BOG transfer 299/.test(r.label), r.label);
check('payment check looks for the 299 BOG part in the bank (not the 200 cash)', JSON.stringify(r.checked) === JSON.stringify([['bog', 299]]), r.checked);
await page.evaluate(() => { S.animate = false; go('store'); }); await page.waitForTimeout(2000);
const k = await page.evaluate(() => [...document.querySelectorAll('#main .kpi')].map(x => x.textContent.replace(/\s+/g, ' ')).find(x => /Cash taken/.test(x)));
check('Store page: cash taken counts only the cash part', /Cash taken ?200/.test(k) && /BOG transfer 299/.test(k), k);
// manager edits the cash part in Mars
await page.evaluate(() => orderModal([...S.pos.values()].find(x => x.pay === 'split').id)); await page.waitForSelector('#omSplitCash');
await page.fill('#omSplitCash', '250'); await page.click('[data-act="or_upd"]');
await page.waitForTimeout(500);
o = pos().find(x => x.pay === 'split');
check('Mars order window edits the cash part, rest follows', o.parts.cash === 250 && o.parts.bog === 249, o.parts);
check('no page errors', !errors.length, errors);
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
