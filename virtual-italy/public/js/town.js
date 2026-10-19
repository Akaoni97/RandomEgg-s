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
  if (road === 'main' || road === 'dorsal') {
    fill('#5d6067');
    const nX = isRoad(city, x - 1, y) || isRoad(city, x + 1, y), nY = isRoad(city, x, y - 1) || isRoad(city, x, y + 1);
    const alongX = nX && (!nY || (y === MAIN_Y && road === 'main'));
    if (det) dots(g, X, Y, x * 97 + y, 7, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.14)']);
    // Marciapiedi dove la strada non continua, con il cordolo
    const walk = (dx, dy, w, h, cx, cy, cw, ch) => { fill('#d9d0be', dx, dy, w, h); fill('#a99f8c', cx, cy, cw, ch); };
    if (!isRoad(city, x, y - 1)) walk(0, 0, T, 5, 0, 5, T, 1);
    if (!isRoad(city, x, y + 1)) walk(0, T - 5, T, 5, 0, T - 6, T, 1);
    if (!isRoad(city, x - 1, y)) walk(0, 0, 5, T, 5, 0, 1, T);
    if (!isRoad(city, x + 1, y)) walk(T - 5, 0, 5, T, T - 6, 0, 1, T);
    if (!det) return;
    const cross = alongX && road === 'main' && isRoad(city, x, y - 1) && isRoad(city, x, y + 1);
    if (cross) {
      // Strisce pedonali dove una via attraversa la statale
      g.fillStyle = '#f1ede4';
      for (let s = 0; s < 5; s++) g.fillRect(X + 3 + s * 6, Y + 6, 3, T - 12);
    } else if (alongX && !nY) {
      g.fillStyle = '#f1ede4'; g.fillRect(X + 4, Y + T / 2 - 1, 9, 2); g.fillRect(X + 20, Y + T / 2 - 1, 9, 2);
    } else if (!nX && nY) {
      g.fillStyle = '#f1ede4'; g.fillRect(X + T / 2 - 1, Y + 4, 2, 9); g.fillRect(X + T / 2 - 1, Y + 20, 2, 9);
    }
    return;
  }
  if (road === 'via') {
    // Sampietrini: pietre quadrate un po' irregolari, con i giunti scuri
    fill('#7d776e');
    const tones = ['#b1a99c', '#a69e91', '#9a9286', '#bdb5a7', '#a39b8e'];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const sx = X + a * 8 + 1, sy = Y + b * 8 + 1;
      g.fillStyle = tones[Math.floor(ih(x * 4 + a, y * 4 + b, 21) * tones.length)];
      g.fillRect(sx, sy, 7, 7);
      if (det) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx, sy, 6, 1); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(sx + 1, sy + 6, 6, 1); }
    }
    g.fillStyle = '#ddd4c2';
    if (!isRoad(city, x, y - 1)) g.fillRect(X, Y, T, 3);
    if (!isRoad(city, x, y + 1)) g.fillRect(X, Y + T - 3, T, 3);
    if (!isRoad(city, x - 1, y)) g.fillRect(X, Y, 3, T);
    if (!isRoad(city, x + 1, y)) g.fillRect(X + T - 3, Y, 3, T);
    return;
  }
  if (road === 'lane') {
    fill('#c9b48c');
    if (det) dots(g, X, Y, x * 13 + y, 10, ['#ddc9a2', '#b39d76', '#e6d6b4'], 2, 2);
    return;
  }
  if (road === 'piazza' || inPiazza(x, y)) {
    const [fx, fy] = PIAZZA_DECOR.fountain;
    const border = x === PIAZZA.x0 || x === PIAZZA.x1 || y === PIAZZA.y0 || y === PIAZZA.y1;
    if (border) {
      // Cornice di cotto a spina di pesce
      fill('#a8653f');
      for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = (r + c) % 2 ? '#c98a5e' : '#bb784c';
        g.fillRect(X + c * 8 + (r % 2 ? 4 : 0) - (r % 2 && c === 3 ? 4 : 0), Y + r * 4, 7, 3);
      }
      return;
    }
    const ring = Math.max(Math.abs(x - fx), Math.abs(y - fy)) === 2;
    const tones = ring ? ['#d9c39f', '#d2bb95'] : ['#ecdcc0', '#e5d2b3', '#efe1c8'];
    fill('#cdb99a');
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      g.fillStyle = tones[Math.floor(ih(x * 2 + a, y * 2 + b, 22) * tones.length)];
      g.fillRect(X + a * 16 + 1, Y + b * 16 + 1, 15, 15);
      if (det) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(X + a * 16 + 1, Y + b * 16 + 1, 14, 1); }
    }
    return;
  }
  fill(G.color[i]);
  if (k === 4 || k === 6) {
    // Acqua: riflessi, schiuma dove tocca la riva, ninfee nel canale
    if (y > 0 && G.kind[(y - 1) * W + x] !== k && G.kind[(y - 1) * W + x] !== 4 && G.kind[(y - 1) * W + x] !== 6) { fill('rgba(255,255,255,0.45)', 0, 0, T, 2); }
    if (!det) return;
    dots(g, X, Y, x * 31 + y, 3, ['rgba(255,255,255,0.5)'], 6, 1);
    if (k === 6 && ih(x, y, 77) > 0.5) for (let n = 0; n < 2; n++) {
      const px = X + 6 + ih(x, y + n, 78) * 20, py = Y + 6 + ih(x + n, y, 79) * 20;
      g.fillStyle = '#5f9a45'; g.beginPath(); g.arc(px, py, 3.5, 0.5, Math.PI * 2); g.lineTo(px, py); g.fill();
      if (n === 0 && ih(x, y, 80) > 0.6) { g.fillStyle = '#f2a7c3'; g.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 2); }
    }
    return;
  }
  if (!det) return;
  if (k === 0 || k === 1 || k === 5) {
    // Erba: fili più chiari e più scuri, qualche fiore
    dots(g, X, Y, x * 131 + y * 7, 9, ['rgba(40,90,25,0.35)', 'rgba(255,255,210,0.28)', 'rgba(30,80,20,0.25)'], 1, 2);
    if (k !== 5 && ih(x, y, 20) > 0.8) dots(g, X, Y, x + y * 3, 4, ['#ffffff', '#f6d84a', '#e86b8a', '#b48be0'], 2, 2);
  } else if (k === 2) {
    const { c, dir } = G.crop[i];
    g.fillStyle = CROP_TINT[c][1];
    for (let r = 0; r < 4; r++) { if (dir === 'u') g.fillRect(X, Y + 3 + r * 8, T, c === 'vine' ? 3 : 2); else g.fillRect(X + 3 + r * 8, Y, c === 'vine' ? 3 : 2, T); }
  } else if (k === 3) {
    dots(g, X, Y, x * 17 + y, 6, ['rgba(160,120,60,0.3)', 'rgba(255,255,255,0.5)']);
    if (G.kind[Math.min(H - 1, y + 1) * W + x] === 4) fill('rgba(120,170,190,0.35)', 0, T - 3, T, 3);
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
  g.fillStyle = 'rgba(25,40,15,0.28)';
  g.beginPath(); g.ellipse(cx + 4, cy + 1, 13 * s, 5 * s, 0, 0, 7); g.fill();
  if (t.kind === 'cipresso') {
    g.fillStyle = '#5c3f26'; g.fillRect(cx - 1.5, cy - 5, 3, 5);
    g.beginPath(); g.ellipse(cx, cy - 22 * s, 6.5 * s, 20 * s, 0, 0, 7); g.fillStyle = '#2c5537'; g.fill();
    g.strokeStyle = '#1d3a25'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.ellipse(cx - 2 * s, cy - 24 * s, 3 * s, 15 * s, 0, 0, 7); g.fillStyle = '#3d7049'; g.fill();
  } else if (t.kind === 'pino') {
    g.strokeStyle = '#6b4a2f'; g.lineWidth = 3 * s;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx - 2, cy - 14 * s, cx + 3, cy - 24 * s); g.stroke();
    g.beginPath(); g.ellipse(cx + 3, cy - 27 * s, 16 * s, 7.5 * s, 0, 0, 7); g.fillStyle = '#365f36'; g.fill();
    g.strokeStyle = '#223f22'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.ellipse(cx + 1, cy - 29 * s, 11 * s, 4.5 * s, 0, 0, 7); g.fillStyle = '#4f8248'; g.fill();
  } else if (t.kind === 'ulivo') {
    g.strokeStyle = '#76604a'; g.lineWidth = 2.5 * s;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + 3, cy - 6, cx - 1, cy - 11 * s); g.stroke();
    blob(g, cx - 4 * s, cy - 14 * s, 7 * s, '#8fa36e', '#5f7348');
    blob(g, cx + 4 * s, cy - 15 * s, 6.5 * s, '#8fa36e', '#5f7348');
    blob(g, cx, cy - 19 * s, 7 * s, '#a3b787', '#5f7348');
    blob(g, cx - 2 * s, cy - 21 * s, 3 * s, '#c3d1a6');
  } else if (t.kind === 'cespuglio') {
    blob(g, cx - 4, cy - 5, 5.5, '#4f9a3f', '#2a5a22'); blob(g, cx + 4, cy - 5, 5, '#4f9a3f', '#2a5a22');
    blob(g, cx, cy - 8, 6, '#66b24c', '#2a5a22'); blob(g, cx - 1.5, cy - 10, 2.2, '#9bd873');
    if (t.flowers) for (const [dx, dy] of [[-5, -7], [3, -9], [-1, -12], [5, -5], [-3, -3]]) { g.fillStyle = t.flowers; g.fillRect(cx + dx, cy + dy, 2, 2); }
  } else {
    // Chioma piena a più strati (ombra, piena luce, riflessi), oppure in fiore
    const bloom = t.kind === 'fiorito';
    const [c0, c1, c2, c3] = bloom ? ['#c95d86', '#e47fa6', '#f2a7c3', '#fbd6e4'] : ['#2f6e2c', '#4f9a3f', '#66b24c', '#9bd873'];
    g.fillStyle = '#6b4a2f'; g.fillRect(cx - 2, cy - 12 * s, 4, 12 * s);
    g.fillStyle = '#4c3420'; g.fillRect(cx + 1, cy - 12 * s, 1, 12 * s);
    blob(g, cx, cy - 20 * s, 13 * s, c0, shade(c0, -0.3));
    blob(g, cx - 7 * s, cy - 18 * s, 7 * s, c0);
    blob(g, cx + 7 * s, cy - 19 * s, 7.5 * s, c0);
    blob(g, cx - 4 * s, cy - 24 * s, 9 * s, c1);
    blob(g, cx + 5 * s, cy - 22 * s, 7.5 * s, c1);
    blob(g, cx - 1 * s, cy - 29 * s, 7 * s, c2);
    blob(g, cx - 6 * s, cy - 27 * s, 3.5 * s, c3);
    blob(g, cx + 3 * s, cy - 31 * s, 2.5 * s, c3);
    if (bloom) for (let k = 0; k < 7; k++) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(cx + (ih(k, cx, 3) - 0.5) * 22 * s), Math.round(cy - (14 + ih(k, cy, 4) * 18) * s), 1, 1); }
  }
}
// Vaso di terracotta con fiori
function pot(g, x, y, seed = 0) {
  const flowers = [['#e85d75', '#f6d84a'], ['#b46ad6', '#ffffff'], ['#f08a3c', '#e85d75'], ['#ffffff', '#f2a7c3']][seed % 4];
  g.fillStyle = 'rgba(30,30,20,0.22)'; g.beginPath(); g.ellipse(x + 2, y + 1, 7, 3, 0, 0, 7); g.fill();
  poly(g, [[x - 5, y - 8], [x + 5, y - 8], [x + 4, y], [x - 4, y]]); g.fillStyle = '#c66a3c'; g.fill(); g.strokeStyle = '#7a3f22'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#d98250'; g.fillRect(x - 5, y - 9, 10, 2);
  blob(g, x - 2, y - 12, 4.5, '#4f9a3f', '#2a5a22'); blob(g, x + 2.5, y - 11, 4, '#4f9a3f', '#2a5a22'); blob(g, x, y - 15, 4, '#66b24c');
  for (const [dx, dy, i] of [[-4, -13, 0], [1, -17, 1], [3, -12, 0], [-1, -11, 1], [4, -15, 0]]) { g.fillStyle = flowers[i]; g.fillRect(x + dx, y + dy, 2, 2); }
}
// Buganvillea su un muro: grappoli fucsia e viola nel riquadro (x0, y0)–(x1, y1)
function bougainvillea(g, x0, y0, x1, y1, seed, n = 24) {
  const cols = ['#c2367a', '#e0559a', '#9b3fb0', '#f28cbf'];
  for (let k = 0; k < n; k++) {
    const px = x0 + ih(seed, k, 11) * (x1 - x0), py = y0 + ih(seed, k, 12) * (y1 - y0);
    g.fillStyle = k % 5 === 0 ? '#3f7d34' : cols[k % cols.length];
    g.beginPath(); g.arc(px, py, 1.6 + ih(seed, k, 13) * 1.4, 0, 7); g.fill();
  }
}
// Panchina vista di fronte (ci si siede guardando verso chi guarda)
function bench(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.25)'; g.fillRect(x - 11, y - 1, 24, 3);
  g.fillStyle = '#3b3f45'; g.fillRect(x - 10, y - 6, 2, 6); g.fillRect(x + 8, y - 6, 2, 6); g.fillRect(x - 10, y - 15, 2, 9); g.fillRect(x + 8, y - 15, 2, 9);
  g.fillStyle = '#8b5e3c'; g.fillRect(x - 12, y - 8, 24, 3);
  g.fillStyle = '#a06d46'; g.fillRect(x - 12, y - 15, 24, 2); g.fillRect(x - 12, y - 12, 24, 2);
}
function planter(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.22)'; g.beginPath(); g.ellipse(x + 3, y + 1, 11, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#d8c8a4'; g.fillRect(x - 9, y - 7, 18, 8); g.fillStyle = '#c4b38e'; g.fillRect(x - 9, y - 2, 18, 3); g.fillStyle = '#ebdfc4'; g.fillRect(x - 9, y - 8, 18, 2);
  blob(g, x - 4, y - 11, 6, '#4f9a3f', '#2a5a22'); blob(g, x + 4, y - 11, 6, '#4f9a3f', '#2a5a22'); blob(g, x, y - 15, 6, '#66b24c');
  for (const [dx, dy, c] of [[-6, -13, '#e85d75'], [2, -12, '#f6d84a'], [0, -19, '#e85d75'], [5, -16, '#ffffff'], [-3, -17, '#b46ad6'], [6, -10, '#e85d75']]) { g.fillStyle = c; g.fillRect(x + dx, y + dy, 2, 2); }
}
// Lampione classico verde scuro; quelli della piazza portano lo stendardo della città
function lampPost(g, x, y, banner = false) {
  g.fillStyle = 'rgba(30,30,20,0.25)'; g.beginPath(); g.ellipse(x + 2, y, 4, 2, 0, 0, 7); g.fill();
  g.fillStyle = '#23402f'; g.fillRect(x - 1, y - 34, 2, 34); g.fillRect(x - 3, y - 3, 6, 3); g.fillRect(x - 2, y - 6, 4, 2);
  poly(g, [[x - 4, y - 34], [x + 4, y - 34], [x + 2.5, y - 42], [x - 2.5, y - 42]]); g.fill();
  g.fillRect(x - 1, y - 45, 2, 3);
  g.fillStyle = '#ffe9b0'; g.fillRect(x - 2.5, y - 41, 5, 6);
  if (banner) {
    g.fillStyle = '#23402f'; g.fillRect(x + 1, y - 30, 7, 1);
    poly(g, [[x + 2, y - 29], [x + 8, y - 29], [x + 8, y - 17], [x + 5, y - 19], [x + 2, y - 17]]); g.fillStyle = '#2f7d4f'; g.fill();
    g.fillStyle = '#f4efe3'; g.fillRect(x + 4.5, y - 27, 1, 6); g.fillRect(x + 3.5, y - 25, 1, 1); g.fillRect(x + 5.5, y - 24, 1, 1);
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

// Intonaco con un po' di grana
function plaster(g, x, y, w, h, color, seed, det) {
  g.fillStyle = color; g.fillRect(x, y, w, h);
  if (!det) return;
  for (let k = 0; k < (w * h) / 45; k++) {
    g.fillStyle = ih(seed, k, 3) > 0.5 ? 'rgba(255,255,255,0.13)' : 'rgba(90,55,30,0.10)';
    g.fillRect(Math.floor(x + ih(seed, k, 1) * w), Math.floor(y + ih(seed, k, 2) * h), 2, 1);
  }
}
// Finestra con persiane del colore della porta, davanzale e (se c'è) fioriera
function window3(g, x, y, w, h, o) {
  const sh = o.door === '#f1ede4' ? '#d9d3c4' : o.door;
  g.fillStyle = sh;
  g.fillRect(x - 4, y - 1, 4, h + 2); g.fillRect(x + w, y - 1, 4, h + 2);
  if (o.detail) { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let s = 1; s < h; s += 2) { g.fillRect(x - 4, y + s, 4, 1); g.fillRect(x + w, y + s, 4, 1); } }
  g.fillStyle = '#f4efe3'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const lit = o.lit;
  g.fillStyle = lit ? '#ffd36b' : o.night ? '#24314f' : '#8ec3dd'; g.fillRect(x, y, w, h);
  if (!lit && !o.night && o.detail) { g.fillStyle = '#b8dcee'; g.fillRect(x, y, w, Math.ceil(h / 3)); }
  g.fillStyle = '#f4efe3'; g.fillRect(x + Math.floor(w / 2), y, 1, h); g.fillRect(x, y + Math.floor(h / 2), w, 1);
  g.fillStyle = '#e2d7bf'; g.fillRect(x - 2, y + h + 1, w + 4, 2);
  if (o.flowers && o.detail) {
    g.fillStyle = '#b5523b'; g.fillRect(x - 1, y + h + 3, w + 2, 3);
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#4f9a3f' : o.flowers[k % 2 ? 1 : (k / 2) % 2]; g.fillRect(x + k * (w / 4), y + h + 1 + (k % 2), 2, 2); }
  }
  o.wins.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
}
function door3(g, x, y, w, h, color) {
  g.fillStyle = '#e6dcc6'; g.fillRect(x - 2, y - 2, w + 4, h + 2);
  g.beginPath(); g.ellipse(x + w / 2, y - 1, w / 2 + 2, 4, 0, Math.PI, 0); g.fill();
  g.fillStyle = color; g.fillRect(x, y, w, h);
  g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 3, 0, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + Math.floor(w / 2), y, 1, h); g.fillRect(x + 1, y + 3, w - 2, 1); g.fillRect(x + 1, y + h / 2 + 2, w - 2, 1);
  g.fillStyle = '#e2bf4f'; g.fillRect(x + w - 3, y + h / 2, 1, 2);
  g.fillStyle = '#cfc3a8'; g.fillRect(x - 3, y + h, w + 6, 2);
}
// Tetto a falde visto dall'alto: file di coppi dalla gronda al colmo
function tiledRoof(g, x0, x1, yEave, yRidge, color, det, clip) {
  g.save();
  if (clip) { poly(g, clip); g.clip(); }
  g.fillStyle = color; g.fillRect(x0, yRidge, x1 - x0, yEave - yRidge);
  if (det) {
    for (let y = yRidge, r = 0; y < yEave; y += 4, r++) {
      g.fillStyle = r % 2 ? shade(color, -0.07) : shade(color, 0.04); g.fillRect(x0, y, x1 - x0, 2);
      g.fillStyle = shade(color, -0.22);
      for (let x = x0 + (r % 2) * 3; x < x1; x += 6) g.fillRect(x, y + 2, 1, 2);
    }
  }
  g.restore();
}

// Casa vista di fronte. (cx, by): centro della casella e base della facciata sullo schermo.
// Restituisce le finestre (per la notte) e la quota più alta (per i tocchi e per coprire gli omini).
export function drawHouse3(g, style, cx, by, { lit = false, night = false, founder = false, cantiere = false, flag = null, detail = true } = {}) {
  const wins = [];
  const wall = style.wall, roof = roofOf(style.roof), dcol = doorOf(style.door);
  const hs = hash(style.wall + style.roof + style.door + style.shape);
  const o = { lit, night, door: dcol, detail, wins, flowers: hs % 2 ? [['#e85d75', '#f6d84a'], ['#b46ad6', '#f28cbf'], ['#e8423a', '#ffffff']][hs % 3] : null };
  const shape = style.shape;
  const w = shape === 'villetta' ? 52 : shape === 'torretta' ? 42 : 46;
  const Hh = shape === 'villetta' ? 30 : 50;
  const D = shape === 'villetta' ? 20 : 22;
  const x0 = Math.round(cx - w / 2), x1 = x0 + w, y0 = by - Hh;
  // Ombra a terra verso destra
  g.fillStyle = 'rgba(25,40,15,0.25)'; g.fillRect(x1, y0 + 8, 7, Hh - 6); g.fillRect(x0 + 4, by, w + 3, 3);
  if (cantiere) {
    // Cantiere: fondamenta, muri a metà, impalcatura, telo
    g.fillStyle = '#b9aa8c'; g.fillRect(x0, by - 6, w, 6);
    plaster(g, x0 + 2, by - 24, w - 4, 18, mix(wall, '#c9bba4', 0.5), hs, detail);
    g.fillStyle = '#c9a15a';
    for (const px of [x0, x0 + w / 2, x1 - 2]) g.fillRect(px, by - 40, 2, 40);
    for (const py of [by - 14, by - 28, by - 40]) g.fillRect(x0 - 2, py, w + 4, 2);
    g.fillStyle = 'rgba(80,140,200,0.55)'; g.fillRect(x0 + 4, by - 38, w / 2 - 6, 22);
    g.fillStyle = '#e0a92a'; g.fillRect(x1 - 10, by - 48, 2, 10); g.fillRect(x1 - 16, by - 48, 14, 2);
    return { wins, top: by - 52, box: [x0 - 6, by - 56, x1 + 8, by + 4] };
  }
  // Tetto (sopra la facciata): falda posteriore, falda davanti con i coppi, colmo, comignolo
  const yR = y0 - D;
  if (shape === 'villetta') {
    const clip = [[x0 - 4, y0 + 2], [x1 + 4, y0 + 2], [x1 - 12, yR], [x0 + 12, yR]];
    tiledRoof(g, x0 - 4, x1 + 4, y0 + 2, yR, roof, detail, clip);
    g.fillStyle = shade(roof, -0.18);
    poly(g, [[x0 - 4, y0 + 2], [x0 + 12, yR], [x0 + 12, y0 + 2]]); g.fill();
    poly(g, [[x1 + 4, y0 + 2], [x1 - 12, yR], [x1 - 12, y0 + 2]]); g.fill();
    g.fillStyle = shade(roof, 0.2); g.fillRect(x0 + 12, yR, w - 24, 2);
  } else {
    g.fillStyle = shade(roof, -0.28); g.fillRect(x0 - 2, yR - 5, w + 4, 6);
    if (detail) { g.fillStyle = shade(wall, -0.25); g.fillRect(x1 - 14, yR - 13, 6, 11); g.fillStyle = '#8c4a35'; g.fillRect(x1 - 15, yR - 14, 8, 2); }
    tiledRoof(g, x0 - 4, x1 + 4, y0 + 2, yR, roof, detail);
    g.fillStyle = shade(roof, 0.22); g.fillRect(x0 - 3, yR, w + 6, 2);
  }
  // Facciata
  plaster(g, x0, y0, w, Hh, wall, hs, detail);
  g.fillStyle = shade(wall, -0.07); g.fillRect(x0, y0, 3, Hh); g.fillRect(x1 - 3, y0, 3, Hh);
  g.fillStyle = shade(wall, -0.22); g.fillRect(x0, by - 4, w, 4);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0, y0, w, 3);
  g.fillStyle = shade(roof, -0.3); g.fillRect(x0 - 4, y0 + 1, w + 8, 2);
  if (shape !== 'villetta' && detail) { g.fillStyle = shade(wall, 0.1); g.fillRect(x0, by - 27, w, 2); }
  // Porta al centro, finestre ai lati e al piano di sopra
  const dw = 10, dh = 17, dx = Math.round(cx - dw / 2);
  door3(g, dx, by - dh - 2, dw, dh, dcol);
  const ww = 7, wh = shape === 'villetta' ? 9 : 10;
  window3(g, x0 + 8, by - 20, ww, wh, o);
  window3(g, x1 - 8 - ww, by - 20, ww, wh, o);
  if (shape !== 'villetta') {
    for (const wx of [x0 + 8, Math.round(cx - ww / 2), x1 - 8 - ww]) window3(g, wx, y0 + 7, ww, 11, o);
    if (detail) {
      // Balconcino sopra la porta
      g.fillStyle = '#e9e1cf'; g.fillRect(dx - 4, y0 + 19, dw + 8, 2);
      g.fillStyle = '#3b3f45'; g.fillRect(dx - 4, y0 + 13, dw + 8, 1);
      for (let k = 0; k <= 6; k++) g.fillRect(dx - 4 + k * 3, y0 + 13, 1, 6);
    }
  }
  if (founder) { g.fillStyle = '#e2bf4f'; g.fillRect(dx + dw + 3, by - 13, 3, 2); }
  // Torretta sul lato sinistro, più alta, con il suo tettino a punta
  if (shape === 'torretta') {
    const tx0 = x0 - 4, tw = 18, th = Hh + 26;
    plaster(g, tx0, by - th, tw, th, shade(wall, 0.03), hs + 1, detail);
    g.fillStyle = shade(wall, -0.22); g.fillRect(tx0, by - 4, tw, 4);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(tx0 + tw - 2, by - th, 2, th);
    window3(g, tx0 + 6, by - th + 8, 6, 9, o);
    window3(g, tx0 + 6, by - 20, 6, 9, o);
    poly(g, [[tx0 - 3, by - th + 1], [tx0 + tw + 3, by - th + 1], [tx0 + tw / 2, by - th - 22]]); g.fillStyle = roof; g.fill();
    poly(g, [[tx0 + tw / 2, by - th - 22], [tx0 + tw + 3, by - th + 1], [tx0 + tw / 2, by - th + 1]]); g.fillStyle = shade(roof, -0.15); g.fill();
  }
  // Fiori: buganvillea su una casa su tre, vasi alla porta, aiuole e oggetto in giardino
  if (detail && hs % 3 === 0) { bougainvillea(g, x0 - 2, y0 - 2, x0 + 10, by - 4, hs); bougainvillea(g, dx - 6, y0 + 8, dx + dw + 6, y0 + 14, hs + 7, 14); }
  if (detail) { pot(g, dx - 5, by + 1, hs); if (hs % 2) pot(g, dx + dw + 5, by + 1, hs + 1); }
  drawGarden3(g, style.garden, x0, x1, by, hs, detail);
  drawDeco3(g, style.deco, x1 + 9, by - 1);
  let top = shape === 'torretta' ? by - Hh - 26 - 22 : yR - 6;
  if (flag) {
    const fx = x0 + 6, fy = yR - 2;
    g.fillStyle = '#4a4a4a'; g.fillRect(fx, fy - 14, 1, 14);
    poly(g, [[fx + 1, fy - 14], [fx + 9, fy - 11], [fx + 1, fy - 8]]); g.fillStyle = flag; g.fill();
    top = Math.min(top, fy - 14);
  }
  return { wins, top, box: [x0 - 8, top - 2, x1 + 18, by + 4] };
}
function drawGarden3(g, garden, x0, x1, by, seed, det) {
  if (!det) return;
  if (garden === 'fiori') {
    for (const [a, b] of [[x0 + 1, x0 + 14], [x1 - 14, x1 - 1]]) {
      g.fillStyle = '#4f9a3f'; g.fillRect(a, by - 4, b - a, 4);
      for (let k = 0; k < 6; k++) { g.fillStyle = ['#e85d75', '#f6d84a', '#ffffff', '#b46ad6'][k % 4]; g.fillRect(a + 1 + k * 2, by - 5 + (k % 2), 2, 2); }
    }
  } else if (garden === 'orto') {
    g.fillStyle = '#8b6a43'; g.fillRect(x0 - 14, by - 10, 11, 10);
    g.fillStyle = '#5f9a3c'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(x0 - 13 + c * 4, by - 9 + r * 3, 2, 2);
    g.fillStyle = '#e8423a'; g.fillRect(x0 - 9, by - 6, 1, 1);
  } else if (garden === 'ulivo') {
    drawTree(g, { kind: 'ulivo', s: 0.75 }, x0 - 8, by);
  } else if (garden === 'nessuno') {
    g.fillStyle = '#ddcfab'; g.fillRect(x0 + 4, by, x1 - x0 - 8, 3);
  } else {
    g.fillStyle = '#5fae43'; for (let k = 0; k < 6; k++) g.fillRect(x0 + 2 + ih(seed, k, 5) * (x1 - x0 - 4), by - 2, 1, 2);
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
  g.fillStyle = '#e9e1cf'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = night ? '#f4cf7a' : '#bfe0ee'; g.fillRect(x, y, w, h);
  const cols = ['#c0392b', '#2f6b9f', '#e0a92a', '#2f7d4f', '#7a4a6b', '#e86b8a'];
  for (let k = 0; k < 3; k++) {
    const c = cols[(seed + k * 2) % cols.length], u = x + (w / 3) * (k + 0.5);
    if (kind === 'wear') {
      g.fillStyle = '#6b6b6b'; g.fillRect(u - 2, y + 3, 4, 1);
      g.fillStyle = c; g.fillRect(u - 4, y + 4, 8, 4); g.fillRect(u - 3, y + 8, 6, 8);
    } else if (kind === 'ride') {
      g.strokeStyle = '#1f1f1f'; g.lineWidth = 1; g.beginPath(); g.arc(u - 3, y + h - 6, 3, 0, 7); g.moveTo(u + 6, y + h - 6); g.arc(u + 3, y + h - 6, 3, 0, 7); g.stroke();
      g.strokeStyle = c; g.beginPath(); g.moveTo(u - 3, y + h - 6); g.lineTo(u, y + h - 11); g.lineTo(u + 3, y + h - 6); g.stroke();
    } else {
      g.fillStyle = c; g.fillRect(u - 4, y + h - 8, 8, 5); g.fillRect(u - 4, y + h - 13, 3, 5);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 2, y + 2, 1, h - 6); g.fillRect(x + 4, y + 2, 1, h - 10);
  wins.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
}
// Negozio su due caselle, visto di fronte: vetrine, tenda a strisce, insegna, tetto piano.
export function drawShop3(g, shop, cx, by, { night = false, detail = true } = {}) {
  const st = SHOP_LOOK[shop.id];
  const wins = [];
  const w = 62, Hh = 60, D = 30;
  const x0 = Math.round(cx - w / 2), x1 = x0 + w, y0 = by - Hh;
  g.fillStyle = 'rgba(25,40,15,0.25)'; g.fillRect(x1, y0 + 8, 8, Hh - 6);
  // Tetto piano con parapetto, ghiaia e un condizionatore
  g.fillStyle = shade(st.wall, -0.2); g.fillRect(x0 - 1, y0 - D, w + 2, D + 1);
  g.fillStyle = '#9d978b'; g.fillRect(x0 + 3, y0 - D + 3, w - 6, D - 4);
  if (detail) {
    for (let k = 0; k < 40; k++) { g.fillStyle = k % 2 ? '#b3ad9f' : '#8a8478'; g.fillRect(x0 + 4 + ih(k, shop.x0, 1) * (w - 9), y0 - D + 4 + ih(k, shop.y0, 2) * (D - 7), 1, 1); }
    g.fillStyle = '#c9c3b5'; g.fillRect(x1 - 18, y0 - D + 7, 11, 8); g.fillStyle = '#8f8a80'; g.fillRect(x1 - 18, y0 - D + 13, 11, 2);
  }
  // Facciata
  plaster(g, x0, y0, w, Hh, st.wall, shop.x0, detail);
  g.fillStyle = st.trim; g.fillRect(x0, by - 4, w, 4);
  g.fillStyle = shade(st.wall, 0.12); g.fillRect(x0 - 1, y0, w + 2, 3);
  vitrine3(g, x0 + 4, by - 29, 18, 24, shop.kind, night, 0, wins);
  vitrine3(g, x1 - 22, by - 29, 18, 24, shop.kind, night, 3, wins);
  // Porta a vetri
  g.fillStyle = st.trim; g.fillRect(cx - 7, by - 32, 14, 28);
  g.fillStyle = night ? '#f4cf7a' : '#9fcbe0'; g.fillRect(cx - 5, by - 30, 10, 26);
  g.fillStyle = st.trim; g.fillRect(cx - 0.5, by - 30, 1, 26);
  if (detail) { g.fillStyle = '#f6efe0'; g.fillRect(cx - 4, by - 22, 3, 3); g.fillStyle = '#2f7d4f'; g.fillRect(cx - 3.5, by - 21, 2, 1); }
  // Insegna e finestrelle del piano di sopra
  g.fillStyle = st.sign; g.fillRect(x0 + 6, y0 + 4, w - 12, 12);
  g.fillStyle = shade(st.sign, 0.25); g.fillRect(x0 + 6, y0 + 4, w - 12, 1);
  g.fillStyle = st.ink; g.font = '800 9px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(shop.sign, cx, y0 + 10.5); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  // Tenda a strisce che sporge sul marciapiede
  const ay = by - 36;
  for (let k = 0; k < 10; k++) {
    const ax = x0 + 1 + k * 6;
    g.fillStyle = st.awning[k % 2];
    poly(g, [[ax, ay], [ax + 6, ay], [ax + 6.6, ay + 8], [ax - 0.6, ay + 8]]); g.fill();
    g.beginPath(); g.arc(ax + 3, ay + 8, 3, 0, Math.PI); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0 + 1, ay + 11, w - 2, 2);
  if (detail) {
    for (const [px, i] of [[cx - 11, 0], [cx + 11, 2]]) pot(g, px, by + 3, i + shop.id.length);
    chalkboard(g, x1 - 6, by + 6);
    if (shop.kind === 'wear') { bougainvillea(g, x0 - 3, y0 - 2, x0 + 4, by - 4, 3); bougainvillea(g, x1 - 4, y0 - 2, x1 + 3, by - 4, 9); }
  }
  return { wins, top: y0 - D - 2, box: [x0 - 6, y0 - D - 4, x1 + 10, by + 8] };
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
  g.fillStyle = '#c9b48f'; g.beginPath(); g.ellipse(cx, cy + 3, 47, 31, 0, 0, 7); g.fill();
  g.fillStyle = '#4f9a3f'; g.beginPath(); g.ellipse(cx, cy + 2, 45, 29, 0, 0, 7); g.fill();
  g.fillStyle = '#66b24c'; g.beginPath(); g.ellipse(cx, cy + 1, 43, 27.5, 0, 0, 7); g.fill();
  const fc = ['#e85d75', '#ffffff', '#f6d84a', '#b46ad6', '#f28cbf', '#e8423a'];
  for (let k = 0; k < 160; k++) {
    const a = ih(k, 1, 90) * Math.PI * 2, r = 0.88 + ih(k, 2, 90) * 0.12;
    g.fillStyle = k % 4 === 3 ? '#3f7d34' : fc[k % fc.length];
    g.fillRect(Math.round(cx + Math.cos(a) * 42 * r), Math.round(cy + Math.sin(a) * 27 * r), 2, 2);
  }
  // Vasca: bordo, parete davanti, acqua (asciutta finché non ci sono 25 abitanti)
  g.fillStyle = '#b9aa8c'; g.beginPath(); g.ellipse(cx, cy + 5, 34, 21, 0, 0, Math.PI); g.lineTo(cx - 34, cy - 1); g.ellipse(cx, cy - 1, 34, 21, 0, Math.PI, 0, true); g.fill();
  g.fillStyle = '#e2d7bf'; g.beginPath(); g.ellipse(cx, cy - 1, 34, 21, 0, 0, 7); g.fill(); g.strokeStyle = '#8c7a5a'; g.lineWidth = 1; g.stroke();
  g.fillStyle = built ? '#5fb0d4' : '#b3a586'; g.beginPath(); g.ellipse(cx, cy - 1, 29, 17, 0, 0, 7); g.fill();
  if (built) { g.fillStyle = '#9ad6ea'; g.beginPath(); g.ellipse(cx - 10, cy - 6, 11, 4, 0, 0, 7); g.fill(); }
  g.fillStyle = '#cdbf9f'; g.fillRect(cx - 3, cy - 26, 6, 25); g.strokeStyle = '#8c7a5a'; g.strokeRect(cx - 3.5, cy - 26.5, 7, 26);
  for (const [r, h] of [[13, 24], [7, 38]]) {
    g.fillStyle = '#e2d7bf'; g.beginPath(); g.ellipse(cx, cy - h, r, r * 0.55, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = built ? '#7cc6df' : '#c4b697'; g.beginPath(); g.ellipse(cx, cy - h - 0.5, r - 2.5, (r - 2.5) * 0.55, 0, 0, 7); g.fill();
  }
  g.fillStyle = '#cdbf9f'; g.fillRect(cx - 1.5, cy - 47, 3, 9);
  if (!built) {
    const q = [cx + 24, cy + 26];
    g.fillStyle = '#8a6a3e'; g.fillRect(q[0] - 1, q[1] - 14, 2, 14);
    g.fillStyle = '#f7f1e1'; g.fillRect(q[0] - 22, q[1] - 24, 44, 11); g.strokeStyle = '#8a6a3e'; g.lineWidth = 1; g.strokeRect(q[0] - 22.5, q[1] - 24.5, 45, 12);
    g.fillStyle = '#5b4a2c'; g.font = '700 6.5px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText(`ACQUA A ${FOUNTAIN_AT} ABITANTI`, q[0], q[1] - 16); g.textAlign = 'left';
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
        const cx = X + T / 2, by = Y + T - 1;
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
function easeBack(p) { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

// Luci della notte su uno strato a parte (da sommare sopra il fotogramma scurito).
export function drawTownLights(g, lights, lamps) {
  for (const q of lights) { const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2; glow(g, cx, cy, 14, 0.32); }
  for (const [lx, ly] of lamps) { glow(g, lx, ly - 38, 10, 0.6); glow(g, lx, ly, 32, 0.2); }
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
