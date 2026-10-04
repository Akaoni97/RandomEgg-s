// Prova d'integrazione del server: accessi reali, conflitti fra dispositivi, idempotenza.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dir, DEMO_DATA: '1', SETUP_CODE: 'codice-test' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/api/session`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server non avviato');
});
after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

function client() {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', 'X-Magazzino': '1', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

test('accesso, invito, conflitto, idempotenza, permessi', async () => {
  const admin = client();
  const anon = client();
  assert.equal((await anon('GET', '/api/state')).status, 401, 'senza sessione niente dati');
  assert.equal((await admin('POST', '/api/setup', { setupCode: 'sbagliato', name: 'Luca', username: 'luca', password: 'password1' })).status, 403);
  assert.equal((await admin('POST', '/api/setup', { setupCode: 'codice-test', name: 'Luca', username: 'luca', password: 'password1' })).status, 200);
  assert.equal((await anon('POST', '/api/setup', { setupCode: 'codice-test', name: 'X', username: 'xx1', password: 'password1' })).status, 403, 'setup una volta sola');

  const inv = await admin('POST', '/api/invites', { role: 'magazzino', name: 'Marco' });
  assert.ok(inv.body.code);
  const marco = client();
  assert.equal((await marco('POST', '/api/register', { invite: inv.body.code, name: 'Marco', username: 'marco', password: 'password2' })).status, 200);
  assert.equal((await client()('POST', '/api/register', { invite: inv.body.code, name: 'Altro', username: 'altro', password: 'password3' })).status, 403, 'invito monouso');
  assert.equal((await marco('GET', '/api/users')).status, 403, 'utenti solo per amministratore');

  // CSRF: senza intestazione la scrittura è rifiutata
  const raw = await fetch(`${BASE}/api/op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(raw.status, 403);

  const st = (await marco('GET', '/api/state')).body.state;
  const lot = st.lots.find((l) => l.lotCode === 'DEMO-A');
  // due dispositivi con la stessa revisione
  const a = await marco('POST', '/api/op', { op: { type: 'lot.unload', lotId: lot.id, expectRev: lot.rev, tons: 5, opId: 'op-a' } });
  assert.equal(a.status, 200);
  assert.equal(a.body.result.message.includes('Scaricate'), true);
  const b = await admin('POST', '/api/op', { op: { type: 'lot.unload', lotId: lot.id, expectRev: lot.rev, tons: 3, opId: 'op-b' } });
  assert.equal(b.status, 409, 'seconda scrittura in conflitto');
  assert.equal(b.body.state.lots.find((l) => l.id === lot.id).tons, 25, 'nessun dato perso');
  // stessa operazione ripetuta
  const again = await marco('POST', '/api/op', { op: { type: 'lot.unload', lotId: lot.id, expectRev: lot.rev, tons: 5, opId: 'op-a' } });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.state.lots.find((l) => l.id === lot.id).tons, 25);
  // autore verificato dal server, non dal browser
  const mv = again.body.state.movements.filter((m) => m.lotId === lot.id).pop();
  assert.equal(mv.byName, 'Marco');
  // permessi: un operatore non fa importazioni riservate
  const imp = await marco('POST', '/api/op', { op: { type: 'data.importTargeted', payload: { updates: [{ location: 'mucchio-21', lot: 'DEMO-M21', tons: 1 }] } } });
  assert.equal(imp.status, 403);
  // persistenza
  assert.equal((await admin('GET', '/api/export')).status, 200);
  await admin('POST', '/api/logout');
  assert.equal((await admin('GET', '/api/state')).status, 401);
});
