// Prova d'integrazione del server: iscrizione, conferma email, lotti, amicizie, password, redazione, cancellazione.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLAN } from '../public/js/core.js';

const PORT = 19000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dir, DEV_MAIL: '1', ADMIN_EMAILS: 'redazione@example.com', BASE_URL: BASE },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/api/session`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server non avviato');
});
after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

function client({ csrf = true } = {}) {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-VI': '1' } : {}), cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}
const form = (email, username, extra = {}) => ({ email, username, password: 'password123', accept: true, adult: true, elapsed: 5000, source: 'bio', ...extra });
const tokenOf = (link) => new URL(link).searchParams.values().next().value;

test('percorso completo di due abitanti e della redazione', async () => {
  const anna = client();
  const bruno = client();
  const admin = client();
  const anon = client();
  const lots = PLAN.lotsByDistrict.get(1);

  // Iscrizione: trappole anti-bot, campi obbligatori, CSRF
  assert.equal((await anna('POST', '/api/register', form('anna@example.com', 'anna.b', { elapsed: 300 }))).status, 400, 'troppo veloce');
  assert.equal((await anna('POST', '/api/register', form('anna@example.com', 'anna.b', { website: 'x' }))).status, 400, 'campo nascosto');
  assert.equal((await anna('POST', '/api/register', form('anna@example.com', 'anna.b', { adult: false }))).status, 400);
  assert.equal((await client({ csrf: false })('POST', '/api/register', form('anna@example.com', 'anna.b'))).status, 403);
  const reg = await anna('POST', '/api/register', form('anna@example.com', 'anna.b'));
  assert.equal(reg.status, 200);
  assert.equal(reg.body.me.emailConfirmed, false);
  assert.ok(reg.body.devLink.includes('?conferma='));
  assert.equal((await bruno('POST', '/api/register', form('ANNA@example.com', 'altro'))).status, 400, 'email già usata');
  assert.equal((await bruno('POST', '/api/register', form('b@example.com', 'Anna.B'))).status, 400, 'nome già preso');

  // Cantiere prima della conferma, casa dopo
  const choose = await anna('POST', '/api/op', { op: { type: 'chooseSlot', slot: lots[0], style: { roof: 'verde' } } });
  assert.equal(choose.status, 200);
  assert.equal(choose.body.result.status, 'cantiere');
  assert.equal((await anon('POST', '/api/confirm', { token: 'sbagliato' })).status, 400);
  const conf = await anon('POST', '/api/confirm', { token: tokenOf(reg.body.devLink) });
  assert.equal(conf.status, 200);
  assert.equal(conf.body.number, 1);
  assert.equal((await anon('POST', '/api/confirm', { token: tokenOf(reg.body.devLink) })).status, 400, 'il link vale una volta');
  const city = (await anon('GET', '/api/city')).body.city;
  assert.equal(city.houses[lots[0]].status, 'casa');
  assert.equal(city.houses[lots[0]].style.roof, 'verde');
  assert.equal(city.residents[Object.keys(city.residents)[0]].email, undefined, "l'email non è pubblica");

  // Accesso con nome utente, password sbagliata
  assert.equal((await bruno('POST', '/api/login', { login: 'anna.b', password: 'sbagliata' })).status, 401);
  const regB = await bruno('POST', '/api/register', form('bruno@example.com', 'bruno.c'));
  await bruno('POST', '/api/confirm', { token: tokenOf(regB.body.devLink) });
  assert.equal((await bruno('POST', '/api/op', { op: { type: 'chooseSlot', slot: lots[0] } })).status, 409, 'lotto già preso');
  assert.equal((await bruno('POST', '/api/op', { op: { type: 'chooseSlot', slot: lots[1] } })).body.result.status, 'casa');

  // Amicizia
  const annaId = reg.body.me.id;
  const brunoId = regB.body.me.id;
  assert.equal((await bruno('POST', '/api/op', { op: { type: 'friendRequest', to: annaId } })).status, 200);
  const annaCity = (await anna('GET', '/api/city')).body.city;
  assert.equal(annaCity.requests.length, 1);
  assert.equal((await client()('GET', '/api/city')).body.city.requests.length, 0, 'gli altri non vedono le richieste');
  await anna('POST', '/api/op', { op: { type: 'friendRespond', id: annaCity.requests[0].id, accept: true } });
  assert.equal((await bruno('GET', '/api/city')).body.city.friendships.length, 1);

  // Password dimenticata
  const rr = await anon('POST', '/api/reset/request', { email: 'nessuno@example.com' });
  assert.equal(rr.status, 200, 'non rivela chi è iscritto');
  const reset = await anon('POST', '/api/reset/request', { email: 'anna@example.com' });
  const newPass = await anon('POST', '/api/reset', { token: tokenOf(reset.body.devLink), password: 'nuovapassword' });
  assert.equal(newPass.status, 200);
  assert.equal((await anna('GET', '/api/me/export')).status, 401, 'le vecchie sessioni sono chiuse');
  assert.equal((await anna('POST', '/api/login', { login: 'anna@example.com', password: 'nuovapassword' })).status, 200);
  const exp = await anna('GET', '/api/me/export');
  assert.equal(exp.body.account.email, 'anna@example.com');
  assert.deepEqual(exp.body.amici, ['bruno.c']);

  // Redazione: solo con email autorizzata
  assert.equal((await anna('GET', '/api/admin')).status, 403);
  const regA = await admin('POST', '/api/register', form('redazione@example.com', 'la.redazione.vi'));
  assert.equal(regA.body.me.admin, true);
  const adm = await admin('GET', '/api/admin');
  assert.equal(adm.status, 200);
  assert.ok(adm.body.sources.some((s) => s.source === 'bio' && s.n === 3));
  assert.ok(adm.body.outbox.length >= 3, 'le email restano nella posta in uscita');
  await anna('POST', '/api/op', { op: { type: 'report', target: brunoId, reason: 'prova' } });
  assert.equal((await anna('POST', '/api/op', { op: { type: 'suspend', id: brunoId, on: true } })).status, 403);
  assert.equal((await admin('POST', '/api/op', { op: { type: 'suspend', id: brunoId, on: true } })).status, 200);
  assert.equal((await bruno('GET', '/api/me/export')).status, 401, 'chi è sospeso viene fatto uscire');
  assert.equal((await bruno('POST', '/api/login', { login: 'bruno.c', password: 'password123' })).status, 403);

  // Cancellazione: il lotto torna libero
  assert.equal((await anna('POST', '/api/op', { op: { type: 'leave' } })).status, 400, 'solo dalle impostazioni, con password');
  assert.equal((await anna('POST', '/api/me/delete', { password: 'sbagliata' })).status, 400);
  assert.equal((await anna('POST', '/api/me/delete', { password: 'nuovapassword' })).status, 200);
  const after = (await anon('GET', '/api/city')).body.city;
  assert.equal(after.houses[lots[0]], undefined);
  assert.equal((await anon('POST', '/api/login', { login: 'anna.b', password: 'nuovapassword' })).status, 401);
  assert.equal((await client()('POST', '/api/register', form('anna@example.com', 'anna.b'))).status, 200, 'email e nome tornano liberi');
});

test('aggiornamenti in tempo reale', async () => {
  const ctrl = new AbortController();
  const res = await fetch(`${BASE}/api/events`, { signal: ctrl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: city\ndata: \{"rev":\d+/);
  ctrl.abort();
});
