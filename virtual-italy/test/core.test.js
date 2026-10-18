// Prove delle regole della città: piano regolatore, strade, lotti, conferme, quartieri, amicizie, filtri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN, DISTRICTS, emptyState, applyOp, computeRoads, publicView, formatNews, checkUsername, cleanInstagram,
  residentHouse, builtCount, lotsOpen, RESERVE_MS, FRIEND_REQUESTS_PER_DAY, isLot, parseKey, districtAt,
} from '../public/js/core.js';
import { seedResidents } from '../public/js/seed.js';

const sys = (now = 1000) => ({ system: true, now });
const as = (id, now = 1000) => ({ user: { id }, now });
function join(s, id, username, { confirm = true, now = 1000 } = {}) {
  s = applyOp(s, { type: 'join', id, username }, sys(now)).state;
  if (confirm) s = applyOp(s, { type: 'confirm', id }, sys(now)).state;
  return s;
}
const freeLots = (s, district = 1) => PLAN.lotsByDistrict.get(district).filter((k) => !s.houses[k]);

test('ogni lotto del piano ha sempre una strada, anche a città piena', () => {
  for (let open = 1; open <= DISTRICTS.length; open++) {
    const houses = {};
    let t = 0;
    for (let id = 1; id <= open; id++) for (const slot of PLAN.lotsByDistrict.get(id)) houses[slot] = { slot, reservedAt: t++ };
    const { roads, doors } = computeRoads(houses, open);
    assert.equal(Object.keys(doors).length, Object.keys(houses).length, `quartieri aperti: ${open}`);
    for (const slot of Object.keys(houses)) assert.equal(roads[slot], undefined, 'nessuna strada passa sopra un lotto');
  }
});

test('le case vicine condividono il vialetto', () => {
  const [a, b] = ['34,26', '35,26'].filter(isLot).length === 2 ? ['34,26', '35,26'] : PLAN.lotsByDistrict.get(1).slice(0, 2);
  const one = computeRoads({ [a]: { slot: a, reservedAt: 1 } }, 1).roads;
  const two = computeRoads({ [a]: { slot: a, reservedAt: 1 }, [b]: { slot: b, reservedAt: 2 } }, 1).roads;
  const lanes = (r) => Object.values(r).filter((t) => t === 'lane').length;
  assert.ok(lanes(two) - lanes(one) <= 2, 'la seconda casa aggiunge al massimo un breve tratto');
});

test('la città completa si calcola in fretta', () => {
  const houses = {};
  let t = 0;
  for (const slot of PLAN.lots) houses[slot] = { slot, reservedAt: t++ };
  const t0 = performance.now();
  computeRoads(houses, DISTRICTS.length);
  assert.ok(performance.now() - t0 < 2000);
});

test('senza email confermata la casa resta cantiere, poi diventa casa con numero e notizia', () => {
  let s = join(emptyState(0), 'u1', 'mario.rossi', { confirm: false });
  const slot = freeLots(s)[0];
  let r = applyOp(s, { type: 'chooseSlot', slot, style: { roof: 'blu' } }, as('u1'));
  assert.equal(r.result.status, 'cantiere');
  assert.equal(r.state.residents.u1.number, null);
  s = applyOp(r.state, { type: 'confirm', id: 'u1' }, sys(2000)).state;
  assert.equal(s.houses[slot].status, 'casa');
  assert.equal(s.houses[slot].style.roof, 'blu');
  assert.equal(s.residents.u1.number, 1);
  assert.equal(s.news[0].kind, 'welcome');
  assert.match(formatNews(s.news[0], s).title, /mario\.rossi, abitante n°1/);
});

test('il cantiere non confermato libera il lotto dopo 24 ore', () => {
  let s = join(emptyState(0), 'u1', 'mario.rossi', { confirm: false });
  const slot = freeLots(s)[0];
  s = applyOp(s, { type: 'chooseSlot', slot }, as('u1', 1000)).state;
  assert.equal(applyOp(s, { type: 'expire' }, sys(1000 + RESERVE_MS - 1)).result.freed, 0);
  s = applyOp(s, { type: 'expire' }, sys(1000 + RESERVE_MS + 1)).state;
  assert.equal(s.houses[slot], undefined);
  assert.ok(s.residents.u1, "l'account resta: potrà scegliere di nuovo");
});

test('regole dei lotti: niente doppioni, niente quartieri chiusi, una casa a testa', () => {
  let s = join(join(emptyState(0), 'u1', 'anna.b'), 'u2', 'carlo.d');
  const slot = freeLots(s)[0];
  s = applyOp(s, { type: 'chooseSlot', slot }, as('u1')).state;
  assert.throws(() => applyOp(s, { type: 'chooseSlot', slot }, as('u2')), { code: 'conflict' });
  assert.throws(() => applyOp(s, { type: 'chooseSlot', slot: freeLots(s)[0] }, as('u1')), /già una casa/);
  assert.throws(() => applyOp(s, { type: 'chooseSlot', slot: PLAN.lotsByDistrict.get(2)[0] }, as('u2')), /non è ancora aperto/);
  assert.throws(() => applyOp(s, { type: 'chooseSlot', slot: '0,30' }, as('u2')), /non si può costruire/);
  assert.throws(() => applyOp(s, { type: 'chooseSlot', slot: freeLots(s)[0] }, as('nessuno')), { code: 'auth' });
});

test("il secondo quartiere apre all'80% del Centro e il giornale lo annuncia", () => {
  const need = Math.ceil(lotsOpen(1) * 0.8);
  let s = seedResidents(emptyState(0), need - 1, 10_000_000);
  assert.equal(s.openDistricts, 1);
  s = seedResidents(s, 1, 10_000_000, 7);
  assert.equal(s.openDistricts, 2);
  assert.ok(s.news.some((n) => n.kind === 'district' && n.district === 2));
  assert.ok(s.roads['60,30'] && s.roads['60,20'] === 'dorsal', 'la nuova strada principale è attiva');
  assert.ok(s.milestones.includes(25), 'traguardo della fontana');
});

test('amicizie: bussare, rispondere, doppioni, reciprocità e limite giornaliero', () => {
  let s = join(join(join(emptyState(0), 'a', 'anna.b'), 'b', 'bruno.c'), 'c', 'carla.d');
  s = applyOp(s, { type: 'friendRequest', to: 'b' }, as('a')).state;
  assert.throws(() => applyOp(s, { type: 'friendRequest', to: 'b' }, as('a')), /già bussato/);
  const q = s.requests[0];
  assert.throws(() => applyOp(s, { type: 'friendRespond', id: q.id, accept: true }, as('c')), { code: 'notfound' });
  s = applyOp(s, { type: 'friendRespond', id: q.id, accept: true }, as('b')).state;
  assert.equal(s.friendships.length, 1);
  assert.throws(() => applyOp(s, { type: 'friendRequest', to: 'a' }, as('b')), /già amici/);
  // c bussa ad a, a bussa a c: diventano amici senza aspettare
  s = applyOp(s, { type: 'friendRequest', to: 'a' }, as('c')).state;
  const r = applyOp(s, { type: 'friendRequest', to: 'c' }, as('a'));
  assert.equal(r.result.friends, true);
  assert.equal(r.state.requests.length, 0);
  // limite giornaliero
  let t = emptyState(0);
  t = join(t, 'x', 'spammer.x');
  for (let i = 0; i < FRIEND_REQUESTS_PER_DAY + 1; i++) t = join(t, 'v' + i, 'vicino.' + i);
  for (let i = 0; i < FRIEND_REQUESTS_PER_DAY; i++) t = applyOp(t, { type: 'friendRequest', to: 'v' + i }, as('x', 5000 + i)).state;
  assert.throws(() => applyOp(t, { type: 'friendRequest', to: 'v' + FRIEND_REQUESTS_PER_DAY }, as('x', 6000)), /al massimo/);
  assert.doesNotThrow(() => applyOp(t, { type: 'friendRequest', to: 'v' + FRIEND_REQUESTS_PER_DAY }, as('x', 5000 + 86400001 + FRIEND_REQUESTS_PER_DAY)));
});

test('chi non ha confermato l’email non può bussare', () => {
  let s = join(join(emptyState(0), 'a', 'anna.b', { confirm: false }), 'b', 'bruno.c');
  assert.throws(() => applyOp(s, { type: 'friendRequest', to: 'b' }, as('a')), /Conferma la tua email/);
});

test('nomi utente: formato, riservati, offensivi, doppioni senza distinzione di maiuscole', () => {
  assert.equal(checkUsername('Giulia.Romano'), 'Giulia.Romano');
  for (const bad of ['ab', 'nome con spazi', '.inizio', 'fine_', 'due..punti', 'Sindaco', 'redazione_ufficiale', 'virtualitaly', 'cazz0ne', 'Stronz0']) {
    assert.throws(() => checkUsername(bad), undefined, bad);
  }
  assert.equal(checkUsername('negroni.lover'), 'negroni.lover', 'parola innocua');
  let s = join(emptyState(0), 'a', 'Anna.B');
  assert.throws(() => applyOp(s, { type: 'join', id: 'b', username: 'anna.b' }, sys()), /già preso/);
});

test('profilo: Instagram facoltativo e ripulito, frase filtrata', () => {
  assert.equal(cleanInstagram('https://www.instagram.com/Virtual.Italy/?hl=it'), 'virtual.italy');
  assert.equal(cleanInstagram('@mario_rossi'), 'mario_rossi');
  assert.equal(cleanInstagram(''), '');
  assert.throws(() => cleanInstagram('nome con spazi'));
  let s = join(emptyState(0), 'a', 'anna.b');
  s = applyOp(s, { type: 'profile', bio: '  Amo   il mare ', instagram: '@anna.b' }, as('a')).state;
  assert.equal(s.residents.a.bio, 'Amo il mare');
  assert.throws(() => applyOp(s, { type: 'profile', bio: 'sei uno stronzo' }, as('a')), /non ammesse/);
  assert.throws(() => applyOp(s, { type: 'profile', bio: 'x'.repeat(121) }, as('a')), /120/);
});

test('cancellare l’account libera il lotto e toglie il nome dalle notizie', () => {
  let s = join(join(emptyState(0), 'a', 'anna.b'), 'b', 'bruno.c');
  const slot = freeLots(s)[0];
  s = applyOp(s, { type: 'chooseSlot', slot }, as('a')).state;
  s = applyOp(s, { type: 'friendRequest', to: 'b' }, as('a')).state;
  const other = applyOp(s, { type: 'leave', id: 'a' }, as('b')).state;
  assert.ok(other.residents.a && !other.residents.b, 'chi chiede di cancellare un altro cancella solo sé stesso');
  s = applyOp(s, { type: 'leave', id: 'a' }, sys()).state;
  assert.equal(s.houses[slot], undefined);
  assert.equal(s.requests.length, 0);
  const welcome = s.news.find((n) => n.kind === 'welcome');
  assert.doesNotMatch(formatNews(welcome, s).title, /anna/);
});

test('ognuno vede solo le proprie richieste; le segnalazioni solo la redazione', () => {
  let s = join(join(join(emptyState(0), 'a', 'anna.b'), 'b', 'bruno.c'), 'c', 'carla.d');
  s = applyOp(s, { type: 'friendRequest', to: 'b' }, as('a')).state;
  s = applyOp(s, { type: 'report', target: 'b', reason: 'nome offensivo' }, as('c')).state;
  assert.equal(publicView(s, 'c').requests.length, 0);
  assert.equal(publicView(s, 'b').requests.length, 1);
  assert.equal(publicView(s, 'c').reports.length, 0);
  assert.equal(publicView(s, 'x', true).reports.length, 1);
  assert.throws(() => applyOp(s, { type: 'suspend', id: 'b', on: true }, as('c')), /redazione/);
  s = applyOp(s, { type: 'suspend', id: 'b', on: true }, { user: { id: 'admin', admin: true }, now: 1 }).state;
  assert.equal(publicView(s, 'c').residents.b.suspended, true);
  assert.throws(() => applyOp(s, { type: 'profile', bio: 'ciao' }, as('b')), /sospeso/);
});

test('i dati dimostrativi passano dalle stesse regole', () => {
  const s = seedResidents(emptyState(0), 20, 10_000_000);
  assert.equal(builtCount(s), 20);
  for (const r of Object.values(s.residents)) {
    const h = residentHouse(s, r.id);
    assert.ok(h && districtAt(...parseKey(h.slot)) <= s.openDistricts);
    assert.ok(s.doors[h.slot], 'ogni casa ha la sua porta sulla strada');
  }
});
