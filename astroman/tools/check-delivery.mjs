// Delivery-order test: register takes an online order (paste → phone/address filled, delivery fee, courier cash),
// it appears on the orders board, moves through the statuses and gets paid; a repeat customer is recognised by phone;
// Mars builds a register month from these records and shows the open order. Fake backend, no real data.
// Run from the repo root:  node astroman/tools/check-delivery.mjs   (screenshots go to /tmp/mars-*.png)
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const { chromium } = await import('playwright');
const cat = [['111', 'მთვარის სანათი', 'სანათები', 5, 1, 9, 32], ['222', 'Foreseen 80/600', 'ტელესკოპი', 4, 1, 160, 499], ['333', 'Visionking Telescope', 'ტელესკოპი', 2, 1, 66, 238]]
  .map(([b, n, c, q, min, cost, price]) => ({ c: 'catalog', id: b, d: { b, n, cat: c, q, qs: q, min, cost, price, sold: 3, img: null, hidden: false, countedAt: '2026-11-06' } }));
const store = new Map();
cat.forEach(x => store.set('catalog/' + x.id, x));
// an old shift left open two days ago on this device id
let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const writes = [];
await page.route('https://fake.backend.test/exec', r => {
  const body = JSON.parse(r.request().postData());
  const docs = () => [...store.values()];
  if (body.action === 'pos_since') return r.fulfill({ json: { docs: docs().map(x => ({ ...x, d: { ...x.d, cost: undefined } })), keys: [...store.keys()], at: Date.now(), pos: { users: [{ id: 'u1', name: 'Irakli', pin: '' }] } } });
  if (body.action === 'pos_write' || body.action === 'write') { body.ops.forEach(o => { writes.push(o); store.set(o.c + '/' + o.id, { c: o.c, id: o.id, d: o.op === 'patch' ? { ...(store.get(o.c + '/' + o.id) || {}).d, ...o.d } : o.d }) }); return r.fulfill({ json: { ok: true, n: body.ops.length } }); }
  if (body.action === 'all') return r.fulfill({ json: { docs: docs().concat([{ c: 'cfg', id: 'main', d: { fx: 2.7, pos: { users: [] } } }]), at: Date.now() } });
  if (body.action === 'since') return r.fulfill({ json: { docs: docs(), keys: [...store.keys()], at: Date.now() } });
  return r.fulfill({ json: { error: 'mock' } });
});
await page.route('**/wp-content/uploads/**', r => r.abort());
const link = Buffer.from(JSON.stringify({ u: 'https://fake.backend.test/exec', k: 'k' })).toString('base64');
const reg = 'file://' + path.join(root, 'store/index.html');

// --- a shift left open yesterday is closed at 20:30 of that day before today's opens
await page.goto(reg + '#connect=' + link);
await page.waitForSelector('[data-login-go]');
const dev = await page.evaluate(() => localStorage.getItem('pos.device'));
const y = new Date(Date.now() - 864e5); const yIso = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 11, 5).toISOString();
const yDay = yIso.slice(0, 10);
store.set('shift/s_old', { c: 'shift', id: 's_old', d: { id: 's_old', user: { id: 'u1', name: 'Irakli' }, device: dev, day: new Date(y.getFullYear(), y.getMonth(), y.getDate()).toLocaleDateString('sv'), openedAt: yIso, openCash: 40, moves: [], closedAt: null } });
await page.reload(); await page.waitForTimeout(800);
await page.click('[data-login-go]');
const stale = await page.waitForSelector('#scGo', { timeout: 5000 }).catch(() => null);
check('stale shift: asks to close yesterday\'s open shift', !!stale);
if (stale) { await page.fill('#sc', '40'); await page.click('#scGo'); await page.waitForSelector('#ocGo'); await page.click('#ocGo'); }
await page.waitForTimeout(400);
const oldS = store.get('shift/s_old').d;
check('stale shift: closed at 20:30 of its own day', oldS.closedAt && new Date(oldS.closedAt).getHours() === 20 && new Date(oldS.closedAt).getMinutes() === 30 && new Date(oldS.closedAt).getDate() === y.getDate(), oldS.closedAt);

// --- delivery order: paste a customer message
await page.waitForSelector('.card');
await page.click('.card[data-add="222"]'); await page.click('[data-act="pay"]'); await page.waitForSelector('#cash');
await page.click('[data-act="dlTog"]'); await page.waitForSelector('#dlPaste');
await page.fill('#dlPaste', 'გამარჯობა, ტელესკოპი მინდა\nმანანა დვალიშვილი\nბარნოვის ქ. 51, მაღაზია ოდრი\n+995 599 21 42 40');
const f = await page.evaluate(() => ({ ph: $('#dlPhone').value, nm: $('#dlName').value, ad: $('#dlAddr').value, tot: $('#payTot').textContent }));
check('paste fills phone', f.ph.replace(/\D/g, '') === '599214240', f);
check('paste fills name', f.nm === 'მანანა დვალიშვილი', f);
check('paste fills address', f.ad.includes('ბარნოვის'), f);
check('delivery fee 10 ₾ added to the total', f.tot.replace(/[^\d.]/g, '') === '509.00', f);
await page.click('[data-method="cod"]'); await page.waitForTimeout(150);
check('courier cash needs no drawer cash', await page.evaluate(() => $('#cash').disabled && !$('[data-act="confirm"]').disabled));
await page.screenshot({ path: '/tmp/mars-register-pay.png' });
await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(600);
const sale = writes.filter(o => o.c === 'pos').map(o => o.d).find(d => d.dl);
check('sale saved with delivery block', sale && sale.dl.phone === '599214240' && sale.dl.st === 'new' && sale.ship === 10 && sale.total === 509 && sale.paid === false && sale.pay === 'cod', sale);

// --- orders board
await page.click('.done [data-act="orders"]'); await page.waitForSelector('.ord');
check('orders board lists it', (await page.locator('.ord').count()) === 1);
check('header shows open orders count', (await page.locator('[data-act="orders"] .n').first().textContent()) === '1');
await page.click('[data-act="dlStep"]'); await page.waitForTimeout(150);
await page.click('[data-act="dlStep"]'); await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/mars-register-orders.png', fullPage: true });
let cur = () => [...store.values()].find(x => x.c === 'pos' && x.d.dl)?.d;
await page.waitForTimeout(700);
check('status moves new → ready → with courier', cur().dl.st === 'out' && cur().dl.log.length === 3, cur().dl);
await page.click('[data-act="dlStep"]'); await page.waitForTimeout(150);
check('still open while unpaid after delivery', (await page.locator('.ord').count()) === 1);
await page.click('[data-act="dlPaid"]'); await page.waitForTimeout(800);
check('paid + delivered leaves the open list', (await page.locator('.ord').count()) === 0 && cur().paid === true && !!cur().paidAt, cur());

// --- repeat customer by phone
await page.click('[data-act="back"]'); await page.waitForSelector('.card');
await page.click('.card[data-add="111"]'); await page.click('[data-act="pay"]'); await page.click('[data-act="dlTog"]');
await page.type('#dlPhone', '599 21 42 40'); await page.waitForTimeout(200);
const k = await page.evaluate(() => ({ nm: $('#dlName').value, ad: $('#dlAddr').value, known: $('#dlKnown').textContent }));
check('repeat customer: name + address filled from phone', k.nm === 'მანანა დვალიშვილი' && k.ad.includes('ბარნოვის') && k.known.includes('1 შეკვეთა'), k);
// missing address is refused
await page.fill('#dlAddr', ''); await page.evaluate(() => { P.pay.dl.addr = '' });
await page.click('[data-method="pending"]'); await page.click('[data-act="confirm"]'); await page.waitForTimeout(200);
check('no address → not saved, error shown', (await page.locator('.done').count()) === 0 && (await page.locator('#dlErr').textContent()).length > 0);
await page.fill('#dlAddr', 'გაიტანს'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(600);

// --- plain shop sale still works and is not a delivery
await page.click('[data-act="newSale"]'); await page.click('.card[data-add="333"]'); await page.click('[data-act="pay"]');
await page.click('[data-method="pos"]'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(600);
const shop = [...store.values()].find(x => x.c === 'pos' && x.d.total === 238)?.d;
check('shop sale: no delivery block, paid', shop && !shop.dl && shop.paid === true, shop);

// --- Mars: the register month and the open order
const mars = 'file://' + path.join(root, 'index.html');
await page.goto(mars + '#connect=' + link);
await page.waitForFunction(() => typeof S !== 'undefined' && S.pos && S.pos.size >= 3, null, { timeout: 30000 }).catch(() => {});
const mk = await page.evaluate(() => { S.cfg = { ...S.cfg, regFrom: today().slice(0, 7) }; schedule(); const m = today().slice(0, 7); const d = S.sales.get(m); return d && { virtual: d.virtual, n: d.rows.length, a: d.rows.reduce((x, r) => x + r.a, 0), unpaid: d.rows.filter(r => !r.paid).length, cs: d.rows.map(r => r.c) } });
check('Mars builds this month from the register', mk && mk.virtual && mk.n === 3 && mk.a === 509 + 32 + 10 + 238, mk);
await page.evaluate(() => { S.month = today().slice(0, 7); go('overview') }); await page.waitForTimeout(800);
const att = await page.evaluate(() => document.body.innerText.includes('delivery order'));
check('Mars overview lists the open delivery order', att);
await page.screenshot({ path: '/tmp/mars-overview.png' });
await page.evaluate(() => go('sales')); await page.waitForTimeout(600);
check('Mars sales page says it comes from the register', await page.evaluate(() => document.body.innerText.includes('From the store register')));
await page.screenshot({ path: '/tmp/mars-sales.png' });
check('no page errors', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
