// Mars smoke test: syntax of both apps, then (if Playwright is installed) a quick run of the register and the
// finance desk against a fake backend with a small synthetic catalog. Run from the repo root:  node astroman/tools/check.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + name); if (!ok) fails++; };
for (const f of ['index.html', 'store/index.html']) {
  const s = fs.readFileSync(path.join(root, f), 'utf8'); const m = s.match(/<script>([\s\S]*)<\/script>/);
  try { new Function(m[1]); check('syntax ' + f, true); } catch (e) { check('syntax ' + f + ': ' + e.message, false); }
}
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { console.log('skip  playwright not installed (npm i playwright && npx playwright install chromium)'); }
if (chromium) {
  const cat = [['111', 'მთვარის სანათი', 'სანათები', 5, 1, 9, 32, ''], ['222', '3D კალამი', 'საბავშვო', 11, 1, 22, 79, ''], ['333', 'Visionking Telescope', 'ტელესკოპი', 2, 1, 66, 238, '']]
    .map(([b, n, cat, q, min, cost, price, vat]) => ({ c: 'catalog', id: b, d: { b, n, cat, q, qs: q, min, cost, price, vat, sold: 3, img: null, hidden: false, countedAt: '2026-11-06' } }));
  let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
  const page = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const writes = [];
  await page.route('https://fake.backend.test/exec', r => { const body = JSON.parse(r.request().postData());
    if (body.action === 'pos_since') return r.fulfill({ json: { docs: body.t ? [] : cat.map(x => ({ ...x, d: { ...x.d, cost: undefined } })), keys: cat.map(x => 'catalog/' + x.id), at: Date.now(), pos: { users: [{ id: 'u1', name: 'Test', pin: '' }] } } });
    if (body.action === 'pos_write') { writes.push(...body.ops); return r.fulfill({ json: { ok: true, n: body.ops.length } }); }
    if (body.action === 'all') return r.fulfill({ json: { docs: cat.concat([{ c: 'cfg', id: 'main', d: { fx: 2.7, pos: { users: [] } } }, { c: 'optimo', id: 'stock', d: { kind: 'stock', at: '2026-11-06T00:00:00.000Z', file: 'StockItems.xlsx', items: cat.map(x => [x.id, x.d.n, x.d.cat, x.d.q, 1, x.d.cost, x.d.price, '']) } }]), at: Date.now() } });
    if (body.action === 'since') return r.fulfill({ json: { docs: [], keys: cat.map(x => 'catalog/' + x.id), at: Date.now() } });
    if (body.action === 'write') { writes.push(...body.ops); return r.fulfill({ json: { ok: true, n: body.ops.length } }); }
    return r.fulfill({ json: { error: 'mock' } }); });
  await page.route('**/wp-content/uploads/**', r => r.abort());
  const link = Buffer.from(JSON.stringify({ u: 'https://fake.backend.test/exec', k: 'k' })).toString('base64');
  // register: log in, add a product, pay cash
  await page.goto('file://' + path.join(root, 'store/index.html') + '#connect=' + link);
  await page.waitForSelector('[data-login-go]'); await page.click('[data-login-go]');
  await page.waitForSelector('#ocGo'); await page.click('#ocGo');
  await page.waitForSelector('.card'); check('register shows the catalog', (await page.locator('.card').count()) === 3);
  await page.click('.card[data-add="222"]'); await page.click('[data-act="pay"]'); await page.waitForSelector('#cash');
  await page.click('[data-act="exact"]'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done');
  await page.waitForTimeout(500); check('register saves a sale', writes.some(o => o.c === 'pos' && o.d.total === 79));
  // finance desk: products page renders the catalog
  await page.goto('file://' + path.join(root, 'index.html') + '#connect=' + link);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded && S.loaded.tx !== undefined && S.catalog && S.catalog.size === 3, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => go('products')); await page.waitForSelector('.pcard', { timeout: 15000 }).catch(() => {});
  check('finance desk shows product cards', (await page.locator('.pcard').count()) === 3);
  check('no page errors', errors.length === 0); if (errors.length) console.log(errors.slice(0, 3));
  await b.close();
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
