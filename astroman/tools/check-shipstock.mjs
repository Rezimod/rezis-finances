// Shipments: delete a product from a shipment, and "Arrived" puts the goods in stock (warehouse or store, per line or all at once),
// with an Undo. Fake backend, no real data.
// Run from the repo root:  node astroman/tools/check-shipstock.mjs
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const { chromium } = await import('playwright');
const store = new Map();
const put = (c, id, d) => store.set(c + '/' + id, { c, id, d });
put('cfg', 'main', { fx: 2.7, regFrom: '2026-01' });
put('catalog', 'N079244', { b: 'N079244', n: 'Lexus ჯიპის მოდელი 1:24', cat: 'სათამაშო', qs: 2, qw: 3, price: 44, cost: 10, countedAt: '2026-11-01' });
put('catalog', 'W15756', { b: 'W15756', n: 'BMW M3 მანქანა', cat: 'სათამაშო', qs: 0, qw: 0, price: 27, cost: 5, countedAt: '2026-11-01' });
put('ships', 'o1', { kind: 'order', supplier: '1688', date: '2026-10-28', cur: 'USD', fx: 2.7, paid: true, shipId: 's1', lines: [
  { n: 'პლანეტების ჭიქები', q: 15, p: 3.5, w: 0 }, { n: 'Lexus ჯიპის მოდელები', q: 13, p: 3.85, w: 0, sku: 'N079244' },
  { n: 'ბოქსის ელექტრონული სამიზნე', q: 1, p: 7, w: 0 }, { n: 'BMW M3', q: 5, p: 1.2, w: 0, sku: 'W15756' } ] });
put('ships', 's1', { forwarder: 'Silkpost', mode: 'land', origin: 'China', date: '2026-10-31', shippedAt: '2026-11-03', customsAt: '2026-11-27', status: 'customs', freight: 91, freightCur: 'USD', freightFx: 2.7, basis: 'qty' });
let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const page = await b.newPage({ viewport: { width: 1300, height: 950 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('https://fake.backend.test/exec', r => {
  const body = JSON.parse(r.request().postData());
  if (body.action === 'write') { body.ops.forEach(o => { const k = o.c + '/' + o.id; if (o.op === 'delete') store.delete(k); else store.set(k, { c: o.c, id: o.id, d: o.op === 'patch' ? { ...(store.get(k) || {}).d, ...o.d } : o.d }); }); return r.fulfill({ json: { ok: true, n: body.ops.length } }); }
  if (body.action === 'all' || body.action === 'since') return r.fulfill({ json: { docs: [...store.values()], keys: [...store.keys()], at: Date.now() } });
  return r.fulfill({ json: { error: 'mock' } });
});
await page.route('**/wp-content/uploads/**', r => r.abort());
const link = Buffer.from(JSON.stringify({ u: 'https://fake.backend.test/exec', k: 'k' })).toString('base64');
await page.goto('file://' + path.join(root, 'index.html') + '#connect=' + link);
await page.waitForFunction(() => typeof S !== 'undefined' && S.ships && S.ships.size >= 2 && S.catalog && S.catalog.size >= 2, null, { timeout: 30000 });
const open = async () => { await page.evaluate(() => { S.animate = false; impState().ship = 's1'; go('imports'); }); await page.waitForSelector('[data-rmline]'); };
await open();
const d = (c, id) => (store.get(c + '/' + id) || {}).d;
check('every product row has a delete button', await page.locator('[data-rmline]').count() === 4);

// delete: first tap asks, second deletes; the row click (link window) does not open
await page.click('[data-rmline="2"]');
await page.locator('.stepper').scrollIntoViewIfNeeded(); await page.screenshot({ path: '/tmp/ship-delete.png' });
check('first tap asks to confirm', (await page.textContent('[data-rmline="2"]')).includes('Delete?') && !(await page.isVisible('#wlQ')));
await page.click('[data-rmline="2"]'); await page.waitForTimeout(500);
check('second tap deletes the line from its order', d('ships', 'o1').lines.length === 3 && !d('ships', 'o1').lines.some(l => /ბოქსის/.test(l.n)), d('ships', 'o1').lines.map(l => l.n));
await page.waitForFunction(() => document.querySelectorAll('[data-rmline]').length === 3);
check('shipment now shows 3 products', await page.locator('[data-rmline]').count() === 3);
check('the link window did not open', !(await page.isVisible('#wlQ')));

// arrived → stock window opens by itself
await page.click('.stepper [data-v="arrived"]'); await page.waitForSelector('[data-skall]', { timeout: 5000 });
check('marking Arrived opens “Put the shipment in stock”', await page.isVisible('[data-act="st_stockGo"]'));
check('linked products are matched already', (await page.inputValue('[data-sk="1"]')).includes('N079244') && (await page.inputValue('[data-sk="2"]')).includes('W15756'), [await page.inputValue('[data-sk="1"]'), await page.inputValue('[data-sk="2"]')]);
check('default is the warehouse', await page.inputValue('[data-skw="0"]') === 'qw');
await page.click('[data-skall="qs"]');
check('“Store” sets every line to the store', (await page.$$eval('[data-skw]', a => a.map(x => x.value))).every(v => v === 'qs'));
await page.selectOption('[data-skw="2"]', 'qw');   // BMW to the warehouse
await page.fill('[data-skq="0"]', '14');            // one cup broke
await page.waitForTimeout(600); check('the Store button shows as chosen', await page.getAttribute('[data-skall="qs"]', 'aria-pressed') === 'true' && await page.getAttribute('[data-skall="qw"]', 'aria-pressed') === 'false'); await page.screenshot({ path: '/tmp/ship-stock-modal.png' });
await page.click('[data-act="st_stockGo"]'); await page.waitForTimeout(700);
const lex = d('catalog', 'N079244'), bmw = d('catalog', 'W15756');
check('Lexus: 13 added to the store (2 → 15)', lex.qs === 15 && lex.qw === 3, { qs: lex.qs, qw: lex.qw });
check('BMW: 5 added to the warehouse', bmw.qw === 5 && bmw.qs === 0 && !!bmw.qwT, { qs: bmw.qs, qw: bmw.qw });
const cups = [...store.values()].find(x => x.c === 'catalog' && /პლანეტების/.test(x.d.n));
check('unlinked cups become a new product with 14 in the store', cups && cups.d.qs === 14 && cups.d.price > 0, cups && cups.d);
check('shipment remembers it is in stock', !!(d('ships', 's1').stocked && d('ships', 's1').stocked.lines.length === 3));
await page.waitForSelector('.stockbar'); await page.waitForTimeout(300);
const bar = await page.textContent('.stockbar');
check('banner: in stock · 5 to the warehouse · 27 to the store', /In stock/.test(bar) && /5 pcs to the warehouse/.test(bar) && /27 pcs to the store/.test(bar), bar);
// stepping back is blocked while in stock
await page.click('.stepper [data-v="customs"]'); await page.waitForTimeout(400);
check('cannot step back while the goods are in stock', d('ships', 's1').status === 'arrived');
// undo
await page.click('[data-act="shipUnstock"]'); await page.click('[data-act="shipUnstock"]'); await page.waitForTimeout(800);
check('Undo takes the pieces back out', d('catalog', 'N079244').qs === 2 && d('catalog', 'W15756').qw === 0 && !d('ships', 's1').stocked, { lex: d('catalog', 'N079244').qs, bmw: d('catalog', 'W15756').qw });
await page.waitForSelector('[data-act="shipStock"]');
check('after Undo the “Put in stock” button is back', await page.isVisible('[data-act="shipStock"]'));
check('no page errors', !errors.length, errors);
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
