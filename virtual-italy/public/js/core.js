// Regole di Virtual-Italy: piano regolatore, lotti, strade automatiche, abitanti, amicizie, notizie.
// Codice puro, senza DOM: lo usano il browser (demo e disegno della mappa) e il server,
// così le regole sono scritte una volta sola.

export const CITY = 'Virtual-Italy';
export const PAPER = 'Virtual-Italy IG';
export const W = 84;
export const H = 60;
export const MAIN_Y = 30;                                  // la strada principale attraversa tutta la mappa
export const SEA_Y = 52;                                   // da qui in giù c'è il mare
export const PIAZZA = { x0: 36, y0: 21, x1: 44, y1: 29 };  // estremi inclusi: 9×9, affacciata sulla strada principale
export const STREET = 5;                                   // le vie corrono ogni 5 caselle, i lotti stanno negli isolati 4×4
export const RESERVE_MS = 24 * 3600000;                    // un cantiere senza email confermata dura 24 ore
export const UNLOCK_RATIO = 0.8;                           // un nuovo quartiere si apre all'80% di occupazione
export const FOUNDERS = 100;
export const FRIEND_REQUESTS_PER_DAY = 20;
export const FOUNTAIN_AT = 25;
export const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// Il tracciato segue una griglia di passo 5: righe e colonne multiple di 5 sono vie, in mezzo
// restano isolati di 4×4 caselle. In ogni isolato ci sono tre lotti affacciati su una via
// (gli angoli verso chi guarda), separati da giardini; l'angolo in fondo è un cortile alberato.
// Le dorsali sono le vie principali di ogni quartiere, tratteggiate finché il quartiere è chiuso.
export const DISTRICTS = [
  { id: 1, name: 'Centro', rect: [30, 20, 55, 35], dorsal: null,
    walls: ['#e8b86a', '#d98b5f', '#f0d39a', '#e3a27a'] },
  { id: 2, name: 'Borgo Est', rect: [55, 20, 75, 35], dorsal: { x: 65, y0: 15, y1: 45 },
    walls: ['#f3d6d0', '#d7e6ef', '#f4e7b8', '#dcebd2'] },
  { id: 3, name: 'Borgo Ovest', rect: [10, 20, 30, 35], dorsal: { x: 20, y0: 15, y1: 45 },
    walls: ['#d8cfc0', '#c9bba4', '#e6dccb', '#bfb5a6'] },
  { id: 4, name: 'Collina Nord', rect: [10, 8, 75, 20], dorsal: { y: 15, x0: 10, x1: 75 },
    walls: ['#c99a6b', '#b98a5e', '#e0c49e', '#a8794f'] },
  { id: 5, name: 'Marina Sud', rect: [10, 35, 75, 51], dorsal: { y: 45, x0: 10, x1: 75 },
    walls: ['#f5f3ee', '#dbe8f1', '#f7efe0', '#e5eef0'] },
];
export const isStreet = (x, y) => x % STREET === 0 || y % STREET === 0;
// Il canale scende dalla collina al mare tra Borgo Ovest e il Centro; le vie lo passano sui ponti.
export const CANAL = { x0: 26, x1: 28, y0: 8 };
export const isCanal = (x, y) => x >= CANAL.x0 && x <= CANAL.x1 && y >= CANAL.y0 && y <= SEA_Y;
// Posizione dentro l'isolato (1..4): i lotti sono gli angoli che guardano a sud o a est.
const LOT_SPOTS = ['4,1', '1,4', '4,4'];

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

// I negozi sono edifici veri ai lati della piazza, con la vetrina sulla strada principale.
// Occupano un blocco 2×2 (x0..x0+1, y0..y0+1) e la porta dà sulla casella `front`.
export const SHOPS = [
  { id: 'mobili', name: 'Mobilificio Bottega', sign: 'MOBILI', kind: 'furni', x0: 33, y0: 28, keeper: 'Gino' },
  { id: 'moda', name: 'Sartoria Moda', sign: 'MODA', kind: 'wear', x0: 46, y0: 28, keeper: 'Rosa' },
  { id: 'bici', name: 'Ciclofficina Ruota Libera', sign: 'BICI', kind: 'ride', x0: 51, y0: 28, keeper: 'Tonino' },
].map((sh) => ({ ...sh, room: 'shop:' + sh.id, front: [sh.x0, MAIN_Y] }));
export const shopById = (id) => SHOPS.find((sh) => sh.id === id || sh.room === id) || null;
export const shopAt = (x, y) => SHOPS.find((sh) => x >= sh.x0 && x <= sh.x0 + 1 && y >= sh.y0 && y <= sh.y0 + 1) || null;
export const isShopRoom = (room) => typeof room === 'string' && room.startsWith('shop:') && !!shopById(room);

// Editor del personaggio: ogni scelta è un indice (colori) o un id (pettinatura, accessorio).
export const LOOK = {
  skin: ['#f6dcc6', '#f3d2b3', '#e8b98f', '#c98d63', '#a8714a', '#8d5b3d', '#5e3b26'],
  hair: ['#1f1a17', '#3b2a1e', '#6b4226', '#a4532e', '#d9a441', '#efd9a0', '#8a8a8a', '#e86b8a', '#3f6aa1'],
  style: [{ id: 'corti', label: 'Corti' }, { id: 'lunghi', label: 'Lunghi' }, { id: 'coda', label: 'Coda' }, { id: 'ricci', label: 'Ricci' }],
  shirt: ['#d9442f', '#e88a3a', '#e0a92a', '#2f7d4f', '#4fb3c8', '#3f6aa1', '#7a4a6b', '#e86b8a', '#f1ede4', '#2d2d2d'],
  pants: ['#2d3a4a', '#2f4f6f', '#4b4f56', '#6b4a2f', '#c9b48f', '#2d2d2d'],
  extra: [{ id: 'nessuno', label: 'Niente' }, { id: 'cappellino', label: 'Cappellino' }, { id: 'occhiali', label: 'Occhiali' }, { id: 'fiore', label: 'Fiore' }],
};
// Vestiti: i capi base li hanno tutti, gli altri si prendono alla Sartoria Moda.
// `price` è già pronto per la moneta della città: finché non c'è, tutto è gratis.
export const WEAR = [
  { id: 'maglietta', slot: 'top', label: 'Maglietta', base: true },
  { id: 'camicia', slot: 'top', label: 'Camicia', price: 40 },
  { id: 'righe', slot: 'top', label: 'Maglia a righe', price: 35 },
  { id: 'felpa', slot: 'top', label: 'Felpa', price: 45 },
  { id: 'giacca', slot: 'top', label: 'Giacca', price: 80 },
  { id: 'canotta', slot: 'top', label: 'Canottiera', price: 20 },
  { id: 'pantaloni', slot: 'bottom', label: 'Pantaloni', base: true },
  { id: 'pantaloncini', slot: 'bottom', label: 'Pantaloncini', price: 25 },
  { id: 'gonna', slot: 'bottom', label: 'Gonna', price: 30 },
  { id: 'nessuno', slot: 'extra', label: 'Niente', base: true },
  { id: 'cappellino', slot: 'extra', label: 'Cappellino', base: true },
  { id: 'occhiali', slot: 'extra', label: 'Occhiali', base: true },
  { id: 'fiore', slot: 'extra', label: 'Fiore', base: true },
  { id: 'paglia', slot: 'extra', label: 'Cappello di paglia', price: 30 },
  { id: 'coppola', slot: 'extra', label: 'Coppola', price: 35 },
  { id: 'basco', slot: 'extra', label: 'Basco', price: 30 },
  { id: 'cuffie', slot: 'extra', label: 'Cuffie', price: 50 },
  { id: 'sciarpa', slot: 'extra', label: 'Sciarpa', price: 25 },
  { id: 'corona', slot: 'extra', label: 'Corona', price: 200 },
];
// Mezzi della Ciclofficina: a piedi si va a passo d'uomo, con un mezzo più svelti (caselle al secondo).
export const WALK_SPEED = 1.6;
export const RIDES = [
  { id: 'skate', label: 'Skateboard', speed: 2.6, price: 60 },
  { id: 'bici', label: 'Bicicletta', speed: 3.2, price: 120 },
  { id: 'monopattino', label: 'Monopattino elettrico', speed: 3.8, price: 250 },
];
export const rideById = (id) => RIDES.find((r) => r.id === id) || null;
export const WEAR_SLOTS = [{ id: 'top', label: 'Maglie' }, { id: 'bottom', label: 'Sotto' }, { id: 'extra', label: 'Accessori' }];
export const wearById = (id) => WEAR.find((w) => w.id === id) || null;
const wearOf = (slot) => WEAR.filter((w) => w.slot === slot);
// Aspetto di partenza, uguale per sempre per lo stesso nome finché l'abitante non sceglie il suo.
export function defaultLook(name) {
  const h = hash(String(name));
  return {
    skin: h % LOOK.skin.length, hair: (h >>> 3) % 6, style: LOOK.style[(h >>> 14) % 2].id,
    shirt: (h >>> 6) % LOOK.shirt.length, pants: (h >>> 9) % 4, extra: (h >>> 12) % 3 === 0 ? 'cappellino' : 'nessuno',
    top: 'maglietta', bottom: 'pantaloni',
  };
}
export function cleanLook(raw, name) {
  const base = defaultLook(name);
  const r = raw && typeof raw === 'object' ? raw : {};
  const idx = (v, list, fb) => (Number.isInteger(v) && v >= 0 && v < list.length ? v : fb);
  const id = (v, list, fb) => (list.some((o) => o.id === v) ? v : fb);
  return {
    skin: idx(r.skin, LOOK.skin, base.skin), hair: idx(r.hair, LOOK.hair, base.hair), style: id(r.style, LOOK.style, base.style),
    shirt: idx(r.shirt, LOOK.shirt, base.shirt), pants: idx(r.pants, LOOK.pants, base.pants), extra: id(r.extra, wearOf('extra'), base.extra),
    top: id(r.top, wearOf('top'), base.top), bottom: id(r.bottom, wearOf('bottom'), base.bottom),
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
      if (isStreet(x, y) || y === MAIN_Y || inPiazza(x, y) || futureRoads.has(k) || shopAt(x, y) || isCanal(x, y)) continue;
      const bx = x % STREET, by = y % STREET;
      // L'isolato deve stare tutto nel quartiere (e sopra la spiaggia)
      const [rx0, ry0, rx1, ry1] = d.rect;
      if (x - bx < rx0 || x - bx + STREET > rx1 || y - by < ry0 || y - by + STREET > Math.min(ry1, SEA_Y)) continue;
      if (!LOT_SPOTS.includes(bx + ',' + by)) continue;
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
    // Le vie del quartiere, con i marciapiedi, ci sono già prima delle case.
    const [x0, y0, x1, y1] = d.rect;
    for (let y = y0; y <= Math.min(y1, SEA_Y - 1); y++) for (let x = x0; x <= x1; x++) {
      const k = key(x, y);
      if (isStreet(x, y) && !net.has(k) && !shopAt(x, y) && !inPiazza(x, y)) net.set(k, 'via');
    }
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
      if (!dId || dId > openDistricts || PLAN.lots.has(nk) || shopAt(nx, ny) || isCanal(nx, ny)) continue;
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
    // Di solito la casa sta già sulla via: la porta guarda la via (meglio se verso chi guarda).
    const [hx, hy] = parseKey(h.slot);
    const side = [['S', 0, 1], ['E', 1, 0], ['W', -1, 0], ['N', 0, -1]].find(([, dx, dy]) => net.has(key(hx + dx, hy + dy)));
    if (side) { doors[h.slot] = side[0]; continue; }
    const r = routeFrom(h.slot, net, openDistricts);
    if (!r) continue;
    for (const k of r.path) net.set(k, 'lane');
    const first = r.path[0] || r.reach;
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
  // Acqua del canale, tranne dove passa un ponte (statale e vie dei quartieri aperti)
  if (isCanal(x, y)) {
    const d0 = districtAt(x, y);
    const bridge = y === MAIN_Y || (y % STREET === 0 && d0 && d0 <= openDistricts && y < SEA_Y);
    if (!bridge) return -1;
  }
  if (y === SEA_Y) return 0;
  const d = districtAt(x, y);
  if (d === 4 && y < 15) return 2;
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
  return x >= 0 && y >= 0 && x < W && y <= SEA_Y && !s.houses[key(x, y)] && !shopAt(x, y) && !PIAZZA_BLOCKED.has(key(x, y))
    && !(isCanal(x, y) && !s.roads[key(x, y)]);
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
export const PIAZZA_CENTER = [40, 28];

export function spawnPoint(s, residentId) {
  const h = residentHouse(s, residentId);
  return h ? frontOf(s, h.slot) : PIAZZA_CENTER;
}

/* Dentro casa: stanza isometrica da arredare ---------------------------- */

export const ROOM = 8;                 // la stanza è 8×8 caselle
export const ROOM_DOOR = [0, 5];       // si entra dal muro di sinistra, su questa casella
export const ROOM_MAX_ITEMS = 80;
export const FLOORS = [
  { id: 'parquet', label: 'Parquet' }, { id: 'piastrelle', label: 'Piastrelle' },
  { id: 'cotto', label: 'Cotto' }, { id: 'marmo', label: 'Marmo' }, { id: 'moquette', label: 'Moquette' },
];
export const WALLS = ['#efe6d2', '#f3d6c3', '#d7e6ef', '#dcebd2', '#f4e7b8', '#d9d0e8', '#c9b8a6', '#5b6b7a'];
export const FURNI_COLORS = ['#c0392b', '#2f6b9f', '#2f7d4f', '#e0a92a', '#7a4a6b', '#e86b8a', '#6b4a2f', '#4b4f56'];
// w lungo x e d lungo y con rotazione 0; con rotazione 1 si scambiano. `rug` si può calpestare.
// `cat` è il reparto del Mobilificio, `price` il prezzo per quando la città avrà la sua moneta.
export const FURNI = [
  { id: 'sedia', label: 'Sedia', w: 1, d: 1, color: true, cat: 'mobili', price: 20 },
  { id: 'poltrona', label: 'Poltrona', w: 1, d: 1, color: true, cat: 'mobili', price: 45 },
  { id: 'divano', label: 'Divano', w: 2, d: 1, color: true, cat: 'mobili', price: 90 },
  { id: 'pouf', label: 'Pouf', w: 1, d: 1, color: true, cat: 'mobili', price: 15 },
  { id: 'tavolino', label: 'Tavolino', w: 1, d: 1, cat: 'mobili', price: 25 },
  { id: 'tavolo', label: 'Tavolo', w: 2, d: 1, cat: 'mobili', price: 60 },
  { id: 'letto', label: 'Letto', w: 1, d: 2, color: true, cat: 'mobili', price: 80 },
  { id: 'libreria', label: 'Libreria', w: 1, d: 1, cat: 'mobili', price: 50 },
  { id: 'armadio', label: 'Armadio', w: 1, d: 1, cat: 'mobili', price: 70 },
  { id: 'scrivania', label: 'Scrivania', w: 2, d: 1, cat: 'mobili', price: 55 },
  { id: 'bancone', label: 'Bancone', w: 2, d: 1, color: true, cat: 'mobili', price: 75 },
  { id: 'cucina', label: 'Cucina', w: 2, d: 1, cat: 'mobili', price: 120 },
  { id: 'frigo', label: 'Frigorifero', w: 1, d: 1, cat: 'mobili', price: 90 },
  { id: 'tv', label: 'Televisore', w: 1, d: 1, cat: 'mobili', price: 110 },
  { id: 'camino', label: 'Camino', w: 2, d: 1, cat: 'mobili', price: 150 },
  { id: 'tappeto', label: 'Tappeto', w: 2, d: 2, color: true, rug: true, cat: 'deco', price: 30 },
  { id: 'lampada', label: 'Lampada', w: 1, d: 1, cat: 'deco', price: 25 },
  { id: 'pianta', label: 'Pianta', w: 1, d: 1, cat: 'deco', price: 15 },
  { id: 'vaso', label: 'Vaso di fiori', w: 1, d: 1, color: true, cat: 'deco', price: 15 },
  { id: 'specchio', label: 'Specchio', w: 1, d: 1, cat: 'deco', price: 35 },
  { id: 'pendolo', label: 'Orologio a pendolo', w: 1, d: 1, cat: 'deco', price: 85 },
  { id: 'jukebox', label: 'Jukebox', w: 1, d: 1, cat: 'deco', price: 140 },
  { id: 'statua', label: 'Busto romano', w: 1, d: 1, cat: 'deco', price: 160 },
  { id: 'acquario', label: 'Acquario', w: 1, d: 1, cat: 'deco', price: 100 },
  { id: 'stender', label: 'Appendiabiti', w: 2, d: 1, color: true, cat: 'deco', price: 40 },
  // Premi: non si vendono, si guadagnano con le missioni.
  { id: 'targa', label: 'Targa di benvenuto', w: 1, d: 1, cat: 'premi' },
  // Solo in negozio: la pedana con un mezzo in esposizione (il colore sceglie quale)
  { id: 'espositore', label: 'Espositore', w: 1, d: 1, cat: 'negozio' },
];
export const FURNI_CATS = [{ id: 'mobili', label: 'Mobili' }, { id: 'deco', label: 'Decorazioni' }];
// Chi costruisce casa trova dentro un piccolo kit di benvenuto, da sistemare come vuole.
export const STARTER_KIT = { letto: 1, sedia: 1, tavolino: 1, lampada: 1, pianta: 1 };
export const MAX_STOCK = 20;          // pezzi uguali tenuti da parte nell'inventario
export const ACCESS = [{ id: 'tutti', label: 'Tutti' }, { id: 'amici', label: 'Solo amici' }, { id: 'nessuno', label: 'Solo io' }];
export const furniById = (id) => FURNI.find((f) => f.id === id);
export const defaultRoom = () => ({ floor: 'parquet', wall: WALLS[0], access: 'tutti', items: [] });
export const roomOf = (s, ownerId) => (isShopRoom(ownerId) ? shopRoom(ownerId) : s.rooms?.[ownerId] || defaultRoom());

// L'interno dei negozi è fisso: la merce in esposizione si tocca per comprarla.
const SHOP_ROOMS = {
  'shop:mobili': { floor: 'marmo', wall: '#f4e7b8', access: 'tutti', items: [
    ['bancone', 4, 1, 0, 6], ['libreria', 2, 0], ['armadio', 3, 0], ['pendolo', 6, 0], ['statua', 7, 0], ['lampada', 0, 0],
    ['divano', 1, 2, 0, 1], ['tappeto', 1, 3, 0, 4], ['poltrona', 3, 3, 1, 0], ['tavolino', 2, 4], ['pouf', 1, 4, 0, 3],
    ['letto', 7, 3, 0, 1], ['tv', 5, 4], ['jukebox', 7, 6], ['acquario', 4, 7], ['pianta', 0, 7], ['vaso', 2, 7, 0, 5],
  ] },
  'shop:bici': { floor: 'piastrelle', wall: '#dcebd2', access: 'tutti', items: [
    ['bancone', 4, 1, 0, 1], ['espositore', 2, 3, 0, 0], ['espositore', 4, 3, 0, 1], ['espositore', 6, 3, 0, 2],
    ['espositore', 2, 6, 0, 1], ['espositore', 4, 6, 0, 2], ['espositore', 6, 6, 0, 0], ['pianta', 0, 0], ['lampada', 7, 0], ['pianta', 7, 7],
  ] },
  'shop:moda': { floor: 'parquet', wall: '#d9d0e8', access: 'tutti', items: [
    ['bancone', 4, 1, 0, 7], ['specchio', 2, 0], ['specchio', 3, 0], ['stender', 6, 3, 1, 0], ['stender', 6, 6, 1, 5],
    ['tappeto', 2, 3, 0, 5], ['pouf', 3, 4, 0, 1], ['pianta', 0, 0], ['pianta', 7, 7], ['vaso', 0, 7, 0, 3], ['lampada', 7, 0],
  ] },
};
for (const [id, room] of Object.entries(SHOP_ROOMS)) room.items = room.items.map(([t, x, y, r = 0, c = 0], i) => ({ uid: `${id}:${i}`, t, x, y, r, c }));
export const shopRoom = (id) => SHOP_ROOMS[shopById(id)?.room] || defaultRoom();
// Dove stanno il commesso (dietro al bancone) e i manichini della Sartoria.
export const SHOP_KEEPER_AT = [5, 0];
export const MANNEQUINS = [
  { at: [1, 5], look: { top: 'camicia', bottom: 'pantaloni', extra: 'coppola', shirt: 8, pants: 0 } },
  { at: [3, 6], look: { top: 'righe', bottom: 'gonna', extra: 'paglia', shirt: 5, pants: 4 } },
  { at: [5, 6], look: { top: 'giacca', bottom: 'pantaloni', extra: 'occhiali', shirt: 9, pants: 5 } },
  { at: [4, 3], look: { top: 'felpa', bottom: 'pantaloncini', extra: 'cuffie', shirt: 7, pants: 1 } },
];

// Inventario: mobili tenuti da parte (non ancora in casa) e vestiti posseduti.
export const invOf = (s, id) => ({ furni: {}, wear: [], rides: [], ...s.inv?.[id] });
export const ownsWear = (s, id, wearId) => !!wearById(wearId)?.base || invOf(s, id).wear.includes(wearId);
// Qui si pagherà con la moneta della città: per ora i negozi regalano tutto.
function pay(s, r, price) { void s; void r; void price; }
export function footprint(it) {
  const f = furniById(it.t);
  const [w, d] = it.r ? [f.d, f.w] : [f.w, f.d];
  return { x0: it.x, y0: it.y, x1: it.x + w - 1, y1: it.y + d - 1, w, d };
}
function cellsOf(it) {
  const { x0, y0, x1, y1 } = footprint(it);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(key(x, y));
  return out;
}
// Controlla che un mobile stia nella stanza, non copra la porta e non si sovrapponga ad altri
// (i tappeti possono stare sotto ai mobili, ma non sopra un altro tappeto).
function checkPlace(room, it, ignoreUid) {
  const f = furniById(it.t);
  const { x0, y0, x1, y1 } = footprint(it);
  if (x0 < 0 || y0 < 0 || x1 >= ROOM || y1 >= ROOM) throw invalid('Il mobile non entra in quel punto: prova più al centro.');
  const cells = new Set(cellsOf(it));
  if (!f.rug && cells.has(key(...ROOM_DOOR))) throw invalid('Lascia libero il passaggio davanti alla porta.');
  for (const o of room.items) {
    if (o.uid === ignoreUid) continue;
    if (!!furniById(o.t).rug !== !!f.rug) continue;
    if (cellsOf(o).some((c) => cells.has(c))) throw invalid('Lì c\'è già un altro mobile.');
  }
}
export function canVisit(s, visitorId, ownerId) {
  if (visitorId === ownerId || isShopRoom(ownerId)) return true;
  const access = roomOf(s, ownerId).access;
  if (access === 'tutti') return true;
  if (access === 'amici') return !!visitorId && areFriends(s, visitorId, ownerId);
  return false;
}
// Dentro casa si cammina sul pavimento libero (i tappeti si calpestano).
export function roomPath(room, from, to) {
  const blocked = new Set();
  for (const it of room.items) if (!furniById(it.t)?.rug) for (const c of cellsOf(it)) blocked.add(c);
  // Sulle sedute ci si può fermare (per sedersi), ma non passarci attraverso.
  if (seatIn(room, to[0], to[1])) blocked.delete(key(to[0], to[1]));
  const ok = (x, y) => x >= 0 && y >= 0 && x < ROOM && y < ROOM && !blocked.has(key(x, y));
  const [sx, sy] = from, [tx, ty] = to;
  if (sx === tx && sy === ty) return [];
  if (!ok(tx, ty)) return null;
  const start = key(sx, sy), goal = key(tx, ty);
  const prev = new Map([[start, null]]);
  const queue = [[sx, sy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (prev.has(nk) || !ok(nx, ny)) continue;
      prev.set(nk, key(x, y));
      if (nk === goal) { const p = []; for (let k = goal; k !== start; k = prev.get(k)) p.push(parseKey(k)); return p.reverse(); }
      queue.push([nx, ny]);
    }
  }
  return null;
}

/* Vita in città: sedersi, missioni, libro degli ospiti, Casa della settimana ---- */

// Altezza della seduta (pixel d'arte) e verso in cui si guarda: lo schienale resta alle spalle.
export const SEATS = { sedia: 15, poltrona: 12, divano: 11, pouf: 13 };
// Arredo della piazza, all'italiana senza esagerare: fontana al centro, campanile in un angolo,
// edicola e bar ai lati, panchine attorno alla fontana, qualche leccio e due fioriere.
export const PIAZZA_DECOR = {
  fountain: [40, 25],                       // centro della vasca; occupa le 3×3 caselle attorno
  edicola: [37, 28],
  muro: [[39, 21], [40, 21], [41, 21]],
  campanile: [44, 21],
  cafe: [[43, 24], [44, 25], [43, 26]],
  lamps: [[37, 23], [43, 23], [37, 27], [43, 27]],
  trees: [[36, 23], [36, 26]],
  planters: [[36, 29], [44, 29]],
};
export const BENCHES = [[38, 25], [42, 25], [40, 23], [40, 27]];
export const PIAZZA_BLOCKED = new Set([
  ...[-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => key(PIAZZA_DECOR.fountain[0] + dx, PIAZZA_DECOR.fountain[1] + dy))),
  key(...PIAZZA_DECOR.edicola), key(...PIAZZA_DECOR.campanile), ...PIAZZA_DECOR.muro.map((p) => key(...p)),
  ...PIAZZA_DECOR.trees.map((p) => key(...p)), ...PIAZZA_DECOR.planters.map((p) => key(...p)),
]);
function seatIn(room, x, y) {
  for (const it of room.items) {
    const h = SEATS[it.t];
    if (!h) continue;
    const f = footprint(it);
    if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1) continue;
    return { h, dir: it.t === 'pouf' ? null : it.r ? 'SE' : 'SW', d: f.x1 + f.y1 + 0.55 };
  }
  return null;
}
// Dove ci si può sedere: un mobile in una stanza (o in un negozio) oppure una panchina in piazza.
export function seatAt(s, room, x, y) {
  if (room) return seatIn(roomOf(s, room), x, y);
  return BENCHES.some(([bx, by]) => bx === x && by === y) ? { h: 6, dir: 'SW', d: x + y + 0.6, bench: true } : null;
}
export const ACTS = ['saluta', 'balla', 'salta', 'siedi'];

// Il giorno e la settimana si contano all'ora italiana (circa: UTC+1), le settimane da lunedì.
export const dayKey = (t) => new Date(t + 3600000).toISOString().slice(0, 10);
export const weekKey = (t) => Math.floor((t + 3600000 + 3 * 86400000) / (7 * 86400000));

// Cose fatte con l'omino che il server non vede passare (si segnano con l'operazione `mark`).
export const MARKS = ['panchina', 'giornale', 'saluta', 'balla'];
export const progressOf = (s, id) => s.progress?.[id] || { marks: {}, welcome: null, daily: { last: null, streak: 0 } };
const signedBy = (s, id, since = 0) => Object.values(s.guestbook || {}).reduce((n, list) => n + list.filter((g) => g.by === id && g.at >= since).length, 0);
const heartsBy = (s, id, since = 0) => Object.values(s.hearts || {}).reduce((n, m) => n + (m[id] >= since ? 1 : 0), 0);
const markedSince = (s, id, k, since) => (progressOf(s, id).marks[k] || -1) >= since;

// Missioni di benvenuto: una lista da spuntare, con un premio alla fine.
export const WELCOME = [
  { id: 'look', label: 'Dai uno stile al tuo omino', hint: 'Profilo → Il mio personaggio', done: (s, id) => !!s.residents[id]?.look },
  { id: 'casa', label: 'Costruisci la tua casa', hint: 'Scegli un lotto libero', done: (s, id) => residentHouse(s, id)?.status === 'casa' },
  { id: 'arreda', label: 'Sistema 3 mobili in casa', hint: 'Entra in casa → Arreda', done: (s, id) => (s.rooms?.[id]?.items.length || 0) >= 3 },
  { id: 'sartoria', label: 'Prendi un capo alla Sartoria Moda', hint: 'Il negozio a destra della piazza', done: (s, id) => invOf(s, id).wear.length > 0 },
  { id: 'panchina', label: 'Siediti su una panchina in piazza', hint: 'Tocca una panchina', done: (s, id) => markedSince(s, id, 'panchina', 0) },
  { id: 'visita', label: 'Firma il libro degli ospiti di un vicino', hint: 'Entra in un\'altra casa', done: (s, id) => signedBy(s, id) > 0 },
  { id: 'giornale', label: 'Leggi il giornale', hint: 'L\'icona del giornale in alto', done: (s, id) => markedSince(s, id, 'giornale', 0) },
];
export const WELCOME_PRIZE = 'targa';

// Missione del giorno: una al giorno, uguale per tutti, scelta dalla data.
export const DAILY = [
  { id: 'visite', label: 'Firma 2 libri degli ospiti', done: (s, id, t0) => signedBy(s, id, t0) >= 2 },
  { id: 'cuore', label: 'Lascia un ❤️ a una casa che ti piace', done: (s, id, t0) => heartsBy(s, id, t0) > 0 },
  { id: 'panchina', label: 'Siediti in piazza', done: (s, id, t0) => markedSince(s, id, 'panchina', t0) },
  { id: 'balla', label: 'Balla in città', done: (s, id, t0) => markedSince(s, id, 'balla', t0) },
  { id: 'saluta', label: 'Saluta qualcuno', done: (s, id, t0) => markedSince(s, id, 'saluta', t0) },
  { id: 'arreda', label: 'Aggiungi o sposta un mobile in casa', done: (s, id, t0) => markedSince(s, id, 'arreda', t0) },
  { id: 'giornale', label: 'Leggi le notizie del giorno', done: (s, id, t0) => markedSince(s, id, 'giornale', t0) },
];
const dayStart = (t) => Date.parse(dayKey(t) + 'T00:00:00Z') - 3600000;
export function dailyMission(now) { return DAILY[hash('giorno' + dayKey(now)) % DAILY.length]; }
export function missionStatus(s, id, now) {
  const p = progressOf(s, id);
  const welcome = WELCOME.map((m) => ({ id: m.id, label: m.label, hint: m.hint, done: !!m.done(s, id) }));
  const d = dailyMission(now);
  const today = dayKey(now);
  return {
    welcome, welcomeClaimed: !!p.welcome, welcomeReady: !p.welcome && welcome.every((m) => m.done),
    daily: { id: d.id, label: d.label, done: !!d.done(s, id, dayStart(now)), claimed: p.daily.last === today },
    streak: p.daily.last === today || p.daily.last === dayKey(now - 86400000) ? p.daily.streak : 0,
  };
}

// Libro degli ospiti e cuori.
export const GUESTBOOK_MAX = 60;
export function heartsThisWeek(s, ownerId, now) {
  const w = weekKey(now);
  return Object.values(s.hearts?.[ownerId] || {}).filter((t) => weekKey(t) === w).length;
}
// Classifica delle case con più cuori in una settimana (a parità vince chi li ha avuti prima).
export function weekRanking(s, w) {
  const out = [];
  for (const [owner, m] of Object.entries(s.hearts || {})) {
    const times = Object.values(m).filter((t) => weekKey(t) === w);
    if (times.length && s.residents[owner] && residentHouse(s, owner)?.status === 'casa') out.push({ id: owner, n: times.length, last: Math.max(...times) });
  }
  return out.sort((a, b) => b.n - a.n || a.last - b.last);
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
    rooms: {},         // id abitante → { floor, wall, access, items: [{ uid, t, x, y, r, c }] }
    inv: {},           // id abitante → { furni: { tipo: quanti }, wear: [id dei vestiti presi] }
    progress: {},      // id abitante → { marks: { cosa: istante }, welcome: istante del premio, daily: { last, streak } }
    guestbook: {},     // id padrone di casa → [{ by, at, text }] (le firme più recenti in fondo)
    hearts: {},        // id padrone di casa → { id visitatore: istante dell'ultimo cuore }
    weeklyDone: null,  // ultima settimana di cui il giornale ha annunciato la Casa della settimana
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
function progressFor(s, id) {
  s.progress ||= {};
  return (s.progress[id] ||= { marks: {}, welcome: null, daily: { last: null, streak: 0 } });
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
    s.inv ||= {};
    const inv = (s.inv[r.id] ||= { furni: {}, wear: [] });
    for (const [t, n] of Object.entries(STARTER_KIT)) inv.furni[t] = (inv.furni[t] || 0) + n;
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
    const look = cleanLook(op.look, r.username);
    for (const slot of ['top', 'bottom', 'extra']) {
      if (!ownsWear(s, r.id, look[slot])) throw invalid(`${wearById(look[slot]).label}: prima prendilo alla Sartoria Moda.`);
    }
    r.look = look;
    return { ok: true };
  },

  // Negozi: un mobile finisce nell'inventario, un vestito nell'armadio (e volendo addosso).
  buy(s, op, ctx) {
    const r = needResident(s, ctx);
    s.inv ||= {};
    const inv = (s.inv[r.id] ||= { furni: {}, wear: [] });
    if (op.kind === 'furni') {
      const f = furniById(op.t);
      if (!f) throw invalid('Articolo sconosciuto.');
      if ((inv.furni[f.id] || 0) >= MAX_STOCK) throw invalid(`Ne hai già ${MAX_STOCK} da parte: sistemane qualcuno in casa.`);
      pay(s, r, f.price);
      inv.furni[f.id] = (inv.furni[f.id] || 0) + 1;
      return { have: inv.furni[f.id] };
    }
    if (op.kind === 'wear') {
      const w = wearById(op.id);
      if (!w) throw invalid('Articolo sconosciuto.');
      if (w.base || inv.wear.includes(w.id)) return { already: true };
      pay(s, r, w.price);
      inv.wear.push(w.id);
      if (op.wear) r.look = { ...cleanLook(r.look, r.username), [w.slot]: w.id };
      return { ok: true };
    }
    if (op.kind === 'ride') {
      const m = rideById(op.id);
      if (!m) throw invalid('Articolo sconosciuto.');
      inv.rides ||= [];
      if (inv.rides.includes(m.id)) return { already: true };
      pay(s, r, m.price);
      inv.rides.push(m.id);
      if (op.use) r.ride = m.id;
      return { ok: true };
    }
    throw invalid('Articolo sconosciuto.');
  },

  // Stile della stanza: pavimento, colore delle pareti, chi può entrare.
  roomStyle(s, op, ctx) {
    const r = needResident(s, ctx);
    if (!residentHouse(s, r.id)) throw invalid('Prima costruisci la tua casa.');
    s.rooms ||= {};
    const room = (s.rooms[r.id] ||= defaultRoom());
    if (op.floor !== undefined) { if (!FLOORS.some((f) => f.id === op.floor)) throw invalid('Pavimento sconosciuto.'); room.floor = op.floor; }
    if (op.wall !== undefined) { if (!WALLS.includes(op.wall)) throw invalid('Colore sconosciuto.'); room.wall = op.wall; }
    if (op.access !== undefined) { if (!ACCESS.some((a) => a.id === op.access)) throw invalid('Scelta sconosciuta.'); room.access = op.access; }
    return { ok: true };
  },

  // Mobili: aggiungere, spostare, ruotare, cambiare colore, togliere. Solo nella propria casa.
  furni(s, op, ctx) {
    const r = needResident(s, ctx);
    if (!residentHouse(s, r.id)) throw invalid('Prima costruisci la tua casa.');
    s.rooms ||= {};
    const room = (s.rooms[r.id] ||= defaultRoom());
    const int = (v) => Number.isInteger(v) ? v : NaN;
    s.inv ||= {};
    const inv = (s.inv[r.id] ||= { furni: {}, wear: [] });
    if (op.act === 'add' || op.act === 'move') progressFor(s, r.id).marks.arreda = ctx.now ?? Date.now();
    if (op.act === 'add') {
      const f = furniById(op.t);
      if (!f) throw invalid('Mobile sconosciuto.');
      if (!inv.furni[f.id]) throw invalid(`Non hai ${f.label.toLowerCase()} da parte: passa dal Mobilificio.`);
      if (room.items.length >= ROOM_MAX_ITEMS) throw invalid(`In casa ci stanno al massimo ${ROOM_MAX_ITEMS} mobili.`);
      const it = { uid: uid('f'), t: f.id, x: int(op.x), y: int(op.y), r: op.r ? 1 : 0, c: f.color ? (Number.isInteger(op.c) && op.c >= 0 && op.c < FURNI_COLORS.length ? op.c : 0) : 0 };
      checkPlace(room, it);
      room.items.push(it);
      if (--inv.furni[f.id] <= 0) delete inv.furni[f.id];
      return { uid: it.uid };
    }
    const it = room.items.find((o) => o.uid === op.uid);
    if (!it) throw new DomainError('notfound', 'Mobile non trovato.');
    if (op.act === 'remove') {
      room.items = room.items.filter((o) => o !== it);
      inv.furni[it.t] = (inv.furni[it.t] || 0) + 1;
      return { ok: true };
    }
    if (op.act === 'color') { if (furniById(it.t).color) it.c = (it.c + 1) % FURNI_COLORS.length; return { ok: true }; }
    const next = { ...it };
    if (op.act === 'move') { next.x = int(op.x); next.y = int(op.y); }
    else if (op.act === 'rotate') next.r = it.r ? 0 : 1;
    else throw invalid('Azione sconosciuta.');
    checkPlace(room, next, it.uid);
    Object.assign(it, next);
    return { ok: true };
  },

  // Salire su un mezzo che si ha (o scendere e andare a piedi).
  ride(s, op, ctx) {
    const r = needResident(s, ctx);
    if (op.id === null || op.id === undefined || op.id === '') { delete r.ride; return { ok: true }; }
    if (!rideById(op.id)) throw invalid('Mezzo sconosciuto.');
    if (!invOf(s, r.id).rides.includes(op.id)) throw invalid('Prima prendilo alla Ciclofficina.');
    r.ride = op.id;
    return { ok: true };
  },

  // Qualcosa fatto con l'omino (sedersi in piazza, ballare, salutare, leggere il giornale).
  mark(s, op, ctx, now) {
    const r = needResident(s, ctx);
    if (!MARKS.includes(op.what)) throw invalid('Azione sconosciuta.');
    progressFor(s, r.id).marks[op.what] = now;
    return { ok: true };
  },

  // Premi delle missioni: il kit di benvenuto completato e la missione del giorno.
  claim(s, op, ctx, now) {
    const r = needResident(s, ctx);
    const st = missionStatus(s, r.id, now);
    const p = progressFor(s, r.id);
    if (op.what === 'welcome') {
      if (st.welcomeClaimed) throw invalid('Il premio di benvenuto l\'hai già ritirato.');
      if (!st.welcomeReady) throw invalid('Completa prima tutte le missioni di benvenuto.');
      p.welcome = now;
      s.inv ||= {};
      const inv = (s.inv[r.id] ||= { furni: {}, wear: [] });
      inv.furni[WELCOME_PRIZE] = (inv.furni[WELCOME_PRIZE] || 0) + 1;
      return { prize: WELCOME_PRIZE };
    }
    if (op.what === 'daily') {
      if (st.daily.claimed) throw invalid('Per oggi hai già fatto: torna domani per una nuova missione.');
      if (!st.daily.done) throw invalid('La missione di oggi non è ancora completa.');
      p.daily = { last: dayKey(now), streak: st.streak + 1 };
      return { streak: p.daily.streak };
    }
    throw invalid('Premio sconosciuto.');
  },

  // Libro degli ospiti: chi è in visita lascia la firma (una al giorno per casa) e un pensiero.
  sign(s, op, ctx, now) {
    const r = needResident(s, ctx);
    const owner = s.residents[op.owner];
    if (!owner || residentHouse(s, owner.id)?.status !== 'casa') throw new DomainError('notfound', 'Casa non trovata.');
    if (owner.id === r.id) throw invalid('Il libro degli ospiti lo firmano gli altri.');
    if (!canVisit(s, r.id, owner.id)) throw forbidden('Il padrone di casa non fa entrare visite.');
    s.guestbook ||= {};
    const list = (s.guestbook[owner.id] ||= []);
    const today = dayKey(now);
    if (list.some((g) => g.by === r.id && dayKey(g.at) === today)) throw invalid('Oggi hai già firmato: ripassa domani.');
    const text = op.text ? checkSay(op.text) : '';
    list.push({ by: r.id, at: now, text });
    if (list.length > GUESTBOOK_MAX) list.splice(0, list.length - GUESTBOOK_MAX);
    return { ok: true };
  },

  // Un cuore alla casa: uno a settimana per ogni visitatore, si può anche togliere.
  heart(s, op, ctx, now) {
    const r = needResident(s, ctx);
    const owner = s.residents[op.owner];
    if (!owner || residentHouse(s, owner.id)?.status !== 'casa') throw new DomainError('notfound', 'Casa non trovata.');
    if (owner.id === r.id) throw invalid('Alla propria casa non si danno cuori.');
    if (!canVisit(s, r.id, owner.id)) throw forbidden('Il padrone di casa non fa entrare visite.');
    s.hearts ||= {};
    const m = (s.hearts[owner.id] ||= {});
    const on = m[r.id] !== undefined && weekKey(m[r.id]) === weekKey(now);
    if (on) delete m[r.id]; else m[r.id] = now;
    return { on: !on, n: heartsThisWeek(s, owner.id, now) };
  },

  // Sistema: a settimana finita il giornale annuncia la Casa della settimana.
  weekly(s, op, ctx, now) {
    if (!ctx.system) throw forbidden('Operazione interna.');
    const prev = weekKey(now) - 1;
    if (s.weeklyDone === prev) return { announced: false, changed: false };
    s.weeklyDone = prev;
    const top = weekRanking(s, prev)[0];
    if (!top) return { announced: false, changed: true };
    addNews(s, { kind: 'casaSettimana', at: now, residentId: top.id, slot: residentHouse(s, top.id).slot, n: top.n });
    return { announced: true, changed: true };
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
    if (s.rooms) delete s.rooms[id];
    if (s.inv) delete s.inv[id];
    if (s.progress) delete s.progress[id];
    if (s.guestbook) { delete s.guestbook[id]; for (const list of Object.values(s.guestbook)) for (let i = list.length - 1; i >= 0; i--) if (list[i].by === id) list.splice(i, 1); }
    if (s.hearts) { delete s.hearts[id]; for (const m of Object.values(s.hearts)) delete m[id]; }
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
    roads: s.roads, doors: s.doors, news: s.news.slice(0, 120), milestones: s.milestones, rooms: s.rooms || {},
    inv: viewerId && s.inv?.[viewerId] ? { [viewerId]: s.inv[viewerId] } : {},
    progress: viewerId && s.progress?.[viewerId] ? { [viewerId]: s.progress[viewerId] } : {},
    guestbook: s.guestbook || {}, hearts: s.hearts || {},
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
        text: n.n === FOUNTAIN_AT ? 'Traguardo raggiunto: la fontana della piazza ha l\'acqua. Grazie a tutti!' : `Un nuovo traguardo per la città. ${nextGoal({ milestones: [] }, n.n)}`,
      };
    case 'casaSettimana':
      return {
        title: r ? `Casa della settimana: da ${who}` : 'La Casa della settimana',
        text: `${n.n} ${n.n === 1 ? 'abitante le ha lasciato' : 'abitanti le hanno lasciato'} un cuore. Passate a trovarla nel quartiere ${d ? d.name : 'Centro'} e firmate il libro degli ospiti!`,
      };
    default:
      return { title: 'Notizia', text: '' };
  }
}

// Il prossimo obiettivo collettivo, per la barra in piazza.
export function nextGoal(s, built) {
  if (built < FOUNTAIN_AT) return `Mancano ${FOUNTAIN_AT - built} abitanti all'acqua nella fontana della piazza.`;
  const m = MILESTONES.find((x) => x > built);
  return m ? `Prossimo traguardo: ${m} abitanti.` : 'Siamo una vera città!';
}
export function goalProgress(built) {
  const target = built < FOUNTAIN_AT ? FOUNTAIN_AT : MILESTONES.find((x) => x > built) || built;
  const from = built < FOUNTAIN_AT ? 0 : [0, ...MILESTONES].filter((x) => x <= built).pop();
  return { target, from, ratio: target === from ? 1 : (built - from) / (target - from) };
}
