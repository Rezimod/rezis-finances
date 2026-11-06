#!/usr/bin/env node
// Mars inbox: messages the owner types or speaks into the Mars assistant widget, kept in the Mars backend
// (collection "chat"). Used by the Claude agent that answers them.
//   MARS_URL=<apps-script web app url> MARS_KEY=<owner key> node mars-inbox.mjs list        → unanswered messages
//   ... node mars-inbox.mjs all                                                              → full data dump to stdout
//   ... node mars-inbox.mjs reply <id> "<text>"                                              → answer a message
//   ... node mars-inbox.mjs write ops.json                                                   → write ops [{op:'set'|'delete',c,id,d}]
//   ... node mars-inbox.mjs get <collection> <id>                                            → one record
const URL = process.env.MARS_URL, KEY = process.env.MARS_KEY;
if (!URL || !KEY) { console.error('Set MARS_URL and MARS_KEY'); process.exit(2); }
async function call(body) {
  for (let a = 0; a < 5; a++) {
    const r = await fetch(URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key: KEY }) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = null; }
    if (j && !j.info && j.error !== 'bad_body') { if (j.error) throw new Error(j.error); return j; }
    await new Promise(z => setTimeout(z, 1500 * (a + 1)));
  }
  throw new Error('backend did not answer');
}
const [cmd, ...args] = process.argv.slice(2);
const out = x => console.log(JSON.stringify(x, null, 1));
if (cmd === 'list') { const r = await call({ action: 'all' }); out(r.docs.filter(d => d.c === 'chat' && d.d && d.d.status === 'new').map(d => ({ id: d.id, ...d.d })).sort((a, b) => String(a.at).localeCompare(String(b.at)))); }
else if (cmd === 'all') { const r = await call({ action: 'all' }); process.stdout.write(JSON.stringify(r)); }
else if (cmd === 'get') { const r = await call({ action: 'all' }); out(r.docs.find(d => d.c === args[0] && String(d.id) === String(args[1])) || null); }
else if (cmd === 'reply') {
  const r = await call({ action: 'all' }); const cur = r.docs.find(d => d.c === 'chat' && d.id === args[0]);
  if (!cur) { console.error('no such message'); process.exit(1); }
  const d = { ...cur.d, status: 'done', reply: args.slice(1).join(' '), repliedAt: new Date().toISOString(), by: process.env.MARS_AGENT || 'Claude' };
  out(await call({ action: 'write', ops: [{ op: 'set', c: 'chat', id: args[0], d }] }));
}
else if (cmd === 'write') { const ops = JSON.parse(await import('node:fs').then(m => m.readFileSync(args[0], 'utf8'))); out(await call({ action: 'write', ops })); }
else { console.error('commands: list | all | get <c> <id> | reply <id> <text> | write <ops.json>'); process.exit(2); }
