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
const td = new Date(); const ym = td.toISOString().slice(0, 7); const kaM = ['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'][td.getMonth()];
const dm = () => td.getDate() + '.' + (td.getMonth() + 1);
const SHEETS = {
  main: [{ name: kaM, values: [[' ', '`', 'დამკვეთი', 'პროდუქტი', 'გადახდა', 'თარიღი', 'რაოდ', 'თანხა', 'მისამართი', 'ტელ', 'სტატუსი'],
    ['', '', 'ფილიალი', 'Visionking Telescope', 'ტერმინალი', dm(1), '1', '238', '', '', 'დასრულებული'],
    ['', '', 'ნინო ცინდელიანი', 'ვარსკვლავური რუკა ა2', 'საქართველოს ბანკი', dm(1), '1', '125', 'გაიტანს', '', 'დასრულებული'],
    ['', '', 'შალვა საზანდრიშვილი', 'Foreseen 70mm telescope', 'ჩასარიცხი', dm(1), '1', '365', 'ქარელი ბახტრიონის N80', '511444733', 'აღებული'],
    ['', '', 'wolt', 'მთვარის სანათი', 'Wolt', dm(1), '1', '32', '', '', 'გაუქმებული']] },
    { name: 'სკოლის ბაზები', values: [['დასახელება', 'ქალააქი', 'რაიონო', 'ტელეფონი', 'მეილი'], ['სკოლა 1', 'თბილისი', '', '599000001', 'a@b.c']] }],
  td: [{ name: '3', values: [['მაღაზიის სახელი', 'ქალაქი', 'მომხმარებელი', 'ტელეფონი', 'ასაღები თანხა', 'მისამართი', 'დროის შეზღუდვა', 'წონა', 'პროდუქტის დასახელება', 'სტატუსი'],
    ['ასტრომანი', 'თბილისი', 'გიორგი ნოზაძე', '599 000 810', '269', 'ჭავჭავაძის 75/9', '', '', 'Levitating Moon Lamp', 'ჩაბარებული'],
    ['სხვა მაღაზია', 'თბილისი', 'Someone Else', '599111222', '50', 'სადღაც 1', '', '', 'x', ''],
    ['ასტრომანი', 'თბილისი', 'გიორგი ნოზაძე', '599000810, 577000111', '0', 'ჭავჭავაძის 75/9', '', '', '', ''],
    ['ასტრომანი', 'თბილისი', '', '', '', '', '', '', '', '']] }]
};
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
  if (body.action === 'orders') return r.fulfill({ json: { sheets: SHEETS[body.sheetId] || SHEETS.main } });
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
await page.click('[data-ch="delivery"]'); await page.waitForSelector('#dlPaste');
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
check('sale saved with delivery block', sale && sale.ch === 'delivery' && sale.dl.phone === '599214240' && sale.dl.st === 'new' && sale.ship === 10 && sale.total === 509 && sale.paid === false && sale.pay === 'cod', sale);

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
await page.click('.card[data-add="111"]'); await page.click('[data-act="pay"]'); await page.click('[data-ch="delivery"]');
await page.type('#dlPhone', '599 21 42 40'); await page.waitForTimeout(200);
const k = await page.evaluate(() => ({ nm: $('#dlName').value, ad: $('#dlAddr').value, known: $('#dlKnown').textContent }));
check('repeat customer: name + address filled from phone', k.nm === 'მანანა დვალიშვილი' && k.ad.includes('ბარნოვის') && k.known.includes('1 შეკვეთა'), k);
// missing address is refused
await page.fill('#dlAddr', ''); await page.evaluate(() => { P.pay.dl.addr = '' });
await page.click('[data-method="pending"]'); await page.click('[data-act="confirm"]'); await page.waitForTimeout(200);
check('no address → not saved, error shown', (await page.locator('.done').count()) === 0 && (await page.locator('#dlErr').textContent()).length > 0);
await page.fill('#dlAddr', 'გაიტანს'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(600);

// --- online order picked up in the store: no address, no fee, its own steps
await page.click('[data-act="newSale"]'); await page.click('.card[data-add="111"]'); await page.click('[data-act="pay"]'); await page.click('[data-ch="delivery"]');
await page.click('[data-dlmode="pick"]'); await page.waitForTimeout(150);
check('pickup: no address field, no delivery fee', !(await page.$('#dlAddr')) && (await page.textContent('#payTot')).replace(/[^\d.]/g, '') === '32.00');
await page.fill('#dlPhone', '577123123'); await page.fill('#dlName', 'ელენე ხაგულაშვილი'); await page.click('[data-method="bog"]'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(600);
const pk = [...store.values()].find(x => x.c === 'pos' && x.d.dl && x.d.dl.pick)?.d;
check('pickup order saved: marked pickup, no fee', pk && pk.dl.addr === 'მაღაზიიდან გაიტანს' && pk.ship === 0 && pk.total === 32, pk && pk.dl);
await page.click('.done [data-act="orders"]'); await page.waitForSelector('.ord');
const pkc = await page.evaluate(() => [...document.querySelectorAll('.ord')].map(c => c.textContent).find(t => t.includes('ელენე')) || '');
check('board: pickup card says so, steps end in გაიტანა, no courier step', pkc.includes('მაღაზიიდან გაიტანს') && pkc.includes('გაიტანა') && !pkc.includes('კურიერმა'), pkc.slice(0, 160));
await page.click('[data-act="back"]');

// --- plain shop sale still works and is not a delivery
if (await page.$('[data-act="newSale"]')) await page.click('[data-act="newSale"]'); await page.waitForSelector('.card[data-add="333"]'); await page.click('.card[data-add="333"]'); await page.click('[data-act="pay"]');
await page.click('[data-method="pos"]'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(600);
const shop = [...store.values()].find(x => x.c === 'pos' && x.d.total === 238)?.d;
check('shop sale: no delivery block, paid, marked shop', shop && !shop.dl && shop.paid === true && shop.ch === 'shop', shop);
// Wolt: only the Wolt payment is offered, no address asked
await page.click('[data-act="newSale"]'); await page.click('.card[data-add="111"]'); await page.click('[data-act="pay"]');
await page.click('[data-ch="wolt"]'); await page.waitForTimeout(100);
const wm = await page.evaluate(() => ({ m: [...document.querySelectorAll('[data-method]')].map(b => b.dataset.method), addr: !!$('#dlAddr'), lbl: $('.chbar .chlbl').textContent }));
check('Wolt: only Wolt payment, no address, label says Wolt', wm.m.join() === 'wolt' && !wm.addr && wm.lbl.includes('Wolt'), wm);
await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(500);
check('Wolt sale saved as wolt', [...store.values()].some(x => x.c === 'pos' && x.d.ch === 'wolt' && x.d.pay === 'wolt' && !x.d.dl));
await page.screenshot({ path: '/tmp/mars-register-done.png' });

// --- Mars: the register month and the open order
const mars = 'file://' + path.join(root, 'index.html');
await page.goto(mars + '#connect=' + link);
await page.waitForFunction(() => typeof S !== 'undefined' && S.pos && S.pos.size >= 3, null, { timeout: 30000 }).catch(() => {});
const mk = await page.evaluate(() => { S.cfg = { ...S.cfg, regFrom: today().slice(0, 7) }; schedule(); const m = today().slice(0, 7); const d = S.sales.get(m); return d && { virtual: d.virtual, n: d.rows.length, a: d.rows.reduce((x, r) => x + r.a, 0), unpaid: d.rows.filter(r => !r.paid).length, cs: d.rows.map(r => r.c) } });
check('Mars builds this month from the register', mk && mk.virtual && mk.n === 5 && mk.a === 509 + 32 + 10 + 238 + 32 + 32, mk);
await page.evaluate(() => { S.month = today().slice(0, 7); go('overview') }); await page.waitForTimeout(800);
const att = await page.evaluate(() => document.body.innerText.includes('still to be paid'));
check('Mars overview lists the open delivery order', att);
await page.screenshot({ path: '/tmp/mars-overview.png' });
await page.evaluate(() => go('sales')); await page.waitForTimeout(600);
check('Mars sales page says it comes from the register', await page.evaluate(() => document.body.innerText.includes('From the store register')));
await page.screenshot({ path: '/tmp/mars-sales.png' });

// --- Mars: Orders page — type an order the Excel way
await page.evaluate(() => go('orders')); await page.waitForTimeout(400);
await page.evaluate(() => act('or_tab', { dataset: { v: 'new' } })); await page.waitForSelector('#ofPhone');
await page.click('[data-act="or_ch"][data-v="delivery"]');
await page.fill('#ofPaste', 'ლელა კვეკვეცია\nმარტვილის რაიონი სოფელი ბანძა\n511 14 39 52');
await page.fill('#ofQ', 'Vision'); await page.waitForSelector('#ofSug [data-act="or_add"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.selectOption('#ofPay', 'pending');
const ftot = await page.evaluate(() => $('#ofTot').textContent);
check('Mars form: paste fills, catalog price + 10 delivery', ftot.replace(/[^\d.]/g, '') === '248', ftot);
await page.setViewportSize({ width: 1366, height: 1500 }); await page.waitForTimeout(1300); await page.screenshot({ path: '/tmp/mars-order-form.png' }); await page.setViewportSize({ width: 1366, height: 860 });
await page.click('[data-act="or_save"]'); await page.waitForTimeout(1500);
console.log('   form says:', await page.evaluate(() => ($('#ofErr')||{}).textContent + ' | ' + ($('#toastRoot')||{}).textContent));
const mo = [...store.values()].find(x => x.c === 'pos' && x.d.src === 'mars')?.d;
check('Mars order saved as a register record with address', mo && mo.ch === 'delivery' && mo.dl.phone === '511143952' && mo.dl.addr.includes('ბანძა') && mo.total === 248 && mo.paid === false && mo.lines[0].b === '333', mo);
await page.evaluate(() => { S.of = ofNew({ ch: 'delivery' }); ofPaint() }); await page.click('[data-act="or_pick"][data-v="1"]'); await page.waitForTimeout(100);
check('Mars form: pickup hides address and fee', !(await page.$('#ofAddr')) && !(await page.$('#ofFee')));
await page.fill('#ofPhone', '577123123'); await page.fill('#ofQ', 'Vision'); await page.waitForSelector('#ofSug [data-act="or_add"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.click('[data-act="or_save"]'); await page.waitForTimeout(900);
const mp = [...store.values()].find(x => x.c === 'pos' && x.d.src === 'mars' && x.d.dl && x.d.dl.pick)?.d;
check('Mars pickup order saved without address or fee', mp && mp.total === 238 && mp.dl.addr === 'მაღაზიიდან გაიტანს', mp && [mp.total, mp.dl]);
// shop order: no address field, phone optional
await page.click('[data-act="or_ch"][data-v="shop"]'); await page.waitForTimeout(100);
check('Mars form: shop order has no address field', !(await page.$('#ofAddr')));
// --- customer base from the sheets
await page.evaluate(() => act('or_tab', { dataset: { v: 'customers' } })); await page.waitForTimeout(300);
await page.evaluate(() => { CUST_SOURCES.length = 0; CUST_SOURCES.push(['main', 'main'], ['td_2025_07', 'td']) });
await page.click('[data-act="or_rebuild"]'); await page.waitForTimeout(2500);
const cb = await page.evaluate(() => { const C = customers(); const g = C.find('599000810'); const alt = C.find('577000111'); const sh = C.find('511444733'); return { n: C.M.size, g: g && { n: g.n, o: g.o, a: g.a[0] }, alt: !!alt && alt.p === '599000810', sh: sh && sh.n, other: !!C.find('599111222'), school: !!C.find('599000001'), docs: custDocs().length } });
check('customer base: courier row, own shop only, 2 phones, schools skipped', cb.g && cb.g.n === 'გიორგი ნოზაძე' && cb.g.a.includes('ჭავჭავაძის') && cb.alt && cb.sh === 'შალვა საზანდრიშვილი' && !cb.other && !cb.school && cb.docs === 1, cb);
await page.waitForTimeout(1300); await page.screenshot({ path: '/tmp/mars-customers.png' });
// the register sees the customer base
await page.goto(reg); await page.waitForSelector('.card').catch(() => {}); await page.click('[data-login-go]').catch(() => {}); await page.waitForTimeout(800);
if (await page.$('#ocGo')) await page.click('#ocGo');
await page.waitForTimeout(400); for (let i = 0; i < 5 && await page.$('#blockRoot [data-ack]'); i++) { await page.click('#blockRoot [data-ack="seen"]'); await page.waitForTimeout(300); }
await page.click('.card[data-add="111"]'); await page.click('[data-act="pay"]'); await page.click('[data-ch="delivery"]'); await page.type('#dlPhone', '599000810'); await page.waitForTimeout(200);
const rk = await page.evaluate(() => ({ nm: $('#dlName').value, ad: $('#dlAddr').value }));
check('register: customer from the sheets fills name + address', rk.nm === 'გიორგი ნოზაძე' && rk.ad.includes('ჭავჭავაძის'), rk);
check('register: the Mars order is on the orders board', await page.evaluate(() => openOrders().some(o => o.src === 'mars')));
// --- import this month from the sheet
await page.goto(mars + '#connect=' + link); await page.waitForFunction(() => typeof S !== 'undefined' && S.pos && S.pos.size >= 3, null, { timeout: 30000 }).catch(() => {});
// a register sale matching the sheet's shop row (238) already exists from the test above
await page.evaluate(() => { S.month = today().slice(0, 7); go('orders'); act('or_tab', { dataset: { v: 'import' } }) }); await page.waitForTimeout(300);
await page.click('[data-act="or_impread"]'); await page.waitForSelector('[data-act="or_impgo"]', { timeout: 10000 }).catch(async () => console.log('   render:', await page.evaluate(() => { try { vOrders(); return 'ok ' + S.view + ' ' + S.ord.tab } catch (e) { return 'ERR ' + e.message } }), errors.slice(-2)));
const plan = await page.evaluate(() => { const I = S.imp.plan; return { add: I.add.map(r => r.c + ' ' + r.amt), pairs: I.pairs.length, conf: I.conflicts.length, attach: I.attach.length } });
check('import: matched sale not added twice; others added; cancelled-but-sold flagged', plan.pairs === 1 && plan.add.length === 2 && plan.conf === 1, plan);
await page.setViewportSize({ width: 1366, height: 1500 }); await page.waitForTimeout(1300); await page.screenshot({ path: '/tmp/mars-import.png' }); await page.setViewportSize({ width: 1366, height: 860 });
await page.click('[data-act="or_impgo"]'); await page.waitForTimeout(1500);
const imp = [...store.values()].filter(x => x.c === 'pos' && x.d.src === 'sheet').map(x => x.d);
check('import: sheet orders saved with address and status', imp.length === 2 && imp.some(o => o.dl && o.dl.phone === '511444733' && o.paid === false && o.dl.st === 'out' && o.ch === 'delivery'), imp.map(o => [o.total, o.ch, o.paid, o.dl && o.dl.st]));
await page.evaluate(() => act('or_tab', { dataset: { v: 'import' } })); await page.click('[data-act="or_impread"]'); await page.waitForTimeout(1500);
check('import twice adds nothing', await page.evaluate(() => S.imp.plan.add.length === 0));
// --- payment check: a BOG transfer order and an incoming bank payment
await page.evaluate(async () => { await S.db.doc('bankin/k1').set({ acct: 'bog', date: today(), gel: 125, party: 'NINO', desc: 'transfer', dir: 'in', cat: '' }); await S.db.doc('bankin/k2').set({ acct: 'bog', date: today(), gel: 77, party: 'SOMEONE', desc: 'transfer', dir: 'in', cat: '' }); await S.db.doc('bankin/k3').set({ acct: 'bog', date: today(), gel: 300, party: 'WOLT GEORGIA', desc: 'payout', dir: 'in', cat: '' }); S.cfg = { ...S.cfg, regFrom: today().slice(0, 7) }; schedule() });
await page.waitForTimeout(400);
const pc = await page.evaluate(() => { const R = payCheck(S.month); return { ord: R.ord.map(r => r.pay + ' ' + r.a), match: R.match.map(([r, t]) => r.a + '→' + t.gel), miss: R.miss.map(r => r.pay + ' ' + r.a), stray: R.stray.map(t => t.gel), plat: R.platform.map(t => t.gel) } });
check('payment check: transfer matched, card/pending missing, unexplained 77, Wolt payout apart, Wolt/cash orders not checked', pc.match.includes('125→125') && pc.stray.join() === '77' && pc.plat.join() === '300' && !pc.ord.some(x => /^(wolt|cash|personal|extra)/.test(x)), pc);
await page.evaluate(() => act('or_tab', { dataset: { v: 'pay' } })); await page.waitForTimeout(300);
await page.setViewportSize({ width: 1366, height: 1500 }); await page.waitForTimeout(1300); await page.screenshot({ path: '/tmp/mars-paycheck.png' }); await page.setViewportSize({ width: 1366, height: 860 });
await page.evaluate(() => act('or_tab', { dataset: { v: 'list' } })); await page.waitForTimeout(300);
const mid = [...store.values()].find(x => x.c === 'pos' && x.d.src === 'mars').id;
await page.evaluate(id => orderModal(id), mid); await page.waitForSelector('#oeLines [data-k="p"]');
await page.fill('#oeLines [data-oe="0"][data-k="q"]', '2'); await page.fill('#oeLines [data-oe="0"][data-k="p"]', '200'); await page.fill('#omFee', '15'); await page.selectOption('#omSt', 'ready'); await page.selectOption('#omPaid', '1');
await page.fill('#oeQ', 'მთვარ'); await page.waitForSelector('#oeSug [data-b]'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.click('[data-act="or_upd"]'); await page.waitForTimeout(900);
const ed = store.get('pos/' + mid).d;
check('Mars edits any order: qty, price, added product, fee, status, paid', ed.total === 2 * 200 + 32 + 15 && ed.lines.length === 2 && ed.dl.st === 'ready' && ed.paid === true && ed.ship === 15, [ed.total, ed.lines.length, ed.dl.st, ed.paid]);
const rid = [...store.values()].find(x => x.c === 'pos' && !x.d.src && x.d.ch === 'wolt').id;
await page.evaluate(id => orderModal(id), rid); await page.waitForSelector('#oeLines'); await page.fill('#oeLines [data-oe="0"][data-k="p"]', '35'); await page.click('[data-act="or_upd"]'); await page.waitForTimeout(900);
check('Mars edits a register sale too', store.get('pos/' + rid).d.total === 35);

// a Wolt price above the catalog: profit from the price really charged, and Wolt remembers it
await page.evaluate(() => { S.of = ofNew({ ch: 'wolt' }); S.ord.tab = 'new'; render() }); await page.waitForSelector('#ofQ');
await page.fill('#ofQ', 'Vision'); await page.waitForSelector('#ofSug [data-act="or_add"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.fill('[data-ofl="0"][data-k="p"]', '400'); await page.click('[data-act="or_save"]'); await page.waitForTimeout(900);
const wo = [...store.values()].find(x => x.c === 'pos' && x.d.src === 'mars' && x.d.ch === 'wolt')?.d;
const pr = await page.evaluate(id => { const o = S.pos.get(id); return { p: orderProfit(o).profit, note: priceNote(o.lines[0]) } }, wo && wo.id);
check('Wolt sale at 400 for a 238 telescope: profit from 400 minus its cost 66', wo && wo.total === 400 && pr.p === 334 && pr.note.includes('catalog'), pr);
await page.evaluate(() => { S.of = ofNew({ ch: 'wolt' }); render() }); await page.waitForSelector('#ofQ');
await page.fill('#ofQ', 'Vision'); await page.waitForSelector('#ofSug [data-act="or_add"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
check('next Wolt order: the telescope comes at the last Wolt price', (await page.inputValue('[data-ofl="0"][data-k="p"]')) === '400');
await page.evaluate(() => { S.cfg = { ...S.cfg, regFrom: today().slice(0, 7) }; S.month = today().slice(0, 7); schedule() }); await page.waitForTimeout(300);
const gm = await page.evaluate(() => { S.mc = new Map(); mergeRegisterSales(); const M = metrics(S.month); return { src: M.src, gross: Math.round(M.gross), sales: M.sales, ic: itemCogs(M.rows) } });
check('the month\'s profit is worked out from item costs at the prices charged', gm.src === 'items' && gm.gross > 0 && gm.gross < gm.sales, gm);
await page.evaluate(() => { S.ord.f.st = 'all'; render() }); await page.waitForTimeout(300);
await page.setViewportSize({ width: 1366, height: 1500 }); await page.waitForTimeout(1300); await page.screenshot({ path: '/tmp/mars-orders.png' }); await page.setViewportSize({ width: 1366, height: 860 });
check('no page errors', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
