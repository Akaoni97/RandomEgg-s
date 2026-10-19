// La città vista dall'alto di tre quarti, in pixel art: caselle quadrate da 32, facciate viste di
// fronte, tetti visti dall'alto, ombre morbide e luce calda. Le quote del terreno spostano le
// caselle verso l'alto e mostrano il loro fronte (muretti, scarpate, argini del canale).
// Qui c'è solo la città: gli interni delle case restano nelle stanze isometriche di render.js.
import {
  W, H, MAIN_Y, SEA_Y, PIAZZA, PLAN, ROOFS, DOORS, FOUNTAIN_AT, DISTRICTS,
  key, districtAt, inPiazza, builtCount, isFounder, levelAt, hash, shopAt, BENCHES, PIAZZA_DECOR, STREET, isStreet, isCanal, CANAL,
} from './core.js';
import { mix, shade, ih, vnoise, clamp01, poly, lerp, blob, glow } from './art.js';

export const TILE = 32;
const T = TILE;
const LVH = 16;                                   // altezza di un gradone di terreno
export const townElev = (L) => (L < 0 ? -8 : L * LVH);
const EL = townElev;
// Punto a terra al centro di una casella (anche frazionaria), alla sua quota.
export function townCenter(x, y, L = 0) { return [(x + 0.5) * T, (y + 0.5) * T - EL(L)]; }
export const TOWN_WORLD = { x0: -2 * T, x1: (W + 2) * T, y0: -4 * T, y1: (H + 1) * T };
const roofOf = (id) => (ROOFS.find((r) => r.id === id) || ROOFS[0]).color;
const doorOf = (id) => (DOORS.find((r) => r.id === id) || DOORS[0]).color;

/* Terreno ---------------------------------------------------------------- */

const CROP_LIST = ['wheat', 'wheat', 'vine', 'green', 'plow', 'olive', 'wheat', 'vine'];
const CROP_TINT = { wheat: ['#e6c96a', '#c9a84a'], vine: ['#cdb68a', '#5f8f3c'], green: ['#b8d474', '#8fb352'], plow: ['#be9468', '#946a45'] };
const townGroundCache = new Map();

// Per ogni casella: tipo (0 erba di quartiere, 1 prato, 2 campo, 3 spiaggia, 4 mare, 5 uliveto,
// 6 canale), colore, coltura, quota, alberi. Si calcola una volta per numero di quartieri aperti.
export function townGround(open) {
  if (townGroundCache.has(open)) return townGroundCache.get(open);
  const kind = new Uint8Array(W * H);
  const color = new Array(W * H);
  const crop = new Array(W * H);
  const level = new Int8Array(W * H);
  const trees = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = districtAt(x, y);
      const n = vnoise(x / 7, y / 7, 1);
      const j = (ih(x, y, 2) - 0.5) * 0.08;
      level[i] = levelAt(x, y, open);
      if (y > SEA_Y) { kind[i] = 4; color[i] = mix('#78c6dc', '#3a8cbc', clamp01((y - SEA_Y - 1) / 6)); }
      else if (isCanal(x, y) && level[i] < 0) { kind[i] = 6; color[i] = mix('#57a6c6', '#4b97b9', ih(x, y, 4)); }
      else if (y === SEA_Y) { kind[i] = 3; color[i] = mix('#f2dfab', '#e8d198', ih(x, y, 3)); }
      else if (d && d <= open) { kind[i] = 0; color[i] = mix('#8fcf5c', '#76ba4c', clamp01(n + j)); }
      else if (d) {
        const px = Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6), py = Math.floor(y / 4);
        const c = CROP_LIST[Math.floor(ih(px, py, 7) * CROP_LIST.length)];
        if (c === 'olive') {
          kind[i] = 5; color[i] = mix('#b6d084', '#a0bd70', n);
          if ((x + y) % 2 === 0 && !PLAN.futureRoads.has(key(x, y))) trees.set(key(x, y), { kind: 'ulivo', s: 0.85 + ih(x, y, 10) * 0.2 });
        } else {
          kind[i] = 2; crop[i] = { c, dir: ih(px, py, 8) > 0.5 ? 'u' : 'v' }; color[i] = CROP_TINT[c][0];
        }
      } else { kind[i] = 1; color[i] = mix('#90c95e', '#72ab4b', clamp01(n + j)); }
      if (level[i] >= 2 && kind[i] === 1) color[i] = mix(color[i], level[i] === 3 ? '#5c8c47' : '#6f9f52', 0.45);
    }
  }
  // Boschi, filari di cipressi lungo la statale, pini sulla costa.
  for (let y = 0; y < SEA_Y; y++) {
    for (let x = 0; x < W; x++) {
      if (districtAt(x, y) || y === MAIN_Y) continue;
      const k = key(x, y);
      if (Math.abs(y - MAIN_Y) === 1) { if (x % 2 === 0) trees.set(k, { kind: 'cipresso', s: 0.95 + ih(x, y, 13) * 0.2 }); continue; }
      const L = levelAt(x, y, open);
      const forest = vnoise(x / 5, y / 5, 6);
      const p = L >= 2 ? 0.6 : forest > 0.58 ? 0.75 : 0.06;
      if (ih(x, y, 14) > p) continue;
      const t = y >= SEA_Y - 5 ? 'pino' : ih(x, y, 15) > 0.72 ? 'cipresso' : 'tondo';
      trees.set(k, { kind: t, s: 0.85 + ih(x, y, 16) * 0.35 });
    }
  }
  const G = { kind, color, crop, level, trees };
  townGroundCache.set(open, G);
  return G;
}

/* Rampe: dove una via cambia livello, una casella diventa una salita ------ */

const townRampCache = new WeakMap();
// l0 e l1 sono i livelli ai due bordi della rampa lungo il suo asse (verso coordinate basse e alte).
// Si sceglie la casella che non è un incrocio, così la rampa segue la strada.
export function townRamps(city, G) {
  let r = townRampCache.get(city.roads);
  if (r) return r;
  r = new Map();
  const lv = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : G.level[y * W + x]);
  const road = (x, y) => !!city.roads[key(x, y)];
  for (const k of Object.keys(city.roads)) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy, axis] of [[1, 0, 'x'], [0, 1, 'y']]) {
      const nx = x + dx, ny = y + dy;
      if (!road(nx, ny)) continue;
      const a = lv(x, y), b = lv(nx, ny);
      if (a === null || b === null || a < 0 || b < 0 || Math.abs(a - b) !== 1) continue;
      const junction = (tx, ty) => (axis === 'x' ? road(tx, ty - 1) || road(tx, ty + 1) : road(tx - 1, ty) || road(tx + 1, ty));
      // [casella, livello dell'altra, la casella è la prima lungo l'asse?]
      const low = a < b ? [x, y, b, true] : [nx, ny, a, false];
      const high = a < b ? [nx, ny, a, false] : [x, y, b, true];
      const pick = [low, high].find(([tx, ty]) => !junction(tx, ty) && !r.has(key(tx, ty)));
      if (!pick) continue;
      const [tx, ty, other, first] = pick;
      const own = lv(tx, ty);
      r.set(key(tx, ty), first ? { axis, l0: own, l1: other } : { axis, l0: other, l1: own });
    }
  }
  townRampCache.set(city.roads, r);
  return r;
}
// Altezza del terreno in un punto della griglia: piatta, o in pendenza sulle rampe.
export function townSurface(G, ramps, gx, gy) {
  const x = Math.floor(gx), y = Math.floor(gy);
  if (x < 0 || y < 0 || x >= W || y >= H) return 0;
  const r = ramps?.get(key(x, y));
  if (r) { const f = r.axis === 'x' ? gx - x : gy - y; return EL(r.l0) + (EL(r.l1) - EL(r.l0)) * f; }
  return EL(G.level[y * W + x]);
}
export function surfaceOf(city, gx, gy) {
  const G = townGround(city.openDistricts);
  return townSurface(G, townRamps(city, G), gx, gy);
}

/* Superficie delle caselle ------------------------------------------------ */

function dots(g, X, Y, seed, n, colors, w = 2, h = 1) {
  for (let k = 0; k < n; k++) {
    g.fillStyle = colors[k % colors.length];
    g.fillRect(Math.floor(X + 2 + ih(seed, k, 1) * (T - 4)), Math.floor(Y + 2 + ih(seed, k, 2) * (T - 4)), w, h);
  }
}
const isRoad = (city, x, y) => !!city.roads[key(x, y)];

// Il piano di una casella: (X, Y) è l'angolo in alto a sinistra sullo schermo.
function tileTop(g, city, G, x, y, X, Y, det) {
  const i = y * W + x;
  const k = G.kind[i];
  const road = city.roads[key(x, y)];
  const fill = (c, dx = 0, dy = 0, w = T, h = T) => { g.fillStyle = c; g.fillRect(X + dx, Y + dy, w, h); };
  // Marciapiede in lastre chiare con il cordolo (luce sopra, ombra verso la strada)
  const sidewalk = (side, wdt) => {
    const [dx, dy, w, h] = side === 'N' ? [0, 0, T, wdt] : side === 'S' ? [0, T - wdt, T, wdt] : side === 'W' ? [0, 0, wdt, T] : [T - wdt, 0, wdt, T];
    fill('#ded4c0', dx, dy, w, h);
    if (det) {
      g.fillStyle = 'rgba(120,100,70,0.22)';
      if (side === 'N' || side === 'S') for (let a = 8; a < T; a += 8) g.fillRect(X + a, Y + dy, 1, h);
      else for (let a = 8; a < T; a += 8) g.fillRect(X + dx, Y + a, w, 1);
    }
    g.fillStyle = '#f3ecdc';
    if (side === 'N') g.fillRect(X, Y + wdt - 2, T, 1); if (side === 'S') g.fillRect(X, Y + T - wdt, T, 1);
    if (side === 'W') g.fillRect(X + wdt - 2, Y, 1, T); if (side === 'E') g.fillRect(X + T - wdt, Y, 1, T);
    g.fillStyle = 'rgba(40,30,20,0.35)';
    if (side === 'N') g.fillRect(X, Y + wdt - 1, T, 1); if (side === 'S') g.fillRect(X, Y + T - wdt - 1, T, 1);
    if (side === 'W') g.fillRect(X + wdt - 1, Y, 1, T); if (side === 'E') g.fillRect(X + T - wdt - 1, Y, 1, T);
  };
  if (road === 'main' || road === 'dorsal') {
    fill('#5a5e65');
    if (det) {
      for (let n = 0; n < 14; n++) { g.fillStyle = n % 3 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.09)'; g.fillRect(X + Math.floor(ih(x * 7 + n, y, 61) * 31), Y + Math.floor(ih(x, y * 7 + n, 62) * 31), 1 + (n % 2), 1); }
      if (ih(x, y, 63) > 0.8) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X + 8, Y + 12, 6, 1); g.fillRect(X + 13, Y + 13, 4, 1); }
    }
    const nX = isRoad(city, x - 1, y) || isRoad(city, x + 1, y), nY = isRoad(city, x, y - 1) || isRoad(city, x, y + 1);
    const alongX = nX && (!nY || (y === MAIN_Y && road === 'main'));
    if (!isRoad(city, x, y - 1)) sidewalk('N', 6);
    if (!isRoad(city, x, y + 1)) sidewalk('S', 6);
    if (!isRoad(city, x - 1, y)) sidewalk('W', 6);
    if (!isRoad(city, x + 1, y)) sidewalk('E', 6);
    if (!det) return;
    const cross = alongX && road === 'main' && isRoad(city, x, y - 1) && isRoad(city, x, y + 1);
    if (cross) {
      // Strisce pedonali dove una via attraversa la statale
      for (let s = 0; s < 5; s++) { g.fillStyle = '#f1ede4'; g.fillRect(X + 3 + s * 6, Y + 5, 3, T - 10); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X + 3 + s * 6, Y + T - 6, 3, 1); }
    } else if (alongX && !nY) {
      g.fillStyle = '#efe7cf'; g.fillRect(X + 4, Y + T / 2 - 1, 9, 2); g.fillRect(X + 20, Y + T / 2 - 1, 9, 2);
    } else if (!nX && nY) {
      g.fillStyle = '#efe7cf'; g.fillRect(X + T / 2 - 1, Y + 4, 2, 9); g.fillRect(X + T / 2 - 1, Y + 20, 2, 9);
    }
    return;
  }
  if (road === 'via') {
    // Sampietrini irregolari: file sfalsate di pietre di larghezza diversa, giunti scuri, luce in alto
    fill('#6e685f');
    const tones = ['#b4ab9c', '#a79e90', '#9b9284', '#c0b7a8', '#aaa193', '#988f82'];
    for (let r = 0; r < 5; r++) {
      const sy = Y + r * 6.4;
      let sx = X - Math.floor(ih(x, y * 5 + r, 23) * 5);
      for (let c = 0; sx < X + T; c++) {
        const w = 5 + Math.floor(ih(x * 9 + c, y * 5 + r, 24) * 4);
        const x0 = Math.max(X, sx), x1 = Math.min(X + T, sx + w - 1);
        if (x1 > x0) {
          g.fillStyle = tones[Math.floor(ih(x * 9 + c, y * 5 + r, 25) * tones.length)];
          g.fillRect(x0, Math.round(sy), x1 - x0, 5);
          if (det) { g.fillStyle = 'rgba(255,250,235,0.28)'; g.fillRect(x0, Math.round(sy), x1 - x0, 1); g.fillStyle = 'rgba(30,20,10,0.16)'; g.fillRect(x0, Math.round(sy) + 4, x1 - x0, 1); }
        }
        sx += w;
      }
    }
    if (!isRoad(city, x, y - 1)) sidewalk('N', 4);
    if (!isRoad(city, x, y + 1)) sidewalk('S', 4);
    if (!isRoad(city, x - 1, y)) sidewalk('W', 4);
    if (!isRoad(city, x + 1, y)) sidewalk('E', 4);
    return;
  }
  if (road === 'lane') {
    fill('#c9b48c');
    if (det) dots(g, X, Y, x * 13 + y, 12, ['#ddc9a2', '#b39d76', '#e6d6b4'], 2, 2);
    return;
  }
  if (road === 'piazza' || inPiazza(x, y)) {
    const border = x === PIAZZA.x0 || x === PIAZZA.x1 || y === PIAZZA.y0 || y === PIAZZA.y1;
    if (border) {
      // Cornice di cotto a spina di pesce
      fill('#8e5236');
      for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
        g.fillStyle = (r + c) % 2 ? '#c98a5e' : '#b8774b';
        g.fillRect(X + c * 8 + (r % 2 ? 4 : 0), Y + r * 4, 7, 3);
        if (det) { g.fillStyle = 'rgba(255,230,200,0.25)'; g.fillRect(X + c * 8 + (r % 2 ? 4 : 0), Y + r * 4, 7, 1); }
      }
      return;
    }
    // Lastre di pietra calda, sfalsate, ognuna con un filo di luce e uno d'ombra
    fill('#b9a383');
    const tones = ['#ead8ba', '#e2cdac', '#efdfc3', '#dcc6a4'];
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 6 : 0;
      for (let c = -1; c < 3; c++) {
        const sx = X + c * 12 + off, w = 11;
        const x0 = Math.max(X, sx), x1 = Math.min(X + T, sx + w);
        if (x1 <= x0) continue;
        g.fillStyle = tones[Math.floor(ih(x * 3 + c, y * 4 + r, 26) * tones.length)];
        g.fillRect(x0, Y + r * 8, x1 - x0, 7);
        if (det) { g.fillStyle = 'rgba(255,255,240,0.35)'; g.fillRect(x0, Y + r * 8, x1 - x0, 1); g.fillStyle = 'rgba(90,60,30,0.15)'; g.fillRect(x0, Y + r * 8 + 6, x1 - x0, 1); }
      }
    }
    return;
  }
  fill(G.color[i]);
  if (k === 4 || k === 6) {
    // Acqua: riflessi, schiuma dove tocca la riva, ninfee nel canale
    const up = y > 0 ? G.kind[(y - 1) * W + x] : k;
    if (up !== 4 && up !== 6) { fill('rgba(20,60,80,0.35)', 0, 0, T, 4); fill('rgba(255,255,255,0.5)', 0, 4, T, 1); }
    if (!det) return;
    for (let n = 0; n < 4; n++) { g.fillStyle = n % 2 ? 'rgba(255,255,255,0.45)' : 'rgba(30,90,130,0.25)'; g.fillRect(X + Math.floor(ih(x, y * 4 + n, 31) * 24), Y + 6 + Math.floor(ih(x * 4 + n, y, 32) * 22), 4 + (n % 3) * 2, 1); }
    if (k === 6 && ih(x, y, 77) > 0.45) for (let n = 0; n < 3; n++) {
      const px = X + 5 + ih(x, y + n, 78) * 22, py = Y + 8 + ih(x + n, y, 79) * 18;
      g.fillStyle = '#3f7d34'; g.beginPath(); g.arc(px, py + 0.5, 3.8, 0.5, Math.PI * 2); g.lineTo(px, py); g.fill();
      g.fillStyle = '#6aa84f'; g.beginPath(); g.arc(px, py, 3.5, 0.5, Math.PI * 2); g.lineTo(px, py); g.fill();
      if (n === 0 && ih(x, y, 80) > 0.5) { g.fillStyle = '#f7b6cf'; g.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 2); g.fillStyle = '#ffffff'; g.fillRect(Math.round(px), Math.round(py) - 2, 1, 1); }
    }
    return;
  }
  if (!det) return;
  if (k === 0 || k === 1 || k === 5) {
    // Erba: macchie di tono, ciuffi di fili più scuri e più chiari, qualche fiorellino
    const base = G.color[i];
    for (let n = 0; n < 3; n++) { g.fillStyle = n % 2 ? shade(base, 0.04) : shade(base, -0.04); g.fillRect(X + Math.floor(ih(x, y * 3 + n, 41) * 22), Y + Math.floor(ih(x * 3 + n, y, 42) * 22), 10, 8); }
    for (let n = 0; n < 16; n++) {
      const px = X + Math.floor(ih(x * 16 + n, y, 43) * 30), py = Y + 2 + Math.floor(ih(x, y * 16 + n, 44) * 28);
      g.fillStyle = n % 3 === 0 ? shade(base, 0.12) : shade(base, -0.14);
      g.fillRect(px, py, 1, 2); if (n % 4 === 0) g.fillRect(px + 1, py - 1, 1, 2);
    }
    if (k !== 5 && ih(x, y, 20) > 0.72) {
      const fc = ['#ffffff', '#f6d84a', '#e86b8a', '#b48be0'][Math.floor(ih(x, y, 21) * 4)];
      for (let n = 0; n < 3; n++) { const px = X + 4 + Math.floor(ih(x, y + n, 45) * 24), py = Y + 4 + Math.floor(ih(x + n, y, 46) * 24); g.fillStyle = fc; g.fillRect(px, py, 2, 2); g.fillStyle = '#f6d84a'; if (fc !== '#f6d84a') g.fillRect(px, py, 1, 1); }
    }
  } else if (k === 2) {
    const { c, dir } = G.crop[i];
    for (let r = 0; r < 4; r++) {
      g.fillStyle = CROP_TINT[c][1];
      if (dir === 'u') g.fillRect(X, Y + 3 + r * 8, T, c === 'vine' ? 3 : 2); else g.fillRect(X + 3 + r * 8, Y, c === 'vine' ? 3 : 2, T);
      g.fillStyle = 'rgba(255,255,220,0.25)';
      if (dir === 'u') g.fillRect(X, Y + 2 + r * 8, T, 1); else g.fillRect(X + 2 + r * 8, Y, 1, T);
    }
  } else if (k === 3) {
    dots(g, X, Y, x * 17 + y, 8, ['rgba(160,120,60,0.3)', 'rgba(255,255,255,0.5)']);
    if (G.kind[Math.min(H - 1, y + 1) * W + x] === 4) { fill('rgba(120,170,190,0.35)', 0, T - 4, T, 4); fill('rgba(255,255,255,0.6)', 0, T - 4, T, 1); }
  }
  // Lotto libero: riquadro tratteggiato
  const lk = key(x, y);
  if (PLAN.lots.has(lk) && !city.houses[lk] && districtAt(x, y) <= city.openDistricts) {
    fill('rgba(255,255,255,0.16)', 3, 3, T - 6, T - 6);
    g.save(); g.setLineDash([3, 2]); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1; g.strokeRect(X + 3.5, Y + 3.5, T - 7, T - 7); g.restore();
  }
}
// Il fronte di una casella più alta di quella davanti (a sud): muretto, scarpata, argine o scale.
function tileFront(g, city, G, ramps, x, y, det) {
  const L = G.level[y * W + x];
  const border = y + 1 >= H;
  const h = (tx, ty, u, v) => townSurface(G, ramps, tx + Math.min(u, 0.999), ty + Math.min(v, 0.999));
  const hL = h(x, y, 0, 1), hR = h(x, y, 1, 1);
  const nL = border ? -48 : h(x, y + 1, 0, 0), nR = border ? -48 : h(x, y + 1, 1, 0);
  const dL = hL - nL, dR = hR - nR;
  if (dL <= 0.5 && dR <= 0.5) return;
  const Yb = (y + 1) * T, X = x * T;
  const a = [X, Yb - hL], b = [X + T, Yb - hR], b2 = [X + T, Yb - Math.min(hR, nR)], a2 = [X, Yb - Math.min(hL, nL)];
  const k = key(x, y), nk = key(x, y + 1);
  const sloped = ramps.has(k) || ramps.has(nk);
  const stairs = !border && !sloped && city.roads[k] && city.roads[nk];
  const canal = !border && isCanal(x, y + 1) && G.level[(y + 1) * W + x] < 0;
  const town = (L >= 1 || sloped) && !border;
  let top, bottom;
  if (stairs) { top = '#e4d8bf'; bottom = '#cbbb95'; }
  else if (canal) { top = '#d9c9a5'; bottom = '#9c8a66'; }
  else if (town) { top = '#dcc8a2'; bottom = '#b09872'; }
  else if (L <= 0) { top = '#e2cb92'; bottom = '#b99a62'; }
  else { top = '#b98b5c'; bottom = '#7b5636'; }
  const drop = Math.max(dL, dR);
  const gr = g.createLinearGradient(0, Math.min(a[1], b[1]), 0, Math.max(a2[1], b2[1]));
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  poly(g, [a, b, b2, a2]); g.fillStyle = gr; g.fill();
  if (canal && city.roads[k]) {
    // Arco del ponte sopra l'acqua
    g.fillStyle = '#2d5e72'; g.beginPath(); g.ellipse(X + T / 2, Math.max(a2[1], b2[1]), T * 0.34, Math.min(drop - 2, 14), 0, Math.PI, 0); g.fill();
  }
  if (det) {
    g.fillStyle = 'rgba(80,60,35,0.35)';
    if (stairs) for (let t = 3; t < drop; t += 3) g.fillRect(X, Math.min(a[1], b[1]) + t, T, 1);
    else if (town || canal) {
      // Blocchi di pietra
      for (let r = 0; r * 5 < drop; r++) {
        g.fillRect(X, Math.min(a[1], b[1]) + r * 5 + 4, T, 1);
        for (let c = 0; c < 4; c++) g.fillRect(X + c * 8 + (r % 2) * 4, Math.min(a[1], b[1]) + r * 5, 1, 4);
      }
    } else for (let s = 0; s < 5; s++) g.fillRect(X + 3 + s * 6, Math.min(a[1], b[1]) + 3, 1, Math.max(0, drop - 6 - ih(x, s, 8) * 4));
  }
  // Orlo in cima
  g.fillStyle = town || stairs || canal ? 'rgba(255,248,230,0.7)' : 'rgba(255,255,255,0.18)';
  poly(g, [a, b, [b[0], b[1] + 1.5], [a[0], a[1] + 1.5]]); g.fill();
}

// Piano e fronte di una casella, compresa l'eventuale rampa (piano inclinato).
function drawTile(g, city, G, ramps, x, y, det) {
  const r = ramps.get(key(x, y));
  if (r) {
    const h0 = EL(r.l0), h1 = EL(r.l1);
    g.save();
    g.translate(x * T, y * T - h0);
    if (r.axis === 'x') g.transform(1, -(h1 - h0) / T, 0, 1, 0, 0); else g.transform(1, 0, 0, (T - (h1 - h0)) / T, 0, 0);
    tileTop(g, city, G, x, y, 0, 0, det);
    g.restore();
  } else tileTop(g, city, G, x, y, x * T, y * T - EL(G.level[y * W + x]), det);
  tileFront(g, city, G, ramps, x, y, det);
}

/* Alberi, vasi, arredo urbano (disegnati in pixel dello schermo) --------- */

// (cx, cy) è la base dell'albero.
function drawTree(g, t, cx, cy) {
  const s = t.s;
  const seed = Math.round(cx * 7 + cy * 13);
  g.fillStyle = 'rgba(25,40,15,0.3)';
  g.beginPath(); g.ellipse(cx + 6 * s, cy + 1, 16 * s, 5 * s, 0, 0, 7); g.fill();
  if (t.kind === 'cipresso') {
    g.fillStyle = '#5c3f26'; g.fillRect(cx - 1.5, cy - 5, 3, 5);
    g.fillStyle = '#1e3d29'; g.beginPath(); g.ellipse(cx + 1, cy - 23 * s, 7.5 * s, 21 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#2c5537'; g.beginPath(); g.ellipse(cx, cy - 23 * s, 6.5 * s, 20 * s, 0, 0, 7); g.fill();
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#3d7049' : '#4b8257'; g.beginPath(); g.arc(cx - 2 * s + ih(seed, k, 7) * 3 * s, cy - 8 * s - ih(seed, k, 8) * 30 * s, 1.6 * s, 0, 7); g.fill(); }
  } else if (t.kind === 'pino') {
    g.strokeStyle = '#6b4a2f'; g.lineWidth = 3 * s;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx - 2, cy - 14 * s, cx + 3, cy - 24 * s); g.stroke();
    canopy(g, cx + 3, cy - 28 * s, 14 * s, ['#2f5a31', '#3f7040', '#558a50', '#7aa868'], seed);
  } else if (t.kind === 'ulivo') {
    g.strokeStyle = '#76604a'; g.lineWidth = 2.5 * s;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + 3, cy - 6, cx - 1, cy - 11 * s); g.stroke();
    canopy(g, cx, cy - 17 * s, 9 * s, ['#6f8458', '#8fa36e', '#a9bb8a', '#cbd8ae'], seed);
  } else if (t.kind === 'cespuglio') {
    canopy(g, cx, cy - 6, 7.5, ['#3f8634', '#56a043', '#78bf5a', '#a7dc84'], seed);
    if (t.flowers) for (let k = 0; k < 7; k++) { g.fillStyle = t.flowers; g.fillRect(Math.round(cx - 6 + ih(seed, k, 9) * 12), Math.round(cy - 12 + ih(seed, k, 10) * 10), 2, 2); }
  } else {
    // Latifoglia (o albero in fiore): tronco con rami, chioma grande a ciuffi
    const bloom = t.kind === 'fiorito';
    g.fillStyle = '#5e4128'; g.fillRect(cx - 2.5, cy - 14 * s, 5, 14 * s);
    g.fillStyle = '#7a5636'; g.fillRect(cx - 2.5, cy - 14 * s, 2, 14 * s);
    g.strokeStyle = '#5e4128'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - 12 * s); g.lineTo(cx - 6 * s, cy - 20 * s); g.moveTo(cx, cy - 13 * s); g.lineTo(cx + 6 * s, cy - 21 * s); g.stroke();
    const cols = bloom ? ['#c75b88', '#e47fa6', '#f6b2cb', '#fde3ec'] : ['#2f7030', '#4c973d', '#6ab64f', '#a6dc7c'];
    canopy(g, cx, cy - 27 * s, 17 * s, cols, seed);
    if (bloom) for (let k = 0; k < 6; k++) { g.fillStyle = '#f6b2cb'; g.fillRect(Math.round(cx - 12 * s + ih(seed, k, 11) * 26 * s), Math.round(cy - 2 + ih(seed, k, 12) * 4), 2, 1); }
  }
}
// Vaso di terracotta con fiori (con il contorno, come tutto il resto)
function pot(g, x, y, seed = 0) {
  const flowers = [['#e85d75', '#f6d84a'], ['#b46ad6', '#ffffff'], ['#f08a3c', '#e85d75'], ['#ffffff', '#f2a7c3']][seed % 4];
  g.fillStyle = 'rgba(30,30,20,0.25)'; g.beginPath(); g.ellipse(x + 3, y + 1, 7, 2.5, 0, 0, 7); g.fill();
  poly(g, [[x - 5, y - 8], [x + 5, y - 8], [x + 4, y], [x - 4, y]]); g.fillStyle = '#c66a3c'; g.fill(); g.strokeStyle = '#6e3a1f'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#e09366'; g.fillRect(x - 4, y - 7, 2, 6);
  g.fillStyle = '#d98250'; g.fillRect(x - 6, y - 10, 12, 3); g.fillStyle = '#6e3a1f'; g.fillRect(x - 6, y - 7, 12, 1);
  canopy(g, x, y - 14, 5.5, ['#3f8634', '#56a043', '#78bf5a', '#a7dc84'], seed * 31 + x);
  for (let k = 0; k < 7; k++) { g.fillStyle = flowers[k % 2]; g.fillRect(Math.round(x - 5 + ih(seed, k, 13) * 10), Math.round(y - 19 + ih(seed, k, 14) * 9), 2, 2); }
  // Un rametto che ricade dal bordo
  g.fillStyle = '#4c973d'; g.fillRect(x + 4, y - 8, 1, 4); g.fillRect(x + 5, y - 5, 1, 2);
}
// Buganvillea su un muro: grappoli fucsia e viola tra le foglie, nel riquadro (x0, y0)–(x1, y1)
function bougainvillea(g, x0, y0, x1, y1, seed, n = 30) {
  const cols = ['#c2367a', '#e0559a', '#9b3fb0', '#f28cbf', '#d94e93'];
  for (let k = 0; k < n; k++) {
    const px = x0 + ih(seed, k, 11) * (x1 - x0), py = y0 + ih(seed, k, 12) * (y1 - y0);
    g.fillStyle = k % 3 === 0 ? (k % 2 ? '#3f7d34' : '#2f6428') : cols[k % cols.length];
    g.beginPath(); g.arc(px, py, 1.5 + ih(seed, k, 13) * 1.6, 0, 7); g.fill();
  }
}
// Panchina di legno su piedi di pietra, vista di fronte
function bench(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.28)'; g.fillRect(x - 11, y - 1, 26, 3);
  g.fillStyle = '#b8aa8c'; g.fillRect(x - 11, y - 7, 4, 7); g.fillRect(x + 7, y - 7, 4, 7);
  g.fillStyle = '#8c7d60'; g.fillRect(x - 11, y - 1, 4, 1); g.fillRect(x + 7, y - 1, 4, 1);
  g.fillStyle = '#6e4a2c'; g.fillRect(x - 13, y - 10, 26, 4);
  g.fillStyle = '#9a6a43'; g.fillRect(x - 13, y - 10, 26, 2);
  g.fillStyle = '#6e4a2c'; g.fillRect(x - 13, y - 18, 26, 3); g.fillRect(x - 13, y - 14, 26, 2);
  g.fillStyle = '#a87650'; g.fillRect(x - 13, y - 18, 26, 1);
  g.fillStyle = '#3b3f45'; g.fillRect(x - 11, y - 18, 2, 8); g.fillRect(x + 9, y - 18, 2, 8);
}
function planter(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.25)'; g.beginPath(); g.ellipse(x + 3, y + 1, 12, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#9c8a66'; g.fillRect(x - 10, y - 8, 20, 9);
  g.fillStyle = '#d8c8a4'; g.fillRect(x - 9, y - 8, 18, 8); g.fillStyle = '#c4b38e'; g.fillRect(x - 9, y - 3, 18, 3); g.fillStyle = '#ebdfc4'; g.fillRect(x - 10, y - 10, 20, 2);
  canopy(g, x - 4, y - 14, 6.5, ['#3f8634', '#56a043', '#78bf5a', '#a7dc84'], x * 3 + y);
  canopy(g, x + 4, y - 14, 6.5, ['#3f8634', '#56a043', '#78bf5a', '#a7dc84'], x * 5 + y);
  for (let k = 0; k < 9; k++) { g.fillStyle = ['#e85d75', '#f6d84a', '#ffffff', '#b46ad6'][k % 4]; g.fillRect(Math.round(x - 9 + ih(x, k, 17) * 18), Math.round(y - 21 + ih(y, k, 18) * 10), 2, 2); }
}
// Lampione in ghisa nera con la lanterna; quelli della piazza portano lo stendardo verde
function lampPost(g, x, y, banner = false) {
  g.fillStyle = 'rgba(30,30,20,0.28)'; g.beginPath(); g.ellipse(x + 3, y, 5, 2, 0, 0, 7); g.fill();
  g.fillStyle = '#1f2a26';
  g.fillRect(x - 3, y - 4, 6, 4); g.fillRect(x - 2, y - 7, 4, 3); g.fillRect(x - 1, y - 40, 2, 34);
  g.fillRect(x - 2, y - 24, 4, 2);
  // Lanterna: cappello, vetro caldo, base
  poly(g, [[x - 5, y - 44], [x + 5, y - 44], [x + 2, y - 49], [x - 2, y - 49]]); g.fill();
  g.fillRect(x - 1, y - 52, 2, 3);
  g.fillRect(x - 4, y - 44, 1, 8); g.fillRect(x + 3, y - 44, 1, 8); g.fillRect(x - 4, y - 37, 8, 2);
  g.fillStyle = '#ffe2a0'; g.fillRect(x - 3, y - 43, 6, 6);
  g.fillStyle = '#fff4cf'; g.fillRect(x - 2, y - 42, 2, 3);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 1, y - 39, 1, 13);
  if (banner) {
    g.fillStyle = '#1f2a26'; g.fillRect(x + 1, y - 34, 9, 1);
    poly(g, [[x + 2, y - 33], [x + 10, y - 33], [x + 10, y - 18], [x + 6, y - 21], [x + 2, y - 18]]); g.fillStyle = '#2f7d4f'; g.fill();
    g.fillStyle = '#245f3c'; g.fillRect(x + 9, y - 33, 1, 14);
    g.fillStyle = '#f4efe3'; g.fillRect(x + 5.5, y - 31, 1, 8); g.fillRect(x + 4, y - 29, 1, 1); g.fillRect(x + 7, y - 28, 1, 1); g.fillRect(x + 4, y - 26, 1, 1); g.fillRect(x + 7, y - 25, 1, 1);
  }
}
function chalkboard(g, x, y) {
  poly(g, [[x - 5, y], [x - 3, y - 14], [x + 3, y - 14], [x + 5, y]]); g.fillStyle = '#7a5a3a'; g.fill();
  g.fillStyle = '#2b2f2c'; g.fillRect(x - 3, y - 12, 6, 9);
  g.fillStyle = '#f4efe3'; g.fillRect(x - 2, y - 10, 4, 1); g.fillRect(x - 1, y - 8, 3, 1); g.fillRect(x - 2, y - 6, 3, 1);
}
// Tavolino del bar con due sedie e l'ombrellone a spicchi
function cafeTable(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.22)'; g.beginPath(); g.ellipse(x + 4, y + 1, 18, 6, 0, 0, 7); g.fill();
  const chair = (cx, cy, back) => {
    g.fillStyle = '#3b3f45'; g.fillRect(cx - 3, cy - 6, 1, 6); g.fillRect(cx + 2, cy - 6, 1, 6);
    g.fillStyle = '#c0392b'; g.fillRect(cx - 4, cy - 7, 8, 2);
    g.fillRect(back < 0 ? cx - 4 : cx + 2, cy - 13, 2, 7);
  };
  chair(x - 11, y - 1, -1);
  g.fillStyle = '#3b3f45'; g.fillRect(x - 1, y - 11, 2, 11);
  g.fillStyle = '#f2ead6'; g.beginPath(); g.ellipse(x, y - 11, 8, 3.5, 0, 0, 7); g.fill(); g.strokeStyle = '#b5ab92'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 13, 2, 2); g.fillStyle = '#6b4a2f'; g.fillRect(x + 1, y - 13, 2, 2);
  chair(x + 11, y + 1, 1);
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 0.5, y - 40, 1, 29);
  const apex = [x, y - 46], rim = (a) => [x + Math.cos(a) * 19, y - 35 + Math.sin(a) * 7];
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    poly(g, [apex, rim(a0), rim(a1)]); g.fillStyle = k % 2 ? '#f6ecd4' : '#e6d3a8'; g.fill();
  }
  g.strokeStyle = 'rgba(120,95,50,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(x, y - 35, 19, 7, 0, 0, Math.PI); g.stroke();
}
function umbrella(g, x, y, seed) {
  const cols = [['#e85d4a', '#fff'], ['#2f6b9f', '#fff'], ['#f2b632', '#fff'], ['#4f8a72', '#f6efe0']][seed % 4];
  g.fillStyle = 'rgba(120,90,40,0.25)'; g.beginPath(); g.ellipse(x + 6, y + 2, 13, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#f6efe0'; g.fillRect(x - 12, y, 9, 4);
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 0.5, y - 20, 1, 22);
  for (let k = 0; k < 8; k++) {
    g.fillStyle = cols[k % 2];
    g.beginPath(); g.moveTo(x, y - 26); g.ellipse(x, y - 18, 14, 6, 0, Math.PI + (k / 8) * Math.PI, Math.PI + ((k + 1) / 8) * Math.PI); g.closePath(); g.fill();
  }
}

/* Case viste di fronte ---------------------------------------------------- */

// Intonaco con grana, un filo di luce a sinistra (il sole viene da lì) e ombra a destra, bordo scuro
function plaster(g, x, y, w, h, color, seed, det) {
  g.fillStyle = shade(color, -0.32); g.fillRect(x - 1, y - 1, w + 2, h + 1);
  g.fillStyle = color; g.fillRect(x, y, w, h);
  g.fillStyle = shade(color, 0.07); g.fillRect(x, y, 3, h);
  g.fillStyle = shade(color, -0.09); g.fillRect(x + w - 5, y, 5, h);
  if (!det) return;
  for (let k = 0; k < (w * h) / 30; k++) {
    g.fillStyle = ih(seed, k, 3) > 0.55 ? 'rgba(255,255,255,0.12)' : 'rgba(90,55,30,0.11)';
    g.fillRect(Math.floor(x + ih(seed, k, 1) * w), Math.floor(y + ih(seed, k, 2) * h), 2 + (k % 2), 1);
  }
  // Qualche macchia d'intonaco scrostato
  for (let k = 0; k < 2; k++) {
    if (ih(seed, k, 9) < 0.5) continue;
    const px = x + 6 + ih(seed, k, 7) * (w - 16), py = y + 6 + ih(seed, k, 8) * (h - 14);
    g.fillStyle = shade(color, -0.06); g.fillRect(Math.round(px), Math.round(py), 6, 3); g.fillStyle = '#b5876a'; g.fillRect(Math.round(px) + 1, Math.round(py) + 1, 3, 1);
  }
}
// Finestra con cornice di pietra, persiane a stecche del colore della porta, davanzale e fioriera
function window3(g, x, y, w, h, o, { box = true, shut = true } = {}) {
  const sh = o.door === '#f1ede4' ? '#d9d3c4' : o.door;
  const sw = Math.round(w / 2);
  if (shut) for (const sx of [x - sw - 1, x + w + 1]) {
    g.fillStyle = shade(sh, -0.35); g.fillRect(sx - 1, y - 2, sw + 2, h + 4);
    g.fillStyle = sh; g.fillRect(sx, y - 1, sw, h + 2);
    if (o.detail) { g.fillStyle = shade(sh, -0.18); for (let s = 1; s < h + 1; s += 2) g.fillRect(sx, y + s, sw, 1); g.fillStyle = shade(sh, 0.15); g.fillRect(sx, y - 1, 1, h + 2); }
  }
  g.fillStyle = '#7d6f5a'; g.fillRect(x - 2, y - 3, w + 4, h + 5);
  g.fillStyle = '#efe6d2'; g.fillRect(x - 1, y - 2, w + 2, h + 3);
  const lit = o.lit;
  g.fillStyle = lit ? '#ffcf6a' : o.night ? '#22304d' : '#5f97b8'; g.fillRect(x, y, w, h);
  if (!lit && !o.night && o.detail) {
    g.fillStyle = '#8cc3dd'; g.fillRect(x, y, w, Math.ceil(h * 0.45));
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 1, y + 1, 1, h - 3); g.fillRect(x + 2, y + 1, 2, 1);
    g.fillStyle = 'rgba(255,240,220,0.6)'; g.fillRect(x + w - 3, y + 1, 2, h - 2);
  }
  g.fillStyle = '#efe6d2'; g.fillRect(x + Math.floor(w / 2), y, 1, h); g.fillRect(x, y + Math.floor(h * 0.45), w, 1);
  g.fillStyle = '#e5dac2'; g.fillRect(x - 3, y + h + 1, w + 6, 2); g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(x - 3, y + h + 3, w + 6, 1);
  if (box && o.flowers && o.detail) {
    // Fioriera con i fiori e le piante che ricadono
    g.fillStyle = '#8e3f2b'; g.fillRect(x - 2, y + h + 3, w + 4, 4);
    g.fillStyle = '#b5523b'; g.fillRect(x - 2, y + h + 3, w + 4, 2);
    for (let k = 0; k < 7; k++) {
      const px = x - 1 + k * ((w + 2) / 6);
      g.fillStyle = k % 2 ? '#3f8634' : '#56a043'; g.fillRect(Math.round(px), y + h, 2, 3);
      g.fillStyle = o.flowers[k % 2]; if (k % 2 === 0) g.fillRect(Math.round(px), y + h - 1, 2, 2);
      if (k % 3 === 1) { g.fillStyle = '#3f8634'; g.fillRect(Math.round(px), y + h + 7, 1, 2 + (k % 2) * 3); }
    }
  }
  o.wins.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
}
// Porta ad arco in pietra, a due battenti, con il gradino
function door3(g, x, y, w, h, color) {
  g.fillStyle = '#7d6f5a'; g.fillRect(x - 4, y - 3, w + 8, h + 3);
  g.beginPath(); g.ellipse(x + w / 2, y - 2, w / 2 + 4, 6, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#e6dcc6'; g.fillRect(x - 3, y - 2, w + 6, h + 2);
  g.beginPath(); g.ellipse(x + w / 2, y - 2, w / 2 + 3, 5, 0, Math.PI, 0); g.fill();
  g.fillStyle = shade(color, -0.3); g.fillRect(x - 1, y - 1, w + 2, h + 1);
  g.beginPath(); g.ellipse(x + w / 2, y, w / 2 + 1, 4, 0, Math.PI, 0); g.fill();
  g.fillStyle = color; g.fillRect(x, y, w, h);
  g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 3, 0, Math.PI, 0); g.fill();
  g.fillStyle = shade(color, -0.2);
  g.fillRect(x + Math.floor(w / 2), y - 2, 1, h + 2);
  for (const px of [x + 2, x + Math.floor(w / 2) + 2]) { g.fillRect(px, y + 3, Math.floor(w / 2) - 4, 1); g.fillRect(px, y + h / 2, Math.floor(w / 2) - 4, 1); g.fillRect(px, y + h - 4, Math.floor(w / 2) - 4, 1); }
  g.fillStyle = shade(color, 0.15); g.fillRect(x + 1, y + 1, 1, h - 2);
  g.fillStyle = '#e2bf4f'; g.fillRect(x + Math.floor(w / 2) - 3, y + h / 2 + 2, 1, 2); g.fillRect(x + Math.floor(w / 2) + 2, y + h / 2 + 2, 1, 2);
  g.fillStyle = '#cfc3a8'; g.fillRect(x - 5, y + h, w + 10, 3); g.fillStyle = '#9c8a66'; g.fillRect(x - 5, y + h + 2, w + 10, 1);
}
// Tetto a falde visto dall'alto: file di coppi dalla gronda al colmo, con ombre e luci
function tiledRoof(g, x0, x1, yEave, yRidge, color, det, clip) {
  g.save();
  if (clip) { poly(g, clip); g.clip(); }
  g.fillStyle = color; g.fillRect(x0, yRidge, x1 - x0, yEave - yRidge);
  if (det) {
    for (let y = yRidge, r = 0; y < yEave; y += 4, r++) {
      g.fillStyle = shade(color, 0.08); g.fillRect(x0, y, x1 - x0, 1);
      g.fillStyle = shade(color, -0.18); g.fillRect(x0, y + 3, x1 - x0, 1);
      for (let x = x0 + (r % 2) * 3; x < x1; x += 6) { g.fillStyle = shade(color, -0.26); g.fillRect(x, y + 1, 1, 3); g.fillStyle = shade(color, 0.14); g.fillRect(x + 1, y + 1, 1, 2); }
    }
    // Qualche coppo più scuro (il tetto ha i suoi anni)
    for (let k = 0; k < 6; k++) { g.fillStyle = shade(color, -0.12); g.fillRect(x0 + Math.floor(ih(x0, k, 3) * (x1 - x0 - 4)), yRidge + 2 + Math.floor(ih(yEave, k, 4) * (yEave - yRidge - 6)), 5, 3); }
  }
  g.restore();
}
// Casa vista di fronte. Deve stare nel suo mezzo isolato: al massimo HOUSE_W di larghezza e alta
// meno di quattro caselle, così non copre le vie di lato né la strada dietro.
// (cx, by): centro della facciata e sua base sullo schermo.
// Restituisce le finestre (per la notte), la quota più alta e il riquadro occupato.
export const HOUSE_W = 58;
export function drawHouse3(g, style, cx, by, { lit = false, night = false, founder = false, cantiere = false, flag = null, detail = true } = {}) {
  const wins = [];
  const wall = style.wall, roof = roofOf(style.roof), dcol = doorOf(style.door);
  const hs = hash(style.wall + style.roof + style.door + style.shape);
  const o = { lit, night, door: dcol, detail, wins, flowers: hs % 3 !== 2 ? [['#e85d75', '#f6d84a'], ['#b46ad6', '#f28cbf'], ['#e8423a', '#ffffff']][hs % 3] : null };
  const shape = style.shape;
  const W = HOUSE_W, X0 = Math.round(cx - W / 2), X1 = X0 + W;
  // La torretta prende il lato sinistro, il corpo della casa il resto
  const tw = shape === 'torretta' ? 18 : 0;
  const x0 = X0 + (tw ? tw - 2 : 0), x1 = X1, w = x1 - x0, mx = Math.round((x0 + x1) / 2);
  const Hh = shape === 'villetta' ? 40 : 66;
  const D = 22;
  const y0 = by - Hh;
  // Ombra corta verso destra (resta dentro il lotto)
  g.fillStyle = 'rgba(25,40,15,0.28)';
  poly(g, [[X1, y0 + 6], [X1 + 4, y0 + 10], [X1 + 4, by + 3], [X0 + 6, by + 3], [X0 + 6, by]]); g.fill();
  if (cantiere) {
    // Cantiere: fondamenta, muri a metà, impalcatura, telo e gru
    g.fillStyle = '#b9aa8c'; g.fillRect(X0, by - 8, W, 8);
    plaster(g, X0 + 4, by - 34, W - 8, 26, mix(wall, '#c9bba4', 0.5), hs, detail);
    g.fillStyle = '#b8873c';
    for (const px of [X0, X0 + W / 3, X0 + (2 * W) / 3, X1 - 2]) g.fillRect(Math.round(px), by - 58, 2, 58);
    for (const py of [by - 20, by - 38, by - 56]) { g.fillRect(X0 - 1, py, W + 2, 2); g.fillStyle = '#8a6a3e'; g.fillRect(X0 - 1, py + 2, W + 2, 1); g.fillStyle = '#b8873c'; }
    g.fillStyle = 'rgba(80,140,200,0.55)'; g.fillRect(X0 + 5, by - 54, W / 2 - 7, 32);
    g.fillStyle = '#e0a92a'; g.fillRect(X1 - 10, by - 80, 3, 24); g.fillRect(X1 - 32, by - 80, 32, 3);
    g.fillStyle = '#c0392b'; for (let k = 0; k < 4; k++) g.fillRect(X0 + 3 + k * 15, by - 4, 8, 3);
    return { wins, top: by - 84, box: [X0 - 4, by - 88, X1 + 8, by + 8] };
  }
  // Tetto: falda posteriore e comignolo, falda davanti con i coppi, colmo, gronda
  const yR = y0 - D;
  if (shape === 'villetta') {
    const clip = [[x0 - 3, y0 + 2], [x1 + 3, y0 + 2], [x1 - 14, yR], [x0 + 14, yR]];
    tiledRoof(g, x0 - 3, x1 + 3, y0 + 2, yR, roof, detail, clip);
    g.fillStyle = shade(roof, -0.2);
    poly(g, [[x0 - 3, y0 + 2], [x0 + 14, yR], [x0 + 14, y0 + 2]]); g.fill();
    poly(g, [[x1 + 3, y0 + 2], [x1 - 14, yR], [x1 - 14, y0 + 2]]); g.fill();
    g.strokeStyle = shade(roof, -0.45); g.lineWidth = 1; poly(g, clip); g.stroke();
    g.fillStyle = shade(roof, 0.25); g.fillRect(x0 + 14, yR, w - 28, 2);
  } else {
    g.fillStyle = shade(roof, -0.32); g.fillRect(x0 - 2, yR - 6, w + 4, 7);
    if (detail) {
      // Comignolo in mattoni con il cappello
      const kx = x1 - 17;
      g.fillStyle = shade(wall, -0.35); g.fillRect(kx - 1, yR - 18, 10, 15);
      g.fillStyle = shade(wall, -0.18); g.fillRect(kx, yR - 17, 8, 14);
      g.fillStyle = '#7a3f22'; g.fillRect(kx - 2, yR - 20, 12, 3);
      g.fillStyle = 'rgba(0,0,0,0.15)'; for (let r = 0; r < 3; r++) g.fillRect(kx, yR - 14 + r * 4, 8, 1);
    }
    tiledRoof(g, x0 - 3, x1 + 3, y0 + 2, yR, roof, detail);
    g.fillStyle = shade(roof, -0.45); g.fillRect(x0 - 3, yR - 1, w + 6, 1); g.fillRect(x0 - 3, yR, 1, D + 2); g.fillRect(x1 + 2, yR, 1, D + 2);
    g.fillStyle = shade(roof, 0.28); g.fillRect(x0 - 2, yR, w + 4, 2);
  }
  // Facciata
  plaster(g, x0, y0, w, Hh, wall, hs, detail);
  // Gronda: sporgenza scura e ombra sulla facciata
  g.fillStyle = shade(roof, -0.4); g.fillRect(x0 - 3, y0 + 1, w + 6, 2);
  g.fillStyle = 'rgba(30,15,5,0.25)'; g.fillRect(x0, y0 + 3, w, 3);
  // Zoccolo di pietra a blocchi
  g.fillStyle = '#b3a487'; g.fillRect(x0, by - 6, w, 6);
  if (detail) { g.fillStyle = '#9c8c6e'; for (let k = 0; k < w; k += 8) g.fillRect(x0 + k, by - 6, 1, 6); g.fillRect(x0, by - 3, w, 1); g.fillStyle = '#cbbd9f'; g.fillRect(x0, by - 6, w, 1); }
  const floors = shape === 'villetta' ? 1 : 2;
  if (floors === 2 && detail) {
    // Cornice marcapiano con la sua ombra
    g.fillStyle = shade(wall, 0.14); g.fillRect(x0 - 1, by - 36, w + 2, 2);
    g.fillStyle = 'rgba(30,15,5,0.2)'; g.fillRect(x0, by - 34, w, 1);
  }
  // Porta (al centro, o di lato nella torretta), finestre ai lati
  const dw = 12, dh = 24;
  const dx = tw ? x0 + 6 : Math.round(mx - dw / 2);
  door3(g, dx, by - dh - 3, dw, dh, dcol);
  const ww = 8, wh = 13;
  if (tw) window3(g, x1 - 6 - ww - 5, by - 29, ww + 4, wh, o);
  else { window3(g, x0 + 6, by - 29, ww, wh, o); window3(g, x1 - 6 - ww, by - 29, ww, wh, o); }
  if (detail) {
    // Lanterna sopra la porta
    const lx = dx + dw / 2;
    g.fillStyle = '#1f2a26'; g.fillRect(lx - 0.5, by - dh - 14, 1, 2); g.fillRect(lx - 2, by - dh - 12, 4, 3);
    g.fillStyle = night ? '#ffe2a0' : '#f6e7c1'; g.fillRect(lx - 1, by - dh - 11, 2, 1);
    if (night) wins.push([[lx - 2, by - dh - 12], [lx + 2, by - dh - 12], [lx + 2, by - dh - 9], [lx - 2, by - dh - 9]]);
  }
  if (floors === 2) {
    if (tw) {
      window3(g, x0 + 7, y0 + 9, ww, wh, o);
      window3(g, x1 - 6 - ww - 5, y0 + 9, ww + 4, wh, o);
    } else {
      window3(g, x0 + 6, y0 + 9, ww, wh, o);
      window3(g, x1 - 6 - ww, y0 + 9, ww, wh, o);
      // Portafinestra con il balcone in ferro e le piante che ricadono
      window3(g, mx - 5, y0 + 7, 10, 20, o, { box: false, shut: false });
      if (detail) {
        const bx = mx - 10, bw = 20, ry = y0 + 19;
        g.fillStyle = '#d6cbb3'; g.fillRect(bx, ry + 8, bw, 2); g.fillStyle = 'rgba(30,15,5,0.3)'; g.fillRect(bx, ry + 10, bw, 2);
        g.fillStyle = '#1f2a26'; g.fillRect(bx, ry, bw, 1);
        for (let k = 0; k <= 6; k++) g.fillRect(Math.min(bx + k * 3, bx + bw - 1), ry, 1, 8);
        if (o.flowers) for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#3f8634' : o.flowers[k % 2 ? 1 : 0]; g.fillRect(bx + 1 + k * 3, ry + 6, 2, 2); if (k % 3 === 0) { g.fillStyle = '#56a043'; g.fillRect(bx + 1 + k * 3, ry + 10, 1, 3 + (k % 2) * 2); } }
      }
    }
  } else if (detail) {
    // Villetta: abbaino sul tetto
    const ax = Math.round(mx - 6);
    g.fillStyle = shade(wall, -0.3); g.fillRect(ax - 1, yR + 5, 14, 12);
    g.fillStyle = wall; g.fillRect(ax, yR + 6, 12, 10);
    g.fillStyle = o.lit ? '#ffcf6a' : '#5f97b8'; g.fillRect(ax + 3, yR + 8, 6, 6);
    poly(g, [[ax - 2, yR + 6], [ax + 14, yR + 6], [ax + 6, yR]]); g.fillStyle = roof; g.fill();
  }
  if (founder) { g.fillStyle = '#7a5a1a'; g.fillRect(dx + dw + 3, by - 20, 6, 5); g.fillStyle = '#e2bf4f'; g.fillRect(dx + dw + 4, by - 19, 4, 3); }
  // Torretta sul lato sinistro, più alta, con il tettino a punta
  if (tw) {
    const tx0 = X0, th = Hh + 20;
    plaster(g, tx0, by - th, tw, th, shade(wall, 0.04), hs + 1, detail);
    g.fillStyle = 'rgba(30,15,5,0.18)'; g.fillRect(tx0 + tw - 2, by - th, 2, th);
    g.fillStyle = '#b3a487'; g.fillRect(tx0, by - 6, tw, 6);
    window3(g, tx0 + 6, by - th + 9, 6, 11, o, { box: false, shut: false });
    window3(g, tx0 + 6, y0 + 9, 6, 13, o, { shut: false });
    window3(g, tx0 + 6, by - 29, 6, 13, o, { shut: false });
    const ty = by - th;
    poly(g, [[tx0 - 3, ty + 1], [tx0 + tw + 3, ty + 1], [tx0 + tw / 2, ty - 22]]); g.fillStyle = roof; g.fill();
    poly(g, [[tx0 + tw / 2, ty - 22], [tx0 + tw + 3, ty + 1], [tx0 + tw / 2, ty + 1]]); g.fillStyle = shade(roof, -0.18); g.fill();
    g.strokeStyle = shade(roof, -0.45); g.lineWidth = 1; poly(g, [[tx0 - 3, ty + 1], [tx0 + tw + 3, ty + 1], [tx0 + tw / 2, ty - 22]]); g.stroke();
    g.fillStyle = '#3b3f45'; g.fillRect(tx0 + tw / 2 - 0.5, ty - 27, 1, 5);
  }
  // Verde: edera e buganvillea su alcune case, vasi alla porta, aiuole e oggetto davanti
  if (detail && hs % 4 === 0) ivy(g, x1 - 12, x1 - 1, y0 + 4, by - 6, hs);
  if (detail && hs % 3 === 0) { bougainvillea(g, x0 - 2, y0 + 4, x0 + 8, by - 8, hs, 26); bougainvillea(g, dx - 7, by - dh - 10, dx + dw + 7, by - dh - 3, hs + 7, 14); }
  if (detail) { pot(g, dx - 6, by + 2, hs); pot(g, dx + dw + 6, by + 2, hs + 1); }
  drawGarden3(g, style.garden, X0, X1, by, hs, detail);
  drawDeco3(g, style.deco, X1 - 8, by + 7);
  let top = tw ? by - Hh - 20 - 27 : shape === 'villetta' ? yR - 2 : yR - 20;
  if (flag) {
    const fx = X0 + (tw ? tw + 4 : 6), fy = yR - 2;
    g.fillStyle = '#3b3f45'; g.fillRect(fx, fy - 16, 1, 16);
    poly(g, [[fx + 1, fy - 16], [fx + 10, fy - 13], [fx + 1, fy - 10]]); g.fillStyle = flag; g.fill();
    top = Math.min(top, fy - 16);
  }
  return { wins, top, box: [X0 - 4, top - 2, X1 + 8, by + 10] };
}
function drawGarden3(g, garden, x0, x1, by, seed, det) {
  if (!det) return;
  if (garden === 'fiori') {
    for (const [a, b] of [[x0 + 1, x0 + 20], [x1 - 20, x1 - 1]]) {
      g.fillStyle = '#2f6428'; g.fillRect(a, by - 6, b - a, 6);
      g.fillStyle = '#4c973d'; g.fillRect(a, by - 7, b - a, 4);
      for (let k = 0; k < 9; k++) { g.fillStyle = ['#e85d75', '#f6d84a', '#ffffff', '#b46ad6'][k % 4]; g.fillRect(a + 1 + k * 2, by - 8 + (k % 2) * 2, 2, 2); }
    }
  } else if (garden === 'orto') {
    // Cassetta dell'orto sul marciapiede, davanti all'angolo
    g.fillStyle = '#6e4a2c'; g.fillRect(x0 + 1, by + 1, 13, 7);
    g.fillStyle = '#8b6a43'; g.fillRect(x0 + 2, by + 2, 11, 5);
    g.fillStyle = '#5f9a3c'; for (let c = 0; c < 3; c++) g.fillRect(x0 + 3 + c * 4, by - 1, 3, 4);
    g.fillStyle = '#e8423a'; g.fillRect(x0 + 4, by + 1, 2, 2); g.fillRect(x0 + 10, by, 2, 2);
  } else if (garden === 'ulivo') {
    drawTree(g, { kind: 'ulivo', s: 0.55 }, x0 + 6, by + 6);
  } else if (garden === 'nessuno') {
    g.fillStyle = '#ddcfab'; g.fillRect(x0 + 4, by, x1 - x0 - 8, 3);
  } else {
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#3f8634' : '#5fae43'; g.fillRect(x0 + 2 + ih(seed, k, 5) * (x1 - x0 - 4), by - 2, 1, 2); }
  }
}
function drawDeco3(g, deco, x, y) {
  if (deco === 'vespa') {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 7, y, 15, 2);
    g.fillStyle = '#1f1f1f'; g.beginPath(); g.arc(x - 5, y - 2, 2.5, 0, 7); g.arc(x + 5, y - 2, 2.5, 0, 7); g.fill();
    g.fillStyle = '#7fc8b8'; g.fillRect(x - 6, y - 7, 9, 4); g.fillRect(x + 2, y - 11, 3, 8);
    g.fillStyle = '#5b4a3a'; g.fillRect(x - 6, y - 9, 6, 2); g.fillStyle = '#c9c9c9'; g.fillRect(x + 1, y - 12, 5, 1);
  } else if (deco === 'bici') {
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 1; g.beginPath(); g.arc(x - 5, y - 4, 3.5, 0, 7); g.moveTo(x + 8.5, y - 4); g.arc(x + 5, y - 4, 3.5, 0, 7); g.stroke();
    g.strokeStyle = '#c0392b'; g.beginPath(); g.moveTo(x - 5, y - 4); g.lineTo(x, y - 4); g.lineTo(x - 2, y - 9); g.lineTo(x + 4, y - 9); g.lineTo(x + 5, y - 4); g.stroke();
  } else if (deco === 'panchina') {
    bench(g, x, y + 1);
  } else if (deco === 'limoni') {
    g.fillStyle = '#c66a3c'; g.fillRect(x - 4, y - 7, 8, 7);
    blob(g, x, y - 12, 6, '#3f7d34', '#24481f'); for (const [dx, dy] of [[-3, -13], [2, -10], [1, -15]]) { g.fillStyle = '#f6d84a'; g.fillRect(x + dx, y + dy, 2, 2); }
  } else if (deco === 'cane') {
    g.fillStyle = '#a0522d'; g.fillRect(x - 6, y - 9, 12, 9);
    poly(g, [[x - 8, y - 9], [x + 8, y - 9], [x, y - 15]]); g.fillStyle = '#7a3f22'; g.fill();
    g.fillStyle = '#2b2118'; g.fillRect(x - 2, y - 6, 4, 6);
  }
}

/* Negozi ------------------------------------------------------------------- */

const SHOP_LOOK = {
  mobili: { wall: '#e6cfa3', trim: '#8a5a36', awning: ['#2f6b4f', '#f6efe0'], sign: '#2f4f3f', ink: '#f6e7b8' },
  moda: { wall: '#f1dcd8', trim: '#3b3f45', awning: ['#2d2d2d', '#f6efe0'], sign: '#2d2d2d', ink: '#e2bf4f' },
  bici: { wall: '#d7e6ef', trim: '#2f6b9f', awning: ['#e0a92a', '#2f6b9f'], sign: '#2f6b9f', ink: '#f6efe0' },
};
function vitrine3(g, x, y, w, h, kind, night, seed, wins) {
  g.fillStyle = '#5a4a38'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = '#e9e1cf'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, night ? '#ffd98a' : '#cfe8f2'); gr.addColorStop(1, night ? '#f2b85a' : '#9fc9dc');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  const cols = ['#c0392b', '#2f6b9f', '#e0a92a', '#2f7d4f', '#7a4a6b', '#e86b8a'];
  for (let k = 0; k < 3; k++) {
    const c = cols[(seed + k * 2) % cols.length], u = x + (w / 3) * (k + 0.5);
    if (kind === 'wear') {
      // Manichino con l'abito
      g.fillStyle = '#d9d3c4'; g.fillRect(u - 1, y + 3, 2, 3);
      g.fillStyle = c; g.fillRect(u - 4, y + 6, 8, 6); g.fillRect(u - 5, y + 12, 10, 8);
      g.fillStyle = shade(c, -0.25); g.fillRect(u + 2, y + 6, 2, 14);
      g.fillStyle = '#6b5a45'; g.fillRect(u - 1, y + 20, 2, h - 22); g.fillRect(u - 3, y + h - 2, 6, 1);
    } else if (kind === 'ride') {
      g.strokeStyle = '#1f1f1f'; g.lineWidth = 1.2; g.beginPath(); g.arc(u - 4, y + h - 6, 4, 0, 7); g.moveTo(u + 8, y + h - 6); g.arc(u + 4, y + h - 6, 4, 0, 7); g.stroke();
      g.strokeStyle = c; g.beginPath(); g.moveTo(u - 4, y + h - 6); g.lineTo(u, y + h - 12); g.lineTo(u + 4, y + h - 6); g.moveTo(u, y + h - 12); g.lineTo(u + 3, y + h - 14); g.stroke();
    } else {
      g.fillStyle = c; g.fillRect(u - 5, y + h - 9, 10, 6); g.fillRect(u - 5, y + h - 15, 3, 6);
      g.fillStyle = shade(c, -0.25); g.fillRect(u - 5, y + h - 4, 10, 1);
      if (k === 1) { g.fillStyle = '#3b3f45'; g.fillRect(u + 7, y + 6, 1, h - 10); g.fillStyle = '#f3e2b8'; g.fillRect(u + 4, y + 4, 7, 4); }
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + 2, y + 2, 1, h - 6); g.fillRect(x + 4, y + 2, 1, h - 12);
  wins.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
}
// Negozio su due caselle, visto di fronte: piano terra con vetrine e tenda, insegna, primo piano
// con le finestre fiorite, tetto piano. Largo quanto le sue due caselle, per lasciare libere le vie.
export function drawShop3(g, shop, cx, by, { night = false, detail = true } = {}) {
  const st = SHOP_LOOK[shop.id];
  const wins = [];
  const w = 60, Hh = 80, D = 20;
  const x0 = Math.round(cx - w / 2), x1 = x0 + w, y0 = by - Hh;
  g.fillStyle = 'rgba(25,40,15,0.28)';
  poly(g, [[x1, y0 + 6], [x1 + 4, y0 + 10], [x1 + 4, by + 3], [x0 + 6, by + 3], [x0 + 6, by]]); g.fill();
  // Tetto piano con parapetto, ghiaia e un condizionatore
  g.fillStyle = shade(st.wall, -0.35); g.fillRect(x0 - 2, y0 - D - 1, w + 4, D + 2);
  g.fillStyle = shade(st.wall, -0.12); g.fillRect(x0 - 1, y0 - D, w + 2, D);
  g.fillStyle = '#9d978b'; g.fillRect(x0 + 3, y0 - D + 3, w - 6, D - 5);
  if (detail) {
    for (let k = 0; k < 40; k++) { g.fillStyle = k % 2 ? '#b3ad9f' : '#8a8478'; g.fillRect(x0 + 4 + ih(k, shop.x0, 1) * (w - 9), y0 - D + 4 + ih(k, shop.y0, 2) * (D - 8), 1, 1); }
    g.fillStyle = '#7d786e'; g.fillRect(x1 - 19, y0 - D + 5, 13, 10); g.fillStyle = '#c9c3b5'; g.fillRect(x1 - 18, y0 - D + 6, 11, 8); g.fillStyle = '#8f8a80'; for (let k = 0; k < 3; k++) g.fillRect(x1 - 17, y0 - D + 7 + k * 2, 9, 1);
  }
  // Facciata: primo piano con finestre, piano terra con vetrine
  plaster(g, x0, y0, w, Hh, st.wall, shop.x0, detail);
  g.fillStyle = shade(st.wall, 0.12); g.fillRect(x0 - 2, y0, w + 4, 3);
  g.fillStyle = 'rgba(30,15,5,0.2)'; g.fillRect(x0, y0 + 3, w, 3);
  const o = { lit: night, night, door: st.trim, detail, wins, flowers: ['#e85d75', '#f6d84a'] };
  for (const wx of [x0 + 7, Math.round(cx - 4), x1 - 15]) window3(g, wx, y0 + 9, 8, 13, o, { shut: false });
  // Insegna sopra la tenda
  const sy = by - 52;
  g.fillStyle = shade(st.sign, -0.35); g.fillRect(x0 + 4, sy, w - 8, 13);
  g.fillStyle = st.sign; g.fillRect(x0 + 5, sy + 1, w - 10, 11);
  g.fillStyle = shade(st.sign, 0.25); g.fillRect(x0 + 5, sy + 1, w - 10, 1);
  g.fillStyle = st.ink; g.font = '800 8px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(shop.sign, cx, sy + 7); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  // Piano terra: zoccolo, vetrine, porta a vetri
  g.fillStyle = st.trim; g.fillRect(x0, by - 5, w, 5); g.fillStyle = shade(st.trim, 0.2); g.fillRect(x0, by - 5, w, 1);
  vitrine3(g, x0 + 4, by - 30, 17, 25, shop.kind, night, 0, wins);
  vitrine3(g, x1 - 21, by - 30, 17, 25, shop.kind, night, 3, wins);
  g.fillStyle = shade(st.trim, -0.3); g.fillRect(cx - 8, by - 33, 16, 28);
  g.fillStyle = st.trim; g.fillRect(cx - 7, by - 32, 14, 27);
  g.fillStyle = night ? '#f4cf7a' : '#a9d3e4'; g.fillRect(cx - 5, by - 30, 10, 25);
  g.fillStyle = st.trim; g.fillRect(cx - 0.5, by - 30, 1, 25);
  if (detail) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(cx - 4, by - 29, 1, 16); g.fillStyle = '#f6efe0'; g.fillRect(cx - 4, by - 19, 3, 3); g.fillStyle = '#2f7d4f'; g.fillRect(cx - 3, by - 18, 1, 1); }
  // Tenda a strisce che sporge sul marciapiede, con il bordo a festoni
  const ay = by - 38, n = 8, sw = w / n;
  for (let k = 0; k < n; k++) {
    const ax = x0 + k * sw;
    g.fillStyle = st.awning[k % 2];
    poly(g, [[ax, ay], [ax + sw, ay], [ax + sw + 0.6, ay + 8], [ax - 0.6, ay + 8]]); g.fill();
    g.beginPath(); g.arc(ax + sw / 2, ay + 8, sw / 2, 0, Math.PI); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0, ay, w, 2); g.fillRect(x0 + 1, ay + 12, w - 2, 2);
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x0, ay + 2, w, 1);
  if (detail) {
    for (const [px, i] of [[cx - 12, 0], [cx + 12, 2]]) pot(g, px, by + 4, i + shop.id.length);
    chalkboard(g, x1 - 5, by + 9);
    if (shop.kind === 'wear') { bougainvillea(g, x0 - 2, y0 - 2, x0 + 5, by - 8, 3, 28); bougainvillea(g, x1 - 5, y0 - 2, x1 + 2, by - 8, 9, 28); bougainvillea(g, x0, y0 - 5, x1, y0 + 3, 12, 22); }
    if (shop.kind === 'furni') ivy(g, x0 + 1, x0 + 8, y0 + 4, by - 8, 21);
    if (shop.kind === 'ride') { drawDeco3(g, 'bici', x0 + 4, by + 8); drawDeco3(g, 'bici', x1 - 16, by + 8); }
  }
  return { wins, top: y0 - D - 2, box: [x0 - 4, y0 - D - 4, x1 + 8, by + 12] };
}
/* Piazza -------------------------------------------------------------------- */

function edicola3(g, x, y) {
  g.fillStyle = 'rgba(25,40,15,0.25)'; g.fillRect(x - 12, y, 28, 3);
  g.fillStyle = '#2f6b5c'; g.fillRect(x - 13, y - 26, 26, 26);
  g.fillStyle = '#24564a'; g.fillRect(x + 9, y - 26, 4, 26);
  g.fillStyle = '#f4ecd8'; g.fillRect(x - 11, y - 20, 18, 14);
  const cols = ['#e85d4a', '#3f6aa1', '#f2c14e', '#7a4a6b', '#4f8a72'];
  for (let k = 0; k < 5; k++) { g.fillStyle = cols[k]; g.fillRect(x - 10 + k * 3.5, y - 18, 3, 10); }
  for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#f6efe0' : '#c0392b'; g.fillRect(x - 15 + k * 4.3, y - 31, 4.3, 6); }
  g.fillStyle = '#c0392b'; g.fillRect(x - 14, y - 34, 28, 3);
}
function muro3(g, x0, x1, y, founders) {
  // Muro dei Fondatori lungo tre caselle, con le targhe dorate
  g.fillStyle = 'rgba(25,40,15,0.25)'; g.fillRect(x0 + 4, y, x1 - x0, 3);
  g.fillStyle = '#c9b48f'; g.fillRect(x0, y - 20, x1 - x0, 20);
  g.fillStyle = '#e6d6b3'; g.fillRect(x0 - 2, y - 23, x1 - x0 + 4, 4);
  g.fillStyle = '#a8946e'; g.fillRect(x0, y - 2, x1 - x0, 2);
  const n = Math.min(founders, 24);
  for (let i = 0; i < 24; i++) {
    const px = x0 + 6 + (i % 12) * ((x1 - x0 - 12) / 12), py = i < 12 ? y - 17 : y - 10;
    g.fillStyle = i < n ? '#e2bf4f' : 'rgba(255,255,255,0.3)'; g.fillRect(Math.round(px), py, 5, 4);
  }
}
// Fontana grande al centro della piazza, vista dall'alto di tre quarti, con l'aiuola fiorita attorno.
function fountain3(g, cx, cy, built) {
  const OL = '#5e5038', ST = '#e4d9c0', STD = '#b9aa8a', STL = '#f4ecd8';
  // Aiuola ad anello con cespugli fioriti
  g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy + 3, 48, 32, 0, 0, 7); g.fill();
  g.fillStyle = '#d8c9a6'; g.beginPath(); g.ellipse(cx, cy + 3, 47, 31, 0, 0, 7); g.fill();
  g.fillStyle = '#3f7d34'; g.beginPath(); g.ellipse(cx, cy + 2, 44, 28.5, 0, 0, 7); g.fill();
  g.fillStyle = '#5fa846'; g.beginPath(); g.ellipse(cx, cy + 1, 43, 27.5, 0, 0, 7); g.fill();
  const fc = ['#e85d75', '#ffffff', '#f6d84a', '#b46ad6', '#f28cbf', '#e8423a', '#ff9a3c'];
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * Math.PI * 2, x = cx + Math.cos(a) * 39, y = cy + 1 + Math.sin(a) * 24.5;
    g.fillStyle = '#356b2b'; g.beginPath(); g.ellipse(x, y + 1, 5.5, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#5c9f3f'; g.beginPath(); g.ellipse(x - 0.5, y, 4.5, 3.2, 0, 0, 7); g.fill();
    g.fillStyle = '#7fc155'; g.fillRect(Math.round(x - 2), Math.round(y - 2), 2, 1);
    for (let j = 0; j < 4; j++) {
      g.fillStyle = fc[(k + j * 3) % fc.length];
      g.fillRect(Math.round(x - 3 + ih(k, j, 91) * 6), Math.round(y - 2 + ih(k, j, 92) * 4), 2, 2);
    }
  }
  // Ombra della vasca
  g.fillStyle = 'rgba(30,40,20,0.3)'; g.beginPath(); g.ellipse(cx + 4, cy + 7, 34, 19, 0, 0, 7); g.fill();
  // Parete davanti della vasca, con luce a sinistra e ombra a destra
  const wall = g.createLinearGradient(cx - 34, 0, cx + 34, 0);
  wall.addColorStop(0, '#d6c8a6'); wall.addColorStop(0.45, '#cdbd98'); wall.addColorStop(1, '#a8977a');
  g.fillStyle = wall; g.beginPath(); g.ellipse(cx, cy + 6, 34, 21, 0, 0, Math.PI); g.lineTo(cx - 34, cy - 1); g.ellipse(cx, cy - 1, 34, 21, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
  // Pannelli scolpiti sulla parete
  g.strokeStyle = 'rgba(94,80,56,0.45)';
  for (let k = 1; k < 8; k++) {
    const a = Math.PI * k / 8, x = cx + Math.cos(a) * 34, y = cy - 1 + Math.sin(a) * 21;
    g.beginPath(); g.moveTo(Math.round(x) + 0.5, y + 1); g.lineTo(Math.round(x) + 0.5, y + 6); g.stroke();
  }
  // Bordo
  g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy - 1, 35, 22, 0, 0, 7); g.fill();
  g.fillStyle = ST; g.beginPath(); g.ellipse(cx, cy - 1, 34, 21, 0, 0, 7); g.fill();
  g.fillStyle = STL; g.beginPath(); g.ellipse(cx - 1, cy - 2, 33, 20, 0, Math.PI * 0.9, Math.PI * 1.6); g.lineTo(cx - 1, cy - 2); g.fill();
  // Acqua (asciutta finché non ci sono 25 abitanti)
  g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy - 1, 29.5, 17.5, 0, 0, 7); g.fill();
  if (built) {
    const wg = g.createLinearGradient(0, cy - 18, 0, cy + 16);
    wg.addColorStop(0, '#3f8fbf'); wg.addColorStop(1, '#6cc0e0');
    g.fillStyle = wg; g.beginPath(); g.ellipse(cx, cy - 0.5, 28.5, 16.5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    for (const [r, dy] of [[22, 2], [14, 3]]) { g.beginPath(); g.ellipse(cx, cy + dy, r, r * 0.5, 0, 0.2, Math.PI - 0.2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(cx - 20, cy - 8, 6, 1); g.fillRect(cx + 12, cy + 7, 5, 1); g.fillRect(cx - 9, cy + 10, 4, 1);
  } else {
    g.fillStyle = '#b6a785'; g.beginPath(); g.ellipse(cx, cy - 0.5, 28.5, 16.5, 0, 0, 7); g.fill();
    g.fillStyle = '#a09170'; g.beginPath(); g.ellipse(cx, cy - 6, 27, 10, 0, Math.PI, 0); g.fill();
    g.strokeStyle = '#8d7e5e'; g.beginPath(); g.moveTo(cx - 16, cy + 6); g.lineTo(cx - 10, cy + 3); g.lineTo(cx - 6, cy + 8); g.moveTo(cx + 12, cy - 2); g.lineTo(cx + 17, cy + 4); g.stroke();
    g.fillStyle = '#c98a3a'; g.fillRect(cx + 8, cy + 8, 2, 1); g.fillStyle = '#9c6b2e'; g.fillRect(cx - 18, cy - 1, 2, 1);
  }
  // Colonna centrale
  const col = (x, y, w, h) => {
    g.fillStyle = OL; g.fillRect(x - w / 2 - 1, y - h, w + 2, h);
    g.fillStyle = ST; g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = STL; g.fillRect(x - w / 2, y - h, 1, h);
    g.fillStyle = STD; g.fillRect(x + w / 2 - 2, y - h, 2, h);
  };
  col(cx, cy + 2, 8, 26);
  g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy + 2, 7, 3, 0, 0, 7); g.fill(); g.fillStyle = STD; g.beginPath(); g.ellipse(cx, cy + 1.5, 6, 2.4, 0, 0, 7); g.fill();
  g.fillStyle = STD; g.fillRect(cx - 4, cy - 12, 8, 2); g.fillStyle = STL; g.fillRect(cx - 4, cy - 12, 8, 1);
  // Coppe: sotto in ombra, bordo chiaro, acqua che trabocca
  const bowl = (r, y) => {
    const ry = r * 0.5;
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, y, r + 1, ry + 1, 0, 0, Math.PI); g.lineTo(cx - r * 0.35, y + ry + 5); g.lineTo(cx + r * 0.35, y + ry + 5); g.closePath(); g.fill();
    const bg = g.createLinearGradient(cx - r, 0, cx + r, 0); bg.addColorStop(0, '#cbbb97'); bg.addColorStop(1, '#988866');
    g.fillStyle = bg; g.beginPath(); g.ellipse(cx, y, r, ry, 0, 0, Math.PI); g.lineTo(cx - r * 0.3, y + ry + 4); g.lineTo(cx + r * 0.3, y + ry + 4); g.closePath(); g.fill();
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, y, r + 1, ry + 1, 0, 0, 7); g.fill();
    g.fillStyle = ST; g.beginPath(); g.ellipse(cx, y, r, ry, 0, 0, 7); g.fill();
    g.fillStyle = STL; g.beginPath(); g.ellipse(cx, y - 0.5, r, ry, 0, Math.PI, Math.PI * 1.5); g.lineTo(cx, y); g.fill();
    g.fillStyle = built ? '#5aaed3' : '#b6a785'; g.beginPath(); g.ellipse(cx, y - 0.3, r - 2.5, ry - 1.6, 0, 0, 7); g.fill();
    if (built) {
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(cx - r * 0.5, y - 1, 3, 1);
      // Veli d'acqua che cadono dal bordo
      g.fillStyle = 'rgba(160,215,240,0.75)';
      for (const f of [-0.85, -0.45, 0, 0.45, 0.85]) {
        const x = Math.round(cx + f * r), y0 = Math.round(y + ry * Math.sqrt(1 - f * f));
        g.fillRect(x, y0, 1, 7 + (1 - Math.abs(f)) * 3);
      }
    }
  };
  bowl(14, cy - 24);
  col(cx, cy - 26, 4, 10);
  bowl(8, cy - 37);
  // Pigna in cima
  g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy - 42, 3, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#d7c9a8'; g.beginPath(); g.ellipse(cx, cy - 42, 2.2, 3.2, 0, 0, 7); g.fill();
  g.fillStyle = STL; g.fillRect(cx - 1, cy - 44, 1, 2);
  if (built) { g.fillStyle = 'rgba(190,232,250,0.85)'; g.fillRect(cx - 0.5, cy - 50, 1, 6); }
  if (!built) {
    const q = [cx + 30, cy + 34];
    g.fillStyle = '#5a4026'; g.fillRect(q[0] - 1.5, q[1] - 14, 3, 14);
    g.fillStyle = '#5a4026'; g.fillRect(q[0] - 33, q[1] - 25, 66, 13);
    g.fillStyle = '#f7f1e1'; g.fillRect(q[0] - 32, q[1] - 24, 64, 11);
    g.fillStyle = '#5b4a2c'; g.font = '700 5.5px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText(`ACQUA A ${FOUNTAIN_AT} ABITANTI`, q[0], q[1] - 16); g.textAlign = 'left';
  }
}
// Campanile in mattoni con la cella delle campane, l'orologio e la cuspide.
function campanile3(g, cx, by) {
  const w = 26, hgt = 118, x0 = cx - w / 2;
  g.fillStyle = 'rgba(25,40,15,0.25)'; g.fillRect(x0 + w, by - hgt + 20, 8, hgt - 18);
  g.fillStyle = '#c98a5e'; g.fillRect(x0, by - hgt, w, hgt);
  g.fillStyle = 'rgba(90,40,20,0.3)';
  for (let y = by - hgt + 3; y < by; y += 4) g.fillRect(x0, y, w, 1);
  g.fillStyle = '#ad7149'; g.fillRect(x0 + w - 4, by - hgt, 4, hgt);
  g.fillStyle = '#e6d6b3'; g.fillRect(x0 - 2, by - 30, w + 4, 3); g.fillRect(x0 - 2, by - hgt + 26, w + 4, 3);
  g.fillStyle = '#2b2118'; g.fillRect(x0 + 6, by - hgt + 6, w - 12, 18);
  g.beginPath(); g.ellipse(cx, by - hgt + 6, (w - 12) / 2, 4, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#c99a2e'; g.beginPath(); g.arc(cx, by - hgt + 16, 5, 0, Math.PI); g.lineTo(cx - 5, by - hgt + 12); g.fill();
  g.fillStyle = '#2b2118'; g.fillRect(cx - 3, by - 22, 6, 12);
  const cl = [cx, by - hgt + 44];
  g.fillStyle = '#f4efe3'; g.beginPath(); g.arc(cl[0], cl[1], 6.5, 0, 7); g.fill(); g.strokeStyle = '#3b3f45'; g.lineWidth = 1; g.stroke();
  g.beginPath(); g.moveTo(cl[0], cl[1]); g.lineTo(cl[0], cl[1] - 4); g.moveTo(cl[0], cl[1]); g.lineTo(cl[0] + 3, cl[1] + 1); g.stroke();
  poly(g, [[x0 - 3, by - hgt], [x0 + w + 3, by - hgt], [cx, by - hgt - 30]]); g.fillStyle = '#b5523b'; g.fill();
  poly(g, [[cx, by - hgt - 30], [x0 + w + 3, by - hgt], [cx, by - hgt]]); g.fillStyle = '#93402d'; g.fill();
  g.fillStyle = '#3b3f45'; g.fillRect(cx - 0.5, by - hgt - 38, 1, 8); g.fillRect(cx - 3, by - hgt - 36, 6, 1);
}
// Parapetto di pietra di un ponte, lungo la strada
function parapet3(g, x0, x1, y) {
  g.fillStyle = '#e2d4b4'; g.fillRect(x0, y - 8, x1 - x0, 8);
  g.fillStyle = '#efe4c9'; g.fillRect(x0, y - 10, x1 - x0, 2);
  g.fillStyle = '#b8a67f'; for (let x = x0 + 3; x < x1 - 1; x += 5) g.fillRect(x, y - 7, 2, 6);
  g.fillStyle = '#9c8a66'; g.fillRect(x0, y - 1, x1 - x0, 1);
}

// Oggetti della piazza, ognuno legato a una casella (per l'ordine di disegno).
function piazzaItems(city) {
  const out = new Map();
  const built = builtCount(city);
  const founders = Object.values(city.residents).filter(isFounder).length;
  const put = (x, y, draw, depth = 0.6) => { const k = key(x, y); if (!out.has(k)) out.set(k, []); out.get(k).push({ draw, depth }); };
  const D = PIAZZA_DECOR;
  put(...D.edicola, (g, X, Y) => edicola3(g, X + 16, Y + 26));
  const [m0] = D.muro, mLast = D.muro[D.muro.length - 1];
  put(...mLast, (g, X, Y) => muro3(g, X - (mLast[0] - m0[0]) * T + 2, X + T - 2, Y + 22, founders));
  put(D.fountain[0], D.fountain[1] + 1, (g, X, Y) => fountain3(g, X + 16, Y - 16, built >= FOUNTAIN_AT), 0.9);
  put(...D.campanile, (g, X, Y) => campanile3(g, X + 16, Y + 28));
  for (const [x, y] of BENCHES) put(x, y, (g, X, Y) => bench(g, X + 16, Y + 22));
  for (const [x, y] of D.planters) put(x, y, (g, X, Y) => planter(g, X + 16, Y + 22));
  for (const [x, y] of D.lamps) put(x, y, (g, X, Y) => lampPost(g, X + 16, Y + 20, true));
  for (const [x, y] of D.trees) put(x, y, (g, X, Y) => drawTree(g, { kind: 'tondo', s: 0.85 }, X + 16, Y + 22));
  for (const [x, y] of D.cafe) put(x, y, (g, X, Y) => cafeTable(g, X + 16, Y + 22));
  for (const [x, y, i] of [[36, 21, 0], [38, 21, 1], [42, 21, 2], [36, 28, 3], [44, 23, 0], [44, 27, 1], [38, 29, 2], [42, 29, 3], [39, 23, 1], [41, 27, 2]]) put(x, y, (g, X, Y) => pot(g, X + 16, Y + 22, i));
  put(42, 26, (g, X, Y) => chalkboard(g, X + 22, Y + 22));
  return out;
}

/* Il mondo: strato fisso ------------------------------------------------------- */

export function townVisible(view) {
  const x0 = Math.max(0, Math.floor(view.L / T) - 2), x1 = Math.min(W - 1, Math.ceil(view.R / T) + 2);
  const y0 = Math.max(0, Math.floor(view.T / T) - 1), y1 = Math.min(H - 1, Math.ceil((view.B + 60) / T) + 5);
  return { x0, x1, y0, y1 };
}

// Disegna la città nel rettangolo `view` (coordinate del mondo): prima tutto il terreno, poi gli
// oggetti dal fondo verso chi guarda. Restituisce gli oggetti (per tocchi e coperture), le etichette
// e le luci della notte.
export function drawTown(g, city, view, o) {
  const det = o.detail !== false;
  const night = !!o.night;
  const G = townGround(city.openDistricts);
  const ramps = townRamps(city, G);
  const items = piazzaItems(city);
  const objects = [], labels = [], lights = [], lamps = [];
  const { x0, x1, y0, y1 } = townVisible(view);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(g, city, G, ramps, x, y, det);
  // Cerchi di pietra attorno alla fontana, sopra le lastre della piazza
  { const [fx, fy] = townCenter(...PIAZZA_DECOR.fountain, 1); if (fx > view.L - 100 && fx < view.R + 100 && fy > view.T - 100 && fy < view.B + 100) piazzaRings(g, fx, fy + 4); }
  const add = (depth, x, draw, box, extra = {}) => objects.push({ depth, x, draw, box, ...extra });
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = key(x, y);
      const L = G.level[y * W + x];
      const X = x * T, Y = y * T - EL(L);
      const h = city.houses[k];
      if (h) {
        const r = city.residents[h.residentId];
        const online = o.online?.has(h.residentId);
        const t0 = o.born?.get(k);
        const age = t0 !== undefined ? (o.t || 0) - t0 : Infinity;
        const grow = age < 900 ? easeBack(Math.max(0, age) / 900) : 1;
        const opts = {
          lit: night && online, night, founder: isFounder(r), cantiere: h.status === 'cantiere', detail: det,
          flag: h.residentId === o.meId ? '#e0a92a' : o.friends?.has(h.residentId) ? '#3f6aa1' : null,
        };
        // I due lotti dell'isolato stanno ai lati: ogni casa si sposta verso il centro del suo mezzo isolato
        const cx = X + T / 2 + (x % STREET === 1 ? T / 2 : x % STREET === STREET - 1 ? -T / 2 : 0), by = Y + T - 1;
        const draw = (gg) => {
          if (grow === 1) return drawHouse3(gg, h.style, cx, by, opts);
          gg.save(); gg.translate(cx, by); gg.scale(grow, grow); gg.translate(-cx, -by);
          const res = drawHouse3(gg, h.style, cx, by, opts);
          gg.restore();
          return res;
        };
        add(y + 0.98, x, draw, null, { type: 'house', slot: k });
        if (r) labels.push({ x: cx, y: by + 6, text: r.username, me: h.residentId === o.meId, slot: k });
        continue;
      }
      const shop = shopAt(x, y);
      if (shop) {
        if (x !== shop.x0 + 1 || y !== shop.y0 + 1) continue;
        const cx = (shop.x0 + 1) * T, by = Y + T - 1;
        add(y + 0.98, x, (gg) => drawShop3(gg, shop, cx, by, { night, detail: det }), null, { type: 'shop', shop: shop.id });
        continue;
      }
      for (const it of items.get(k) || []) add(y + it.depth, x, (gg) => it.draw(gg, X, Y), [X - 60, Y - 140, X + T + 60, Y + T + 40], { type: 'prop' });
      const tree = G.trees.get(k);
      const road = city.roads[k];
      const dd = districtAt(x, y);
      // Nei quartieri aperti: un albero nel cortile di ogni isolato, siepi fiorite tra i giardini
      const inner = !tree && !road && dd && dd <= city.openDistricts && !inPiazza(x, y) && !isStreet(x, y) && !PLAN.lots.has(k) && !isCanal(x, y);
      const bx = x % STREET, by2 = y % STREET;
      const yard = inner && bx === 2 && by2 === 2 ? { kind: ['tondo', 'cipresso', 'fiorito', 'tondo'][Math.floor(ih(x, y, 31) * 4)], s: 0.9 + ih(x, y, 32) * 0.2 }
        : inner && ih(x, y, 30) < 0.3 ? { kind: 'cespuglio', s: 1, flowers: ih(x, y, 33) < 0.6 ? ['#e85d75', '#f28cbf', '#ffffff', '#b46ad6'][Math.floor(ih(x, y, 34) * 4)] : null } : null;
      if ((tree && !road) || yard) {
        const t = tree || yard;
        const cx = X + T / 2, cy = Y + T * 0.7;
        add(y + 0.7, x, (gg) => drawTree(gg, t, cx, cy), [cx - 20, cy - 54, cx + 20, cy + 4], { type: 'tree' });
      }
      if (road === 'main' && x % STREET === 3 && !(x >= PIAZZA.x0 && x <= PIAZZA.x1)) {
        const lx = X + T / 2, ly = Y + 4;
        lamps.push([lx, ly]);
        add(y + 0.12, x, (gg) => lampPost(gg, lx, ly), [lx - 6, ly - 46, lx + 10, ly + 2], { type: 'prop' });
      }
      // Ringhiera di ferro e paletti sulle rive del canale (non dove passa una strada)
      const bank = !road && !isCanal(x, y) && (isCanal(x + 1, y) || isCanal(x - 1, y)) && y < SEA_Y && G.level[y * W + x] >= 0;
      if (bank) {
        const ex = isCanal(x + 1, y) ? X + T - 3 : X + 2;
        add(y + 0.95, x, (gg) => { gg.fillStyle = '#1f2a26'; gg.fillRect(ex, Y - 12, 1, T); gg.fillRect(ex - 1, Y + T - 14, 3, 14); gg.fillRect(ex - 1, Y + 2, 3, 12); gg.fillStyle = 'rgba(255,255,255,0.2)'; gg.fillRect(ex, Y - 12, 1, 1); }, [X, Y - 16, X + T, Y + T + 2], { type: 'prop' });
      }
      if (isCanal(x, y) && road && L >= 0) {
        // Ponte: parapetto dietro e parapetto davanti (che copre chi passa sul ponte)
        add(y + 0.02, x, (gg) => parapet3(gg, X, X + T, Y + 3), [X, Y - 10, X + T, Y + 4], { type: 'prop' });
        add(y + 0.99, x, (gg) => parapet3(gg, X, X + T, Y + T), [X, Y + T - 10, X + T, Y + T + 1], { type: 'prop' });
      }
      if (y === SEA_Y && x % 3 === 1 && x > 12 && x < 72) { const ux = X + 16, uy = Y + 20; add(y + 0.6, x, (gg) => umbrella(gg, ux, uy, x), null, { type: 'prop' }); }
    }
  }
  for (const [x, y] of PIAZZA_DECOR.lamps) lamps.push([(x + 0.5) * T, (y + 0.5) * T + 4 - EL(1)]);
  objects.sort((a, b) => a.depth - b.depth || a.x - b.x);
  for (const ob of objects) {
    const res = ob.draw(g);
    if (res?.box) ob.box = res.box;
    if (res?.wins && (ob.type === 'shop' || (night && o.online?.has(city.houses[ob.slot]?.residentId)))) lights.push(...res.wins);
    if (!ob.box) ob.box = [ob.x * T - 40, ob.depth * T - 120, ob.x * T + T + 40, ob.depth * T + 10];
  }
  return { objects, labels, lights, lamps };
}
// Luce calda e radente del pomeriggio su tutto il fotogramma (in pixel del contesto): un velo dorato
// dall'alto a sinistra, più fresco in basso a destra.
// (dx, dy) sposta la sfumatura: serve per scaldare un ritaglio come il pezzo di schermo da cui viene.
export function warmLight(g, w, h, dx = 0, dy = 0) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'soft-light';
  const gr = g.createLinearGradient(dx, dy, dx + w, dy + h);
  gr.addColorStop(0, 'rgba(255,214,150,0.55)'); gr.addColorStop(0.55, 'rgba(255,236,200,0.25)'); gr.addColorStop(1, 'rgba(150,170,210,0.3)');
  g.fillStyle = gr; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}
function easeBack(p) { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

// Luci della notte su uno strato a parte (da sommare sopra il fotogramma scurito).
export function drawTownLights(g, lights, lamps) {
  for (const q of lights) { const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2; glow(g, cx, cy, 14, 0.32); }
  for (const [lx, ly] of lamps) { glow(g, lx, ly - 40, 11, 0.7); glow(g, lx, ly - 4, 36, 0.22); }
  for (const q of lights) { poly(g, q); g.fillStyle = 'rgba(255,200,110,0.6)'; g.fill(); }
}

/* Strato animato: acqua, fontana, traffico, barche, cigno ---------------------- */

const CAR_PALETTE = ['#e8c95a', '#d9442f', '#6fb3c8', '#f1ede4', '#3f6aa1', '#4f8a72', '#c7c2b8', '#e88a3a', '#2d2d2d'];
// Misure in pixel: lunghezza, altezza del fianco, larghezza vista di fronte
const CAR_MODELS = {
  utilitaria: { len: 28, hgt: 15, wid: 18 },
  berlina: { len: 34, hgt: 14, wid: 20 },
  furgone: { len: 36, hgt: 22, wid: 20 },
  ape: { len: 24, hgt: 17, wid: 15 },
  autobus: { len: 72, hgt: 26, wid: 24 },
};
function trafficList(city) {
  const built = builtCount(city);
  const out = [];
  const put = (route, n, kinds, seed) => {
    for (let i = 0; i < n; i++) {
      const r = (k) => ih(seed + i, k, 40);
      out.push({ ...route, kind: kinds[Math.floor(r(1) * kinds.length)], color: CAR_PALETTE[Math.floor(r(2) * CAR_PALETTE.length)],
        dir: i % 2 ? -1 : 1, speed: 0.9 + r(3) * 0.7, offset: r(4) * 200 });
    }
  };
  put({ axis: 'x', at: MAIN_Y, from: -2, to: W + 2 }, Math.min(9, 3 + Math.floor(built / 5)), ['utilitaria', 'berlina', 'berlina', 'furgone', 'autobus', 'utilitaria'], 0);
  put({ axis: 'x', at: 20, from: 30, to: 55 }, 1, ['ape', 'utilitaria'], 20);
  put({ axis: 'x', at: 35, from: 30, to: 55 }, 2, ['utilitaria', 'ape', 'berlina'], 30);
  put({ axis: 'y', at: 30, from: 20, to: 35 }, 1, ['ape'], 40);
  for (const d of DISTRICTS) {
    if (!d.dorsal || d.id > city.openDistricts) continue;
    const r = d.dorsal.x !== undefined ? { axis: 'y', at: d.dorsal.x, from: d.dorsal.y0, to: d.dorsal.y1 } : { axis: 'x', at: d.dorsal.y, from: d.dorsal.x0, to: d.dorsal.x1 };
    put(r, 2, ['utilitaria', 'berlina', 'ape', 'furgone'], 50 + d.id * 10);
  }
  return out;
}
let trafficCache = { rev: -1, list: [] };
function traffic(city) {
  if (trafficCache.rev !== city.rev) trafficCache = { rev: city.rev, list: trafficList(city) };
  return trafficCache.list;
}
function carAt(v, s) {
  const span = v.to - v.from;
  let p = (s * v.speed + v.offset) % span;
  if (v.dir < 0) p = span - p;
  const along = v.from + p, lane = v.at + 0.5 + (v.axis === 'x' ? v.dir * 0.22 : -v.dir * 0.22);
  return v.axis === 'x' ? [along, lane] : [lane, along];
}
// Un veicolo: di fianco se va a destra o a sinistra, di fronte o di spalle se sale o scende.
function drawCar(g, v, X, Y, night, glows) {
  const M = CAR_MODELS[v.kind];
  const col = v.color, glass = night ? '#ffe39a' : '#3e5a72', dark = shade(col, -0.3);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  if (v.axis === 'x') {
    const L2 = M.len / 2, f = v.dir;   // f = verso del muso
    g.beginPath(); g.ellipse(X, Y + 1, L2 + 2, 3, 0, 0, 7); g.fill();
    const wheel = (wx) => { g.fillStyle = '#1f1f1f'; g.beginPath(); g.arc(wx, Y - 4, 4, 0, 7); g.fill(); g.fillStyle = '#9aa0a6'; g.fillRect(wx - 1, Y - 5, 2, 2); };
    const bodyTop = Y - 12;
    if (v.kind === 'autobus') {
      g.fillStyle = col; g.fillRect(X - L2, Y - M.hgt - 3, M.len, M.hgt);
      g.fillStyle = shade(col, 0.15); g.fillRect(X - L2, Y - M.hgt - 3, M.len, 3);
      for (let k = 0; k < 7; k++) { g.fillStyle = glass; g.fillRect(X - L2 + 6 + k * 9, Y - M.hgt + 3, 7, 8); }
      g.fillStyle = '#f1ede4'; g.fillRect(X - L2, Y - 9, M.len, 2);
      g.fillStyle = glass; g.fillRect(f > 0 ? X + L2 - 4 : X - L2, Y - M.hgt + 1, 4, 12);
      wheel(X - L2 + 11); wheel(X + L2 - 12);
    } else if (v.kind === 'furgone') {
      g.fillStyle = col; g.fillRect(X - L2 + (f > 0 ? 0 : 10), Y - M.hgt - 2, M.len - 10, M.hgt - 2);
      g.fillStyle = shade(col, 0.12); g.fillRect(X - L2 + (f > 0 ? 0 : 10), Y - M.hgt - 2, M.len - 10, 2);
      const cabX = f > 0 ? X + L2 - 10 : X - L2;
      g.fillStyle = col; g.fillRect(cabX, Y - 14, 10, 10);
      g.fillStyle = glass; g.fillRect(cabX + (f > 0 ? 1 : 2), Y - 20, 7, 6);
      g.fillStyle = dark; g.fillRect(X - L2, Y - 6, M.len, 2);
      wheel(X - L2 + 7); wheel(X + L2 - 7);
    } else if (v.kind === 'ape') {
      const cabX = f > 0 ? X + 2 : X - 12;
      g.fillStyle = '#9a6a43'; g.fillRect(f > 0 ? X - L2 : X, Y - 10, 12, 5); g.fillStyle = '#7d5434'; g.fillRect(f > 0 ? X - L2 : X, Y - 12, 12, 2);
      g.fillStyle = col; g.fillRect(cabX, Y - 16, 10, 12);
      g.fillStyle = glass; g.fillRect(cabX + 2, Y - 15, 6, 5);
      g.fillStyle = shade(col, 0.15); g.fillRect(cabX, Y - 17, 10, 2);
      wheel(f > 0 ? X - L2 + 4 : X + L2 - 4); wheel(f > 0 ? X + L2 - 3 : X - L2 + 3);
    } else {
      // Auto: carrozzeria, abitacolo con due finestrini, tetto
      g.fillStyle = col; g.beginPath(); g.roundRect(X - L2, bodyTop, M.len, 9, 3); g.fill();
      g.fillStyle = dark; g.fillRect(X - L2 + 2, Y - 6, M.len - 4, 2);
      const c0 = X - L2 * (v.kind === 'berlina' ? 0.55 : 0.6), c1 = X + L2 * (v.kind === 'berlina' ? 0.45 : 0.4);
      const cab = f > 0 ? [c0, c1] : [X - (c1 - X), X + (X - c0)];
      poly(g, [[cab[0], bodyTop], [cab[1], bodyTop], [cab[1] - 3 * f, bodyTop - 7], [cab[0] + 2 * f, bodyTop - 7]]); g.fillStyle = col; g.fill();
      g.fillStyle = glass; g.fillRect(Math.min(cab[0], cab[1]) + 2, bodyTop - 6, Math.abs(cab[1] - cab[0]) / 2 - 3, 5); g.fillRect((cab[0] + cab[1]) / 2 + 1, bodyTop - 6, Math.abs(cab[1] - cab[0]) / 2 - 3, 5);
      g.fillStyle = shade(col, 0.2); g.fillRect(Math.min(cab[0], cab[1]) + 2, bodyTop - 8, Math.abs(cab[1] - cab[0]) - 4, 2);
      wheel(X - L2 + 6); wheel(X + L2 - 6);
    }
    g.fillStyle = '#ffe39a'; g.fillRect(f > 0 ? X + L2 - 2 : X - L2, Y - 10, 2, 2);
    g.fillStyle = '#c0392b'; g.fillRect(f > 0 ? X - L2 : X + L2 - 2, Y - 10, 2, 2);
    if (night && glows) glows.push([X + f * (L2 + 10), Y - 9]);
  } else {
    // Di fronte (scende verso chi guarda) o di spalle (sale): il tetto si vede dall'alto
    const w2 = M.wid / 2, roofH = Math.round(M.len * 0.35);
    g.beginPath(); g.ellipse(X, Y + 1, w2 + 2, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#1f1f1f'; g.fillRect(X - w2, Y - 5, 4, 5); g.fillRect(X + w2 - 4, Y - 5, 4, 5);
    const top = Y - M.hgt - roofH;
    g.fillStyle = shade(col, 0.15); g.fillRect(X - w2 + 1, top, M.wid - 2, roofH);
    if (v.kind !== 'furgone' && v.kind !== 'autobus') { g.fillStyle = glass; g.fillRect(X - w2 + 3, top + roofH - 5, M.wid - 6, 4); }
    g.fillStyle = col; g.fillRect(X - w2, Y - M.hgt, M.wid, M.hgt - 3);
    g.fillStyle = v.dir > 0 ? glass : shade(glass, -0.1); g.fillRect(X - w2 + 2, Y - M.hgt + 1, M.wid - 4, Math.round(M.hgt * 0.35));
    g.fillStyle = dark; g.fillRect(X - w2, Y - 5, M.wid, 2);
    const lamp = v.dir > 0 ? '#ffe39a' : '#c0392b';
    g.fillStyle = lamp; g.fillRect(X - w2 + 1, Y - 8, 3, 2); g.fillRect(X + w2 - 4, Y - 8, 3, 2);
    if (night && glows && v.dir > 0) glows.push([X, Y + 8]);
  }
}

export function drawTownAmbient(g, city, view, o, t) {
  const s = t / 1000;
  const night = !!o.night;
  const { L, R, T: top, B } = view;
  const G = townGround(city.openDistricts);
  const ramps = townRamps(city, G);
  // Luccichii sul mare e barche a vela
  if ((SEA_Y + 1) * T < B + 40) {
    g.fillStyle = night ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.75)';
    for (let y = SEA_Y + 1; y < H; y++) {
      for (let x = Math.max(0, Math.floor(L / T)); x <= Math.min(W - 1, Math.ceil(R / T)); x++) {
        const r = ih(x, y, 50);
        if (r < 0.55) continue;
        const ph = (s * 0.6 + r * 10) % 1;
        if (ph > 0.5) continue;
        g.fillRect(Math.round(x * T + 6 + r * 16 + ph * 8), Math.round(y * T + 8 + r * 14 + EL(-1) * -1), 5, 1);
      }
    }
    for (let i = 0; i < 3; i++) {
      const gx = ((s * (0.25 + i * 0.08) + ih(i, 9, 60) * W) % (W + 4)) - 2;
      const bx = gx * T, byy = (SEA_Y + 2.5 + i * 2) * T + 8;
      if (bx < L - 40 || bx > R + 40) continue;
      const bob = Math.sin(s * 1.3 + i);
      g.fillStyle = night ? '#c9c4b8' : '#fbf7ee'; g.beginPath(); g.ellipse(bx, byy + bob, 13, 4, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#8b5e3c'; g.fillRect(bx, byy - 22 + bob, 1, 22);
      g.fillStyle = i % 2 ? '#e85d4a' : '#f6efe0'; poly(g, [[bx + 1, byy - 22 + bob], [bx + 12, byy - 2 + bob], [bx + 1, byy - 2 + bob]]); g.fill();
    }
  }
  // Un cigno che scivola lungo il canale
  {
    const gy = 34 + (Math.sin(s * 0.035) + 1) * 7, gx = CANAL.x0 + 1.5 + Math.sin(s * 0.11) * 0.5;
    const cx = gx * T, cy = gy * T + 8;
    if (cx > L - 40 && cx < R + 40 && cy > top - 40 && cy < B + 40) {
      const dir = Math.cos(s * 0.11) > 0 ? 1 : -1;
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx, cy + 3, 10, 2.5, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, cy - 1, 7, 4, 0, 0, 7); g.fill();
      g.strokeStyle = '#d9d9d9'; g.lineWidth = 0.6; g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 4 * dir, cy - 2); g.quadraticCurveTo(cx + 6 * dir, cy - 10, cx + 3 * dir, cy - 11); g.stroke();
      g.fillStyle = '#e8862a'; g.fillRect(Math.round(cx + 3 * dir + (dir > 0 ? 0 : -2)), Math.round(cy - 12), 2, 1);
    }
  }
  // Getti della fontana
  if (builtCount(city) >= FOUNTAIN_AT) {
    const [fx, fy] = townCenter(...PIAZZA_DECOR.fountain, 1);
    if (fx > L - 100 && fx < R + 100 && fy > top - 100 && fy < B + 100) {
      g.fillStyle = 'rgba(230,248,255,0.95)';
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2, p = (s * 1.2 + k * 0.137) % 1;
        g.fillRect(Math.round(fx + Math.cos(a) * p * 14), Math.round(fy + 16 - 47 - Math.sin(p * Math.PI) * 10 + p * 30 + Math.sin(a) * p * 6), 2, 2);
      }
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
      const p = (s * 0.5) % 1;
      g.globalAlpha = 1 - p; g.beginPath(); g.ellipse(fx, fy + 15, 10 + p * 18, (10 + p * 18) * 0.6, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
  }
  // Traffico: ogni veicolo, una volta disegnato, viene coperto da quello che gli sta davanti
  for (const v of traffic(city)) {
    const [gx, gy] = carAt(v, s);
    const X = gx * T, Y = gy * T - townSurface(G, ramps, gx, gy);
    if (X < L - 90 || X > R + 90 || Y < top - 60 || Y > B + 90) continue;
    drawCar(g, v, X, Y, night, o.glows);
    o.occlude?.(gy, [X - 40, Y - 40, X + 40, Y + 4]);
  }
}

/* Tocchi: da un punto del mondo alla casella -------------------------------- */

export function townTileAt(city, wx, wy) {
  let best = null;
  for (let L = 3; L >= -1; L--) {
    const tx = Math.floor(wx / T), ty = Math.floor((wy + EL(L)) / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
    if (levelAt(tx, ty, city.openDistricts) !== L) continue;
    if (!best || ty > best[1]) best = [tx, ty];
  }
  return best;
}

// Pavimentazione a cerchi concentrici attorno alla fontana (si posa sopra le lastre della piazza).
function piazzaRings(g, cx, cy) {
  const rings = [[78, '#d8c19c'], [70, '#e7d5b6'], [62, '#cfb48d'], [56, '#ead9bc'], [48, '#dcc5a1']];
  for (const [r, c] of rings) { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, r, r * 0.66, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(110,80,45,0.28)'; g.lineWidth = 1;
  for (const [r] of rings) { g.beginPath(); g.ellipse(cx, cy, r, r * 0.66, 0, 0, 7); g.stroke(); }
  // Giunti radiali tra le pietre di ogni anello
  g.beginPath();
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    for (const [r0, r1] of [[48, 56], [56, 62], [62, 70], [70, 78]]) {
      if ((k + r0) % 2) continue;
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.66); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.66);
    }
  }
  g.stroke();
}

// Una chioma fatta di tante foglie: sagoma scura, ciuffi in piena luce verso sinistra, riflessi.
function canopy(g, cx, cy, r, cols, seed) {
  const [c0, c1, c2, c3] = cols;
  g.fillStyle = shade(c0, -0.18);
  g.beginPath(); g.ellipse(cx + 1, cy + 2, r + 1, r * 0.92 + 1, 0, 0, 7); g.fill();
  g.fillStyle = c0;
  g.beginPath(); g.ellipse(cx, cy, r, r * 0.92, 0, 0, 7); g.fill();
  for (let k = 0; k < 22; k++) {
    const a = ih(seed, k, 1) * Math.PI * 2, d = Math.sqrt(ih(seed, k, 2)) * r * 0.85;
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.92;
    const lit = (cx - px) + (cy - py) * 1.2 + (ih(seed, k, 3) - 0.5) * r * 0.6;
    const rr = 2 + ih(seed, k, 4) * r * 0.22;
    g.fillStyle = lit > r * 0.35 ? c2 : lit > -r * 0.2 ? c1 : shade(c0, -0.06);
    g.beginPath(); g.arc(px, py, rr, 0, 7); g.fill();
  }
  for (let k = 0; k < 9; k++) {
    const px = cx - r * 0.55 + ih(seed, k, 5) * r * 0.8, py = cy - r * 0.6 + ih(seed, k, 6) * r * 0.6;
    g.fillStyle = c3; g.fillRect(Math.round(px), Math.round(py), 2, 1);
  }
}

// Edera che sale lungo un muro dal basso, più fitta in basso e più rada in alto
function ivy(g, x0, x1, yTop, yBot, seed) {
  for (let k = 0; k < 46; k++) {
    const f = Math.pow(ih(seed, k, 15), 0.6);
    const py = yBot - f * (yBot - yTop), px = x0 + ih(seed, k, 16) * (x1 - x0);
    g.fillStyle = ['#2f6428', '#3f7d34', '#56a043', '#2a5a22'][k % 4];
    g.fillRect(Math.round(px), Math.round(py), 2 + (k % 2), 2);
  }
  g.fillStyle = '#3a2a18';
  for (let k = 0; k < 3; k++) { const px = x0 + (x1 - x0) * (0.2 + k * 0.3); g.fillRect(Math.round(px), yTop + 6, 1, yBot - yTop - 6); }
}

// Paletto in ghisa e ringhiera lungo il canale
function bollard(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.25)'; g.fillRect(x - 1, y, 5, 2);
  g.fillStyle = '#1f2a26'; g.fillRect(x - 2, y - 9, 4, 9); g.fillRect(x - 1, y - 11, 2, 2);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 1, y - 8, 1, 6);
}

function railing(g, x0, x1, y) {
  g.fillStyle = '#1f2a26';
  g.fillRect(x0, y - 12, x1 - x0, 2); g.fillRect(x0, y - 4, x1 - x0, 1);
  for (let x = x0 + 2; x < x1; x += 4) g.fillRect(x, y - 12, 1, 12);
  for (let x = x0; x <= x1; x += 16) { g.fillRect(x - 1, y - 14, 3, 14); g.fillRect(x - 1, y - 15, 3, 1); }
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0, y - 12, x1 - x0, 1);
}
