// Manager profile test (fake backend): a manager logs in without a shift prompt, rings up a sale, joins a
// consultant's open shift when there is one, and Mars keeps the role when the people list is saved.
// Run from the repo root:  node astroman/tools/check-manager.mjs
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : ' → ' + JSON.stringify(extra))); if (!ok) fails++; };
const { chromium } = await import('playwright');
const store = new Map();
[['111', 'მთვარის სანათი', 32], ['222', 'Foreseen 80/600', 499]].forEach(([b, n, price]) => store.set('catalog/' + b, { c: 'catalog', id: b, d: { b, n, cat: 'x', q: 5, qs: 5, price, cost: 1, img: null, hidden: false, countedAt: '2026-11-06' } }));
const users = [{ id: 'u1', name: 'Irakli', pin: '' }, { id: 'u9', name: 'ადმინი', pin: '', admin: true }];
let cfg = { fx: 2.7, pos: { users, key: 'pk' } };
let b; try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const page = await b.newPage({ viewport: { width: 1366, height: 860 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('https://fake.backend.test/exec', r => {
  const body = JSON.parse(r.request().postData()); const docs = () => [...store.values()];
  if (body.action === 'pos_since') return r.fulfill({ json: { docs: docs(), keys: [...store.keys()], at: Date.now(), pos: { users: cfg.pos.users } } });
  if (body.action === 'pos_write' || body.action === 'write') { body.ops.forEach(o => { if (o.c === 'cfg') cfg = o.d; else if (o.op === 'delete') store.delete(o.c + '/' + o.id); else store.set(o.c + '/' + o.id, { c: o.c, id: o.id, d: o.d }) }); return r.fulfill({ json: { ok: true } }); }
  if (body.action === 'all' || body.action === 'since') return r.fulfill({ json: { docs: docs().concat([{ c: 'cfg', id: 'main', d: cfg }]), keys: [...store.keys(), 'cfg/main'], at: Date.now() } });
  return r.fulfill({ json: { error: 'mock' } });
});
await page.route('**/wp-content/uploads/**', r => r.abort());
const link = Buffer.from(JSON.stringify({ u: 'https://fake.backend.test/exec', k: 'k' })).toString('base64');
const reg = 'file://' + path.join(root, 'store/index.html');
const sell = async (bc, method) => { await page.click(`.card[data-add="${bc}"]`); await page.click('[data-act="pay"]'); await page.click(`[data-method="${method}"]`); if (method === 'cash') await page.click('[data-act="exact"]'); await page.click('[data-act="confirm"]'); await page.waitForSelector('.done'); await page.waitForTimeout(500); await page.click('[data-act="newSale"]') };

// manager alone: no shift prompt, sale without a shift
await page.goto(reg + '#connect=' + link); await page.waitForSelector('[data-login="u9"]');
check('login screen marks the manager', (await page.textContent('[data-login="u9"]')).includes('მენეჯერი'));
await page.click('[data-login="u9"]'); await page.click('[data-login-go]'); await page.waitForTimeout(600);
check('manager: no shift prompt', !(await page.$('#ocGo')));
check('manager: header says manager, no shift', (await page.textContent('header')).includes('მენეჯერი') && (await page.textContent('header')).includes('ცვლის გარეშე'));
await page.waitForSelector('.card'); await sell('222', 'pos');
let s1 = [...store.values()].find(x => x.c === 'pos' && x.d.total === 499)?.d;
check('manager sale saved: manager, no shift', s1 && s1.mgr === true && s1.user.name === 'ადმინი' && s1.shift === null && s1.ch === 'shop', s1);
// consultant opens a shift; manager then sells into it
await page.evaluate(() => logout()); await page.click('[data-login="u1"]'); await page.click('[data-login-go]'); await page.waitForSelector('#ocGo'); await page.fill('#oc', '40'); await page.click('#ocGo'); await page.waitForTimeout(300);
await page.evaluate(() => logout()); await page.click('[data-login="u9"]'); await page.click('[data-login-go]'); await page.waitForTimeout(500);
check('manager joins the consultant\'s open shift', (await page.textContent('header')).includes('Irakli-ის ცვლა'));
await sell('111', 'cash');
const sh = [...store.values()].find(x => x.c === 'shift' && !x.d.kind)?.d;
const s2 = [...store.values()].find(x => x.c === 'pos' && x.d.total === 32)?.d;
check('manager cash sale counts in that shift\'s drawer', s2 && sh && s2.shift === sh.id && s2.mgr === true, { s2: s2 && s2.shift, sh: sh && sh.id });

// an online order typed in Mars reaches the consultant: sound + pop-up + pulsing button, then status steps
await page.evaluate(() => logout()); await page.click('[data-login="u1"]'); await page.click('[data-login-go]'); await page.waitForTimeout(500);
store.set('pos/oM1', { c: 'pos', id: 'oM1', d: { id: 'oM1', src: 'mars', ch: 'delivery', at: new Date().toISOString(), day: new Date().toLocaleDateString('sv'), user: { id: 'mars', name: 'Mars' }, shift: null, device: 'mars', lines: [{ b: '222', n: 'Foreseen 80/600', q: 1, p: 499, d: 0 }], sub: 499, total: 509, pay: 'pending', status: 'ok', no: 50, paid: false, ship: 10, dl: { name: 'ნინო ბერიძე', phone: '599123456', addr: 'ვაკე, ჭავჭავაძის 1', fee: 10, st: 'new', log: [] } } });
await page.evaluate(() => load(false)); await page.waitForTimeout(600);
const card = await page.evaluate(() => ({ up: !!document.querySelector('#blockRoot .bcard'), txt: (document.querySelector('#blockRoot') || {}).textContent || '' }));
check('new Mars order: a card covers the register with name, address, items', card.up && card.txt.includes('ნინო ბერიძე') && card.txt.includes('ჭავჭავაძის') && card.txt.includes('Foreseen'), card.txt.slice(0, 120));
await page.screenshot({ path: '/tmp/mars-register-card.png' });
await page.keyboard.press('Escape'); await page.mouse.click(30, 400); await page.waitForTimeout(200);
check('the card cannot be closed by Esc or clicking outside', await page.evaluate(() => !!document.querySelector('#blockRoot .bcard')));
check('the sale screen behind it cannot be used', await page.evaluate(() => { const c = document.querySelector('.card[data-add]'); if (!c) return true; const r = c.getBoundingClientRect(); const el = document.elementFromPoint(r.x + 10, r.y + 10); return !!el.closest('#blockRoot') }));
await page.click('#blockRoot [data-ack="ready"]'); await page.waitForTimeout(700);
check('consultant answers "packed": saved with who saw it, card gone', store.get('pos/oM1').d.dl.st === 'ready' && store.get('pos/oM1').d.dl.seen.by === 'Irakli' && !(await page.$('#blockRoot .bcard')), store.get('pos/oM1').d.dl);
await page.evaluate(() => load(false)); await page.waitForTimeout(300);
check('the card does not come back once answered', !(await page.$('#blockRoot .bcard')));
await page.click('header [data-act="orders"]'); await page.waitForSelector('.ord');
await page.click('.ord [data-act="dlSet"][data-st="new"]'); await page.waitForTimeout(300);
check('any status can be set, also back', store.get('pos/oM1').d.dl.st === 'new');
await page.click('.ord [data-act="dlSet"][data-st="out"]'); await page.waitForTimeout(500);
check('consultant marks it picked up by courier', store.get('pos/oM1').d.dl.st === 'out' && (await page.textContent('.ord')).includes('კურიერმა წაიღო'), store.get('pos/oM1').d.dl);
check('consultant cannot edit prices', !(await page.$('.ord [data-act="dlEdit"]')));
await page.screenshot({ path: '/tmp/mars-register-board.png' });
await page.click('.ord [data-act="dlPaid"]'); await page.waitForTimeout(300); await page.click('.ord [data-act="dlStep"]'); await page.waitForTimeout(700);
check('paid + delivered: done, off the open list', store.get('pos/oM1').d.paid === true && store.get('pos/oM1').d.dl.st === 'done' && !(await page.$('.ord')));
await page.click('[data-otab="all"]'); await page.fill('#oq', 'ნინო'); await page.waitForTimeout(500);
check('"all" shows finished orders and search finds them', (await page.$$('.ord')).length === 1);
// manager: edit the price on the register
await page.evaluate(() => logout()); await page.click('[data-login="u9"]'); await page.click('[data-login-go]'); await page.waitForTimeout(400);
await page.click('header [data-act="orders"]'); await page.click('[data-otab="all"]'); await page.waitForSelector('.ord [data-act="dlEdit"]');
await page.click('.ord [data-act="dlEdit"]'); await page.fill('[data-de="0"][data-k="p"]', '450'); await page.fill('#deFee', '0'); await page.click('#deGo'); await page.waitForTimeout(700);
check('manager edits the price on the register: total recalculated', store.get('pos/oM1').d.total === 450 && store.get('pos/oM1').d.lines[0].p === 450, store.get('pos/oM1').d.total);
// a second Mars order while the first card is answered: the queue shows them one by one
['oM2', 'oM3'].forEach((id, k) => store.set('pos/' + id, { c: 'pos', id, d: { ...store.get('pos/oM1').d, id, no: 60 + k, paid: false, total: 32, lines: [{ b: '111', n: 'მთვარის სანათი', q: 1, p: 32, d: 0 }], dl: { name: 'კლიენტი ' + k, phone: '59912345' + k, addr: 'თბილისი', st: 'new', log: [] } } }));
await page.evaluate(() => load(false)); await page.waitForTimeout(500);
check('two new orders: one card, says one more is waiting', (await page.textContent('#blockRoot')).includes('კიდევ 1'));
await page.click('#blockRoot [data-ack="seen"]'); await page.waitForTimeout(400);
check('after the first, the second card shows', (await page.textContent('#blockRoot')).includes('კლიენტი 1'));
await page.click('#blockRoot [data-ack="seen"]'); await page.waitForTimeout(400);
check('"seen" keeps the status new and records who', store.get('pos/oM2').d.dl.st === 'new' && store.get('pos/oM2').d.dl.seen.by === 'ადმინი' && !(await page.$('#blockRoot .bcard')));

// Mars: the role survives a save, and can be given to someone
const mars = 'file://' + path.join(root, 'index.html');
await page.goto(mars + '#connect=' + link); await page.waitForFunction(() => typeof S !== 'undefined' && S.cfg && S.cfg.pos, null, { timeout: 30000 });
await page.evaluate(() => { go('store'); act('st_tab', { dataset: { v: 'setup' } }) }); await page.waitForSelector('#stUsers [data-k="role"]');
const roles = await page.$$eval('#stUsers [data-k="role"]', a => a.map(x => x.value));
check('Mars shows the roles', roles.join() === ',mgr', roles);
await page.selectOption('#stUsers tr:nth-child(1) [data-k="role"]', 'mgr');
await page.click('[data-act="st_saveUsers"]'); await page.waitForTimeout(1200);
check('Mars saves the roles (and keeps the old manager)', cfg.pos.users.filter(u => u.admin).map(u => u.name).join() === 'Irakli,ადმინი', cfg.pos.users.map(u => [u.name, !!u.admin]));
await page.selectOption('#stUsers tr:nth-child(1) [data-k="role"]', ''); await page.click('[data-act="st_saveUsers"]'); await page.waitForTimeout(1200);
check('Mars can take the role back', cfg.pos.users.filter(u => u.admin).map(u => u.name).join() === 'ადმინი');
await page.evaluate(() => act('st_tab', { dataset: { v: 'history' } })); await page.waitForTimeout(400);
check('Mars staff table labels the manager', await page.evaluate(() => document.body.innerText.includes('manager')));
check('no page errors', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
