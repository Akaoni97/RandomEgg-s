// Casi di prova del pacchetto (03_CASI_DI_PROVA.md) eseguiti sul motore condiviso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOp, emptyState, findLocation, LOCATIONS, positionStats, presentLots, planResidual, reconcile,
  previewTargeted, addDays, romeDate, DomainError, locationHistory, parseNum, fmtTons, tripsFor, normalizeState,
} from '../public/js/core.js';
import { buildDemoState, DEMO_USERS } from '../public/js/seed.js';

const [LUCA, MARCO, GIULIA] = DEMO_USERS;
const T0 = Date.parse('2026-10-05T08:00:00Z');
const DAY = 86400000;
const ctx = (days = 0, user = MARCO) => ({ user, now: T0 + days * DAY, today: romeDate(T0 + days * DAY) });

function run(s, op, c = ctx()) {
  return applyOp(s, op, c).state;
}
function expectError(fn, code) {
  assert.throws(fn, (e) => e instanceof DomainError && (!code || e.code === code));
}
const lotBy = (s, code) => s.lots.find((l) => l.lotCode === code);

test('posizioni: 73, ricerca 18/49/A/Tettoia', () => {
  assert.equal(LOCATIONS.length, 73);
  assert.equal(findLocation('18').location.name, 'Mucchio 18');
  assert.equal(findLocation('49').location.name, 'Mucchio 49');
  assert.equal(findLocation('A').location.name, 'Baia A');
  assert.equal(findLocation('a').location.name, 'Baia A');
  assert.equal(findLocation('Tettoia').location.id, 'tettoia');
  assert.equal(findLocation('7').location.name, 'Baia 7');
  assert.ok(findLocation('Baia 18').error);
  assert.equal(findLocation('Baia 18').suggestion.id, 'mucchio-18');
  assert.ok(findLocation('61').error);
  assert.ok(findLocation('M').error);
  assert.ok(findLocation('zzz').error);
});

test('numeri in formato italiano', () => {
  assert.equal(parseNum('1.080,30'), 1080.3);
  assert.equal(parseNum('12,5'), 12.5);
  assert.equal(parseNum('12.5'), 12.5);
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.equal(fmtTons(1080.3), '1080,3 t'.replace('1080', '1.080'));
});

function baia1() {
  let s = emptyState();
  s = run(s, { type: 'lot.create', locationId: 'baia-1', material: 'FeSi', client: 'Alfa', lotCode: 'DEMO-A', tons: 30 });
  s = run(s, { type: 'lot.create', locationId: 'baia-1', material: 'FeMn', client: 'Beta', lotCode: 'DEMO-B', tons: 20 });
  return s;
}

test('lotti separati: scarico 8 t da A, B intatto', () => {
  let s = baia1();
  s = run(s, { type: 'lot.unload', lotId: lotBy(s, 'DEMO-A').id, tons: 8 });
  assert.equal(lotBy(s, 'DEMO-A').tons, 22);
  assert.equal(lotBy(s, 'DEMO-B').tons, 20);
  assert.equal(positionStats(s, 'baia-1').present, 42);
});

test('svuotamento: ricerca vuota, storico e appunto conservati', () => {
  let s = baia1();
  s = run(s, { type: 'note.create', locationId: 'baia-1', title: 'Telo', status: 'Aperto' });
  s = run(s, { type: 'lot.unloadAll', lotId: lotBy(s, 'DEMO-A').id });
  s = run(s, { type: 'lot.unloadAll', lotId: lotBy(s, 'DEMO-B').id });
  const st = positionStats(s, 'baia-1');
  assert.equal(st.present, 0);
  assert.equal(st.lots.length, 0);
  assert.equal(s.notes.filter((n) => n.locationId === 'baia-1').length, 1);
  assert.equal(locationHistory(s, 'baia-1').length, 2);
  assert.ok(s.movements.some((m) => m.type === 'scarica_tutto'));
});

test('scarico eccessivo rifiutato, giacenza immutata', () => {
  let s = emptyState();
  s = run(s, { type: 'lot.create', locationId: 'baia-2', material: 'X', client: 'Y', lotCode: 'L10', tons: 10 });
  const before = s;
  expectError(() => run(s, { type: 'lot.unload', lotId: lotBy(s, 'L10').id, tons: 15 }), 'validation');
  assert.equal(lotBy(before, 'L10').tons, 10);
  expectError(() => run(s, { type: 'lot.unload', lotId: lotBy(s, 'L10').id, tons: -1 }), 'validation');
  expectError(() => run(s, { type: 'lot.unload', lotId: lotBy(s, 'L10').id, tons: 'abc' }), 'validation');
});

function planState() {
  let s = emptyState();
  s = run(s, { type: 'plan.create', locationId: 'baia-7', material: 'FeSi', client: 'Alfa', lotCode: 'P10', containers: 10, days: 5, startDate: ctx().today, totalTons: 270 });
  return s;
}
const reconcileAt = (s, days) => reconcile(s, ctx(days)) || s;

test('piano: giorno iniziale nessuna maturazione, poi 2 al giorno', () => {
  let s = planState();
  assert.equal(s.plans[0].receivedContainers, 0);
  assert.equal(positionStats(s, 'baia-7').incoming, 270);
  s = reconcileAt(s, 1);
  assert.equal(s.plans[0].receivedContainers, 2);
  assert.equal(s.plans[0].receivedTons, 54);
  s = reconcileAt(s, 2);
  assert.equal(s.plans[0].receivedContainers, 4);
  assert.equal(s.plans[0].receivedTons, 108);
  assert.equal(planResidual(s.plans[0]), 162);
  // riconciliare di nuovo lo stesso giorno non duplica
  assert.equal(reconcile(s, ctx(2)), null);
});

test('sequenza quantitativa centrale: lo scarico non viene ricreato', () => {
  let s = reconcileAt(planState(), 2);
  const lot = () => s.lots.find((l) => l.sourcePlanId === s.plans[0].id);
  assert.equal(lot().tons, 108);
  s = run(s, { type: 'lot.unload', lotId: lot().id, tons: 50 }, ctx(2));
  assert.equal(lot().tons, 58);
  assert.equal(s.plans[0].receivedTons, 108);
  assert.equal(planResidual(s.plans[0]), 162);
  s = reconcileAt(s, 3);
  assert.equal(lot().tons, 112);
  assert.equal(s.plans[0].receivedTons, 162);
  assert.equal(planResidual(s.plans[0]), 108);
  s = reconcileAt(s, 4);
  assert.equal(lot().tons, 166);
  s = reconcileAt(s, 5);
  assert.equal(lot().tons, 220);
  assert.equal(s.plans[0].status, 'completato');
  assert.equal(planResidual(s.plans[0]), 0);
  s = reconcileAt(s, 9);
  assert.equal(lot().tons, 220);
  s = run(s, { type: 'lot.unload', lotId: lot().id, tons: 220 }, ctx(9));
  assert.equal(positionStats(s, 'baia-7').present, 0);
  assert.equal(positionStats(s, 'baia-7').incoming, 0);
});

test('annulla piano parzialmente ricevuto: resta il presente', () => {
  let s = reconcileAt(planState(), 2);
  const lotId = s.plans[0].lotId;
  s = run(s, { type: 'lot.unload', lotId, tons: 50 }, ctx(2));
  s = reconcileAt(s, 3);
  s = run(s, { type: 'plan.cancel', planId: s.plans[0].id }, ctx(3));
  assert.equal(s.plans[0].status, 'annullato');
  assert.equal(positionStats(s, 'baia-7').present, 112);
  assert.equal(positionStats(s, 'baia-7').incoming, 0);
  s = reconcileAt(s, 6);
  assert.equal(positionStats(s, 'baia-7').present, 112);
});

test('pausa: nessuna nuova ricezione automatica', () => {
  let s = reconcileAt(planState(), 1);
  s = run(s, { type: 'plan.pause', planId: s.plans[0].id, paused: true }, ctx(1));
  s = reconcileAt(s, 3);
  assert.equal(s.plans[0].receivedContainers, 2);
  // ripresa spostando il calendario dei giorni di pausa
  s = run(s, { type: 'plan.pause', planId: s.plans[0].id, paused: false, shiftSchedule: true }, ctx(3));
  assert.equal(s.plans[0].receivedContainers, 2);
  s = reconcileAt(s, 4);
  assert.equal(s.plans[0].receivedContainers, 4);
});

test('resto: 7 container in 3 giorni → 2, 2, 3', () => {
  let s = emptyState();
  s = run(s, { type: 'plan.create', locationId: 'baia-8', material: 'X', client: 'Y', lotCode: 'R7', containers: 7, days: 3, startDate: ctx().today, totalTons: 189 });
  const seen = [];
  for (let d = 1; d <= 3; d++) { s = reconcileAt(s, d); seen.push(s.plans[0].receivedContainers); }
  assert.deepEqual(seen, [2, 4, 7]);
  assert.equal(s.plans[0].receivedTons, 189);
});

test('ricevi tutto: residuo zero, niente doppio carico', () => {
  let s = reconcileAt(planState(), 1);
  s = run(s, { type: 'plan.receiveAll', planId: s.plans[0].id }, ctx(1));
  assert.equal(s.plans[0].status, 'completato');
  assert.equal(positionStats(s, 'baia-7').present, 270);
  s = reconcileAt(s, 5);
  assert.equal(positionStats(s, 'baia-7').present, 270);
});

test('ricevi oggi: limiti sul residuo e chiusura coerente', () => {
  let s = planState();
  const id = s.plans[0].id;
  s = run(s, { type: 'plan.receive', planId: id, containers: 3, tons: 80 });
  assert.equal(s.plans[0].receivedContainers, 3);
  expectError(() => run(s, { type: 'plan.receive', planId: id, containers: 8, tons: 100 }), 'validation');
  expectError(() => run(s, { type: 'plan.receive', planId: id, containers: 7, tons: 150 }), 'validation');
  expectError(() => run(s, { type: 'plan.receive', planId: id, containers: 2, tons: 190 }), 'validation');
  // la ricezione manuale anticipata viene contata dall'automatico
  s = reconcileAt(s, 1);
  assert.equal(s.plans[0].receivedContainers, 3);
  s = reconcileAt(s, 2);
  assert.equal(s.plans[0].receivedContainers, 4);
});

test('modifica piano: il ricevuto resta, vincoli sul totale', () => {
  let s = reconcileAt(planState(), 2);
  const p = s.plans[0];
  expectError(() => run(s, { type: 'plan.update', planId: p.id, fields: { containers: 3 } }, ctx(2)), 'validation');
  s = run(s, { type: 'plan.update', planId: p.id, fields: { containers: 12, totalTons: 330 } }, ctx(2));
  assert.equal(s.plans[0].receivedTons, 108);
  assert.equal(planResidual(s.plans[0]), 222);
});

test('elimina piano solo se nulla è stato ricevuto', () => {
  let s = planState();
  const s2 = reconcileAt(s, 1);
  expectError(() => run(s2, { type: 'plan.delete', planId: s2.plans[0].id }, ctx(1)), 'validation');
  s = run(s, { type: 'plan.delete', planId: s.plans[0].id });
  assert.equal(s.plans.length, 0);
});

test('ordine completato: nessuno scarico implicito', () => {
  let s = baia1();
  s = run(s, { type: 'order.create', title: 'Camion', date: ctx().today, locationId: 'baia-1', qty: 10, unit: 't', status: 'Da fare' });
  const o = s.orders[0];
  s = run(s, { type: 'order.update', orderId: o.id, expectRev: o.rev, fields: { status: 'Completato' } });
  assert.equal(s.orders[0].status, 'Completato');
  assert.equal(positionStats(s, 'baia-1').present, 50);
});

test('trasferimento: totale del magazzino invariato', () => {
  let s = baia1();
  s = run(s, { type: 'lot.transfer', lotId: lotBy(s, 'DEMO-A').id, toLocationId: 'baia-4', tons: 8 });
  assert.equal(positionStats(s, 'baia-1').present, 42);
  assert.equal(positionStats(s, 'baia-4').present, 8);
  assert.equal(presentLots(s).reduce((a, l) => a + l.tons, 0), 50);
});

test('concorrenza: revisione vecchia → conflitto, nessuna perdita', () => {
  let s = baia1();
  const lot = lotBy(s, 'DEMO-A');
  const rev = lot.rev;
  s = run(s, { type: 'lot.unload', lotId: lot.id, expectRev: rev, tons: 5 });
  expectError(() => run(s, { type: 'lot.unload', lotId: lot.id, expectRev: rev, tons: 3 }), 'conflict');
  assert.equal(lotBy(s, 'DEMO-A').tons, 25);
});

test('idempotenza: stesso opId, un solo effetto', () => {
  let s = baia1();
  const op = { type: 'lot.unload', lotId: lotBy(s, 'DEMO-A').id, tons: 5, opId: 'op-1' };
  s = run(s, op);
  const r = applyOp(s, op, ctx());
  assert.equal(r.duplicate, true);
  assert.equal(lotBy(r.state, 'DEMO-A').tons, 25);
});

test('aggiornamento mirato: solo il lotto indicato cambia', () => {
  let s = buildDemoState(T0);
  const before = structuredClone(s);
  const pv = previewTargeted(s, { updates: [{ location: 'mucchio-21', lot: 'DEMO-M21', tons: 125.5 }] });
  assert.equal(pv.ok, true);
  s = run(s, { type: 'data.importTargeted', payload: { updates: [{ location: 'mucchio-21', lot: 'DEMO-M21', tons: 125.5 }] } }, ctx(0, LUCA));
  assert.equal(lotBy(s, 'DEMO-M21').tons, 125.5);
  for (const l of before.lots) if (l.lotCode !== 'DEMO-M21' && !l.sourcePlanId) assert.equal(lotBy(s, l.lotCode).tons, l.tons);
  assert.deepEqual(s.notes.map((n) => n.title), before.notes.map((n) => n.title));
  assert.equal(s.orders.length, before.orders.length);
});

test('import ambiguo e posizioni non mucchio rifiutati', () => {
  const s = buildDemoState(T0);
  assert.equal(previewTargeted(s, { updates: [{ location: 'mucchio-22', tons: 10 }] }).ok, false);
  assert.equal(previewTargeted(s, { updates: [{ location: 'baia-1', lot: 'DEMO-A', tons: 10 }] }).ok, false);
  assert.equal(previewTargeted(s, { updates: [{ location: '21', lot: 'NUOVO', tons: 10 }] }).ok, false);
  expectError(() => run(s, { type: 'data.importTargeted', payload: { updates: [{ location: 'mucchio-22', tons: 10 }] } }, ctx(0, LUCA)), 'validation');
  expectError(() => run(s, { type: 'data.importTargeted', payload: { updates: [{ location: 'mucchio-21', lot: 'DEMO-M21', tons: 1 }] } }, ctx(0, MARCO)), 'forbidden');
});

test('appunti: un operatore non elimina appunti altrui', () => {
  let s = emptyState();
  s = run(s, { type: 'note.create', title: 'Di Luca', locationId: null }, ctx(0, LUCA));
  const n = s.notes[0];
  expectError(() => run(s, { type: 'note.delete', noteId: n.id }, ctx(0, MARCO)), 'forbidden');
  s = run(s, { type: 'note.update', noteId: n.id, fields: { status: 'Risolto' } }, ctx(0, MARCO));
  assert.equal(s.notes[0].updatedByName, 'Marco');
  s = run(s, { type: 'note.delete', noteId: n.id }, ctx(0, LUCA));
  assert.equal(s.notes.length, 0);
});

test('demo: stato iniziale coerente con il brief', () => {
  const s = buildDemoState(T0);
  assert.equal(positionStats(s, 'baia-1').lots.length, 2);
  assert.equal(positionStats(s, 'baia-5').present, 0);
  const p = s.plans.find((x) => x.lotCode === 'DEMO-P10');
  assert.equal(p.receivedContainers, 4);
  assert.equal(p.receivedTons, 108);
  assert.equal(positionStats(s, 'baia-2').over, true);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.ok(GIULIA);
});

test('mezzi: viaggi, stato, permessi, archivi vecchi', () => {
  let s = emptyState();
  const trips = Object.fromEntries(tripsFor(s, 22).map((v) => [v.id, v.trips]));
  assert.deepEqual(trips, { pala: 3, merlo: 6, 'muletto-1': 8, 'muletto-2': 8 });
  assert.equal(tripsFor(s, 10)[0].trips, 1);
  const v = s.fleet.find((x) => x.id === 'muletto-2');
  s = run(s, { type: 'fleet.update', vehicleId: v.id, expectRev: v.rev, fields: { status: 'Manutenzione', note: 'Forche' } });
  assert.equal(s.fleet.find((x) => x.id === 'muletto-2').status, 'Manutenzione');
  expectError(() => run(s, { type: 'fleet.update', vehicleId: 'pala', fields: { capacity: 12 } }, ctx(0, MARCO)), 'forbidden');
  s = run(s, { type: 'fleet.update', vehicleId: 'pala', fields: { capacity: 12 } }, ctx(0, LUCA));
  assert.equal(s.fleet[0].capacity, 12);
  expectError(() => run(s, { type: 'order.create', title: 'X', date: ctx().today, vehicleId: 'ruspa' }), 'validation');
  s = run(s, { type: 'order.create', title: 'X', date: ctx().today, vehicleId: 'merlo' });
  assert.equal(s.orders[0].vehicleId, 'merlo');
  const old = emptyState(); delete old.fleet;
  assert.equal(normalizeState(old).fleet.length, 4);
});
