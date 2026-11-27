// Online orders take products off the store count: the store can go below zero, and a receipt from the warehouse
// brings it back. Typed lines are matched to products; unmatched ones are flagged; old orders can be linked afterwards.
// Fake backend, no real data.   Run from the repo root:  node astroman/tools/check-orderstock.mjs
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const { chromium } = await import('playwright');
const today = new Date(); const pad = n => String(n).padStart(2, '0');
const td = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
const m = td.slice(0, 7), d1 = m + '-01';
const store = new Map(); const put = (c, id, d) => store.set(c + '/' + id, { c, id, d });
put('cfg', 'main', { fx: 2.7, regFrom: m });
put('catalog', '1211', { b: '1211', n: 'FORESEEN 70mm Astronomical', cat: 'ტელესკოპი', qs: 1, qw: 4, price: 355, cost: 138, countedAt: d1 });
put('catalog', '7788371', { b: '7788371', n: '3D ხის პლანეტები', cat: 'სათამაშო', qs: 3, qw: 0, price: 45, cost: 15, countedAt: d1 });
// an imported order from the sheet whose product was typed, not linked
put('pos', 'old1', { src: 'sheet', ch: 'delivery', day: d1, at: d1 + 'T12:00:00.000Z', total: 45, lines: [{ b: null, n: '3D ხის პლანეტები', q: 1, p: 45 }], pay: 'cod', status: 'ok', dl: { name: 'ნინო', phone: '599111222', addr: 'ვაკე', st: 'done' } });
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
await page.waitForFunction(() => typeof S !== 'undefined' && S.catalog && S.catalog.size >= 2 && S.pos && S.pos.size >= 1, null, { timeout: 30000 });
const live = bc => page.evaluate(bc => catLive(S.catalog.get(bc)), bc);
check('starting store count: Foreseen 1, planets 3', await live('1211') === 1 && await live('7788371') === 3);

// the old typed order is flagged on the Orders page and can be linked
await page.evaluate(() => { S.animate = false; S.ord.tab = 'list'; go('orders'); }); await page.waitForTimeout(500);
check('Orders page flags the unlinked line', /1 product line in 1 order/.test(await page.textContent('#main')));
await page.click('[data-act="or_linkold"]'); await page.waitForSelector('[data-lo]');
check('the right product is guessed', (await page.inputValue('[data-lo="0"]')).includes('7788371'));
await page.click('[data-act="or_linkoldGo"]'); await page.waitForTimeout(600);
check('linked: planets come off the store (3 → 2)', await live('7788371') === 2 && store.get('pos/old1').d.lines[0].b === '7788371');

// new Wolt order: 2 × Foreseen with only 1 in the store
await page.evaluate(() => { S.ord.tab = 'new'; S.of = ofNew({ ch: 'wolt', pay: 'wolt' }); render(); }); await page.waitForSelector('#ofQ');
await page.fill('#ofQ', 'foreseen 70'); await page.waitForSelector('#ofSug [data-act="or_add"]');
await page.click('#ofSug [data-act="or_add"]'); await page.waitForTimeout(150);
await page.fill('[data-ofl="0"][data-k="q"]', '2'); await page.evaluate(() => ofPaint());
let t = await page.textContent('.oflines');
check('form shows the store count going below zero', /store 1 → -1/.test(t) && /below zero/.test(t), t);
// a typed name that matches a product exactly is linked by itself
await page.fill('#ofQ', '3D ხის პლანეტები'); await page.evaluate(() => act('or_addfree', $('#ofQ'))); await page.waitForTimeout(150);
check('typed exact name is linked automatically', await page.evaluate(() => S.of.lines[1] && S.of.lines[1].b === '7788371'));
// a made-up name: warned once, saved on the second press
await page.fill('#ofQ', 'სასაჩუქრე შეფუთვა'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.fill('[data-ofl="2"][data-k="p"]', '5');
check('typed unknown product shows “not linked to stock · pick”', await page.isVisible('[data-act="or_relink"]'));
await page.click('[data-act="or_save"]'); await page.waitForTimeout(300);
check('first Save warns it will not come off stock', /won't come off the store count/.test(await page.textContent('#ofErr')));
check('nothing saved yet', [...store.values()].filter(x => x.c === 'pos').length === 1);
await page.click('[data-act="or_save"]'); await page.waitForTimeout(600);
const saved = [...store.values()].filter(x => x.c === 'pos' && x.id !== 'old1').map(x => x.d);
check('second Save saves the order', saved.length === 1 && saved[0].lines.length === 3);
check('Foreseen store count is now -1 (1 − 2)', await live('1211') === -1);
check('planets 2 → 1', await live('7788371') === 1);

// pick for an unlinked line in the editor
const oid = await page.evaluate(() => [...S.pos.values()].find(o => o.src === 'mars').id);
await page.evaluate(id => orderModal(id), oid); await page.waitForSelector('[data-oelink]');
check('order window shows store counts and the unlinked line', /store -1/.test(await page.textContent('#oeLines')) && await page.isVisible('[data-oelink]'));
await page.keyboard.press('Escape');

// a receipt from the warehouse corrects the store
await page.evaluate(async () => { await S.db.doc('shift/rcv1').set({ kind: 'receive', from: 'wh', at: new Date().toISOString(), user: { name: 'Irakli' }, status: 'ok', lines: [{ b: '1211', n: 'FORESEEN 70mm Astronomical', q: 3 }] }); });
await page.waitForTimeout(500);
const wh = await page.evaluate(() => whQ(S.catalog.get('1211')));
check('receiving 3 from the warehouse: store -1 → 2, warehouse 4 → 1', await live('1211') === 2 && wh === 1, { store: await live('1211'), wh });
check('no page errors', !errors.length, errors);
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
