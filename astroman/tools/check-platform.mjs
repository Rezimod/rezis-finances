// Platform commission: Wolt, Glovo and Extra.ge keep 18% (changeable in Settings) of the goods on every order.
// It comes off each order's profit, and every month gets an automatic "Wolt · Glovo · Extra fees" line,
// topped up only by what was not already entered by hand. Fake backend, no real data.
// Run from the repo root:  node astroman/tools/check-platform.mjs
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const near = (a, b) => Math.abs(a - b) < 0.02;
const { chromium } = await import('playwright');
const m = new Date().toISOString().slice(0, 7), day = m + '-05';
const docs = [
  { c: 'catalog', id: '222', d: { b: '222', n: 'Foreseen 80/600', cat: 'ტელესკოპი', q: 4, cost: 200, price: 450 } },
  { c: 'catalog', id: '111', d: { b: '111', n: 'Moon lamp', cat: 'სანათები', q: 9, cost: 10, price: 40 } },
  // Wolt: sold at the platform price 400 → 18% = 72
  { c: 'pos', id: 'p1', d: { day, at: day + 'T10:00:00Z', ch: 'wolt', pay: 'wolt', total: 400, lines: [{ b: '222', n: 'Foreseen 80/600', q: 1, p: 400, d: 0 }], status: 'ok', src: 'mars' } },
  // Extra.ge with a 10 ₾ delivery fee: the share is taken from the goods only → 18% of 80 = 14.4
  { c: 'pos', id: 'p2', d: { day, at: day + 'T11:00:00Z', ch: 'extra', pay: 'extra', total: 90, ship: 10, lines: [{ b: '111', n: 'Moon lamp', q: 2, p: 40, d: 0 }], status: 'ok', src: 'mars' } },
  // shop sale: no commission
  { c: 'pos', id: 'p3', d: { day, at: day + 'T12:00:00Z', ch: 'shop', pay: 'card', total: 40, lines: [{ b: '111', n: 'Moon lamp', q: 1, p: 40, d: 0 }], status: 'ok' } },
  // voided Glovo order: ignored
  { c: 'pos', id: 'p4', d: { day, at: day + 'T13:00:00Z', ch: 'glovo', pay: 'glovo', total: 500, lines: [{ b: '222', n: 'Foreseen 80/600', q: 1, p: 500, d: 0 }], status: 'void', src: 'mars' } },
];
const store = new Map(docs.map(x => [x.c + '/' + x.id, x]));
store.set('cfg/main', { c: 'cfg', id: 'main', d: { fx: 2.7, regFrom: '2026-01', method: 'auto' } });
let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
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
await page.waitForFunction(() => typeof S !== 'undefined' && S.pos && S.pos.size >= 4 && S.sales && S.sales.size, null, { timeout: 30000 });
const ev = f => page.evaluate(f, m);

let r = await ev(m => { const M = metrics(m); const t = txOf(m).find(t => t.source === 'platform'); return { fee: M.by.platform_fees || 0, line: t && t.gel, note: t && t.note, p1: platFee(S.pos.get('p1')), p2: platFee(S.pos.get('p2')), p3: platFee(S.pos.get('p3')) }; });
check('Wolt order: 18% of 400 = 72', near(r.p1, 72), r);
check('Extra.ge order: 18% of the goods (80), not the delivery fee', near(r.p2, 14.4), r);
check('shop order pays no commission', r.p3 === 0, r);
check('month gets one automatic platform line (72 + 14.40, voided Glovo left out)', near(r.line, 86.4) && near(r.fee, 86.4), r);
check('the line says which orders it covers', /2 orders/.test(r.note || '') && /Wolt 1/.test(r.note || '') && /Extra/.test(r.note || ''), r.note);

r = await ev(m => { const P = orderProfit({ lines: S.pos.get('p1').lines, disc: 0 }, 'wolt'); const Q = orderProfit({ lines: S.pos.get('p3').lines, disc: 0 }, 'shop'); return { P, Q }; });
check('Wolt order profit = 400 − cost 200 − 72 = 128', near(r.P.profit, 128) && near(r.P.fee, 72), r.P);
check('shop order profit has no commission taken off', near(r.Q.profit, 30) && r.Q.fee === 0, r.Q);

r = await ev(m => { const M = metrics(m); return { net: M.net, opex: M.opex, gross: M.gross }; });
check('net profit includes the commission as a running cost', near(r.gross - r.opex, r.net) && r.opex >= 86.39, r);

// a Wolt invoice already entered for 50 → only the missing 36.40 is added
await ev(m => { S.tx.set('tw', { id: 'tw', month: m, date: m + '-20', cat: 'platform_fees', gel: 50, vendor: 'Wolt', account: 'bog' }); S.mc = new Map(); });
r = await ev(m => { const t = txOf(m).find(t => t.source === 'platform'); return { line: t && t.gel, total: metrics(m).by.platform_fees, note: t && t.note }; });
check('fees already entered count towards it (no double count)', near(r.line, 36.4) && near(r.total, 86.4), r);
await ev(m => { S.tx.get('tw').gel = 120; S.mc = new Map(); });
r = await ev(m => ({ line: txOf(m).some(t => t.source === 'platform'), total: metrics(m).by.platform_fees }));
check('when more was entered than 18%, nothing is added', !r.line && near(r.total, 120), r);
await ev(m => { S.tx.delete('tw'); S.mc = new Map(); });

// order modal shows the commission
await ev(() => orderModal('p1')); await page.waitForSelector('#omProfit');
const txt = await page.textContent('#omProfit');
check('order window shows the profit after the platform share', /128/.test(txt) && /18%/.test(txt) && /72/.test(txt), txt);
await page.selectOption('#omCh', 'shop'); await page.waitForTimeout(100);
check('switching the order to shop removes the commission', /200/.test(await page.textContent('#omProfit')) && !/18%/.test(await page.textContent('#omProfit')));
await page.keyboard.press('Escape');

// orders page KPI
await ev(() => { S.animate = false; go('orders'); }); await page.waitForTimeout(400);
const kpi = await page.evaluate(() => document.querySelector('#main .kpi .delta').textContent);
check('Orders page profit is after Wolt/Glovo/Extra', /after\s*86\.40/.test(kpi.replace(/,/g, '')) || /after/.test(kpi), kpi);

// settings: change Wolt to 15%
await ev(() => { go('settings'); }); await page.waitForSelector('[data-plat="wolt"]');
check('settings show 18% by default', await page.inputValue('[data-plat="wolt"]') === '18');
await page.fill('[data-plat="wolt"]', '15'); await page.click('[data-act="savePlat"]'); await page.waitForTimeout(400);
r = await ev(m => ({ cfg: S.cfg.platFee, p1: platFee(S.pos.get('p1')), line: txOf(m).find(t => t.source === 'platform').gel, saved: true }));
check('Wolt at 15% → 60 on the 400 order, month line 74.40', near(r.p1, 60) && near(r.line, 74.4) && r.cfg.wolt === 15 && r.cfg.extra === 18, r);
check('the rate is saved to the books', (store.get('cfg/main').d.platFee || {}).wolt === 15, store.get('cfg/main').d.platFee);
check('no page errors', !errors.length, errors);
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
