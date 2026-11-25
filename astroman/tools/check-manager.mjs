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
await page.evaluate(() => { window.__beeps = 0; const B = window.beep; window.beep = () => { window.__beeps++ }; return load(false) }); await page.waitForTimeout(600);
const al = await page.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '', pulse: !!document.querySelector('[data-act="orders"].pulse'), beeps: window.__beeps }));
check('new Mars order: pop-up names it, button pulses, sound plays', al.toast.includes('ახალი ონლაინ შეკვეთა') && al.toast.includes('ნინო') && al.pulse && al.beeps === 1, al);
await page.evaluate(() => load(false)); await page.waitForTimeout(300);
check('the alert sounds once, not on every refresh', await page.evaluate(() => window.__beeps === 1));
await page.click('header [data-act="orders"]'); await page.waitForSelector('.ord');
check('board tags it ახალი! and the button stops pulsing', (await page.textContent('.ord')).includes('ახალი!') && !(await page.$('[data-act="orders"].pulse')));
await page.click('.ord [data-act="dlStep"]'); await page.waitForTimeout(200); await page.click('.ord [data-act="dlStep"]'); await page.waitForTimeout(700);
check('consultant marks it packed → picked up by courier', store.get('pos/oM1').d.dl.st === 'out' && (await page.textContent('.ord')).includes('კურიერმა წაიღო'), store.get('pos/oM1').d.dl);
await page.screenshot({ path: '/tmp/mars-register-board.png' });
await page.click('.ord [data-act="dlPaid"]'); await page.waitForTimeout(300); await page.click('.ord [data-act="dlStep"]'); await page.waitForTimeout(700);
check('paid + delivered: done, off the open list', store.get('pos/oM1').d.paid === true && store.get('pos/oM1').d.dl.st === 'done' && !(await page.$('.ord')));

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
