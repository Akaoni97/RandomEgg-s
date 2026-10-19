// Regole di Virtual-Italy: piano regolatore, lotti, strade automatiche, abitanti, amicizie, notizie.
// Codice puro, senza DOM: lo usano il browser (demo e disegno della mappa) e il server,
// così le regole sono scritte una volta sola.

export const CITY = 'Virtual-Italy';
export const PAPER = 'Virtual-Italy IG';
export const W = 84;
export const H = 60;
export const MAIN_Y = 30;                                  // la strada principale attraversa tutta la mappa
export const SEA_Y = 52;                                   // da qui in giù c'è il mare
export const PIAZZA = { x0: 37, y0: 27, x1: 44, y1: 29 };  // estremi inclusi, a nord della strada principale
export const RESERVE_MS = 24 * 3600000;                    // un cantiere senza email confermata dura 24 ore
export const UNLOCK_RATIO = 0.8;                           // un nuovo quartiere si apre all'80% di occupazione
export const FOUNDERS = 100;
export const FRIEND_REQUESTS_PER_DAY = 20;
export const FOUNTAIN_AT = 25;
export const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// Il tracciato delle vie segue una griglia di passo 3: le righe e colonne multiple di 3 sono
// corsie percorribili, gli altri riquadri 2×2 sono lotti. Così ogni lotto tocca sempre una corsia
// e ogni corsia porta a una strada: nessuna casa può restare isolata.
// Le strade principali future (dorsali) stanno anch'esse sulla griglia delle corsie.
export const DISTRICTS = [
  { id: 1, name: 'Centro', rect: [33, 27, 50, 33], dorsal: null,
    walls: ['#e8b86a', '#d98b5f', '#f0d39a', '#e3a27a'] },
  { id: 2, name: 'Borgo Est', rect: [51, 24, 69, 36], dorsal: { x: 60, y0: 18, y1: 42 },
    walls: ['#f3d6d0', '#d7e6ef', '#f4e7b8', '#dcebd2'] },
  { id: 3, name: 'Borgo Ovest', rect: [15, 24, 32, 36], dorsal: { x: 24, y0: 18, y1: 42 },
    walls: ['#d8cfc0', '#c9bba4', '#e6dccb', '#bfb5a6'] },
  { id: 4, name: 'Collina Nord', rect: [15, 12, 69, 26], dorsal: { y: 18, x0: 15, x1: 68 },
    walls: ['#c99a6b', '#b98a5e', '#e0c49e', '#a8794f'] },
  { id: 5, name: 'Marina Sud', rect: [15, 34, 69, 51], dorsal: { y: 42, x0: 15, x1: 68 },
    walls: ['#f5f3ee', '#dbe8f1', '#f7efe0', '#e5eef0'] },
];

export const ROOFS = [
  { id: 'coppi', label: 'Coppi', color: '#b5523b' },
  { id: 'ardesia', label: 'Ardesia', color: '#4b5563' },
  { id: 'verde', label: 'Rame verde', color: '#4f8a72' },
  { id: 'blu', label: 'Blu', color: '#3f6aa1' },
  { id: 'senape', label: 'Senape', color: '#c99a2e' },
  { id: 'prugna', label: 'Prugna', color: '#7a4a6b' },
];
export const DOORS = [
  { id: 'noce', label: 'Noce', color: '#6b4428' },
  { id: 'verde', label: 'Verde', color: '#2f6b4f' },
  { id: 'rosso', label: 'Rosso', color: '#b3362f' },
  { id: 'blu', label: 'Blu', color: '#2d5b8c' },
  { id: 'giallo', label: 'Giallo', color: '#e0a92a' },
  { id: 'bianco', label: 'Bianco', color: '#f1ede4' },
];
export const GARDENS = [
  { id: 'prato', label: 'Prato' },
  { id: 'fiori', label: 'Fiori' },
  { id: 'orto', label: 'Orto' },
  { id: 'ulivo', label: 'Ulivo' },
  { id: 'nessuno', label: 'Ghiaia' },
];
export const DECOS = [
  { id: 'nessuno', label: 'Niente' },
  { id: 'vespa', label: 'Vespa' },
  { id: 'bici', label: 'Bicicletta' },
  { id: 'panchina', label: 'Panchina' },
  { id: 'limoni', label: 'Vaso di limoni' },
  { id: 'cane', label: 'Cuccia' },
];
export const SHAPES = ['casa', 'villetta', 'torretta'];

// Editor del personaggio: ogni scelta è un indice (colori) o un id (pettinatura, accessorio).
export const LOOK = {
  skin: ['#f6dcc6', '#f3d2b3', '#e8b98f', '#c98d63', '#a8714a', '#8d5b3d', '#5e3b26'],
  hair: ['#1f1a17', '#3b2a1e', '#6b4226', '#a4532e', '#d9a441', '#efd9a0', '#8a8a8a', '#e86b8a', '#3f6aa1'],
  style: [{ id: 'corti', label: 'Corti' }, { id: 'lunghi', label: 'Lunghi' }, { id: 'coda', label: 'Coda' }, { id: 'ricci', label: 'Ricci' }],
  shirt: ['#d9442f', '#e88a3a', '#e0a92a', '#2f7d4f', '#4fb3c8', '#3f6aa1', '#7a4a6b', '#e86b8a', '#f1ede4', '#2d2d2d'],
  pants: ['#2d3a4a', '#2f4f6f', '#4b4f56', '#6b4a2f', '#c9b48f', '#2d2d2d'],
  extra: [{ id: 'nessuno', label: 'Niente' }, { id: 'cappellino', label: 'Cappellino' }, { id: 'occhiali', label: 'Occhiali' }, { id: 'fiore', label: 'Fiore' }],
};
// Aspetto di partenza, uguale per sempre per lo stesso nome finché l'abitante non sceglie il suo.
export function defaultLook(name) {
  const h = hash(String(name));
  return {
    skin: h % LOOK.skin.length, hair: (h >>> 3) % 6, style: LOOK.style[(h >>> 14) % 2].id,
    shirt: (h >>> 6) % LOOK.shirt.length, pants: (h >>> 9) % 4, extra: (h >>> 12) % 3 === 0 ? 'cappellino' : 'nessuno',
  };
}
export function cleanLook(raw, name) {
  const base = defaultLook(name);
  const r = raw && typeof raw === 'object' ? raw : {};
  const idx = (v, list, fb) => (Number.isInteger(v) && v >= 0 && v < list.length ? v : fb);
  const id = (v, list, fb) => (list.some((o) => o.id === v) ? v : fb);
  return {
    skin: idx(r.skin, LOOK.skin, base.skin), hair: idx(r.hair, LOOK.hair, base.hair), style: id(r.style, LOOK.style, base.style),
    shirt: idx(r.shirt, LOOK.shirt, base.shirt), pants: idx(r.pants, LOOK.pants, base.pants), extra: id(r.extra, LOOK.extra, base.extra),
  };
}

export class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // validation | conflict | forbidden | notfound | auth
  }
}
const invalid = (msg) => new DomainError('validation', msg);
const forbidden = (msg) => new DomainError('forbidden', msg);

/* Piano regolatore --------------------------------------------------- */

export const key = (x, y) => x + ',' + y;
export const parseKey = (k) => k.split(',').map(Number);

function inRect([x0, y0, x1, y1], x, y) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}
export function inPiazza(x, y) {
  return x >= PIAZZA.x0 && x <= PIAZZA.x1 && y >= PIAZZA.y0 && y <= PIAZZA.y1;
}
function dorsalTiles(d) {
  const out = [];
  if (!d) return out;
  if (d.x !== undefined) for (let y = d.y0; y <= d.y1; y++) out.push(key(d.x, y));
  else for (let x = d.x0; x <= d.x1; x++) out.push(key(x, d.y));
  return out;
}

// Il piano è calcolato una volta: per ogni casella il quartiere, e l'elenco dei lotti.
export const PLAN = (() => {
  const district = new Int8Array(W * H);
  const lots = new Set();
  const lotsByDistrict = new Map(DISTRICTS.map((d) => [d.id, []]));
  const futureRoads = new Map(); // casella → id del quartiere che la attiva
  for (const d of DISTRICTS) for (const k of dorsalTiles(d.dorsal)) if (!futureRoads.has(k)) futureRoads.set(k, d.id);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = DISTRICTS.find((q) => inRect(q.rect, x, y));
      if (!d || y >= SEA_Y) continue;
      district[y * W + x] = d.id;
      const k = key(x, y);
      if (x % 3 === 0 || y % 3 === 0 || y === MAIN_Y || inPiazza(x, y) || futureRoads.has(k)) continue;
      lots.add(k);
      lotsByDistrict.get(d.id).push(k);
    }
  }
  return { district, lots, lotsByDistrict, futureRoads };
})();

export const districtAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : PLAN.district[y * W + x]);
export const isLot = (k) => PLAN.lots.has(k);
export const districtById = (id) => DISTRICTS.find((d) => d.id === id);

export function lotsOpen(openDistricts) {
  let n = 0;
  for (let id = 1; id <= openDistricts; id++) n += PLAN.lotsByDistrict.get(id).length;
  return n;
}

/* Strade automatiche ------------------------------------------------- */

// Rete di base: strada principale, piazza e dorsali dei quartieri aperti.
function baseNetwork(openDistricts) {
  const net = new Map();
  for (let x = 0; x < W; x++) net.set(key(x, MAIN_Y), 'main');
  for (let y = PIAZZA.y0; y <= PIAZZA.y1; y++) for (let x = PIAZZA.x0; x <= PIAZZA.x1; x++) net.set(key(x, y), 'piazza');
  for (const d of DISTRICTS) {
    if (d.id > openDistricts) continue;
    for (const k of dorsalTiles(d.dorsal)) if (!net.has(k)) net.set(k, 'dorsal');
  }
  return net;
}

const STEPS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

// Percorso più breve (ricerca in ampiezza: ogni passo costa uguale, quindi coincide con A*)
// dal lotto alla casella di rete più vicina, passando solo su corsie dei quartieri aperti.
// I vialetti già tracciati fanno parte della rete, così le case vicine li condividono.
function routeFrom(lotKey, net, openDistricts) {
  const [sx, sy] = parseKey(lotKey);
  const prev = new Map([[lotKey, null]]);
  const queue = [[sx, sy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      if (net.has(nk)) {
        const path = [];
        for (let k = key(x, y); k !== lotKey; k = prev.get(k)) path.push(k);
        return { path: path.reverse(), reach: nk };
      }
      const dId = districtAt(nx, ny);
      if (!dId || dId > openDistricts || PLAN.lots.has(nk)) continue;
      prev.set(nk, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Ricostruisce tutta la rete in ordine di arrivo: deterministica, e quando una dorsale si attiva
// le case vicine si ricollegano da sole a quella, se è più vicina.
export function computeRoads(houses, openDistricts) {
  const net = baseNetwork(openDistricts);
  const doors = {};
  const ordered = Object.values(houses).sort((a, b) => a.reservedAt - b.reservedAt || (a.slot < b.slot ? -1 : 1));
  for (const h of ordered) {
    const r = routeFrom(h.slot, net, openDistricts);
    if (!r) continue;
    for (const k of r.path) net.set(k, 'lane');
    const first = r.path[0] || r.reach;
    const [hx, hy] = parseKey(h.slot);
    const [fx, fy] = parseKey(first);
    doors[h.slot] = fx > hx ? 'E' : fx < hx ? 'W' : fy > hy ? 'S' : 'N';
  }
  return { roads: Object.fromEntries(net), doors };
}

export function canReach(lotKey, houses, openDistricts) {
  const { roads } = computeRoads(houses, openDistricts);
  return !!routeFrom(lotKey, new Map(Object.entries(roads)), openDistricts);
}

/* Livelli del terreno e passeggiate ------------------------------------ */

// Il mondo è a gradoni come nei Pokémon: -1 mare, 0 pianura e spiaggia, 1 paese,
// 2 Collina Nord e prime alture, 3 montagne in fondo alla mappa.
export function levelAt(x, y, openDistricts) {
  if (y > SEA_Y) return -1;
  if (y === SEA_Y) return 0;
  const d = districtAt(x, y);
  if (d === 4 && y <= 23) return 2;
  if (inPiazza(x, y) || (d && d <= openDistricts)) return 1;
  if (!d) {
    const edge = 7 + (hash('monte' + Math.floor(x / 4)) % 3);
    if (y < edge - 3) return 3;
    if (y < edge) return 2;
  }
  return 0;
}

// Dove si può camminare: ovunque sulla terraferma tranne dentro le case.
// Si cambia livello solo su strade, vialetti e piazza, dove ci sono le scale.
export function walkable(s, x, y) {
  return x >= 0 && y >= 0 && x < W && y <= SEA_Y && !s.houses[key(x, y)];
}
export function canStep(s, ax, ay, bx, by) {
  if (!walkable(s, bx, by)) return false;
  if (levelAt(ax, ay, s.openDistricts) === levelAt(bx, by, s.openDistricts)) return true;
  return !!(s.roads[key(ax, ay)] && s.roads[key(bx, by)]);
}

// Percorso a piedi più breve tra due caselle (ricerca in ampiezza). Restituisce le caselle da
// attraversare, esclusa la partenza; vuoto se si è già arrivati, null se non ci si arriva.
export function walkPath(s, from, to, limit = 6000) {
  const [sx, sy] = from, [tx, ty] = to;
  if (sx === tx && sy === ty) return [];
  if (!walkable(s, tx, ty)) return null;
  const start = key(sx, sy), goal = key(tx, ty);
  const prev = new Map([[start, null]]);
  const queue = [[sx, sy]];
  for (let i = 0; i < queue.length && prev.size < limit; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (prev.has(nk) || !canStep(s, x, y, nx, ny)) continue;
      prev.set(nk, key(x, y));
      if (nk === goal) {
        const path = [];
        for (let k = goal; k !== start; k = prev.get(k)) path.push(parseKey(k));
        return path.reverse();
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

// La casella davanti alla porta di una casa: lì compare l'omino del suo abitante.
export function frontOf(s, slot) {
  const [x, y] = parseKey(slot);
  const d = s.doors?.[slot] || 'S';
  const [dx, dy] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d];
  return [x + dx, y + dy];
}
export const PIAZZA_CENTER = [PIAZZA.x0 + 3, PIAZZA.y0 + 2];

export function spawnPoint(s, residentId) {
  const h = residentHouse(s, residentId);
  return h ? frontOf(s, h.slot) : PIAZZA_CENTER;
}

// Le nuvolette sopra la testa: frasi pronte oppure un messaggio breve e filtrato.
export const SAY_PRESETS = ['Ciao!', 'Buongiorno!', 'Buonasera!', 'Come va?', 'Benvenuto!', 'Bella casa!', 'Ci vediamo in piazza', 'A dopo!', '👋', '😄', '❤️', '👍'];
export const SAY_MAX = 60;
export function checkSay(raw) {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) throw invalid('Scrivi qualcosa da dire.');
  if (t.length > SAY_MAX) throw invalid(`Al massimo ${SAY_MAX} caratteri.`);
  if (isOffensive(t)) throw invalid('Il messaggio contiene parole non ammesse.');
  return t;
}

/* Nomi, frasi e filtri ------------------------------------------------ */

const BAD_WORDS = ['cazz', 'merd', 'stronz', 'puttan', 'troia', 'vaffanc', 'fancul', 'coglion', 'frocio', 'froci',
  'negro', 'ricchion', 'porcodio', 'diocane', 'dioporco', 'mignott', 'zoccol', 'bastard',
  'fuck', 'shit', 'bitch', 'nigg', 'faggot', 'cunt', 'whore', 'nazist', 'hitler', 'pedofil', 'stupr'];
// Parole innocue che contengono una delle precedenti.
const ALLOWED = ['negroni'];
const RESERVED = ['admin', 'amministratore', 'amministrazione', 'sindaco', 'giornale', 'virtualitaly', 'virtualitalyig',
  'redazione', 'moderatore', 'moderazione', 'staff', 'comune', 'support', 'supporto', 'assistenza', 'sistema', 'ufficiale'];

function squash(s) {
  return String(s).toLowerCase()
    .replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}
export function isOffensive(s) {
  let q = squash(s);
  for (const a of ALLOWED) q = q.split(a).join('');
  return BAD_WORDS.some((w) => q.includes(w));
}

export function checkUsername(raw) {
  const u = String(raw ?? '').trim();
  if (!/^[A-Za-z0-9._]{3,20}$/.test(u)) throw invalid('Il nome utente deve avere da 3 a 20 caratteri: lettere, numeri, punto o trattino basso.');
  if (/^[._]|[._]$/.test(u) || /[._]{2}/.test(u)) throw invalid('Il nome utente non può iniziare o finire con punto o trattino basso, né averne due di fila.');
  const q = squash(u);
  if (RESERVED.some((r) => q === r || q.startsWith(r))) throw invalid('Questo nome utente è riservato: scegline un altro.');
  if (isOffensive(u)) throw invalid('Questo nome utente non è ammesso: scegline un altro.');
  return u;
}
export const usernameKey = (u) => String(u).trim().toLowerCase();

export function checkEmail(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  if (e.length > 120 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) throw invalid("L'indirizzo email non sembra valido.");
  return e;
}

export function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw invalid('La password deve avere almeno 8 caratteri.');
  if (p.length > 200) throw invalid('La password è troppo lunga.');
  return p;
}

function cleanBio(raw) {
  const b = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (b.length > 120) throw invalid('La frase di presentazione può avere al massimo 120 caratteri.');
  if (b && isOffensive(b)) throw invalid('La frase contiene parole non ammesse.');
  return b;
}

export function cleanInstagram(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw invalid('Il nome Instagram può contenere solo lettere, numeri, punto e trattino basso.');
  return s.toLowerCase();
}

function pick(list, id, fallback) {
  return list.some((o) => o.id === id) ? id : fallback;
}
// Lo stile della casa: colori scelti dall'abitante, forma e muri dal quartiere (stabili per lotto).
export function makeStyle(slot, choice = {}) {
  const [x, y] = parseKey(slot);
  const d = districtById(districtAt(x, y)) || DISTRICTS[0];
  const h = hash(slot);
  return {
    roof: pick(ROOFS, choice.roof, ROOFS[h % ROOFS.length].id),
    door: pick(DOORS, choice.door, DOORS[(h >>> 3) % DOORS.length].id),
    garden: pick(GARDENS, choice.garden, 'prato'),
    deco: pick(DECOS, choice.deco, 'nessuno'),
    wall: d.walls[(h >>> 6) % d.walls.length],
    shape: SHAPES[(h >>> 9) % SHAPES.length],
  };
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Stato della città -------------------------------------------------- */

export function emptyState(now = Date.now()) {
  const s = {
    rev: 1,
    createdAt: now,
    nextNumber: 1,
    openDistricts: 1,
    residents: {},     // id → { id, username, number, joinedAt, bio, instagram, confirmed, suspended }
    houses: {},        // lotto → { slot, residentId, style, status, reservedAt, builtAt }
    roads: {},
    doors: {},
    requests: [],      // { id, from, to, at }
    friendships: [],   // { a, b, since }
    sentLog: {},       // id → istanti delle richieste inviate nelle ultime 24 ore
    reports: [],       // { id, from, target, reason, at, resolved }
    news: [],          // { id, kind, at, residentId?, n?, district?, slot? }
    milestones: [],
  };
  addNews(s, { kind: 'founding', at: now });
  return refresh(s);
}

let seq = 0;
export const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

function addNews(s, n) {
  s.news.unshift({ id: uid('n'), ...n });
  if (s.news.length > 500) s.news.length = 500;
}

export const residentHouse = (s, residentId) => Object.values(s.houses).find((h) => h.residentId === residentId) || null;
export const builtCount = (s) => Object.values(s.houses).filter((h) => h.status === 'casa').length;
export const isFounder = (r) => !!r && r.number !== null && r.number <= FOUNDERS;
export const areFriends = (s, a, b) => s.friendships.some((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));
export const friendsOf = (s, id) => s.friendships.filter((f) => f.a === id || f.b === id).map((f) => (f.a === id ? f.b : f.a));

// Dopo ogni modifica alle case: quartieri da aprire, traguardi, strade.
function refresh(s, now = Date.now()) {
  while (s.openDistricts < DISTRICTS.length) {
    const taken = Object.values(s.houses).filter((h) => districtAt(...parseKey(h.slot)) <= s.openDistricts).length;
    if (taken < lotsOpen(s.openDistricts) * UNLOCK_RATIO) break;
    s.openDistricts++;
    addNews(s, { kind: 'district', at: now, district: s.openDistricts });
  }
  const built = builtCount(s);
  for (const m of MILESTONES) {
    if (built >= m && !s.milestones.includes(m)) {
      s.milestones.push(m);
      addNews(s, { kind: 'milestone', at: now, n: m });
    }
  }
  const r = computeRoads(s.houses, s.openDistricts);
  s.roads = r.roads;
  s.doors = r.doors;
  return s;
}

function needResident(s, ctx) {
  const r = ctx.user && s.residents[ctx.user.id];
  if (!r) throw new DomainError('auth', 'Accedi per continuare.');
  if (r.suspended) throw forbidden('Il tuo account è sospeso.');
  return r;
}
function needAdmin(ctx) {
  if (!ctx.user?.admin) throw forbidden('Riservato alla redazione.');
}

function finishHouse(s, r, h, now) {
  h.status = 'casa';
  h.builtAt = now;
  addNews(s, { kind: 'welcome', at: now, residentId: r.id, slot: h.slot });
}

// Ogni operazione restituisce un nuovo stato; quello vecchio resta intatto se c'è un errore.
export function applyOp(state, op, ctx) {
  const s = structuredClone(state);
  const now = ctx.now ?? Date.now();
  const result = OPS[op?.type]?.(s, op, ctx, now);
  if (result === undefined) throw invalid('Operazione sconosciuta.');
  s.rev++;
  return { state: s, result };
}

const OPS = {
  // Server: nuovo account creato (email non ancora confermata).
  join(s, op, ctx, now) {
    if (!ctx.system) throw forbidden('Operazione interna.');
    const username = checkUsername(op.username);
    if (Object.values(s.residents).some((r) => usernameKey(r.username) === usernameKey(username))) throw invalid('Questo nome utente è già preso.');
    s.residents[op.id] = { id: op.id, username, number: null, joinedAt: now, bio: '', instagram: '', confirmed: false, suspended: false };
    return { id: op.id };
  },

  // Server: email confermata. Il numero di abitante si assegna qui, così i bot non lo consumano.
  confirm(s, op, ctx, now) {
    if (!ctx.system) throw forbidden('Operazione interna.');
    const r = s.residents[op.id];
    if (!r) throw new DomainError('notfound', 'Abitante non trovato.');
    if (r.confirmed) return { already: true };
    r.confirmed = true;
    r.number = s.nextNumber++;
    const h = residentHouse(s, r.id);
    if (h && h.status === 'cantiere') finishHouse(s, r, h, now);
    refresh(s, now);
    return { number: r.number };
  },

  chooseSlot(s, op, ctx, now) {
    const r = needResident(s, ctx);
    if (residentHouse(s, r.id)) throw invalid('Hai già una casa a Virtual-Italy.');
    const slot = String(op.slot || '');
    if (!isLot(slot)) throw invalid('Qui non si può costruire: scegli uno dei lotti liberi.');
    if (districtAt(...parseKey(slot)) > s.openDistricts) throw invalid('Questo quartiere non è ancora aperto.');
    if (s.houses[slot]) throw new DomainError('conflict', 'Qualcuno ha appena preso questo lotto: scegline un altro.');
    const h = { slot, residentId: r.id, style: makeStyle(slot, op.style), status: 'cantiere', reservedAt: now, builtAt: null };
    s.houses[slot] = h;
    if (r.confirmed) finishHouse(s, r, h, now);
    refresh(s, now);
    return { slot, status: h.status };
  },

  restyle(s, op, ctx) {
    const r = needResident(s, ctx);
    const h = residentHouse(s, r.id);
    if (!h) throw invalid('Non hai ancora una casa.');
    h.style = makeStyle(h.slot, { ...h.style, ...op.style });
    return { ok: true };
  },

  look(s, op, ctx) {
    const r = needResident(s, ctx);
    r.look = cleanLook(op.look, r.username);
    return { ok: true };
  },

  profile(s, op, ctx) {
    const r = needResident(s, ctx);
    if (op.bio !== undefined) r.bio = cleanBio(op.bio);
    if (op.instagram !== undefined) r.instagram = cleanInstagram(op.instagram);
    return { ok: true };
  },

  friendRequest(s, op, ctx, now) {
    const r = needResident(s, ctx);
    if (!r.confirmed) throw forbidden('Conferma la tua email prima di bussare alle porte.');
    const to = s.residents[op.to];
    if (!to || to.id === r.id) throw new DomainError('notfound', 'Abitante non trovato.');
    if (areFriends(s, r.id, to.id)) throw invalid(`Tu e ${to.username} siete già amici.`);
    if (s.requests.some((q) => q.from === r.id && q.to === to.id)) throw invalid('Hai già bussato: aspetta la risposta.');
    const back = s.requests.find((q) => q.from === to.id && q.to === r.id);
    if (back) {
      s.requests = s.requests.filter((q) => q !== back);
      s.friendships.push({ a: to.id, b: r.id, since: now });
      return { friends: true };
    }
    const log = (s.sentLog[r.id] || []).filter((t) => now - t < 86400000);
    if (log.length >= FRIEND_REQUESTS_PER_DAY) throw forbidden(`Puoi bussare al massimo ${FRIEND_REQUESTS_PER_DAY} volte al giorno. Riprova domani.`);
    s.sentLog[r.id] = [...log, now];
    s.requests.push({ id: uid('q'), from: r.id, to: to.id, at: now });
    return { sent: true };
  },

  friendRespond(s, op, ctx, now) {
    const r = needResident(s, ctx);
    const q = s.requests.find((x) => x.id === op.id && x.to === r.id);
    if (!q) throw new DomainError('notfound', 'Richiesta non trovata.');
    s.requests = s.requests.filter((x) => x !== q);
    if (op.accept && s.residents[q.from] && !areFriends(s, q.from, r.id)) s.friendships.push({ a: q.from, b: r.id, since: now });
    return { accepted: !!op.accept };
  },

  unfriend(s, op, ctx) {
    const r = needResident(s, ctx);
    s.friendships = s.friendships.filter((f) => !((f.a === r.id && f.b === op.id) || (f.b === r.id && f.a === op.id)));
    return { ok: true };
  },

  report(s, op, ctx, now) {
    const r = needResident(s, ctx);
    if (!s.residents[op.target] || op.target === r.id) throw new DomainError('notfound', 'Abitante non trovato.');
    const reason = String(op.reason || '').trim().slice(0, 300);
    if (!reason) throw invalid('Scrivi brevemente il motivo della segnalazione.');
    s.reports.unshift({ id: uid('s'), from: r.id, target: op.target, reason, at: now, resolved: false });
    return { ok: true };
  },

  // L'account viene cancellato: la casa torna lotto libero, le notizie restano senza nome.
  leave(s, op, ctx, now) {
    const id = ctx.system ? op.id : needResident(s, ctx).id;
    if (!s.residents[id]) throw new DomainError('notfound', 'Abitante non trovato.');
    delete s.residents[id];
    for (const [slot, h] of Object.entries(s.houses)) if (h.residentId === id) delete s.houses[slot];
    s.requests = s.requests.filter((q) => q.from !== id && q.to !== id);
    s.friendships = s.friendships.filter((f) => f.a !== id && f.b !== id);
    delete s.sentLog[id];
    refresh(s, now);
    return { ok: true };
  },

  // Cantieri di chi non ha confermato l'email entro 24 ore: il lotto torna libero.
  expire(s, op, ctx, now) {
    if (!ctx.system) throw forbidden('Operazione interna.');
    let n = 0;
    for (const [slot, h] of Object.entries(s.houses)) {
      if (h.status === 'cantiere' && now - h.reservedAt > RESERVE_MS) { delete s.houses[slot]; n++; }
    }
    if (n) refresh(s, now);
    return { freed: n };
  },

  suspend(s, op, ctx) {
    needAdmin(ctx);
    const r = s.residents[op.id];
    if (!r) throw new DomainError('notfound', 'Abitante non trovato.');
    r.suspended = !!op.on;
    return { ok: true };
  },

  resolveReport(s, op, ctx) {
    needAdmin(ctx);
    const rep = s.reports.find((x) => x.id === op.id);
    if (!rep) throw new DomainError('notfound', 'Segnalazione non trovata.');
    rep.resolved = true;
    return { ok: true };
  },
};

/* Cosa vede chi guarda ------------------------------------------------ */

// Le richieste, le amicizie e le segnalazioni restano private: ognuno vede solo le sue.
export function publicView(s, viewerId, admin = false) {
  const residents = {};
  for (const r of Object.values(s.residents)) {
    residents[r.id] = r.suspended
      ? { id: r.id, username: r.username, number: r.number, joinedAt: r.joinedAt, bio: '', instagram: '', confirmed: r.confirmed, suspended: true }
      : { ...r };
  }
  const v = {
    rev: s.rev, createdAt: s.createdAt, openDistricts: s.openDistricts, residents, houses: s.houses,
    roads: s.roads, doors: s.doors, news: s.news.slice(0, 120), milestones: s.milestones,
    requests: viewerId ? s.requests.filter((q) => q.from === viewerId || q.to === viewerId) : [],
    friendships: viewerId ? s.friendships.filter((f) => f.a === viewerId || f.b === viewerId) : [],
    reports: [],
  };
  if (admin) {
    v.reports = s.reports.slice(0, 100);
    v.news = s.news;
  }
  return v;
}

/* Notizie ------------------------------------------------------------- */

export function formatNews(n, s) {
  const r = n.residentId && s.residents[n.residentId];
  const who = r ? r.username : 'un abitante';
  const d = n.slot ? districtById(districtAt(...parseKey(n.slot))) : null;
  switch (n.kind) {
    case 'founding':
      return { title: `Nasce ${CITY}`, text: 'Una piazza, una strada principale e tanti lotti liberi. La città aspetta i suoi primi abitanti: il link per entrare è nella bio.' };
    case 'welcome':
      return {
        title: r ? `Benvenuto a ${who}, abitante n°${r.number}` : 'Un nuovo abitante è arrivato in città',
        text: `Ha costruito casa nel quartiere ${d ? d.name : 'Centro'}.${r && isFounder(r) ? ' È uno dei primi cento: il suo nome è sul Muro dei Fondatori.' : ''}`,
      };
    case 'district': {
      const q = districtById(n.district);
      return { title: `Apre il quartiere ${q.name}`, text: `Il Centro è quasi pieno: da oggi si può costruire anche a ${q.name}. Nuovi lotti e una nuova strada principale.` };
    }
    case 'milestone':
      return {
        title: `${CITY} ha ${n.n} abitanti`,
        text: n.n === FOUNTAIN_AT ? 'Traguardo raggiunto: in piazza è arrivata la fontana. Grazie a tutti!' : `Un nuovo traguardo per la città. ${nextGoal({ milestones: [] }, n.n)}`,
      };
    default:
      return { title: 'Notizia', text: '' };
  }
}

// Il prossimo obiettivo collettivo, per la barra in piazza.
export function nextGoal(s, built) {
  if (built < FOUNTAIN_AT) return `Mancano ${FOUNTAIN_AT - built} abitanti alla fontana in piazza.`;
  const m = MILESTONES.find((x) => x > built);
  return m ? `Prossimo traguardo: ${m} abitanti.` : 'Siamo una vera città!';
}
export function goalProgress(built) {
  const target = built < FOUNTAIN_AT ? FOUNTAIN_AT : MILESTONES.find((x) => x > built) || built;
  const from = built < FOUNTAIN_AT ? 0 : [0, ...MILESTONES].filter((x) => x <= built).pop();
  return { target, from, ratio: target === from ? 1 : (built - from) / (target - from) };
}
