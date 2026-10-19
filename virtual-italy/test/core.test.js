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

test('livelli del terreno e passeggiate: si cambia livello solo dalle strade', async () => {
  const { levelAt, walkPath, canStep, spawnPoint, frontOf, PIAZZA_CENTER } = await import('../public/js/core.js');
  let s = seedResidents(emptyState(0), 12, 10_000_000);
  assert.equal(levelAt(40, 28, 1), 1, 'il paese è rialzato');
  assert.equal(levelAt(40, 20, 1), 2, 'la collina è più in alto');
  assert.equal(levelAt(40, 2, 1), 3, 'le montagne in fondo');
  assert.equal(levelAt(40, 55, 1), -1, 'il mare');
  assert.equal(canStep(s, 34, 33, 34, 34), false, 'non si scavalca il muro del paese');
  const id = Object.keys(s.residents)[0];
  const home = spawnPoint(s, id);
  assert.deepEqual(home, frontOf(s, Object.values(s.houses).find((h) => h.residentId === id).slot));
  const toPiazza = walkPath(s, home, PIAZZA_CENTER);
  assert.ok(toPiazza && toPiazza.length > 0);
  for (let i = 1; i < toPiazza.length; i++) assert.ok(canStep(s, ...toPiazza[i - 1], ...toPiazza[i]));
  const someHouse = Object.keys(s.houses)[0].split(',').map(Number);
  assert.equal(walkPath(s, home, someHouse), null, 'dentro le case non si entra');
  assert.equal(walkPath(s, home, [40, 55]), null, 'nel mare non si cammina');
  assert.deepEqual(walkPath(s, home, home), []);
});

test("editor del personaggio: valori controllati, aspetto di partenza stabile", async () => {
  const { cleanLook, defaultLook, LOOK } = await import('../public/js/core.js');
  let s = join(emptyState(0), 'a', 'anna.b');
  assert.deepEqual(cleanLook(undefined, 'anna.b'), defaultLook('anna.b'));
  s = applyOp(s, { type: 'look', look: { skin: 2, hair: 4, style: 'ricci', shirt: 1, pants: 0, extra: 'occhiali' } }, as('a')).state;
  assert.deepEqual(s.residents.a.look, { skin: 2, hair: 4, style: 'ricci', shirt: 1, pants: 0, extra: 'occhiali' });
  s = applyOp(s, { type: 'look', look: { skin: 99, hair: -1, style: '<script>', shirt: 'rosso', extra: 'corona' } }, as('a')).state;
  const d = defaultLook('anna.b');
  assert.deepEqual(s.residents.a.look, { skin: d.skin, hair: d.hair, style: d.style, shirt: d.shirt, pants: d.pants, extra: d.extra }, 'valori sbagliati tornano a quelli di partenza');
  assert.ok(d.skin < LOOK.skin.length && LOOK.style.some((o) => o.id === d.style));
  assert.throws(() => applyOp(s, { type: 'look', look: {} }, as('nessuno')), { code: 'auth' });
});

test('nuvolette: testo ripulito, lungo al massimo 60 caratteri, niente parole offensive', async () => {
  const { checkSay, SAY_PRESETS } = await import('../public/js/core.js');
  assert.equal(checkSay('  Ciao   a tutti '), 'Ciao a tutti');
  for (const p of SAY_PRESETS) assert.equal(checkSay(p), p);
  assert.throws(() => checkSay(''), /Scrivi/);
  assert.throws(() => checkSay('a'.repeat(61)), /60/);
  assert.throws(() => checkSay('vaffanculo'), /non ammesse/);
});

test('dentro casa: mobili dentro la stanza, senza sovrapporsi, porta libera, percorsi tra i mobili', async () => {
  const { roomOf, roomPath, canVisit, ROOM, ROOM_DOOR } = await import('../public/js/core.js');
  let s = join(join(emptyState(0), 'a', 'anna.b'), 'b', 'bruno.c');
  assert.throws(() => applyOp(s, { type: 'furni', act: 'add', t: 'sedia', x: 1, y: 1 }, as('a')), /Prima costruisci/);
  s = applyOp(s, { type: 'chooseSlot', slot: freeLots(s)[0] }, as('a')).state;
  const add = (op) => applyOp(s, { type: 'furni', act: 'add', ...op }, as('a'));
  assert.throws(() => add({ t: 'divano', x: ROOM - 1, y: 0 }), /non entra/);
  assert.throws(() => add({ t: 'sedia', x: ROOM_DOOR[0], y: ROOM_DOOR[1] }), /porta/);
  assert.throws(() => add({ t: 'trono', x: 1, y: 1 }), /sconosciuto/);
  let r = add({ t: 'divano', x: 2, y: 2 }); s = r.state;
  assert.throws(() => add({ t: 'sedia', x: 3, y: 2 }), /già un altro/);
  s = add({ t: 'tappeto', x: 2, y: 2 }).state; // il tappeto può stare sotto il divano
  assert.throws(() => applyOp(s, { type: 'furni', act: 'rotate', uid: r.result.uid }, as('b')), /Prima costruisci/, 'gli altri non toccano i mobili');
  s = applyOp(s, { type: 'furni', act: 'rotate', uid: r.result.uid }, as('a')).state;
  assert.equal(roomOf(s, 'a').items.find((i) => i.t === 'divano').r, 1);
  const p = roomPath(roomOf(s, 'a'), ROOM_DOOR, [7, 0]);
  assert.ok(p && p.every(([x, y]) => !(x === 2 && (y === 2 || y === 3))), 'si gira attorno al divano');
  assert.ok(canVisit(s, 'b', 'a'));
  s = applyOp(s, { type: 'roomStyle', access: 'amici' }, as('a')).state;
  assert.equal(canVisit(s, 'b', 'a'), false);
  assert.throws(() => applyOp(s, { type: 'roomStyle', floor: 'oro' }, as('a')), /sconosciuto/);
  s = applyOp(s, { type: 'leave', id: 'a' }, sys()).state;
  assert.equal(s.rooms.a, undefined, 'chi se ne va porta via i mobili');
});
