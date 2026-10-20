// Prove delle regole della città: piano regolatore, strade, lotti, conferme, quartieri, amicizie, filtri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN, DISTRICTS, emptyState, applyOp, computeRoads, publicView, formatNews, checkUsername, cleanInstagram,
  residentHouse, builtCount, lotsOpen, RESERVE_MS, FRIEND_REQUESTS_PER_DAY, isLot, parseKey, districtAt,
  lotFacing, walkable, migratePlan,
} from '../public/js/core.js';
import { seedResidents } from '../public/js/seed.js';

const sys = (now = 1000) => ({ system: true, now });
const as = (id, now = 1000) => ({ user: { id }, now });
function join(s, id, username, { confirm = true, now = 1000 } = {}) {
  s = applyOp(s, { type: 'join', id, username }, sys(now)).state;
  if (confirm) s = applyOp(s, { type: 'confirm', id }, sys(now)).state;
  s = applyOp(s, { type: 'anagrafe' }, as(id, now)).state;
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
  assert.ok(s.roads['65,30'] && s.roads['65,17'] === 'dorsal' && s.roads['60,27'] === 'via', 'la nuova strada principale e le vie del quartiere sono attive');
  s = seedResidents(s, 25 - builtCount(s), 10_000_000, 8);
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
  assert.equal(levelAt(40, 12, 1), 2, 'la collina è più in alto');
  assert.equal(levelAt(40, 2, 1), 3, 'le montagne in fondo');
  assert.equal(levelAt(40, 55, 1), -1, 'il mare');
  assert.equal(canStep(s, 34, 36, 34, 35) || canStep(s, 33, 35, 33, 36), false, 'non si scavalca il muro del paese');
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
  const d0 = defaultLook('anna.b');
  assert.deepEqual(s.residents.a.look, { ...d0, skin: 2, hair: 4, style: 'ricci', shirt: 1, pants: 0, extra: 'occhiali', top: 'maglietta', bottom: 'pantaloni' });
  // Uomo e donna, con barba o rossetto; i valori sconosciuti tornano a quelli di partenza
  s = applyOp(s, { type: 'look', look: { gender: 'donna', style: 'chignon', lips: 'rosso', eyes: 2, shoes: 3, top: 'vestito', bottom: 'gonna' } }, as('a')).state;
  assert.equal(s.residents.a.look.gender, 'donna'); assert.equal(s.residents.a.look.lips, 'rosso'); assert.equal(s.residents.a.look.top, 'vestito');
  s = applyOp(s, { type: 'look', look: { gender: 'alieno', beard: 'treccia', lips: 'blu' } }, as('a')).state;
  assert.ok(['uomo', 'donna'].includes(s.residents.a.look.gender) && s.residents.a.look.lips === 'naturale');
  s = applyOp(s, { type: 'look', look: { skin: 99, hair: -1, style: '<script>', shirt: 'rosso', extra: 'trono', top: 'armatura' } }, as('a')).state;
  const d = defaultLook('anna.b');
  assert.deepEqual(s.residents.a.look, d, 'valori sbagliati tornano a quelli di partenza');
  assert.ok(d.skin < LOOK.skin.length && LOOK.style.some((o) => o.id === d.style));
  assert.throws(() => applyOp(s, { type: 'look', look: {} }, as('nessuno')), { code: 'auth' });
});

test('negozi: edifici fissi accanto alla piazza, vestiti e mobili si prendono e finiscono nell\'inventario', async () => {
  const { SHOPS, shopAt, walkable, roomOf, canVisit, invOf, STARTER_KIT, MAX_STOCK } = await import('../public/js/core.js');
  let s = join(emptyState(0), 'a', 'anna.b');
  for (const sh of SHOPS) {
    for (const k of [[0, 0], [sh.w - 1, 0], [0, sh.d - 1], [sh.w - 1, sh.d - 1]]) {
      const x = sh.x0 + k[0], y = sh.y0 + k[1];
      assert.equal(shopAt(x, y), sh);
      assert.ok(!isLot(`${x},${y}`), 'il negozio non è un lotto');
      assert.ok(!walkable(s, x, y), 'nel negozio si entra dalla porta');
    }
    assert.ok(['main', 'piazza'].includes(s.roads[sh.front.join(',')]), 'la porta dà sulla strada principale o sulla piazza');
    assert.ok(canVisit(s, 'a', sh.room) && roomOf(s, sh.room).items.length > 5, 'il negozio è aperto e ha la merce esposta');
  }
  // Vestiti: prima si prendono, poi si indossano.
  assert.throws(() => applyOp(s, { type: 'look', look: { extra: 'corona' } }, as('a')), /Sartoria/);
  // Si paga in soldi: con i 150 del Comune la corona (200) non basta
  assert.equal(s.residents.a.soldi, 150);
  assert.throws(() => applyOp(s, { type: 'buy', kind: 'wear', id: 'corona' }, as('a')), /Ti mancano 50 soldi/);
  s.residents.a.soldi = 10_000;
  s = applyOp(s, { type: 'buy', kind: 'wear', id: 'corona', wear: true }, as('a')).state;
  assert.equal(s.residents.a.soldi, 9800);
  assert.equal(s.residents.a.look.extra, 'corona');
  assert.deepEqual(invOf(s, 'a').wear, ['corona']);
  assert.ok(applyOp(s, { type: 'buy', kind: 'wear', id: 'corona' }, as('a')).result.already);
  assert.throws(() => applyOp(s, { type: 'buy', kind: 'wear', id: 'mantello' }, as('a')), /sconosciuto/);
  // Mobili: il kit di benvenuto arriva con la casa, il resto si prende al Mobilificio.
  s = applyOp(s, { type: 'chooseSlot', slot: freeLots(s)[0] }, as('a')).state;
  assert.deepEqual(invOf(s, 'a').furni, STARTER_KIT);
  assert.throws(() => applyOp(s, { type: 'furni', act: 'add', t: 'jukebox', x: 3, y: 3 }, as('a')), /Mobilificio/);
  s = applyOp(s, { type: 'buy', kind: 'furni', t: 'jukebox' }, as('a')).state;
  const r = applyOp(s, { type: 'furni', act: 'add', t: 'jukebox', x: 3, y: 3 }, as('a'));
  s = r.state;
  assert.equal(invOf(s, 'a').furni.jukebox, undefined, 'sistemato in casa, non è più da parte');
  s = applyOp(s, { type: 'furni', act: 'remove', uid: r.result.uid }, as('a')).state;
  assert.equal(invOf(s, 'a').furni.jukebox, 1, 'tolto dalla stanza, torna nell\'inventario');
  for (let i = 1; i < MAX_STOCK; i++) s = applyOp(s, { type: 'buy', kind: 'furni', t: 'jukebox' }, as('a')).state;
  assert.throws(() => applyOp(s, { type: 'buy', kind: 'furni', t: 'jukebox' }, as('a')), /da parte/);
  assert.equal(publicView(s, 'b').inv.a, undefined, 'l\'inventario resta privato');
  assert.equal(publicView(s, 'b').residents.a.soldi, undefined, 'il borsellino resta privato');
  assert.equal(publicView(s, 'a').residents.a.soldi, 9800 - 140 * MAX_STOCK);
  assert.equal(publicView(s, 'a').inv.a.furni.jukebox, MAX_STOCK);
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
  for (const t of ['divano', 'tappeto']) s = applyOp(s, { type: 'buy', kind: 'furni', t }, as('a')).state;
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

test('vita in città: missioni, libro degli ospiti, cuori, Casa della settimana, sedute', async () => {
  const { missionStatus, invOf, heartsThisWeek, weekRanking, seatAt, roomOf, roomPath, BENCHES, dailyMission, DAILY } = await import('../public/js/core.js');
  const T = Date.UTC(2026, 9, 19, 10); // lunedì
  const at = (id, t = T) => ({ user: { id }, now: t });
  let s = join(join(emptyState(0), 'a', 'anna.b'), 'b', 'bruno.c');
  const lots = freeLots(s);
  for (const [id, i] of [['a', 0], ['b', 1]]) s = applyOp(s, { type: 'chooseSlot', slot: lots[i] }, at(id)).state;
  // Libro degli ospiti: una firma al giorno, non a casa propria, testo filtrato.
  assert.throws(() => applyOp(s, { type: 'sign', owner: 'a' }, at('a')), /gli altri/);
  s = applyOp(s, { type: 'sign', owner: 'a', text: 'Bella casa!' }, at('b')).state;
  assert.throws(() => applyOp(s, { type: 'sign', owner: 'a' }, at('b')), /già firmato/);
  assert.throws(() => applyOp(s, { type: 'sign', owner: 'a', text: 'vaffanculo' }, at('b', T + 86400000)), /non ammesse/);
  assert.equal(s.guestbook.a[0].text, 'Bella casa!');
  // Cuori: uno a settimana, si tolgono e si rimettono.
  let r = applyOp(s, { type: 'heart', owner: 'a' }, at('b')); s = r.state;
  assert.deepEqual(r.result, { on: true, n: 1 });
  assert.equal(applyOp(s, { type: 'heart', owner: 'a' }, at('b')).result.on, false);
  assert.throws(() => applyOp(s, { type: 'heart', owner: 'a' }, at('a')), /propria casa/);
  assert.equal(heartsThisWeek(s, 'a', T + 6 * 86400000), 1);
  assert.equal(heartsThisWeek(s, 'a', T + 7 * 86400000), 0, 'la settimana dopo si riparte da zero');
  assert.equal(weekRanking(s, Math.floor((T + 3600000 + 3 * 86400000) / (7 * 86400000)))[0].id, 'a');
  // Il lunedì dopo il giornale annuncia la Casa della settimana, una volta sola.
  r = applyOp(s, { type: 'weekly' }, { system: true, now: T + 7 * 86400000 });
  assert.ok(r.result.announced);
  s = r.state;
  assert.equal(s.news[0].kind, 'casaSettimana');
  assert.match(formatNews(s.news[0], s).title, /anna\.b/);
  assert.equal(applyOp(s, { type: 'weekly' }, { system: true, now: T + 7 * 86400000 + 60000 }).result.changed, false);
  // Missioni di benvenuto: si completano con quello che si fa, poi si ritira il premio.
  let st = missionStatus(s, 'b', T);
  assert.ok(st.welcome.find((m) => m.id === 'visita').done && st.welcome.find((m) => m.id === 'casa').done);
  assert.throws(() => applyOp(s, { type: 'claim', what: 'welcome' }, at('b')), /Completa prima/);
  s = applyOp(s, { type: 'look', look: { skin: 1 } }, at('b')).state;
  for (const t of ['sedia', 'tavolino', 'letto']) s = applyOp(s, { type: 'furni', act: 'add', t, x: 2 + ['sedia', 'tavolino', 'letto'].indexOf(t) * 2, y: 2 }, at('b')).state;
  s = applyOp(s, { type: 'buy', kind: 'wear', id: 'basco' }, at('b')).state;
  for (const what of ['panchina', 'giornale']) s = applyOp(s, { type: 'mark', what }, at('b')).state;
  assert.throws(() => applyOp(s, { type: 'mark', what: 'barare' }, at('b')), /sconosciuta/);
  assert.ok(missionStatus(s, 'b', T).welcomeReady);
  s = applyOp(s, { type: 'claim', what: 'welcome' }, at('b')).state;
  assert.equal(invOf(s, 'b').furni.targa, 1, 'la targa di benvenuto arriva nell\'inventario');
  assert.throws(() => applyOp(s, { type: 'claim', what: 'welcome' }, at('b')), /già ritirato/);
  // Missione del giorno e serie di giorni di fila.
  assert.ok(DAILY.length >= 5);
  let streak = 0;
  for (const d of [3, 4]) { // due giorni di fila con missioni da fare con l'omino
    const t = T + d * 86400000;
    const m = dailyMission(t);
    // Le missioni che si fanno con l'omino (le altre sono già provate sopra)
    if (!['panchina', 'balla', 'saluta', 'giornale'].includes(m.id)) continue;
    s = applyOp(s, { type: 'mark', what: m.id }, at('b', t)).state;
    assert.ok(missionStatus(s, 'b', t).daily.done, `missione ${m.id} completata`);
    const res = applyOp(s, { type: 'claim', what: 'daily' }, at('b', t));
    s = res.state;
    streak = res.result.streak;
    assert.throws(() => applyOp(s, { type: 'claim', what: 'daily' }, at('b', t)), /già fatto/);
  }
  assert.equal(streak, 2, 'due giorni di fila');
  // Sedute: panchine in piazza e mobili in casa; ci si arriva sopra ma non ci si passa attraverso.
  assert.ok(seatAt(s, null, ...BENCHES[0]).bench);
  assert.equal(seatAt(s, null, 0, 0), null);
  const chair = roomOf(s, 'b').items.find((i) => i.t === 'sedia');
  assert.ok(seatAt(s, 'b', chair.x, chair.y));
  assert.ok(roomPath(roomOf(s, 'b'), [0, 5], [chair.x, chair.y]), 'si arriva sulla sedia');
  // Chi se ne va porta via firme e cuori.
  s = applyOp(s, { type: 'leave', id: 'b' }, sys()).state;
  assert.equal(s.guestbook.a.length, 0);
  assert.equal(s.progress.b, undefined);
});

test('piano della città: vie ogni 5 caselle, lotti distanziati sulle vie, piazza grande, mezzi della Ciclofficina', async () => {
  const { isStreet, PIAZZA, PIAZZA_CENTER, walkable, RIDES, WALK_SPEED, invOf } = await import('../public/js/core.js');
  let s = emptyState(0);
  assert.ok(PIAZZA.x1 - PIAZZA.x0 + 1 >= 9 && PIAZZA.y1 - PIAZZA.y0 + 1 >= 9, 'la piazza è grande');
  assert.ok(walkable(s, ...PIAZZA_CENTER));
  for (const k of PLAN.lots) {
    const [x, y] = parseKey(k);
    assert.ok(!isStreet(x, y));
    // Nessun lotto attaccato a un altro: tra due case c'è sempre un giardino o una via
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(!isLot(`${x + dx},${y + dy}`), `lotto ${k} attaccato a un altro`);
  }
  // Ogni casa del Centro ha la porta su una via già tracciata
  s = seedResidents(s, 20, 10_000_000);
  for (const h of Object.values(s.houses)) {
    const [x, y] = parseKey(h.slot);
    const [dx, dy] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[s.doors[h.slot]];
    assert.ok(s.roads[`${x + dx},${y + dy}`], `la casa ${h.slot} guarda una via`);
  }
  // Mezzi: si prendono, ci si sale, si scende; più veloci che a piedi
  assert.ok(RIDES.every((m) => m.speed > WALK_SPEED));
  s = join(s, 'z', 'zeno.v');
  assert.throws(() => applyOp(s, { type: 'ride', id: 'bici' }, as('z')), /Ciclofficina/);
  s = applyOp(s, { type: 'buy', kind: 'ride', id: 'bici', use: true }, as('z')).state;
  assert.equal(s.residents.z.ride, 'bici');
  assert.deepEqual(invOf(s, 'z').rides, ['bici']);
  s = applyOp(s, { type: 'ride', id: null }, as('z')).state;
  assert.equal(s.residents.z.ride, undefined);
  assert.throws(() => applyOp(s, { type: 'ride', id: 'razzo' }, as('z')), /sconosciuto/);
});

test('pianta: case su tutti e due i lati delle vie, città vecchie sistemate', () => {
  // Ogni casa guarda la sua via: i lotti a nord dell'isolato hanno la porta a nord
  let s = seedResidents(emptyState(0), 24, 10_000_000);
  for (const h of Object.values(s.houses)) assert.equal(s.doors[h.slot], lotFacing(h.slot), `porta della casa ${h.slot}`);
  assert.ok(Object.values(s.houses).some((h) => lotFacing(h.slot) === 'N') && Object.values(s.houses).some((h) => lotFacing(h.slot) === 'S'));
  // Dentro gli isolati non si cammina
  assert.ok(!walkable(s, 37, 32) && walkable(s, 35, 32) && walkable(s, 37, 30));
  // Una casa salvata con la pianta di prima (sopra una via) torna su un lotto vero, e la notizia la segue
  const k = Object.keys(s.houses)[0], h = s.houses[k];
  delete s.houses[k];
  s.houses['45,32'] = { ...h, slot: '45,32' };
  for (const n of s.news) if (n.slot === k) n.slot = '45,32';
  assert.ok(migratePlan(s));
  assert.ok(!s.houses['45,32'] && Object.keys(s.houses).every((slot) => isLot(slot)));
  const moved = Object.values(s.houses).find((x) => x.residentId === h.residentId);
  assert.ok(moved && s.doors[moved.slot]);
  assert.ok(!s.news.some((n) => n.slot === '45,32'));
  assert.ok(!migratePlan(s), 'una città già a posto non cambia');
});

test('municipio: prima di costruire ci si iscrive all\'anagrafe', async () => {
  const { shopById, COMUNE, shopAt } = await import('../public/js/core.js');
  let s = emptyState(0);
  s = applyOp(s, { type: 'join', id: 'n', username: 'nina.c' }, sys()).state;
  s = applyOp(s, { type: 'confirm', id: 'n' }, sys()).state;
  assert.throws(() => applyOp(s, { type: 'chooseSlot', slot: freeLots(s)[0] }, as('n')), /Municipio/);
  const sh = shopById(COMUNE);
  assert.equal(shopAt(40, 21), sh, 'il municipio chiude la piazza a nord');
  s = applyOp(s, { type: 'anagrafe', look: { gender: 'donna', style: 'coda' } }, as('n', 5000)).state;
  assert.equal(s.residents.n.anagrafe, 5000);
  assert.equal(s.residents.n.look.style, 'coda');
  assert.ok(applyOp(s, { type: 'anagrafe' }, as('n', 9000)).result.already, 'ci si iscrive una volta sola');
  s = applyOp(s, { type: 'chooseSlot', slot: freeLots(s)[0] }, as('n')).state;
  // Chi aveva casa prima del Municipio risulta già iscritto
  const old = seedResidents(emptyState(0), 3, 10_000_000);
  for (const r of Object.values(old.residents)) delete r.anagrafe;
  migratePlan(old);
  assert.ok(Object.values(old.residents).every((r) => r.anagrafe));
});

test('soldo: regalo del Comune, premi delle missioni e della Casa della settimana', async () => {
  const { INCOME, dailyReward, soldi, walletOf } = await import('../public/js/core.js');
  assert.equal(soldi(1), '1 soldo'); assert.equal(soldi(40), '40 soldi');
  assert.equal(dailyReward(1), 20); assert.equal(dailyReward(3), 30); assert.equal(dailyReward(100), 70);
  let s = join(emptyState(0), 'a', 'anna.b');
  assert.equal(walletOf(s, 'a'), INCOME.anagrafe);
  assert.ok(applyOp(s, { type: 'anagrafe' }, as('a')).result.already);
  assert.equal(walletOf(applyOp(s, { type: 'anagrafe' }, as('a')).state, 'a'), INCOME.anagrafe, 'il regalo arriva una volta sola');
  // Le città di prima del Soldo: chi è iscritto riceve il regalo
  const old = seedResidents(emptyState(0), 3, 10_000_000);
  for (const r of Object.values(old.residents)) delete r.soldi;
  migratePlan(old);
  assert.ok(Object.values(old.residents).every((r) => r.soldi === INCOME.anagrafe));
});
