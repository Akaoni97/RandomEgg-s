// Nucleo logico del magazzino: posizioni, regole quantitative, piani di arrivo.
// Lo stesso modulo gira nel browser (demo locale) e nel server (archivio condiviso),
// così le regole sono scritte una volta sola.

export const APP_VERSION = '1.0.0';
export const TZ = 'Europe/Rome';
export const EPS = 0.0005;

export const DEFAULT_SETTINGS = {
  bayCapacity: 1080.3,      // provvisoria, ricavata dall'inventario: non è una capacità certificata
  tonsPerContainer: 27,     // peso medio di riferimento, modificabile
  arrivalMode: 'stima',     // 'stima' = comportamento del riferimento; 'conferma' = proposta alternativa
  reconcileSeconds: 30,
};

export const SYSTEM_USER = { id: 'system', name: 'Sistema · stima automatica', role: 'system' };

export const ROLES = { admin: 'Amministratore', magazzino: 'Magazzino', ufficio: 'Ufficio' };
export const FORMATS = ['Sfuso', 'Sacconi', 'Altro'];
export const NOTE_STATUSES = ['Aperto', 'In lavorazione', 'Risolto'];
export const ORDER_STATUSES = ['Da fare', 'Programmato', 'Completato', 'Annullato'];
export const ORDER_UNITS = ['t', 'sacconi', 'container', 'pezzi'];
export const EVENT_TYPES = ['Promemoria', 'Carico', 'Mezzi', 'Visita'];
export const VEHICLE_STATUSES = ['Disponibile', 'In uso', 'Manutenzione', 'Fermo'];
export const VEHICLE_KINDS = { loader: 'Pala gommata', telehandler: 'Sollevatore telescopico', forklift: 'Muletto' };

// Mezzi del piazzale (aggiunta di questa versione): portate indicate da Luca.
export const DEFAULT_FLEET = [
  { id: 'pala', name: 'Pala gommata', kind: 'loader', capacity: 10 },
  { id: 'merlo', name: 'Merlo', kind: 'telehandler', capacity: 4 },
  { id: 'muletto-1', name: 'Muletto 1', kind: 'forklift', capacity: 3 },
  { id: 'muletto-2', name: 'Muletto 2', kind: 'forklift', capacity: 3 },
];
function defaultFleet() {
  return DEFAULT_FLEET.map((v) => ({ ...v, status: 'Disponibile', note: '', rev: 1, updatedAt: null, updatedByName: null }));
}

export const MOVEMENT_TYPES = {
  creazione:      { label: 'Nuovo lotto',        sign: 1 },
  carico:         { label: 'Carico',             sign: 1 },
  scarico:        { label: 'Scarico',            sign: -1 },
  scarica_tutto:  { label: 'Scarica tutto',      sign: -1 },
  ricezione:      { label: 'Ricezione arrivo',   sign: 1 },
  stima:          { label: 'Stima automatica',   sign: 1 },
  rettifica:      { label: 'Rettifica',          sign: 0 },
  trasferimento:  { label: 'Trasferimento',      sign: 0 },
  eliminazione:   { label: 'Eliminazione lotto', sign: -1 },
  annullo_arrivo: { label: 'Arrivo annullato',   sign: 0 },
  aggiornamento:  { label: 'Aggiornamento mirato', sign: 0 },
};

export class DomainError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.code = code; // validation | conflict | forbidden | notfound
    this.extra = extra;
  }
}
const invalid = (msg, extra) => new DomainError('validation', msg, extra);
const conflict = (msg) => new DomainError('conflict', msg);
const forbidden = (msg) => new DomainError('forbidden', msg);

/* ------------------------------------------------------------------ */
/* Posizioni                                                           */
/* ------------------------------------------------------------------ */

function buildLocations() {
  const list = [];
  const nums = [];
  for (let n = 1; n <= 17; n++) nums.push(n);
  nums.push(19, 20);
  for (const n of nums) list.push({ id: `baia-${n}`, name: `Baia ${n}`, kind: 'baia', code: String(n), group: 'Baie 1–20' });
  list.push({ id: 'mucchio-18', name: 'Mucchio 18', kind: 'mucchio', code: '18', group: 'Mucchi' });
  for (let n = 21; n <= 60; n++) list.push({ id: `mucchio-${n}`, name: `Mucchio ${n}`, kind: 'mucchio', code: String(n), group: 'Mucchi' });
  for (const l of 'ABCDEFGHIJKL') list.push({ id: `baia-${l.toLowerCase()}`, name: `Baia ${l}`, kind: 'baia', code: l, group: 'Baie A–L' });
  list.push({ id: 'tettoia', name: 'Tettoia', kind: 'deposito', code: 'T', group: 'Deposito' });
  return list;
}

export const LOCATIONS = Object.freeze(buildLocations());
export const LOCATION_BY_ID = Object.freeze(Object.fromEntries(LOCATIONS.map((l) => [l.id, l])));
export const KIND_LABEL = { baia: 'Baia', mucchio: 'Mucchio', deposito: 'Deposito' };

export function getLocation(id) {
  return LOCATION_BY_ID[id] || null;
}

function normQuery(q) {
  return String(q ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Risolve quanto scritto nella ricerca in una posizione.
 * "18" → Mucchio 18, "49" → Mucchio 49, "A" → Baia A, "Tettoia" → deposito.
 * Restituisce { location } oppure { error, hint }.
 */
export function findLocation(query) {
  const q = normQuery(query);
  if (!q) return { error: 'Scrivi un numero, una lettera o il nome della posizione.' };
  if (LOCATION_BY_ID[q]) return { location: LOCATION_BY_ID[q] };
  if (/^(t|tett|tettoia|deposito)$/.test(q) || 'tettoia'.startsWith(q) && q.length >= 3) return { location: LOCATION_BY_ID.tettoia };

  const m = q.match(/^(baia|b|mucchio|m|mucc?)?\s*([0-9]{1,3}|[a-z])$/);
  if (!m) return { error: `“${query}” non corrisponde a nessuna posizione.` };
  const prefix = m[1] ? (m[1].startsWith('b') ? 'baia' : 'mucchio') : null;
  const code = m[2].toUpperCase();
  const loc = LOCATIONS.find((l) => l.code === code && l.kind !== 'deposito');
  if (!loc) return { error: `La posizione “${query}” non esiste.`, hint: 'Posizioni valide: Baie 1–17, 19, 20, A–L · Mucchi 18 e 21–60 · Tettoia.' };
  if (prefix && prefix !== loc.kind) {
    return { error: `${prefix === 'baia' ? 'Baia' : 'Mucchio'} ${code} non esiste.`, hint: `Il ${code} è ${loc.name}.`, suggestion: loc };
  }
  return { location: loc };
}

/** Suggerimenti mentre si scrive: posizioni il cui codice o nome inizia con la ricerca. */
export function suggestLocations(query, limit = 8) {
  const q = normQuery(query);
  if (!q) return [];
  const bare = q.replace(/^(baia|mucchio)\s*/, '');
  const scored = [];
  for (const l of LOCATIONS) {
    const code = l.code.toLowerCase();
    const name = l.name.toLowerCase();
    let score = -1;
    if (code === bare) score = 100;
    else if (name === q) score = 95;
    else if (code.startsWith(bare) && bare) score = 60 - code.length;
    else if (name.startsWith(q)) score = 40;
    else if (name.includes(q)) score = 20;
    if (score >= 0) scored.push({ l, score });
  }
  scored.sort((a, b) => b.score - a.score || compareLocations(a.l, b.l));
  return scored.slice(0, limit).map((s) => s.l);
}

export function compareLocations(a, b) {
  return LOCATIONS.indexOf(a) - LOCATIONS.indexOf(b);
}

/* ------------------------------------------------------------------ */
/* Numeri e date                                                       */
/* ------------------------------------------------------------------ */

export function round3(n) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Accetta "12,5", "1.080,30", "12.5", 12.5. Restituisce NaN se non valido. */
export function parseNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s|t$/gi, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

const nf = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: 'always' });
const nf2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: 'always' });
export function fmtNum(n, { fixed2 = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  return (fixed2 ? nf2 : nf).format(round3(n));
}
export function fmtTons(n, opts) {
  return `${fmtNum(n, opts)} t`;
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export function romeDate(ms) {
  return dayFmt.format(new Date(ms));
}
export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

let idCounter = 0;
export function uid(prefix = 'id') {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  const rnd = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
  idCounter = (idCounter + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rnd}`;
}

/* ------------------------------------------------------------------ */
/* Stato                                                               */
/* ------------------------------------------------------------------ */

export function emptyState() {
  return {
    schema: 1,
    rev: 0,
    settings: { ...DEFAULT_SETTINGS },
    lots: [],
    plans: [],
    receipts: [],
    movements: [],
    notes: [],
    orders: [],
    events: [],
    audit: [],
    fleet: defaultFleet(),
    meta: { recentOps: [], createdAt: null },
  };
}

/** Completa uno stato salvato da una versione precedente (es. senza mezzi). */
export function normalizeState(s) {
  if (!s || typeof s !== 'object') return s;
  if (!Array.isArray(s.fleet)) s.fleet = defaultFleet();
  for (const k of ['lots', 'plans', 'receipts', 'movements', 'notes', 'orders', 'events', 'audit']) if (!Array.isArray(s[k])) s[k] = [];
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  s.meta ||= { recentOps: [], createdAt: null };
  s.meta.recentOps ||= [];
  return s;
}

/** Viaggi necessari per spostare una quantità con ciascun mezzo disponibile. */
export function tripsFor(s, t) {
  if (!Number.isFinite(t) || t <= 0) return [];
  return (s.fleet || []).map((v) => ({ ...v, trips: Math.ceil(round3(t / v.capacity) - 1e-9) }));
}

/* Selettori ---------------------------------------------------------- */

export const isPresent = (lot) => lot.status === 'presente' && lot.tons > EPS;

export function presentLots(s, locationId) {
  return s.lots.filter((l) => isPresent(l) && (!locationId || l.locationId === locationId));
}

export const planResidual = (p) => Math.max(0, round3(p.totalTons - p.receivedTons));
export const planRemainingContainers = (p) => Math.max(0, p.containers - p.receivedContainers);
export const planIsOpen = (p) => p.status === 'attivo';

export function openPlans(s, locationId) {
  return s.plans.filter((p) => planIsOpen(p) && (!locationId || p.locationId === locationId));
}

export function capacityOf(s, loc) {
  if (!loc) return null;
  return loc.kind === 'baia' && s.settings.bayCapacity > 0 ? s.settings.bayCapacity : null;
}

export function positionStats(s, locationId) {
  const loc = getLocation(locationId);
  const lots = presentLots(s, locationId);
  const plans = openPlans(s, locationId);
  const present = round3(lots.reduce((a, l) => a + l.tons, 0));
  const incoming = round3(plans.reduce((a, p) => a + planResidual(p), 0));
  const capacity = capacityOf(s, loc);
  const final = round3(present + incoming);
  return {
    present,
    incoming,
    final,
    capacity,
    free: capacity != null ? Math.max(0, round3(capacity - present)) : null,
    over: capacity != null && final > capacity + EPS,
    overNow: capacity != null && present > capacity + EPS,
    lots,
    plans,
  };
}

/** Obiettivo cumulativo dei container stimati alla data (formula del riferimento). */
export function autoTarget(p, today) {
  const elapsed = Math.max(0, daysBetween(p.startDate, today));
  return Math.floor((p.containers * Math.min(p.days, elapsed)) / p.days);
}

/** Calendario del piano: per ogni giornata obiettivo cumulativo e incremento. */
export function planSchedule(p, today) {
  const elapsed = daysBetween(p.startDate, today);
  const rows = [];
  let prev = 0;
  for (let d = 1; d <= p.days; d++) {
    const cum = Math.floor((p.containers * d) / p.days);
    rows.push({
      day: d,
      date: addDays(p.startDate, d),
      cum,
      inc: cum - prev,
      state: d < elapsed ? 'past' : d === elapsed ? 'today' : 'future',
    });
    prev = cum;
  }
  return rows;
}

export function planEstimatedUnconfirmed(s, planId) {
  return s.receipts.filter((r) => r.planId === planId && r.mode === 'stima' && !r.confirmedAt);
}

export function lotHasEstimates(s, lot) {
  return !!lot.sourcePlanId && planEstimatedUnconfirmed(s, lot.sourcePlanId).length > 0;
}

/** Lotti passati da una posizione (anche esauriti), ricostruiti dai movimenti. */
export function locationHistory(s, locationId) {
  const map = new Map();
  for (const m of s.movements) {
    const touches = m.locationId === locationId || m.toLocationId === locationId;
    if (!touches || !m.lotCode) continue;
    const key = `${m.lotCode}|${m.material}|${m.client}`;
    const e = map.get(key) || { lotCode: m.lotCode, material: m.material, client: m.client, inTons: 0, outTons: 0, first: m.at, last: m.at, count: 0 };
    const t = m.tons || 0;
    const sign = movementSignFor(m, locationId);
    if (sign > 0) e.inTons += t; else if (sign < 0) e.outTons += t;
    e.first = Math.min(e.first, m.at); e.last = Math.max(e.last, m.at); e.count++;
    map.set(key, e);
  }
  const present = presentLots(s, locationId);
  return [...map.values()]
    .map((e) => ({ ...e, inTons: round3(e.inTons), outTons: round3(e.outTons),
      stillPresent: present.some((l) => l.lotCode === e.lotCode && l.material === e.material && l.client === e.client) }))
    .sort((a, b) => b.last - a.last);
}

/** Segno della quantità di un movimento rispetto a una posizione. */
export function movementSignFor(m, locationId) {
  if (m.type === 'trasferimento') {
    if (m.toLocationId === locationId) return 1;
    if (m.locationId === locationId) return -1;
    return 0;
  }
  if (m.type === 'rettifica' || m.type === 'aggiornamento') return m.delta > 0 ? 1 : m.delta < 0 ? -1 : 0;
  return MOVEMENT_TYPES[m.type]?.sign ?? 0;
}

/** Posizioni più usate negli ultimi movimenti, con una base fissa per i dati vuoti. */
export function frequentLocations(s, limit = 8) {
  const counts = new Map();
  for (const m of s.movements.slice(-400)) {
    if (m.locationId) counts.set(m.locationId, (counts.get(m.locationId) || 0) + 1);
  }
  for (const l of s.lots) if (isPresent(l)) counts.set(l.locationId, (counts.get(l.locationId) || 0) + 0.5);
  const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  for (const id of ['baia-1', 'mucchio-18', 'baia-a', 'tettoia']) if (!ids.includes(id)) ids.push(id);
  return ids.slice(0, limit).map(getLocation).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Permessi                                                            */
/* ------------------------------------------------------------------ */

const ADMIN_OPS = new Set(['settings.update', 'data.importTargeted', 'data.replaceAll']);

export function canDo(user, opType) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'system') return opType === 'system.reconcile';
  if (ADMIN_OPS.has(opType)) return false;
  return user.role === 'magazzino' || user.role === 'ufficio';
}

/** Regola del riferimento: si eliminano solo i propri appunti; l'amministratore gestisce quelli senza autore. */
export function canDeleteNote(user, note) {
  if (!user || !note) return false;
  if (note.createdBy) return note.createdBy === user.id;
  return user.role === 'admin';
}

/* ------------------------------------------------------------------ */
/* Validazione                                                         */
/* ------------------------------------------------------------------ */

function tons(v, label, { allowZero = false } = {}) {
  const n = parseNum(v);
  if (!Number.isFinite(n)) throw invalid(`${label}: inserisci un numero valido (es. 12,5).`);
  if (n < 0) throw invalid(`${label} non può essere negativo.`);
  if (!allowZero && n <= 0) throw invalid(`${label} deve essere maggiore di zero.`);
  if (n > 1_000_000) throw invalid(`${label}: valore troppo grande.`);
  return round3(n);
}
function int(v, label, min = 1) {
  const n = parseNum(v);
  if (!Number.isInteger(n)) throw invalid(`${label}: serve un numero intero.`);
  if (n < min) throw invalid(`${label} deve essere almeno ${min}.`);
  if (n > 100000) throw invalid(`${label}: valore troppo grande.`);
  return n;
}
function text(v, label, { required = true, max = 160 } = {}) {
  const s = String(v ?? '').trim();
  if (required && !s) throw invalid(`${label} è obbligatorio.`);
  if (s.length > max) throw invalid(`${label}: massimo ${max} caratteri.`);
  return s;
}
function loc(id, label = 'Posizione', { required = true } = {}) {
  if (!id && !required) return null;
  if (!getLocation(id)) throw invalid(`${label} non valida.`);
  return id;
}
function date(v, label = 'Data') {
  if (!isIsoDate(v)) throw invalid(`${label} non valida.`);
  return v;
}
function time(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw invalid('Ora non valida (usa HH:MM).');
  return s;
}
function oneOf(v, list, label) {
  if (!list.includes(v)) throw invalid(`${label} non valido.`);
  return v;
}
function optInt(v, label) {
  if (v === '' || v == null) return null;
  return int(v, label, 0);
}

function find(list, id, what) {
  const item = list.find((x) => x.id === id);
  if (!item) throw conflict(`${what} non esiste più: forse è stato eliminato da un altro operatore. I dati sono stati ricaricati.`);
  return item;
}
function checkRev(entity, expectRev, what) {
  if (expectRev != null && entity.rev !== expectRev) {
    throw conflict(`${what} è stato modificato da un altro operatore mentre lavoravi. Ho ricaricato i dati: controlla e ripeti l'operazione.`);
  }
}

/* ------------------------------------------------------------------ */
/* Registrazioni                                                       */
/* ------------------------------------------------------------------ */

function stamp(ctx) {
  return { at: ctx.now, by: ctx.user.id, byName: ctx.user.name };
}
function lotRef(lot) {
  return { lotId: lot.id, lotCode: lot.lotCode, material: lot.material, client: lot.client, locationId: lot.locationId };
}
function movement(s, ctx, m) {
  const rec = { id: uid('mv'), at: ctx.now, date: ctx.today, by: ctx.user.id, byName: ctx.user.name, note: '', ...m };
  s.movements.push(rec);
  return rec;
}
function audit(s, ctx, action, object, objectId, before, after) {
  s.audit.push({ id: uid('au'), at: ctx.now, by: ctx.user.id, byName: ctx.user.name, action, object, objectId,
    before: before ? summarize(before) : null, after: after ? summarize(after) : null });
  if (s.audit.length > 4000) s.audit.splice(0, s.audit.length - 4000);
}
function summarize(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (['rev', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'updatedByName', 'createdByName'].includes(k)) continue;
    if (v == null || typeof v === 'object') continue;
    out[k] = v;
  }
  return out;
}
function touch(entity, ctx) {
  entity.rev = (entity.rev || 0) + 1;
  entity.updatedAt = ctx.now;
  entity.updatedBy = ctx.user.id;
  entity.updatedByName = ctx.user.name;
}
function created(ctx) {
  return { rev: 1, createdAt: ctx.now, createdBy: ctx.user.id, createdByName: ctx.user.name, updatedAt: ctx.now, updatedBy: ctx.user.id, updatedByName: ctx.user.name };
}

function setLotTons(lot, value) {
  lot.tons = round3(Math.max(0, value));
  if (lot.status !== 'eliminato') lot.status = lot.tons > EPS ? 'presente' : 'esaurito';
  if (lot.tons <= EPS) lot.tons = 0;
}

function sameIdentity(a, b) {
  const n = (x) => String(x || '').trim().toLowerCase();
  return n(a.lotCode) === n(b.lotCode) && n(a.material) === n(b.material) && n(a.client) === n(b.client) && a.format === b.format;
}

/* Ricezioni ---------------------------------------------------------- */

function tonsFor(p, inc) {
  const remaining = planRemainingContainers(p);
  const residual = planResidual(p);
  if (inc >= remaining) return residual;
  return round3((residual * inc) / remaining);
}

function receiveInto(s, p, containers, t, mode, dateIso, ctx, note) {
  let lot = p.lotId ? s.lots.find((l) => l.id === p.lotId) : null;
  if (!lot || lot.status === 'eliminato') {
    lot = {
      id: uid('lot'), material: p.material, client: p.client, lotCode: p.lotCode, locationId: p.locationId,
      tons: 0, format: p.format || 'Sfuso', bags: null, pdfRef: '', origin: 'arrivo', sourcePlanId: p.id,
      status: 'esaurito', ...created(ctx),
    };
    s.lots.push(lot);
    p.lotId = lot.id;
  } else {
    touch(lot, ctx);
  }
  setLotTons(lot, lot.tons + t);
  p.receivedTons = round3(p.receivedTons + t);
  p.receivedContainers += containers;
  touch(p, ctx);
  s.receipts.push({ id: uid('rc'), planId: p.id, containers, tons: t, date: dateIso, mode, ...stamp(ctx), confirmedAt: null });
  movement(s, ctx, { type: mode === 'stima' ? 'stima' : 'ricezione', ...lotRef(lot), tons: t, containers, planId: p.id, date: dateIso,
    note: note || '', mode: mode === 'stima' ? 'automatica' : 'manuale' });
  if (p.receivedContainers >= p.containers) {
    p.status = 'completato';
    p.completedAt = ctx.now;
  }
  return lot;
}

/** Applica le stime automatiche maturate. Non legge mai la giacenza presente:
 *  l'incremento è sempre calcolato sul ricevuto cumulativo del piano. */
export function reconcilePlans(s, ctx) {
  if (s.settings.arrivalMode !== 'stima') return false;
  const sys = { ...ctx, user: SYSTEM_USER };
  let changed = false;
  for (const p of s.plans) {
    if (!planIsOpen(p) || p.paused) continue;
    const upto = Math.min(p.days, Math.max(0, daysBetween(p.startDate, ctx.today)));
    for (let d = 1; d <= upto && planIsOpen(p); d++) {
      const cum = Math.floor((p.containers * d) / p.days);
      if (cum > p.receivedContainers) {
        const inc = cum - p.receivedContainers;
        receiveInto(s, p, inc, tonsFor(p, inc), 'stima', addDays(p.startDate, d), sys, `Giorno ${d} di ${p.days} · ${inc} container stimati`);
        changed = true;
      }
    }
  }
  return changed;
}

/* ------------------------------------------------------------------ */
/* Operazioni                                                          */
/* ------------------------------------------------------------------ */

const H = {};

H['lot.create'] = (s, op, ctx) => {
  const lot = {
    id: uid('lot'),
    locationId: loc(op.locationId),
    material: text(op.material, 'Materiale'),
    client: text(op.client, 'Cliente'),
    lotCode: text(op.lotCode, 'Numero lotto', { max: 60 }),
    tons: 0,
    format: oneOf(op.format || 'Sfuso', FORMATS, 'Formato'),
    bags: optInt(op.bags, 'Numero sacconi'),
    pdfRef: text(op.pdfRef, 'Riferimento PDF', { required: false, max: 200 }),
    origin: 'manuale',
    sourcePlanId: null,
    status: 'presente',
    ...created(ctx),
  };
  setLotTons(lot, tons(op.tons, 'Quantità'));
  s.lots.push(lot);
  movement(s, ctx, { type: 'creazione', ...lotRef(lot), tons: lot.tons, note: text(op.note, 'Nota', { required: false, max: 300 }) });
  audit(s, ctx, 'Creato lotto', 'lotto', lot.id, null, lot);
  return { lotId: lot.id, message: `Lotto ${lot.lotCode} aggiunto in ${getLocation(lot.locationId).name}` };
};

H['lot.load'] = (s, op, ctx) => {
  const lot = find(s.lots, op.lotId, 'Il lotto');
  checkRev(lot, op.expectRev, 'Il lotto');
  if (lot.status === 'eliminato') throw invalid('Il lotto è stato eliminato.');
  const t = tons(op.tons, 'Quantità da caricare');
  touch(lot, ctx);
  setLotTons(lot, lot.tons + t);
  movement(s, ctx, { type: 'carico', ...lotRef(lot), tons: t, note: text(op.note, 'Nota', { required: false, max: 300 }) });
  return { message: `Caricate ${fmtTons(t)} su ${lot.lotCode} · ora ${fmtTons(lot.tons)}` };
};

H['lot.unload'] = (s, op, ctx) => {
  const lot = find(s.lots, op.lotId, 'Il lotto');
  checkRev(lot, op.expectRev, 'Il lotto');
  if (!isPresent(lot)) throw invalid('Il lotto non è più presente.');
  const t = tons(op.tons, 'Quantità da scaricare');
  if (t > lot.tons + EPS) throw invalid(`Non puoi scaricare ${fmtTons(t)}: nel lotto ci sono ${fmtTons(lot.tons)}.`);
  touch(lot, ctx);
  setLotTons(lot, lot.tons - t);
  movement(s, ctx, { type: 'scarico', ...lotRef(lot), tons: t, note: text(op.note, 'Nota', { required: false, max: 300 }) });
  return { message: lot.status === 'esaurito' ? `${lot.lotCode} scaricato completamente` : `Scaricate ${fmtTons(t)} da ${lot.lotCode} · restano ${fmtTons(lot.tons)}` };
};

H['lot.unloadAll'] = (s, op, ctx) => {
  const lot = find(s.lots, op.lotId, 'Il lotto');
  checkRev(lot, op.expectRev, 'Il lotto');
  if (!isPresent(lot)) throw invalid('Il lotto non è più presente.');
  const t = lot.tons;
  touch(lot, ctx);
  setLotTons(lot, 0);
  movement(s, ctx, { type: 'scarica_tutto', ...lotRef(lot), tons: t, note: text(op.note, 'Nota', { required: false, max: 300 }) });
  return { message: `${lot.lotCode}: scaricate tutte le ${fmtTons(t)}` };
};

H['lot.update'] = (s, op, ctx) => {
  const lot = find(s.lots, op.lotId, 'Il lotto');
  checkRev(lot, op.expectRev, 'Il lotto');
  const f = op.fields || {};
  const before = { ...lot };
  const next = {
    material: text(f.material ?? lot.material, 'Materiale'),
    client: text(f.client ?? lot.client, 'Cliente'),
    lotCode: text(f.lotCode ?? lot.lotCode, 'Numero lotto', { max: 60 }),
    format: oneOf(f.format ?? lot.format, FORMATS, 'Formato'),
    bags: f.bags !== undefined ? optInt(f.bags, 'Numero sacconi') : lot.bags,
    pdfRef: text(f.pdfRef ?? lot.pdfRef, 'Riferimento PDF', { required: false, max: 200 }),
  };
  const newLoc = f.locationId ? loc(f.locationId) : lot.locationId;
  const newTons = f.tons !== undefined && f.tons !== '' ? tons(f.tons, 'Quantità', { allowZero: true }) : lot.tons;
  const reason = text(op.reason, 'Motivo', { required: false, max: 300 });
  if (Math.abs(newTons - lot.tons) > EPS && reason.length < 3) throw invalid('Per correggere la quantità scrivi il motivo della rettifica.');

  touch(lot, ctx);
  Object.assign(lot, next);
  if (newLoc !== lot.locationId) {
    movement(s, ctx, { type: 'trasferimento', ...lotRef(lot), toLocationId: newLoc, tons: lot.tons, note: 'Modifica posizione del lotto' });
    lot.locationId = newLoc;
  }
  if (Math.abs(newTons - lot.tons) > EPS) {
    const delta = round3(newTons - lot.tons);
    movement(s, ctx, { type: 'rettifica', ...lotRef(lot), tons: Math.abs(delta), delta, note: reason });
    setLotTons(lot, newTons);
  }
  audit(s, ctx, 'Modificato lotto', 'lotto', lot.id, before, lot);
  return { message: `Lotto ${lot.lotCode} aggiornato` };
};

// Aggiunta di questa versione: trasferimento tracciato fra posizioni.
H['lot.transfer'] = (s, op, ctx) => {
  const lot = find(s.lots, op.lotId, 'Il lotto');
  checkRev(lot, op.expectRev, 'Il lotto');
  if (!isPresent(lot)) throw invalid('Il lotto non è più presente.');
  const to = loc(op.toLocationId, 'Destinazione');
  if (to === lot.locationId) throw invalid('Scegli una destinazione diversa dalla posizione attuale.');
  const t = tons(op.tons, 'Quantità da spostare');
  if (t > lot.tons + EPS) throw invalid(`Puoi spostare al massimo ${fmtTons(lot.tons)}.`);
  const note = text(op.note, 'Nota', { required: false, max: 300 });
  const total = Math.abs(t - lot.tons) <= EPS;
  const target = s.lots.find((l) => l.id !== lot.id && l.locationId === to && l.status !== 'eliminato' && sameIdentity(l, lot));
  movement(s, ctx, { type: 'trasferimento', ...lotRef(lot), toLocationId: to, tons: t, note });
  touch(lot, ctx);
  if (target) {
    touch(target, ctx);
    setLotTons(target, target.tons + t);
    setLotTons(lot, lot.tons - t);
  } else if (total) {
    lot.locationId = to;
  } else {
    setLotTons(lot, lot.tons - t);
    const copy = { ...lot, id: uid('lot'), locationId: to, tons: 0, origin: 'trasferimento', sourcePlanId: null, fromLotId: lot.id, ...created(ctx) };
    setLotTons(copy, t);
    s.lots.push(copy);
  }
  return { message: `Spostate ${fmtTons(t)} di ${lot.lotCode} in ${getLocation(to).name}` };
};

H['lot.delete'] = (s, op, ctx) => {
  const lot = find(s.lots, op.lotId, 'Il lotto');
  checkRev(lot, op.expectRev, 'Il lotto');
  if (lot.status === 'eliminato') throw invalid('Il lotto è già stato eliminato.');
  const t = lot.tons;
  const before = { ...lot };
  touch(lot, ctx);
  lot.status = 'eliminato';
  lot.tons = 0;
  movement(s, ctx, { type: 'eliminazione', ...lotRef(lot), tons: t, note: text(op.reason, 'Motivo', { required: false, max: 300 }) });
  audit(s, ctx, 'Eliminato lotto', 'lotto', lot.id, before, null);
  return { message: `Lotto ${lot.lotCode} tolto dalla giacenza. Lo storico resta consultabile.` };
};

/* Piani di arrivo ---------------------------------------------------- */

function planFields(f, p, s) {
  const out = {
    material: text(f.material ?? p?.material, 'Materiale'),
    client: text(f.client ?? p?.client, 'Cliente'),
    lotCode: text(f.lotCode ?? p?.lotCode, 'Numero lotto', { max: 60 }),
    format: oneOf(f.format ?? p?.format ?? 'Sfuso', FORMATS, 'Formato'),
    containers: int(f.containers ?? p?.containers, 'Numero container', 1),
    days: int(f.days ?? p?.days, 'Giorni stimati', 1),
    startDate: date(f.startDate ?? p?.startDate, 'Primo giorno'),
  };
  const t = f.totalTons ?? p?.totalTons;
  out.totalTons = t === '' || t == null ? round3(out.containers * s.settings.tonsPerContainer) : tons(t, 'Tonnellate totali');
  return out;
}

function checkPlanConsistency(p) {
  if (p.containers < p.receivedContainers) throw invalid(`Sono già stati ricevuti ${p.receivedContainers} container: il totale non può essere inferiore.`);
  if (p.totalTons < p.receivedTons - EPS) throw invalid(`Sono già state ricevute ${fmtTons(p.receivedTons)}: il totale non può essere inferiore.`);
  const remC = planRemainingContainers(p);
  const remT = planResidual(p);
  if (remC === 0 && remT > EPS) throw invalid(`Tutti i container risultano ricevuti ma restano ${fmtTons(remT)}: aumenta i container o riduci le tonnellate.`);
  if (remC > 0 && remT <= EPS) throw invalid(`Le tonnellate sono già tutte ricevute ma restano ${remC} container: riduci i container o aumenta le tonnellate.`);
}

H['plan.create'] = (s, op, ctx) => {
  const f = planFields(op, null, s);
  const p = {
    id: uid('pl'), ...f, locationId: loc(op.locationId),
    receivedTons: 0, receivedContainers: 0, paused: !!op.paused, pausedAt: op.paused ? ctx.today : null,
    status: 'attivo', lotId: null, note: text(op.note, 'Nota', { required: false, max: 300 }), ...created(ctx),
  };
  s.plans.push(p);
  audit(s, ctx, 'Creato piano di arrivo', 'piano', p.id, null, p);
  return { planId: p.id, message: `Piano creato: ${p.containers} container in ${p.days} giorni verso ${getLocation(p.locationId).name}` };
};

H['plan.update'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  if (!planIsOpen(p)) throw invalid('Il piano non è più attivo.');
  const f = op.fields || {};
  const before = { ...p };
  const next = planFields(f, p, s);
  let newLoc = p.locationId;
  if (f.locationId && f.locationId !== p.locationId) {
    if (p.receivedContainers > 0) throw invalid('Il piano ha già ricevuto materiale: per cambiare posizione sposta il lotto con “Trasferisci”.');
    newLoc = loc(f.locationId);
  }
  Object.assign(p, next, { locationId: newLoc });
  checkPlanConsistency(p);
  touch(p, ctx);
  const lot = p.lotId && s.lots.find((l) => l.id === p.lotId);
  if (lot && lot.status !== 'eliminato') {
    Object.assign(lot, { material: p.material, client: p.client, lotCode: p.lotCode, format: p.format });
    touch(lot, ctx);
  }
  if (planRemainingContainers(p) === 0) { p.status = 'completato'; p.completedAt = ctx.now; }
  audit(s, ctx, 'Modificato piano di arrivo', 'piano', p.id, before, p);
  return { message: 'Piano aggiornato. Il materiale già ricevuto resta riconosciuto.' };
};

function receiveManual(s, p, containers, t, ctx, note) {
  const remC = planRemainingContainers(p);
  const remT = planResidual(p);
  if (containers > remC) throw invalid(`Restano solo ${remC} container da ricevere.`);
  if (t > remT + EPS) throw invalid(`Non puoi superare il residuo di ${fmtTons(remT)}. Se il peso è cambiato, modifica prima il piano.`);
  if (containers === remC && Math.abs(t - remT) > EPS) {
    throw invalid(`Questi sono gli ultimi ${remC} container: devono chiudere il residuo di ${fmtTons(remT)}. Se il peso reale è diverso, correggi prima il piano.`);
  }
  if (containers < remC && remT - t <= EPS) {
    throw invalid(`Con ${fmtTons(t)} il residuo si azzera ma restano ${remC - containers} container: correggi prima il piano.`);
  }
  return receiveInto(s, p, containers, t, 'manuale', ctx.today, ctx, note);
}

H['plan.receive'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  if (!planIsOpen(p)) throw invalid('Il piano non è più attivo.');
  const c = int(op.containers, 'Container ricevuti', 1);
  const t = op.tons === '' || op.tons == null ? tonsFor(p, c) : tons(op.tons, 'Tonnellate ricevute');
  receiveManual(s, p, c, t, ctx, text(op.note, 'Nota', { required: false, max: 300 }));
  return { message: p.status === 'completato' ? `Ricevuti ${c} container: piano completato` : `Ricevuti ${c} container (${fmtTons(t)}) · residuo ${fmtTons(planResidual(p))}` };
};

H['plan.receiveAll'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  if (!planIsOpen(p)) throw invalid('Il piano non è più attivo.');
  const c = planRemainingContainers(p);
  const t = planResidual(p);
  receiveManual(s, p, c, t, ctx, text(op.note, 'Nota', { required: false, max: 300 }) || 'Ricevuto tutto il residuo');
  return { message: `Ricevuto tutto: ${c} container, ${fmtTons(t)}. Piano completato.` };
};

H['plan.pause'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  if (!planIsOpen(p)) throw invalid('Il piano non è più attivo.');
  const pause = !!op.paused;
  if (pause === p.paused) return { message: pause ? 'Il piano era già in pausa' : 'Il piano era già attivo' };
  const before = { ...p };
  if (pause) {
    p.paused = true;
    p.pausedAt = ctx.today;
  } else {
    if (op.shiftSchedule && p.pausedAt) {
      const shift = Math.max(0, daysBetween(p.pausedAt, ctx.today));
      p.startDate = addDays(p.startDate, shift);
    }
    p.paused = false;
    p.pausedAt = null;
  }
  touch(p, ctx);
  audit(s, ctx, pause ? 'Pausa automatico' : 'Ripreso automatico', 'piano', p.id, before, p);
  return { message: pause ? 'Automatico in pausa: nessuna nuova stima finché non lo riprendi' : 'Automatico ripreso' };
};

H['plan.cancel'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  if (!planIsOpen(p)) throw invalid('Il piano non è più attivo.');
  const residual = planResidual(p);
  const before = { ...p };
  p.status = 'annullato';
  p.cancelledTons = residual;
  p.cancelledContainers = planRemainingContainers(p);
  p.cancelledAt = ctx.now;
  touch(p, ctx);
  const lot = p.lotId && s.lots.find((l) => l.id === p.lotId);
  movement(s, ctx, { type: 'annullo_arrivo', lotId: lot?.id || null, lotCode: p.lotCode, material: p.material, client: p.client,
    locationId: p.locationId, tons: residual, containers: p.cancelledContainers, planId: p.id,
    note: text(op.reason, 'Motivo', { required: false, max: 300 }) || 'Annullato il residuo non ricevuto' });
  audit(s, ctx, 'Annullato arrivo', 'piano', p.id, before, p);
  return { message: `Arrivo annullato: tolte ${fmtTons(residual)} previste. Il materiale già ricevuto resta.` };
};

H['plan.delete'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  if (p.receivedContainers > 0) throw invalid(`Il piano ha già ricevuto ${p.receivedContainers} container: usa “Annulla arrivo” per togliere solo il residuo.`);
  s.plans = s.plans.filter((x) => x.id !== p.id);
  audit(s, ctx, 'Eliminato piano di arrivo', 'piano', p.id, p, null);
  return { message: 'Piano di arrivo eliminato' };
};

// Aggiunta di questa versione: conferma che le stime corrispondono a consegne reali.
H['plan.confirmEstimates'] = (s, op, ctx) => {
  const p = find(s.plans, op.planId, 'Il piano di arrivo');
  checkRev(p, op.expectRev, 'Il piano di arrivo');
  const list = planEstimatedUnconfirmed(s, p.id);
  if (!list.length) throw invalid('Non ci sono stime da confermare.');
  for (const r of list) { r.confirmedAt = ctx.now; r.confirmedBy = ctx.user.id; r.confirmedByName = ctx.user.name; }
  touch(p, ctx);
  const c = list.reduce((a, r) => a + r.containers, 0);
  audit(s, ctx, `Confermate stime (${c} container)`, 'piano', p.id, null, null);
  return { message: `Confermati ${c} container stimati come arrivati` };
};

/* Appunti ------------------------------------------------------------ */

H['note.create'] = (s, op, ctx) => {
  const n = {
    id: uid('nt'), title: text(op.title, 'Titolo', { max: 120 }), text: text(op.text, 'Testo', { required: false, max: 2000 }),
    locationId: loc(op.locationId, 'Posizione', { required: false }), status: oneOf(op.status || 'Aperto', NOTE_STATUSES, 'Stato'),
    important: !!op.important, ...created(ctx),
  };
  s.notes.push(n);
  audit(s, ctx, 'Creato appunto', 'appunto', n.id, null, n);
  return { noteId: n.id, message: 'Appunto salvato' };
};
H['note.update'] = (s, op, ctx) => {
  const n = find(s.notes, op.noteId, "L'appunto");
  checkRev(n, op.expectRev, "L'appunto");
  const f = op.fields || {};
  const before = { ...n };
  Object.assign(n, {
    title: text(f.title ?? n.title, 'Titolo', { max: 120 }),
    text: text(f.text ?? n.text, 'Testo', { required: false, max: 2000 }),
    locationId: f.locationId !== undefined ? loc(f.locationId, 'Posizione', { required: false }) : n.locationId,
    status: oneOf(f.status ?? n.status, NOTE_STATUSES, 'Stato'),
    important: f.important !== undefined ? !!f.important : n.important,
  });
  touch(n, ctx);
  audit(s, ctx, 'Modificato appunto', 'appunto', n.id, before, n);
  return { message: 'Appunto aggiornato' };
};
H['note.delete'] = (s, op, ctx) => {
  const n = find(s.notes, op.noteId, "L'appunto");
  checkRev(n, op.expectRev, "L'appunto");
  if (!canDeleteNote(ctx.user, n)) {
    throw forbidden(n.createdBy ? `Puoi eliminare solo i tuoi appunti. Questo è di ${n.createdByName || 'un altro operatore'}: puoi modificarlo o segnarlo come Risolto.` : "Gli appunti senza autore li elimina l'amministratore.");
  }
  s.notes = s.notes.filter((x) => x.id !== n.id);
  audit(s, ctx, 'Eliminato appunto', 'appunto', n.id, n, null);
  return { message: 'Appunto eliminato' };
};

/* Ordini ------------------------------------------------------------- */

function orderFields(f, o) {
  return {
    title: text(f.title ?? o?.title, 'Titolo', { max: 140 }),
    date: date(f.date ?? o?.date),
    time: time(f.time ?? o?.time),
    material: text(f.material ?? o?.material, 'Materiale', { required: false }),
    locationId: (f.locationId !== undefined ? f.locationId : o?.locationId) ? loc(f.locationId !== undefined ? f.locationId : o?.locationId) : null,
    qty: (f.qty ?? o?.qty) === '' || (f.qty ?? o?.qty) == null ? null : tons(f.qty ?? o?.qty, 'Quantità', { allowZero: true }),
    unit: oneOf(f.unit ?? o?.unit ?? 't', ORDER_UNITS, 'Unità'),
    status: oneOf(f.status ?? o?.status ?? 'Da fare', ORDER_STATUSES, 'Stato'),
    notes: text(f.notes ?? o?.notes, 'Note', { required: false, max: 1000 }),
    vehicleId: vehicleRef(f.vehicleId !== undefined ? f.vehicleId : o?.vehicleId),
  };
}
let currentState = null; // stato in lavorazione, per validare i riferimenti ai mezzi
function vehicleRef(id) {
  if (!id) return null;
  if (!currentState?.fleet?.some((v) => v.id === id)) throw invalid('Mezzo non valido.');
  return id;
}
H['order.create'] = (s, op, ctx) => {
  const o = { id: uid('or'), ...orderFields(op, null), ...created(ctx) };
  s.orders.push(o);
  audit(s, ctx, 'Creato ordine', 'ordine', o.id, null, o);
  return { orderId: o.id, message: 'Ordine aggiunto' };
};
H['order.update'] = (s, op, ctx) => {
  const o = find(s.orders, op.orderId, "L'ordine");
  checkRev(o, op.expectRev, "L'ordine");
  const before = { ...o };
  Object.assign(o, orderFields(op.fields || {}, o));
  touch(o, ctx);
  audit(s, ctx, 'Modificato ordine', 'ordine', o.id, before, o);
  // Regola del riferimento: lo stato dell'ordine non muove mai la giacenza.
  return { message: o.status === 'Completato' ? 'Ordine completato. Nessuno scarico automatico: la giacenza non cambia.' : 'Ordine aggiornato' };
};
H['order.delete'] = (s, op, ctx) => {
  const o = find(s.orders, op.orderId, "L'ordine");
  checkRev(o, op.expectRev, "L'ordine");
  s.orders = s.orders.filter((x) => x.id !== o.id);
  audit(s, ctx, 'Eliminato ordine', 'ordine', o.id, o, null);
  return { message: 'Ordine eliminato' };
};

/* Calendario --------------------------------------------------------- */

function eventFields(f, e) {
  return {
    title: text(f.title ?? e?.title, 'Titolo', { max: 140 }),
    date: date(f.date ?? e?.date),
    time: time(f.time ?? e?.time),
    kind: oneOf(f.kind ?? e?.kind ?? 'Promemoria', EVENT_TYPES, 'Tipo'),
    notes: text(f.notes ?? e?.notes, 'Note', { required: false, max: 1000 }),
  };
}
H['event.create'] = (s, op, ctx) => {
  const e = { id: uid('ev'), ...eventFields(op, null), ...created(ctx) };
  s.events.push(e);
  audit(s, ctx, 'Creato evento', 'evento', e.id, null, e);
  return { eventId: e.id, message: 'Evento aggiunto al calendario' };
};
H['event.update'] = (s, op, ctx) => {
  const e = find(s.events, op.eventId, "L'evento");
  checkRev(e, op.expectRev, "L'evento");
  const before = { ...e };
  Object.assign(e, eventFields(op.fields || {}, e));
  touch(e, ctx);
  audit(s, ctx, 'Modificato evento', 'evento', e.id, before, e);
  return { message: 'Evento aggiornato' };
};
H['event.delete'] = (s, op, ctx) => {
  const e = find(s.events, op.eventId, "L'evento");
  checkRev(e, op.expectRev, "L'evento");
  s.events = s.events.filter((x) => x.id !== e.id);
  audit(s, ctx, 'Eliminato evento', 'evento', e.id, e, null);
  return { message: 'Evento eliminato' };
};

/* Impostazioni e dati ------------------------------------------------ */

H['settings.update'] = (s, op, ctx) => {
  const f = op.fields || {};
  const before = { ...s.settings };
  if (f.bayCapacity !== undefined) s.settings.bayCapacity = f.bayCapacity === '' || f.bayCapacity == null ? null : tons(f.bayCapacity, 'Capienza baie');
  if (f.tonsPerContainer !== undefined) s.settings.tonsPerContainer = tons(f.tonsPerContainer, 'Tonnellate per container');
  if (f.arrivalMode !== undefined) s.settings.arrivalMode = oneOf(f.arrivalMode, ['stima', 'conferma'], 'Modalità arrivi');
  audit(s, ctx, 'Modificati parametri', 'impostazioni', 'settings', before, s.settings);
  return { message: 'Parametri salvati' };
};

/** Anteprima dell'aggiornamento mirato: tocca solo lotti esistenti nei mucchi indicati. */
export function previewTargeted(s, payload) {
  let data = payload;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { ok: false, error: 'Il testo non è un JSON valido.', rows: [] }; }
  }
  if (!data || !Array.isArray(data.updates) || !data.updates.length) return { ok: false, error: 'Il file deve contenere “updates”: un elenco di aggiornamenti.', rows: [] };
  const rows = data.updates.map((u, i) => {
    const row = { index: i + 1, input: u, ok: false };
    const found = findLocation(u?.location);
    if (!found.location) return { ...row, error: `Posizione “${u?.location ?? ''}” non trovata.` };
    const l = found.location;
    row.locationId = l.id; row.locationName = l.name;
    if (l.kind !== 'mucchio') return { ...row, error: `${l.name} non è un mucchio: l'aggiornamento mirato vale solo per i mucchi.` };
    const t = parseNum(u?.tons);
    if (!Number.isFinite(t) || t < 0) return { ...row, error: 'Tonnellate non valide.' };
    row.after = round3(t);
    const lots = presentLots(s, l.id);
    let lot;
    if (u.lot) {
      lot = lots.find((x) => x.lotCode.toLowerCase() === String(u.lot).trim().toLowerCase());
      if (!lot) return { ...row, lotCode: u.lot, error: `Il lotto “${u.lot}” non è presente in ${l.name}. L'aggiornamento non crea lotti nuovi.` };
    } else if (lots.length === 1) {
      lot = lots[0];
    } else if (lots.length === 0) {
      return { ...row, error: `In ${l.name} non ci sono lotti presenti da aggiornare.` };
    } else {
      return { ...row, error: `In ${l.name} ci sono ${lots.length} lotti (${lots.map((x) => x.lotCode).join(', ')}): indica quale con “lot”.` };
    }
    return { ...row, ok: true, lotId: lot.id, lotCode: lot.lotCode, material: lot.material, before: lot.tons, delta: round3(row.after - lot.tons) };
  });
  const ids = rows.filter((r) => r.ok).map((r) => r.lotId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'Lo stesso lotto compare più volte nel file.', rows };
  return { ok: rows.every((r) => r.ok), error: rows.every((r) => r.ok) ? null : 'Alcune righe vanno corrette: nessuna modifica è stata applicata.', rows };
}

H['data.importTargeted'] = (s, op, ctx) => {
  const pv = previewTargeted(s, op.payload);
  if (!pv.ok) throw invalid(pv.error || 'Aggiornamento non valido.', pv);
  for (const r of pv.rows) {
    const lot = s.lots.find((l) => l.id === r.lotId);
    if (Math.abs(r.delta) <= EPS) continue;
    touch(lot, ctx);
    movement(s, ctx, { type: 'aggiornamento', ...lotRef(lot), tons: Math.abs(r.delta), delta: r.delta, note: `Aggiornamento mirato: ${fmtTons(r.before)} → ${fmtTons(r.after)}` });
    setLotTons(lot, r.after);
  }
  audit(s, ctx, `Aggiornamento mirato (${pv.rows.length} righe)`, 'giacenza', 'import', null, null);
  return { message: `Aggiornati ${pv.rows.length} lotti. Tutto il resto è rimasto invariato.` };
};

export function validateBackup(data) {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { ok: false, error: 'Il testo non è un JSON valido.' }; }
  }
  const st = data?.state || data;
  const keys = ['lots', 'plans', 'receipts', 'movements', 'notes', 'orders', 'events'];
  for (const k of keys) if (!Array.isArray(st?.[k])) return { ok: false, error: `Backup non valido: manca l'elenco “${k}”.` };
  for (const l of st.lots) {
    if (!getLocation(l.locationId) || !Number.isFinite(l.tons) || l.tons < 0) return { ok: false, error: `Backup non valido: lotto ${l.lotCode || l.id} con posizione o quantità errata.` };
  }
  return { ok: true, state: st, counts: Object.fromEntries(keys.map((k) => [k, st[k].length])) };
}

// Aggiunta di questa versione: stato dei mezzi del piazzale.
H['fleet.update'] = (s, op, ctx) => {
  const v = find(s.fleet, op.vehicleId, 'Il mezzo');
  checkRev(v, op.expectRev, 'Il mezzo');
  const f = op.fields || {};
  const before = { ...v };
  if (f.status !== undefined) v.status = oneOf(f.status, VEHICLE_STATUSES, 'Stato');
  if (f.note !== undefined) v.note = text(f.note, 'Nota', { required: false, max: 200 });
  if ((f.name !== undefined && f.name !== v.name) || (f.capacity !== undefined && Number(parseNum(f.capacity)) !== v.capacity)) {
    if (ctx.user.role !== 'admin') throw forbidden("Nome e portata dei mezzi li cambia l'amministratore.");
    if (f.name !== undefined) v.name = text(f.name, 'Nome', { max: 40 });
    if (f.capacity !== undefined) v.capacity = tons(f.capacity, 'Portata');
  }
  touch(v, ctx);
  audit(s, ctx, `Mezzo: ${v.name} → ${v.status}`, 'mezzo', v.id, before, v);
  return { message: `${v.name}: ${v.status.toLowerCase()}` };
};

H['data.replaceAll'] = (s, op, ctx) => {
  const v = validateBackup(op.backup);
  if (!v.ok) throw invalid(v.error);
  const keep = { rev: s.rev, meta: s.meta };
  const fresh = emptyState();
  Object.assign(s, fresh, structuredClone(v.state), keep, { settings: { ...DEFAULT_SETTINGS, ...(v.state.settings || {}) } });
  s.audit = Array.isArray(v.state.audit) ? v.state.audit : [];
  normalizeState(s);
  audit(s, ctx, 'Importato backup completo', 'archivio', 'backup', null, null);
  return { message: 'Backup importato' };
};

/* ------------------------------------------------------------------ */
/* Motore                                                              */
/* ------------------------------------------------------------------ */

export const OP_TYPES = Object.keys(H);

/**
 * Applica un'operazione a una copia dello stato.
 * - verifica permessi e revisioni (nessuna sovrascrittura silenziosa);
 * - un opId già visto restituisce il risultato precedente senza ripetere l'effetto;
 * - le stime automatiche maturate vengono applicate prima e dopo.
 */
export function applyOp(prev, op, ctx) {
  if (!op || typeof op.type !== 'string' || !H[op.type]) throw invalid('Operazione sconosciuta.');
  if (op.opId) {
    const seen = prev.meta?.recentOps?.find((r) => r.opId === op.opId);
    if (seen) return { state: prev, result: seen.result, duplicate: true };
  }
  if (!canDo(ctx.user, op.type)) throw forbidden('Il tuo ruolo non permette questa operazione.');
  const s = normalizeState(structuredClone(prev));
  reconcilePlans(s, ctx);
  currentState = s;
  let result;
  try { result = H[op.type](s, op, ctx) || {}; } finally { currentState = null; }
  reconcilePlans(s, ctx);
  s.rev += 1;
  if (op.opId) {
    s.meta.recentOps.push({ opId: op.opId, result, at: ctx.now });
    if (s.meta.recentOps.length > 300) s.meta.recentOps.splice(0, s.meta.recentOps.length - 300);
  }
  return { state: s, result };
}

/** Riconciliazione periodica (all'apertura e ogni 30 secondi): restituisce lo stato nuovo se qualcosa è maturato. */
export function reconcile(prev, ctx) {
  const s = structuredClone(prev);
  if (!reconcilePlans(s, ctx)) return null;
  s.rev += 1;
  return s;
}

/** Copia per l'esportazione: niente credenziali (che non stanno comunque nello stato) e niente cache operazioni. */
export function exportBackup(s, extra = {}) {
  const { meta, ...rest } = s;
  return { app: 'magazzino-ferroleghe', version: APP_VERSION, exportedAt: new Date().toISOString(), ...extra, state: rest };
}
