// Disegno della città in isometria pixel art, nello spirito di Habbo: caselle a rombo 64×32,
// blocchi con contorni netti, pavimenti a scacchi, omini squadrati. Il mondo si disegna in un buffer
// a bassa risoluzione e si ingrandisce a pixel interi, così resta nitido e leggero sui telefoni.
// Uno strato fisso si ridisegna solo quando cambia qualcosa; sopra si muovono omini, acqua, auto.
import {
  W, H, MAIN_Y, SEA_Y, PIAZZA, PLAN, ROOFS, DOORS, FOUNTAIN_AT,
  key, parseKey, districtAt, districtById, inPiazza, builtCount, isFounder, formatNews, CITY, PAPER, levelAt, walkPath, LOOK, cleanLook,
} from './core.js';

const LV = 14;                                   // altezza di un gradone di terreno, in pixel d'arte
const BAR_AT = 50;                               // a 50 abitanti arrivano i tavolini del bar in piazza
const elev = (L) => (L < 0 ? -6 : L * LV);
const roofColor = (id) => (ROOFS.find((r) => r.id === id) || ROOFS[0]).color;
const doorColor = (id) => (DOORS.find((r) => r.id === id) || DOORS[0]).color;

/* Colori e rumore -------------------------------------------------------- */

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function toHex([r, g, b]) {
  const f = (c) => Math.max(0, Math.min(255, Math.round(c)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
function mix(a, b, t) { const x = rgb(a), y = rgb(b); return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t)); }
function shade(hex, amt) { return toHex(rgb(hex).map((v) => v + amt * 255)); }
function ih(a, b, s = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* Geometria isometrica --------------------------------------------------- */

// Angolo in alto della casella (x, y) e punto (u, v) dentro il rombo: u lungo +x, v lungo +y.
const isoX = (x, y) => (x - y) * 32;
const isoY = (x, y) => (x + y) * 16;
const P = (sx, sy, u, v) => [sx + 32 * u - 32 * v, sy + 16 * u + 16 * v];
function diamond(g, sx, sy, inset = 0) {
  const k = inset;
  g.beginPath();
  g.moveTo(sx, sy + k); g.lineTo(sx + 32 - 2 * k, sy + 16); g.lineTo(sx, sy + 32 - k); g.lineTo(sx - 32 + 2 * k, sy + 16);
  g.closePath();
}
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
const add = (p, dx, dy) => [p[0] + dx, p[1] + dy];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// Centro di una casella (anche frazionaria) sullo schermo, alla sua quota.
export function tileCenter(x, y, L = 0) { return [isoX(x + 0.5, y + 0.5), isoY(x + 0.5, y + 0.5) - elev(L)]; }

/* Terreno (calcolato una volta per numero di quartieri aperti) ----------- */

const CROPS = ['wheat', 'wheat', 'vine', 'green', 'plow', 'olive', 'wheat', 'vine'];
const CROP_COLORS = { wheat: ['#e3c76d', '#c9a94a'], vine: ['#c8b285', '#5f8f3c'], green: ['#b8d074', '#8fb052'], plow: ['#b98f66', '#946a45'] };
const groundCache = new Map();

function getGround(open) {
  if (groundCache.has(open)) return groundCache.get(open);
  const kind = new Uint8Array(W * H);  // 0 erba di quartiere, 1 prato, 2 campo, 3 spiaggia, 4 mare, 5 uliveto
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
      if (y > SEA_Y) { kind[i] = 4; color[i] = mix('#7fcbe0', '#3d8fbe', clamp01((y - SEA_Y - 1) / 6)); }
      else if (y === SEA_Y) { kind[i] = 3; color[i] = mix('#f1dea9', '#e6cf95', ih(x, y, 3)); }
      else if (d && d <= open) { kind[i] = 0; color[i] = mix('#9fcf6c', '#86bd58', clamp01(n + j)); }
      else if (d) {
        const px = Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6), py = Math.floor(y / 4);
        const c = CROPS[Math.floor(ih(px, py, 7) * CROPS.length)];
        if (c === 'olive') {
          kind[i] = 5; color[i] = mix('#b9cf86', '#a3bd72', n);
          if ((x + y) % 2 === 0 && !PLAN.futureRoads.has(key(x, y))) trees.set(key(x, y), { kind: 'ulivo', s: 0.85 + ih(x, y, 10) * 0.2 });
        } else {
          kind[i] = 2; crop[i] = { c, dir: ih(px, py, 8) > 0.5 ? 'u' : 'v' }; color[i] = CROP_COLORS[c][0];
        }
      } else { kind[i] = 1; color[i] = mix('#97c763', '#76a84d', clamp01(n + j)); }
      if (level[i] >= 2 && kind[i] === 1) color[i] = mix(color[i], level[i] === 3 ? '#5c8c47' : '#6f9f52', 0.5);
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
  groundCache.set(open, G);
  return G;
}

/* Casella: superficie ----------------------------------------------------- */

function speck(g, sx, sy, seed, n, colors, size = [2, 1]) {
  for (let k = 0; k < n; k++) {
    const u = 0.12 + ih(seed, k, 1) * 0.76, v = 0.12 + ih(seed, k, 2) * 0.76;
    const [px, py] = P(sx, sy, u, v);
    g.fillStyle = colors[k % colors.length];
    g.fillRect(Math.round(px), Math.round(py), size[0], size[1]);
  }
}
function rows(g, sx, sy, dir, color, n = 4, width = 1.2) {
  g.strokeStyle = color; g.lineWidth = width;
  g.beginPath();
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    const a = dir === 'u' ? P(sx, sy, 0, t) : P(sx, sy, t, 0);
    const b = dir === 'u' ? P(sx, sy, 1, t) : P(sx, sy, t, 1);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  }
  g.stroke();
}
function diamondSmall(g, cx, cy, w, h) {
  g.beginPath(); g.moveTo(cx, cy - h / 2); g.lineTo(cx + w / 2, cy); g.lineTo(cx, cy + h / 2); g.lineTo(cx - w / 2, cy); g.closePath();
}

function drawTileTop(g, city, G, x, y, sx, sy, det) {
  const i = y * W + x;
  const k = G.kind[i];
  const road = city.roads[key(x, y)];
  diamond(g, sx, sy);
  if (road === 'main' || road === 'dorsal') {
    g.fillStyle = '#5d6168'; g.fill();
    // Marciapiedi lungo i bordi paralleli alla strada
    const alongX = city.roads[key(x - 1, y)] === road || city.roads[key(x + 1, y)] === road;
    g.fillStyle = '#d6cfc0';
    if (alongX) {
      if (!city.roads[key(x, y - 1)]) { poly(g, [P(sx, sy, 0, 0), P(sx, sy, 1, 0), P(sx, sy, 1, 0.16), P(sx, sy, 0, 0.16)]); g.fill(); }
      if (!city.roads[key(x, y + 1)]) { poly(g, [P(sx, sy, 0, 0.84), P(sx, sy, 1, 0.84), P(sx, sy, 1, 1), P(sx, sy, 0, 1)]); g.fill(); }
    } else {
      if (!city.roads[key(x - 1, y)]) { poly(g, [P(sx, sy, 0, 0), P(sx, sy, 0.16, 0), P(sx, sy, 0.16, 1), P(sx, sy, 0, 1)]); g.fill(); }
      if (!city.roads[key(x + 1, y)]) { poly(g, [P(sx, sy, 0.84, 0), P(sx, sy, 1, 0), P(sx, sy, 1, 1), P(sx, sy, 0.84, 1)]); g.fill(); }
    }
    if (det) {
      speck(g, sx, sy, x * 97 + y, 6, ['rgba(255,255,255,0.12)', 'rgba(0,0,0,0.15)']);
      g.strokeStyle = '#f2efe6'; g.lineWidth = 1.6;
      const a = alongX ? P(sx, sy, 0.3, 0.5) : P(sx, sy, 0.5, 0.3), b = alongX ? P(sx, sy, 0.7, 0.5) : P(sx, sy, 0.5, 0.7);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      // Strisce pedonali dove le vie attraversano la statale, e davanti alla piazza
      const cross = alongX && road === 'main' && ['lane', 'dorsal'].includes(city.roads[key(x, y - 1)]) && ['lane', 'dorsal'].includes(city.roads[key(x, y + 1)]);
      if (cross || (alongX && road === 'main' && x === PIAZZA.x0 + 3)) {
        g.fillStyle = '#f2efe6';
        for (let s = 0; s < 4; s++) { const u = 0.3 + s * 0.12; poly(g, [P(sx, sy, u, 0.2), P(sx, sy, u + 0.06, 0.2), P(sx, sy, u + 0.06, 0.8), P(sx, sy, u, 0.8)]); g.fill(); }
      }
    }
    return;
  }
  if (road === 'lane') {
    g.fillStyle = '#c7b28a'; g.fill();
    if (det) {
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const [px, py] = P(sx, sy, 0.125 + a * 0.25, 0.125 + b * 0.25);
        g.fillStyle = (a + b + x + y) % 2 ? '#dccaa4' : '#d3bf98';
        diamondSmall(g, px, py, 13, 6.5); g.fill();
      }
    }
    return;
  }
  if (road === 'piazza' || inPiazza(x, y)) {
    // Pavimento a scacchi, come le stanze di Habbo
    g.fillStyle = (x + y) % 2 ? '#efe5cf' : '#d9c8a8'; g.fill();
    if (det) { g.strokeStyle = 'rgba(120,95,60,0.35)'; g.lineWidth = 1; diamond(g, sx, sy); g.stroke(); }
    return;
  }
  g.fillStyle = G.color[i]; g.fill();
  if (!det) return;
  if (k === 0 || k === 1 || k === 5) {
    speck(g, sx, sy, x * 131 + y * 7, 7, ['rgba(40,90,25,0.35)', 'rgba(255,255,200,0.3)', 'rgba(40,90,25,0.25)']);
    if (k !== 5 && ih(x, y, 20) > 0.86) speck(g, sx, sy, x + y * 3, 4, ['#ffffff', '#f6d84a', '#e86b8a', '#b48be0'], [2, 2]);
  } else if (k === 2) {
    const { c, dir } = G.crop[i];
    rows(g, sx, sy, dir, CROP_COLORS[c][1], 4, c === 'vine' ? 2.2 : 1.6);
  } else if (k === 3) {
    speck(g, sx, sy, x * 17 + y, 6, ['rgba(160,120,60,0.3)', 'rgba(255,255,255,0.45)']);
  } else if (k === 4) {
    speck(g, sx, sy, x * 23 + y, 2, ['rgba(255,255,255,0.35)'], [5, 1]);
  }
  // Lotto libero: rombo tratteggiato
  const lk = key(x, y);
  if (PLAN.lots.has(lk) && !city.houses[lk] && districtAt(x, y) <= city.openDistricts) {
    g.fillStyle = 'rgba(255,255,255,0.16)'; diamond(g, sx, sy, 4); g.fill();
    g.save(); g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1; diamond(g, sx, sy, 4); g.stroke(); g.restore();
  }
}

/* Casella: pareti dei gradoni e bordo dell'isola ---------------------------- */

function drawTileFaces(g, city, G, x, y, sx, sy, det) {
  const L = G.level[y * W + x];
  const lvl = (a, b) => (a < 0 || b < 0 || a >= W || b >= H ? null : G.level[b * W + a]);
  const faces = [
    { n: lvl(x, y + 1), a: P(sx, sy, 0, 1), b: P(sx, sy, 1, 1), light: true, nx: x, ny: y + 1 },
    { n: lvl(x + 1, y), a: P(sx, sy, 1, 1), b: P(sx, sy, 1, 0), light: false, nx: x + 1, ny: y },
  ];
  for (const f of faces) {
    const border = f.n === null;
    const drop = border ? elev(L) + 34 : elev(L) - elev(f.n);
    if (drop <= 0) continue;
    const a = f.a, b = f.b, a2 = add(a, 0, drop), b2 = add(b, 0, drop);
    const stairs = !border && city.roads[key(x, y)] && city.roads[key(f.nx, f.ny)];
    const town = L === 1 && !border;
    let top, bottom;
    if (stairs) { top = '#e2d6bd'; bottom = '#c9b993'; }
    else if (town) { top = f.light ? '#dcc8a2' : '#c2ab83'; bottom = f.light ? '#b39b74' : '#9a8260'; }
    else if (L <= 0) { top = f.light ? '#e2cb92' : '#c9b07a'; bottom = f.light ? '#b99a62' : '#a0834f'; }
    else { top = f.light ? '#b98b5c' : '#9c7149'; bottom = f.light ? '#7b5636' : '#654428'; }
    if (border && L <= 0 && y < SEA_Y) { top = f.light ? '#b98b5c' : '#9c7149'; bottom = f.light ? '#6b4a2f' : '#563a24'; }
    const gr = g.createLinearGradient(0, Math.min(a[1], b[1]), 0, Math.max(a2[1], b2[1]));
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    poly(g, [a, b, b2, a2]); g.fillStyle = gr; g.fill();
    if (det) {
      if (stairs) {
        const n = Math.max(3, Math.round(drop / 3));
        g.strokeStyle = 'rgba(90,70,40,0.45)'; g.lineWidth = 1;
        g.beginPath();
        for (let s = 1; s < n; s++) { const t = (s / n) * drop; g.moveTo(a[0], a[1] + t); g.lineTo(b[0], b[1] + t); }
        g.stroke();
      } else if (town) {
        g.strokeStyle = 'rgba(90,70,40,0.35)'; g.lineWidth = 1;
        g.beginPath();
        for (let t = 4; t < drop; t += 4) { g.moveTo(a[0], a[1] + t); g.lineTo(b[0], b[1] + t); }
        for (let s = 0; s < 4; s++) for (let r = 0; r * 4 < drop - 2; r++) {
          const q = lerp(a, b, (s + (r % 2) * 0.5) / 4 + 0.06);
          g.moveTo(q[0], q[1] + r * 4); g.lineTo(q[0], q[1] + r * 4 + 4);
        }
        g.stroke();
      } else {
        for (let s = 0; s < 6; s++) {
          const q = lerp(a, b, (s + 0.5) / 6);
          g.fillStyle = 'rgba(50,30,10,0.25)';
          g.fillRect(Math.round(q[0]), Math.round(q[1] + 3 + ih(x, s, 9) * 3), 1, Math.max(2, drop - 8 - ih(y, s, 8) * 5));
        }
        if (border && drop > 20) { poly(g, [add(a, 0, drop - 8), add(b, 0, drop - 8), b2, a2]); g.fillStyle = 'rgba(40,25,10,0.35)'; g.fill(); }
      }
    }
    // Orlo in cima: erba che sporge, o cornice di pietra per il paese
    g.strokeStyle = town || stairs ? '#f0e4c8' : L > 0 || border ? shade(G.color[y * W + x], -0.08) : '#f2e2b4';
    g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1] + 1); g.lineTo(b[0], b[1] + 1); g.stroke();
    g.strokeStyle = 'rgba(30,20,10,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(b2[0], b2[1]); g.stroke();
  }
}

/* Alberi ------------------------------------------------------------------ */

function blob(g, cx, cy, r, color, outline) {
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = color; g.fill();
  if (outline) { g.strokeStyle = outline; g.lineWidth = 1; g.stroke(); }
}
// (cx, cy) è la base dell'albero, al centro della casella.
function drawTree(g, t, cx, cy) {
  const s = t.s;
  g.fillStyle = 'rgba(25,40,15,0.28)';
  g.beginPath(); g.ellipse(cx + 3, cy + 1, 13 * s, 6 * s, 0, 0, 7); g.fill();
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
    blob(g, cx - 4, cy - 5, 5.5, '#4f8a45', '#2f5a29'); blob(g, cx + 4, cy - 5, 5, '#4f8a45', '#2f5a29');
    blob(g, cx, cy - 8, 6, '#62a052', '#2f5a29'); blob(g, cx - 1.5, cy - 10, 2.2, '#8bc46e');
  } else {
    g.fillStyle = '#6b4a2f'; g.fillRect(cx - 2, cy - 12 * s, 4, 12 * s);
    g.fillStyle = '#4c3420'; g.fillRect(cx + 1, cy - 12 * s, 1, 12 * s);
    blob(g, cx, cy - 20 * s, 12 * s, '#3f7a3b', '#24481f');
    blob(g, cx - 5 * s, cy - 23 * s, 8 * s, '#4f8c45');
    blob(g, cx + 5 * s, cy - 18 * s, 7.5 * s, '#4a8541');
    blob(g, cx - 2 * s, cy - 28 * s, 6.5 * s, '#5c9c50');
    blob(g, cx - 5 * s, cy - 27 * s, 3 * s, '#86c16b');
  }
}

/* Case isometriche ------------------------------------------------------- */

// Un muro visto in isometria: face(u, h) è il punto a frazione u lungo la base, all'altezza h.
function wallFace(a, b) { return (u, hh) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - hh]; }
function quadOn(f, u0, u1, h0, h1) { return [f(u0, h0), f(u1, h0), f(u1, h1), f(u0, h1)]; }

function drawWall(g, a, b, hgt, color) {
  poly(g, [a, b, add(b, 0, -hgt), add(a, 0, -hgt)]);
  g.fillStyle = color; g.fill();
  g.strokeStyle = shade(color, -0.35); g.lineWidth = 1; g.stroke();
  poly(g, [a, b, add(b, 0, -3), add(a, 0, -3)]); g.fillStyle = shade(color, -0.18); g.fill();
}
function windowOn(g, f, u0, u1, h0, h1, o, side) {
  const { lit, night, door, detail, wins } = o;
  poly(g, quadOn(f, u0 - 0.02, u1 + 0.02, h0 - 1, h1 + 1)); g.fillStyle = '#f4efe3'; g.fill();
  const glass = quadOn(f, u0, u1, h0, h1);
  poly(g, glass); g.fillStyle = lit ? '#ffd36b' : night ? '#24314f' : side ? '#8fc2dd' : '#b5dcef'; g.fill();
  if (detail) {
    const m0 = f((u0 + u1) / 2, h0), m1 = f((u0 + u1) / 2, h1);
    g.strokeStyle = '#f4efe3'; g.lineWidth = 1; g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
    if (!lit && !night) { const r0 = f(u0 + 0.01, h1 - 1), r1 = f(u0 + (u1 - u0) * 0.4, h1 - 1); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke(); }
    // Persiane del colore della porta
    const sc = door === '#f1ede4' ? '#d9d3c4' : door;
    const w = (u1 - u0) * 0.42;
    for (const [s0, s1] of [[u0 - 0.03 - w, u0 - 0.03], [u1 + 0.03, u1 + 0.03 + w]]) {
      poly(g, quadOn(f, s0, s1, h0 - 1, h1 + 1)); g.fillStyle = sc; g.fill();
      g.strokeStyle = shade(sc, -0.3); g.lineWidth = 1; g.stroke();
    }
  }
  poly(g, quadOn(f, u0 - 0.04, u1 + 0.04, h0 - 2.5, h0 - 1)); g.fillStyle = '#e9e1cf'; g.fill();
  wins.push(glass);
}
function doorOn(g, f, u0, u1, hgt, color) {
  poly(g, quadOn(f, u0 - 0.03, u1 + 0.03, 0, hgt + 2)); g.fillStyle = '#e6dcc6'; g.fill();
  poly(g, quadOn(f, u0, u1, 0, hgt)); g.fillStyle = color; g.fill();
  g.strokeStyle = shade(color === '#f1ede4' ? '#c9c3b5' : color, -0.3); g.lineWidth = 1; g.stroke();
  const k = f(u0 + (u1 - u0) * 0.78, hgt * 0.45); g.fillStyle = '#e2bf4f'; g.fillRect(Math.round(k[0]), Math.round(k[1]), 1.5, 1.5);
}
function roofTiles(g, pts, a0, a1, b0, b1, n, color) {
  // File di coppi parallele al colmo, dentro la falda
  g.save(); poly(g, pts); g.clip();
  g.strokeStyle = shade(color, -0.16); g.lineWidth = 1;
  g.beginPath();
  for (let k = 1; k < n; k++) { const t = k / n; const a = lerp(a0, a1, t), b = lerp(b0, b1, t); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.stroke(); g.restore();
}

// Disegna una casa sulla casella con angolo in alto (sx, sy). Restituisce le finestre (per la notte)
// e la quota più alta (per i tocchi e per coprire gli omini che passano dietro).
export function drawHouse(g, style, sx, sy, { lit = false, night = false, founder = false, cantiere = false, flag = null, detail = true, door = 'S' } = {}) {
  const wins = [];
  const wall = style.wall, roof = roofColor(style.roof), dcol = doorColor(style.door);
  const o = { lit, night, door: dcol, detail, wins };
  g.fillStyle = 'rgba(25,40,15,0.28)';
  poly(g, [P(sx, sy, 0.15, 0.15), P(sx, sy, 1.15, -0.05), P(sx, sy, 1.05, 0.85), P(sx, sy, 0.85, 0.85)]); g.fill();
  drawYard(g, style.garden, sx, sy, detail);
  const inset = style.shape === 'villetta' ? 0.1 : 0.17;
  const T0 = P(sx, sy, inset, inset), R0 = P(sx, sy, 1 - inset, inset), B0 = P(sx, sy, 1 - inset, 1 - inset), L0 = P(sx, sy, inset, 1 - inset);
  if (cantiere) { drawSite(g, T0, R0, B0, L0, detail); return { wins, top: sy - 40 }; }
  const hw = style.shape === 'villetta' ? 22 : style.shape === 'torretta' ? 26 : 30;
  let top = sy;
  if (style.shape === 'torretta') {
    // Torre sull'angolo posteriore, disegnata prima perché sta dietro
    const tT = P(sx, sy, 0.12, 0.12), tR = P(sx, sy, 0.46, 0.12), tB = P(sx, sy, 0.46, 0.46), tL = P(sx, sy, 0.12, 0.46);
    const th = 50;
    drawWall(g, tL, tB, th, shade(wall, 0.02));
    drawWall(g, tB, tR, th, shade(wall, -0.12));
    windowOn(g, wallFace(tL, tB), 0.3, 0.7, th - 16, th - 6, o, false);
    const apex = add(lerp(tT, tB, 0.5), 0, -th - 20);
    const e = (p) => add(p, 0, -th);
    poly(g, [e(tL), e(tB), apex]); g.fillStyle = roof; g.fill(); g.strokeStyle = shade(roof, -0.35); g.lineWidth = 1; g.stroke();
    poly(g, [e(tB), e(tR), apex]); g.fillStyle = shade(roof, -0.14); g.fill(); g.stroke();
    top = apex[1];
  }
  // Muri: sinistro (verso sud-ovest, in luce) e destro (verso sud-est, in ombra)
  drawWall(g, L0, B0, hw, wall);
  drawWall(g, B0, R0, hw, shade(wall, -0.13));
  const fl = wallFace(L0, B0), fr = wallFace(B0, R0);
  // Porta sul lato che guarda la sua via, finestre ai lati
  const doorLeft = door !== 'E';
  if (doorLeft) {
    doorOn(g, fl, 0.42, 0.6, 15, dcol);
    windowOn(g, fl, 0.12, 0.28, 9, 18, o, false);
    windowOn(g, fl, 0.74, 0.9, 9, 18, o, false);
    windowOn(g, fr, 0.3, 0.55, 9, 18, o, true);
  } else {
    doorOn(g, fr, 0.4, 0.6, 15, dcol);
    windowOn(g, fl, 0.25, 0.45, 9, 18, o, false);
    windowOn(g, fl, 0.6, 0.8, 9, 18, o, false);
  }
  if (founder) { const q = (doorLeft ? fl : fr)(0.34, 11); g.fillStyle = '#e2bf4f'; g.fillRect(Math.round(q[0]), Math.round(q[1]), 3, 2); }
  // Tetto, con un po' di sporgenza
  const e = (p) => add(p, 0, -hw);
  const ctr = lerp(e(T0), e(B0), 0.5);
  const oh = (p) => lerp(ctr, p, 1.12);
  const Lt = oh(e(L0)), Bt = oh(e(B0)), Rt = oh(e(R0)), Tt = oh(e(T0));
  const rh = style.shape === 'villetta' ? 10 : 15;
  if (style.shape === 'villetta') {
    // Padiglione: quattro falde, colmo corto
    const mid1 = lerp(Lt, Tt, 0.5), mid2 = lerp(Bt, Rt, 0.5);
    const m1 = add(lerp(mid1, mid2, 0.3), 0, -rh), m2 = add(lerp(mid1, mid2, 0.7), 0, -rh);
    poly(g, [Tt, Rt, m2, m1]); g.fillStyle = shade(roof, 0.12); g.fill(); g.strokeStyle = shade(roof, -0.35); g.lineWidth = 1; g.stroke();
    poly(g, [Bt, Rt, m2]); g.fillStyle = shade(roof, -0.14); g.fill(); g.stroke();
    poly(g, [Lt, Bt, m2, m1]); g.fillStyle = roof; g.fill(); g.stroke();
    if (detail) roofTiles(g, [Lt, Bt, m2, m1], Lt, m1, Bt, m2, 4, roof);
    top = Math.min(top, m1[1]);
  } else {
    // Due falde con il colmo lungo la casa, timpano a destra
    const m1 = add(lerp(Lt, Tt, 0.5), 0, -rh), m2 = add(lerp(Bt, Rt, 0.5), 0, -rh);
    const chim = add(lerp(m1, Tt, 0.45), 4, 0);
    poly(g, [Tt, Rt, m2, m1]); g.fillStyle = shade(roof, 0.14); g.fill(); g.strokeStyle = shade(roof, -0.35); g.lineWidth = 1; g.stroke();
    if (detail) { g.fillStyle = shade(wall, -0.2); g.fillRect(Math.round(chim[0]), Math.round(chim[1] - 9), 5, 10); g.fillStyle = '#8c4a35'; g.fillRect(Math.round(chim[0]) - 1, Math.round(chim[1] - 10), 7, 2); }
    poly(g, [e(B0), e(R0), add(lerp(e(B0), e(R0), 0.5), 0, -rh)]); g.fillStyle = shade(wall, -0.13); g.fill(); g.strokeStyle = shade(wall, -0.4); g.stroke();
    poly(g, [Lt, Bt, m2, m1]); g.fillStyle = roof; g.fill(); g.strokeStyle = shade(roof, -0.35); g.stroke();
    if (detail) roofTiles(g, [Lt, Bt, m2, m1], Lt, m1, Bt, m2, 4, roof);
    g.strokeStyle = shade(roof, 0.3); g.lineWidth = 1.5; g.beginPath(); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.stroke();
    top = Math.min(top, m1[1] - 10);
  }
  if (flag) {
    const base = add(lerp(Lt, Tt, 0.5), 0, -rh);
    g.fillStyle = '#4a4a4a'; g.fillRect(Math.round(base[0]), Math.round(base[1] - 14), 1, 14);
    poly(g, [[base[0] + 1, base[1] - 14], [base[0] + 9, base[1] - 11], [base[0] + 1, base[1] - 8]]); g.fillStyle = flag; g.fill();
    top = Math.min(top, base[1] - 14);
  }
  drawGardenFront(g, style.garden, sx, sy);
  drawDeco(g, style.deco, sx, sy);
  return { wins, top };
}

function drawYard(g, garden, sx, sy, det) {
  if (garden === 'nessuno') { g.fillStyle = '#ddcfab'; diamond(g, sx, sy, 2); g.fill(); if (det) speck(g, sx, sy, sx + sy, 8, ['rgba(150,120,70,0.4)', 'rgba(255,255,255,0.5)']); }
  else if (garden === 'prato') { g.fillStyle = 'rgba(200,240,150,0.35)'; diamond(g, sx, sy, 2); g.fill(); }
}
function drawGardenFront(g, garden, sx, sy) {
  if (garden === 'fiori') {
    const cols = ['#e85d75', '#f2c14e', '#ffffff', '#b07cd8', '#ff8a5c'];
    for (let k = 0; k < 7; k++) {
      const [px, py] = P(sx, sy, 0.1 + k * 0.05, 0.92);
      g.fillStyle = '#4f8a45'; g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 2);
      g.fillStyle = cols[k % 5]; g.fillRect(Math.round(px), Math.round(py) - 2, 2, 2);
    }
  } else if (garden === 'orto') {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const [px, py] = P(sx, sy, 0.86 + r * 0.04, 0.2 + k * 0.08);
      g.fillStyle = '#6b4a2f'; g.fillRect(Math.round(px) - 2, Math.round(py), 5, 2);
      g.fillStyle = r % 2 ? '#7fbf4a' : '#5f9e3a'; g.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 3);
    }
  } else if (garden === 'ulivo') {
    const [px, py] = P(sx, sy, 0.08, 0.92);
    drawTree(g, { kind: 'ulivo', s: 0.55 }, px + 4, py);
  }
}
function drawDeco(g, deco, sx, sy) {
  const [x, y] = P(sx, sy, 0.95, 0.72);
  if (deco === 'vespa') {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 1, 7, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = '#1f1f1f'; g.fillRect(x - 6, y - 3, 3, 3); g.fillRect(x + 3, y - 1, 3, 3);
    g.fillStyle = '#9adbc6'; g.beginPath(); g.ellipse(x - 2, y - 5, 5, 3.5, 0.4, 0, 7); g.fill(); g.strokeStyle = '#4f8f7c'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#5a3a2a'; g.fillRect(x - 5, y - 9, 6, 2);
    g.fillStyle = '#86cdb8'; g.fillRect(x + 3, y - 11, 2, 9);
  } else if (deco === 'bici') {
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x - 5, y - 3, 3.5, 3.5, 0, 0, 7); g.moveTo(x + 8.5, y); g.ellipse(x + 5, y, 3.5, 3.5, 0, 0, 7); g.stroke();
    g.strokeStyle = '#c0392b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 5, y - 3); g.lineTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x - 1, y - 2); g.lineTo(x, y - 7); g.stroke();
  } else if (deco === 'panchina') {
    g.fillStyle = '#3b3f45'; g.fillRect(x - 6, y - 4, 1, 5); g.fillRect(x + 5, y - 1, 1, 5);
    g.fillStyle = '#8b5e3c';
    for (let k = 0; k < 3; k++) { poly(g, [[x - 8, y - 6 + k * 2], [x + 7, y - 5 + k * 2], [x + 7, y - 3.5 + k * 2], [x - 8, y - 4.5 + k * 2]]); g.fill(); }
  } else if (deco === 'limoni') {
    g.fillStyle = '#c4673d'; poly(g, [[x - 4, y - 6], [x + 4, y - 6], [x + 3, y], [x - 3, y]]); g.fill();
    g.fillStyle = '#76533a'; g.fillRect(x - 0.5, y - 10, 1, 4);
    blob(g, x, y - 13, 5, '#3f7d34', '#284f21');
    g.fillStyle = '#f6d533'; g.fillRect(x - 3, y - 14, 2, 2); g.fillRect(x + 2, y - 12, 2, 2); g.fillRect(x - 1, y - 17, 2, 2);
  } else if (deco === 'cane') {
    g.fillStyle = '#c4935e'; poly(g, [[x - 7, y - 3], [x + 1, y + 1], [x + 1, y - 6], [x - 7, y - 10]]); g.fill();
    g.fillStyle = '#a77a49'; poly(g, [[x + 1, y + 1], [x + 6, y - 2], [x + 6, y - 9], [x + 1, y - 6]]); g.fill();
    g.fillStyle = '#b5523b'; poly(g, [[x - 8, y - 10], [x - 3, y - 15], [x + 7, y - 10], [x + 1, y - 6]]); g.fill();
    g.fillStyle = '#3d2a1c'; g.fillRect(x - 4, y - 6, 3, 4);
    g.fillStyle = '#e8c48f'; g.beginPath(); g.ellipse(x + 9, y - 1, 3, 2.5, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 10, y - 5, 2.2, 0, 7); g.fill();
    g.fillStyle = '#222'; g.fillRect(x + 11, y - 6, 1, 1);
  }
}
function drawSite(g, T0, R0, B0, L0, det) {
  poly(g, [T0, R0, B0, L0]); g.fillStyle = '#cfc8bb'; g.fill();
  drawWall(g, L0, B0, 12, '#b8684a');
  drawWall(g, B0, R0, 8, '#a35c41');
  if (det) {
    const f = wallFace(L0, B0);
    g.strokeStyle = 'rgba(80,40,20,0.35)'; g.lineWidth = 1; g.beginPath();
    for (let h = 3; h < 12; h += 3) { const a = f(0, h), b = f(1, h); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
  }
  g.strokeStyle = '#8a6a3e'; g.lineWidth = 1.5; g.beginPath();
  for (const p of [T0, R0, B0, L0]) { g.moveTo(p[0], p[1]); g.lineTo(p[0], p[1] - 34); }
  for (const hh of [16, 30]) { for (const [a, b] of [[L0, B0], [B0, R0]]) { g.moveTo(a[0], a[1] - hh); g.lineTo(b[0], b[1] - hh); } }
  g.stroke();
  g.fillStyle = '#ff8a2a'; poly(g, [add(B0, 6, 4), add(B0, 12, 4), add(B0, 9, -5)]); g.fill();
}

/* Piazza ------------------------------------------------------------------ */

export const PIAZZA_SPOTS = {
  edicola: [PIAZZA.x0, PIAZZA.y0],
  muro: [[PIAZZA.x0 + 3, PIAZZA.y0], [PIAZZA.x0 + 4, PIAZZA.y0], [PIAZZA.x0 + 5, PIAZZA.y0]],
};
const FOUNTAIN_TILE = [PIAZZA.x0 + 4, PIAZZA.y0 + 1];

// Oggetti della piazza, ognuno legato a una casella per l'ordine di disegno.
function piazzaProps(city) {
  const out = new Map();
  const built = builtCount(city);
  const founders = Object.values(city.residents).filter(isFounder).length;
  const put = (x, y, draw) => { const k = key(x, y); if (!out.has(k)) out.set(k, []); out.get(k).push(draw); };
  put(...PIAZZA_SPOTS.edicola, (g, sx, sy) => edicola(g, sx, sy));
  put(PIAZZA.x0 + 5, PIAZZA.y0, (g, sx, sy) => muro(g, sx, sy, founders));
  put(...FOUNTAIN_TILE, (g, sx, sy) => fountain(g, sx, sy, built >= FOUNTAIN_AT));
  put(PIAZZA.x0 + 1, PIAZZA.y1, (g, sx, sy) => bench(g, ...P(sx, sy, 0.5, 0.6)));
  put(PIAZZA.x1 - 1, PIAZZA.y1, (g, sx, sy) => bench(g, ...P(sx, sy, 0.5, 0.6)));
  put(PIAZZA.x0, PIAZZA.y1, (g, sx, sy) => planter(g, ...P(sx, sy, 0.3, 0.7)));
  put(PIAZZA.x1, PIAZZA.y1, (g, sx, sy) => planter(g, ...P(sx, sy, 0.7, 0.7)));
  put(PIAZZA.x0 + 2, PIAZZA.y1, (g, sx, sy) => lampPost(g, ...P(sx, sy, 0.5, 0.85)));
  put(PIAZZA.x1 - 2, PIAZZA.y1, (g, sx, sy) => lampPost(g, ...P(sx, sy, 0.5, 0.85)));
  if (built >= BAR_AT) {
    for (const [x, y] of [[PIAZZA.x1, PIAZZA.y0], [PIAZZA.x1 - 1, PIAZZA.y0 + 1], [PIAZZA.x1, PIAZZA.y0 + 1]]) put(x, y, (g, sx, sy) => cafeTable(g, ...P(sx, sy, 0.5, 0.5)));
  }
  return out;
}
// Parallelepipedo isometrico appoggiato sul punto `base` (angolo verso chi guarda).
function box(g, base, w, d, hgt, top, left, right) {
  const B = base, R = add(B, 32 * w, -16 * w), Lc = add(B, -32 * d, -16 * d), Tc = add(R, -32 * d, -16 * d);
  poly(g, [Lc, B, add(B, 0, -hgt), add(Lc, 0, -hgt)]); g.fillStyle = left; g.fill(); g.strokeStyle = shade(left, -0.35); g.lineWidth = 1; g.stroke();
  poly(g, [B, R, add(R, 0, -hgt), add(B, 0, -hgt)]); g.fillStyle = right; g.fill(); g.stroke();
  poly(g, [add(Lc, 0, -hgt), add(B, 0, -hgt), add(R, 0, -hgt), add(Tc, 0, -hgt)]); g.fillStyle = top; g.fill(); g.stroke();
  return { B, R, L: Lc, T: Tc };
}
function edicola(g, sx, sy) {
  const b = box(g, P(sx, sy, 0.85, 0.85), 0.6, 0.6, 22, '#c0392b', '#2f6b5c', '#24564a');
  const f = wallFace(b.L, b.B);
  poly(g, quadOn(f, 0.12, 0.88, 6, 16)); g.fillStyle = '#f4ecd8'; g.fill();
  const cols = ['#e85d4a', '#3f6aa1', '#f2c14e', '#7a4a6b', '#4f8a72'];
  for (let k = 0; k < 5; k++) { poly(g, quadOn(f, 0.16 + k * 0.14, 0.27 + k * 0.14, 8, 14)); g.fillStyle = cols[k]; g.fill(); }
  for (let k = 0; k < 6; k++) { poly(g, quadOn(f, k / 6, (k + 1) / 6, 18, 22)); g.fillStyle = k % 2 ? '#f6efe0' : '#c0392b'; g.fill(); }
}
function muro(g, sx, sy, founders) {
  // Muro dei Fondatori lungo tre caselle in fila sull'asse x (questa è l'ultima)
  const a = P(sx - 64, sy - 32, 0.05, 0.3), b = P(sx, sy, 0.95, 0.3);
  const f = wallFace(a, b);
  poly(g, [a, b, add(b, 0, -16), add(a, 0, -16)]); g.fillStyle = '#c9b48f'; g.fill(); g.strokeStyle = '#8c7650'; g.lineWidth = 1; g.stroke();
  poly(g, [add(a, 0, -16), add(b, 0, -16), add(b, 4, -18), add(a, 4, -18)]); g.fillStyle = '#e6d6b3'; g.fill();
  const n = Math.min(founders, 24);
  for (let i = 0; i < 24; i++) {
    const u = 0.04 + (i % 12) * 0.08, hh = i < 12 ? 11 : 5;
    poly(g, quadOn(f, u, u + 0.05, hh, hh + 3.5)); g.fillStyle = i < n ? '#e2bf4f' : 'rgba(255,255,255,0.25)'; g.fill();
  }
}
function fountain(g, sx, sy, built) {
  const c = P(sx, sy, 0, 1); // incrocio di quattro caselle: centro della fontana
  if (!built) {
    g.fillStyle = '#6aa25a'; g.beginPath(); g.ellipse(c[0], c[1], 28, 14, 0, 0, 7); g.fill(); g.strokeStyle = '#3f6b33'; g.lineWidth = 1; g.stroke();
    speck(g, c[0], c[1] - 14, 7, 8, ['#e85d75', '#f6d84a', '#fff']);
    g.fillStyle = '#8a6a3e'; g.fillRect(c[0] - 1, c[1] - 24, 2, 18);
    g.fillStyle = '#f7f1e1'; g.fillRect(c[0] - 18, c[1] - 32, 36, 10); g.strokeStyle = '#8a6a3e'; g.strokeRect(c[0] - 18.5, c[1] - 32.5, 37, 11);
    g.fillStyle = '#5b4a2c'; g.font = '700 6px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText(`FONTANA A ${FOUNTAIN_AT}`, c[0], c[1] - 25); g.textAlign = 'left';
    return;
  }
  g.fillStyle = '#b9aa8c'; g.beginPath(); g.ellipse(c[0], c[1] + 4, 34, 17, 0, 0, Math.PI); g.lineTo(c[0] - 34, c[1]); g.fill();
  g.fillStyle = '#d7cbb2'; g.beginPath(); g.ellipse(c[0], c[1], 34, 17, 0, 0, 7); g.fill(); g.strokeStyle = '#8c7a5a'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#5fb0d4'; g.beginPath(); g.ellipse(c[0], c[1], 28, 13, 0, 0, 7); g.fill();
  g.fillStyle = '#9ad6ea'; g.beginPath(); g.ellipse(c[0] - 6, c[1] - 3, 12, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#cdbf9f'; g.fillRect(c[0] - 3, c[1] - 20, 6, 20); g.strokeStyle = '#8c7a5a'; g.strokeRect(c[0] - 3.5, c[1] - 20.5, 7, 21);
  g.fillStyle = '#e2d7bf'; g.beginPath(); g.ellipse(c[0], c[1] - 21, 10, 4, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#7cc6df'; g.beginPath(); g.ellipse(c[0], c[1] - 21.5, 7.5, 2.6, 0, 0, 7); g.fill();
}
function bench(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.25)'; poly(g, [[x - 10, y + 1], [x + 8, y + 10], [x + 12, y + 8], [x - 6, y - 1]]); g.fill();
  g.fillStyle = '#3b3f45'; g.fillRect(x - 8, y - 3, 1, 6); g.fillRect(x + 7, y + 4, 1, 6);
  g.fillStyle = '#8b5e3c';
  for (let k = 0; k < 3; k++) { poly(g, [[x - 10, y - 6 + k * 2], [x + 9, y + 3.5 + k * 2], [x + 9, y + 5 + k * 2], [x - 10, y - 4.5 + k * 2]]); g.fill(); }
}
function planter(g, x, y) {
  g.fillStyle = '#b8643d'; poly(g, [[x - 6, y - 7], [x + 6, y - 7], [x + 5, y + 1], [x - 5, y + 1]]); g.fill(); g.strokeStyle = '#7a3f22'; g.lineWidth = 1; g.stroke();
  blob(g, x, y - 11, 6.5, '#4f8a45', '#2f5a29');
  for (const [dx, dy, c] of [[-3, -13, '#e85d75'], [2, -12, '#f6d84a'], [0, -16, '#e85d75'], [3, -9, '#ffffff']]) { g.fillStyle = c; g.fillRect(x + dx, y + dy, 2, 2); }
}
function lampPost(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.25)'; g.beginPath(); g.ellipse(x + 2, y, 4, 2, 0, 0, 7); g.fill();
  g.fillStyle = '#2f3338'; g.fillRect(x - 1, y - 30, 2, 30); g.fillRect(x - 2.5, y - 2, 5, 2);
  poly(g, [[x - 3.5, y - 30], [x + 3.5, y - 30], [x + 2, y - 37], [x - 2, y - 37]]); g.fill();
  g.fillStyle = '#f3e6c2'; g.fillRect(x - 2, y - 36, 4, 5);
}
function cafeTable(g, x, y) {
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 0.5, y - 22, 1, 22);
  g.fillStyle = '#f2ead6'; g.beginPath(); g.ellipse(x, y - 2, 6, 3, 0, 0, 7); g.fill();
  for (let k = 0; k < 8; k++) {
    g.fillStyle = k % 2 ? '#f6efe0' : '#2f6b4f';
    g.beginPath(); g.moveTo(x, y - 30); g.ellipse(x, y - 22, 15, 7, 0, Math.PI + (k / 8) * Math.PI, Math.PI + ((k + 1) / 8) * Math.PI); g.closePath(); g.fill();
  }
}
function umbrella(g, x, y, seed) {
  const cols = [['#e85d4a', '#fff'], ['#2f6b9f', '#fff'], ['#f2b632', '#fff'], ['#4f8a72', '#f6efe0']][seed % 4];
  g.fillStyle = 'rgba(120,90,40,0.25)'; g.beginPath(); g.ellipse(x + 6, y + 2, 13, 6, 0, 0, 7); g.fill();
  g.fillStyle = '#f6efe0'; poly(g, [[x - 12, y + 2], [x - 4, y + 6], [x - 1, y + 4], [x - 9, y]]); g.fill();
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 0.5, y - 20, 1, 22);
  for (let k = 0; k < 8; k++) {
    g.fillStyle = cols[k % 2];
    g.beginPath(); g.moveTo(x, y - 26); g.ellipse(x, y - 18, 14, 7, 0, Math.PI + (k / 8) * Math.PI, Math.PI + ((k + 1) / 8) * Math.PI); g.closePath(); g.fill();
  }
}

/* Il mondo: strato fisso -------------------------------------------------- */

// Le caselle che possono comparire nella vista, in ordine di disegno (dal fondo verso chi guarda).
function visibleTiles(view) {
  const out = [];
  const { L, R, T, B } = view;
  const dmin = Math.max(0, Math.floor((T - 60) / 16) - 1), dmax = Math.min(W + H - 2, Math.ceil((B + 120) / 16) + 1);
  const emin = Math.floor(L / 32) - 2, emax = Math.ceil(R / 32) + 2;
  for (let d = dmin; d <= dmax; d++) {
    for (let x = Math.max(0, d - (H - 1)); x <= Math.min(W - 1, d); x++) {
      const y = d - x, e = x - y;
      if (e < emin || e > emax) continue;
      out.push([x, y]);
    }
  }
  return out;
}

// Disegna il mondo nel rettangolo `view` (coordinate del mondo) sul contesto già trasformato.
// Restituisce gli oggetti disegnati (per tocchi e sovrapposizioni) e le etichette.
export function drawWorld(g, city, view, o) {
  const det = o.detail !== false;
  const night = !!o.night;
  const G = getGround(city.openDistricts);
  const props = piazzaProps(city);
  const objects = [], labels = [], lights = [], lamps = [];
  for (const [x, y] of visibleTiles(view)) {
    const L = G.level[y * W + x];
    const sx = isoX(x, y), sy = isoY(x, y) - elev(L);
    drawTileTop(g, city, G, x, y, sx, sy, det);
    drawTileFaces(g, city, G, x, y, sx, sy, det);
    const k = key(x, y);
    const d = x + y;
    const h = city.houses[k];
    if (h) {
      const r = city.residents[h.residentId];
      const online = o.online?.has(h.residentId);
      const t0 = o.born?.get(k);
      const age = t0 !== undefined ? (o.t || 0) - t0 : Infinity;
      const grow = age < 900 ? easeOutBack(Math.max(0, age) / 900) : 1;
      const opts = {
        lit: night && online, night, founder: isFounder(r), cantiere: h.status === 'cantiere', detail: det, door: city.doors?.[k] || 'S',
        flag: h.residentId === o.meId ? '#e0a92a' : o.friends?.has(h.residentId) ? '#3f6aa1' : null,
      };
      const draw = (gg) => {
        if (grow === 1) return drawHouse(gg, h.style, sx, sy, opts);
        gg.save(); gg.translate(sx, sy + 32); gg.scale(grow, grow); gg.translate(-sx, -(sy + 32));
        const res = drawHouse(gg, h.style, sx, sy, opts);
        gg.restore();
        return res;
      };
      const res = draw(g);
      if (night && online) lights.push(...res.wins);
      objects.push({ type: 'house', slot: k, depth: d, box: [sx - 34, res.top - 4, sx + 34, sy + 32], draw });
      if (r) labels.push({ x: sx, y: sy + 34, text: r.username, me: h.residentId === o.meId, slot: k });
      continue;
    }
    const tree = G.trees.get(k);
    const road = city.roads[k];
    const dd = districtAt(x, y);
    const bush = !tree && !road && x % 3 === 0 && y % 3 === 0 && y !== MAIN_Y && dd && dd <= city.openDistricts && !inPiazza(x, y) && ih(x, y, 30) < 0.45;
    if ((tree && !road) || bush) {
      const t = tree || { kind: 'cespuglio', s: 1 };
      const [cx, cy] = P(sx, sy, 0.5, 0.5);
      drawTree(g, t, cx, cy);
      objects.push({ type: 'tree', depth: d, box: [cx - 18, cy - 50, cx + 18, cy + 4], draw: (gg) => drawTree(gg, t, cx, cy) });
    }
    for (const pd of props.get(k) || []) {
      pd(g, sx, sy);
      objects.push({ type: 'prop', depth: d, box: [sx - 70, sy - 60, sx + 40, sy + 32], draw: (gg) => pd(gg, sx, sy) });
    }
    // Lampioni lungo la statale e ombrelloni sulla spiaggia
    if (road === 'main' && x % 5 === 0 && !(x >= PIAZZA.x0 && x <= PIAZZA.x1)) {
      const [lx, ly] = P(sx, sy, 0.5, 0.08);
      lampPost(g, lx, ly); lamps.push([lx, ly]);
      objects.push({ type: 'prop', depth: d, box: [lx - 5, ly - 38, lx + 5, ly + 2], draw: (gg) => lampPost(gg, lx, ly) });
    }
    if (y === SEA_Y && x % 3 === 1 && x > 12 && x < 72) { const [ux, uy] = P(sx, sy, 0.5, 0.45); umbrella(g, ux, uy, x); }
  }
  for (const [x, y] of [[PIAZZA.x0 + 2, PIAZZA.y1], [PIAZZA.x1 - 2, PIAZZA.y1]]) lamps.push(P(isoX(x, y), isoY(x, y) - elev(1), 0.5, 0.85));
  if (night) {
    const { L, R, T, B } = view;
    g.save();
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#56649a'; g.fillRect(L - 40, T - 40, R - L + 80, B - T + 80);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(8,12,34,0.25)'; g.fillRect(L - 40, T - 40, R - L + 80, B - T + 80);
    g.globalCompositeOperation = 'lighter';
    for (const q of lights) { const c = lerp(q[0], q[2], 0.5); glow(g, c[0], c[1], 16, 0.35); }
    for (const [lx, ly] of lamps) { glow(g, lx, ly - 33, 10, 0.6); glow(g, lx, ly, 34, 0.22); }
    g.restore();
    for (const q of lights) { poly(g, q); g.fillStyle = '#ffdc8a'; g.fill(); }
  }
  return { objects, labels };
}

function glow(g, x, y, r, a, color = '255,214,110') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

/* Strato animato: acqua, fontana, auto, barche ------------------------------ */

const CAR_COLORS = ['#e8c95a', '#d9442f', '#6fb3c8', '#f1ede4', '#3f6aa1', '#4f8a72', '#c7c2b8', '#e88a3a'];
function carsFor(built) {
  const n = Math.max(2, Math.min(9, 2 + Math.floor(built / 6)));
  return Array.from({ length: n }, (_, i) => ({
    color: CAR_COLORS[Math.floor(ih(i, 1, 40) * CAR_COLORS.length)], bus: i % 5 === 4,
    dir: i % 2 ? -1 : 1, speed: 1.1 + ih(i, 2, 40) * 0.9, offset: ih(i, 3, 40) * W,
  }));
}
function drawCar(g, car, gx, gy, night) {
  // Auto lungo l'asse x della statale: una scatola isometrica con i finestrini
  const len = car.bus ? 0.9 : 0.5, wid = 0.26, hgt = car.bus ? 13 : 8;
  const lv = levelAt(Math.round(gx), Math.round(gy), 1) >= 1 ? 1 : 0;
  const bx = isoX(gx, gy), by = isoY(gx, gy) - elev(lv);
  const p = (u, v) => [bx + 32 * u - 32 * v, by + 16 * u + 16 * v];
  const L0 = p(-len / 2, wid / 2), B0 = p(len / 2, wid / 2), R0 = p(len / 2, -wid / 2), T0 = p(-len / 2, -wid / 2);
  const col = night ? shade(car.color, -0.25) : car.color;
  g.fillStyle = 'rgba(0,0,0,0.3)'; poly(g, [add(L0, 3, 2), add(B0, 3, 2), add(R0, 3, 2), add(T0, 3, 2)]); g.fill();
  const up = (q) => add(q, 0, -hgt);
  poly(g, [L0, B0, up(B0), up(L0)]); g.fillStyle = shade(col, -0.05); g.fill(); g.strokeStyle = shade(col, -0.4); g.lineWidth = 1; g.stroke();
  poly(g, [B0, R0, up(R0), up(B0)]); g.fillStyle = shade(col, -0.2); g.fill(); g.stroke();
  poly(g, [up(L0), up(B0), up(R0), up(T0)]); g.fillStyle = shade(col, 0.1); g.fill(); g.stroke();
  poly(g, quadOn(wallFace(L0, B0), 0.15, 0.85, hgt - 6, hgt - 2)); g.fillStyle = night ? '#ffe39a' : '#33465a'; g.fill();
  if (night) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const front = car.dir > 0 ? lerp(B0, R0, 0.5) : lerp(L0, T0, 0.5);
    glow(g, front[0] + car.dir * 12, front[1] + car.dir * 6, 16, 0.4, '255,240,180');
    g.restore();
  }
}

export function drawAmbient(g, city, view, o, t) {
  const s = t / 1000;
  const night = !!o.night;
  const { L, R, T, B } = view;
  // Luccichii sull'acqua e barche a vela
  if (isoY(W, SEA_Y) > T) {
    g.save();
    g.fillStyle = night ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.75)';
    for (let y = SEA_Y + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = isoX(x, y), sy = isoY(x, y) - elev(-1);
        if (sx < L - 40 || sx > R + 40 || sy < T - 40 || sy > B + 20) continue;
        const r = ih(x, y, 50);
        if (r < 0.6) continue;
        const ph = (s * 0.6 + r * 10) % 1;
        if (ph > 0.5) continue;
        const [px, py] = P(sx, sy, 0.3 + r * 0.4, 0.4);
        g.fillRect(Math.round(px + ph * 8), Math.round(py), 4, 1);
      }
    }
    for (let i = 0; i < 3; i++) {
      const gx = ((s * (0.25 + i * 0.08) + ih(i, 9, 60) * W) % (W + 4)) - 2;
      const gy = SEA_Y + 2.5 + i * 2;
      const bx = isoX(gx, gy), by = isoY(gx, gy) - elev(-1);
      if (bx < L - 40 || bx > R + 40 || by < T - 40 || by > B + 40) continue;
      const bob = Math.sin(s * 1.3 + i);
      g.fillStyle = night ? '#c9c4b8' : '#fbf7ee'; poly(g, [[bx - 12, by + bob], [bx + 10, by + 11 + bob], [bx + 14, by + 7 + bob], [bx - 8, by - 4 + bob]]); g.fill();
      g.fillStyle = '#8b5e3c'; g.fillRect(bx, by - 20 + bob, 1, 22);
      g.fillStyle = i % 2 ? '#e85d4a' : '#f6efe0'; poly(g, [[bx + 1, by - 20 + bob], [bx + 12, by + 2 + bob], [bx + 1, by + 2 + bob]]); g.fill();
    }
    g.restore();
  }
  // Fontana
  if (builtCount(city) >= FOUNTAIN_AT) {
    const [fx, fy] = P(isoX(...FOUNTAIN_TILE), isoY(...FOUNTAIN_TILE) - elev(1), 0, 1);
    if (fx > L - 60 && fx < R + 60 && fy > T - 60 && fy < B + 60) {
      g.fillStyle = 'rgba(230,248,255,0.95)';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, p = (s * 1.3 + k * 0.137) % 1;
        g.fillRect(Math.round(fx + Math.cos(a) * p * 11), Math.round(fy - 24 - Math.sin(p * Math.PI) * 8 + p * 6 + Math.sin(a) * p * 5), 2, 2);
      }
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
      const p = (s * 0.5) % 1;
      g.globalAlpha = 1 - p; g.beginPath(); g.ellipse(fx, fy, 8 + p * 18, (8 + p * 18) * 0.5, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
  }
  // Automobili sulla statale
  for (const car of carsFor(builtCount(city))) {
    let gx = ((s * car.speed + car.offset) % (W + 4)) - 2;
    if (car.dir < 0) gx = W - gx;
    const gy = MAIN_Y + 0.5 + (car.dir > 0 ? 0.18 : -0.18);
    const x0 = isoX(gx, gy);
    if (x0 < L - 60 || x0 > R + 60) continue;
    drawCar(g, car, gx, gy, night);
  }
}

/* Abitanti a passeggio (omini squadrati alla Habbo) ------------------------ */

export function avatarLook(name, chosen) {
  const l = cleanLook(chosen, name);
  return { skin: LOOK.skin[l.skin], hair: LOOK.hair[l.hair], shirt: LOOK.shirt[l.shirt], pants: LOOK.pants[l.pants], style: l.style, extra: l.extra };
}
function rectO(g, x, y, w, h, fill, line) {
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  if (line) { g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
}
// Direzioni isometriche: SE e SW verso chi guarda (si vede il viso), NE e NW di spalle.
// (x, y) sono i piedi; step 0 fermo, 1 e 2 le due pose della camminata.
export function drawAvatar(g, x, y, dir, step, look, { night = false } = {}) {
  const back = dir === 'NE' || dir === 'NW';
  const mirror = dir === 'SW' || dir === 'NW';
  const ol = 'rgba(30,22,16,0.85)';
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (night && 'filter' in g) g.filter = 'brightness(0.62) saturate(0.85)';
  g.fillStyle = 'rgba(20,30,15,0.3)'; g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, 7); g.fill();
  if (mirror) g.scale(-1, 1);
  const a = step === 1 ? 1 : 0, b = step === 2 ? 1 : 0;
  // Gambe e scarpe
  rectO(g, -5, -14 + a, 4, 12 - a, look.pants, ol);
  rectO(g, 1, -14 + b, 4, 12 - b, shade(look.pants, -0.1), ol);
  rectO(g, -6 + a, -3, 6, 3, '#2b2b2b');
  rectO(g, 1 - b, -3 - b, 6, 3, '#1f1f1f');
  // Braccio dietro, busto, braccio davanti
  rectO(g, 6, -27 + b, 3, 11, shade(look.shirt, -0.22), ol);
  rectO(g, -7, -28, 14, 15, look.shirt, ol);
  g.fillStyle = shade(look.shirt, back ? 0.08 : -0.14); g.fillRect(back ? -6 : 1, -27, 5, 13);
  if (!back) { g.fillStyle = shade(look.shirt, 0.18); g.fillRect(-3, -27, 6, 2); }
  rectO(g, -9, -27 + a, 3, 11, shade(look.shirt, -0.05), ol);
  rectO(g, -9, -17 + a, 3, 3, look.skin);
  // Testa
  rectO(g, -2, -31, 4, 3, look.skin);
  g.fillStyle = ol; g.beginPath(); g.roundRect(-7.5, -44.5, 15, 15, 4); g.fill();
  g.fillStyle = look.skin; g.beginPath(); g.roundRect(-6.5, -43.5, 13, 13, 3.5); g.fill();
  const hair = look.hair, st = look.style;
  g.fillStyle = hair;
  if (back) {
    g.beginPath(); g.roundRect(-7.5, -45.5, 15, 13, 4); g.fill();
    if (st === 'lunghi') g.fillRect(-7, -34, 14, 9);
    if (st === 'coda') { g.fillStyle = '#e85d75'; g.fillRect(-1.5, -34, 3, 2); g.fillStyle = hair; g.fillRect(-2, -32, 4, 8); }
  } else {
    g.fillRect(-7.5, -45.5, 15, 6);
    g.fillRect(-7.5, -40, 4, 6);
    g.fillRect(2, -40, 5.5, 2);
    if (st === 'lunghi') g.fillRect(-7.5, -36, 4, 10);
    if (st === 'coda') { g.fillRect(-11, -42, 4, 9); g.fillStyle = '#e85d75'; g.fillRect(-8, -41, 2, 3); }
    // Viso di tre quarti
    g.fillStyle = '#1f1f1f'; g.fillRect(0, -37, 2, 3); g.fillRect(4, -37, 2, 3);
    g.fillStyle = 'rgba(230,110,110,0.5)'; g.fillRect(-1, -33, 2, 1); g.fillRect(5, -33, 2, 1);
    g.fillStyle = shade(look.skin, -0.3); g.fillRect(2, -32, 3, 1);
  }
  if (st === 'ricci') {
    for (const [cx, cy] of [[-6, -44], [-2, -46], [2, -46], [6, -44], [-7, -40], [7, -41]]) { g.fillStyle = hair; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill(); }
  }
  if (look.extra === 'cappellino') {
    g.fillStyle = shade(look.shirt, -0.08); g.beginPath(); g.roundRect(-8, -48, 16, 6, 3); g.fill();
    g.fillStyle = shade(look.shirt, -0.3); if (!back) g.fillRect(3, -43, 9, 2);
    g.fillStyle = '#ffffff'; g.fillRect(-2, -47, 4, 2);
  } else if (look.extra === 'occhiali' && !back) {
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 1;
    g.strokeRect(-0.5, -38.5, 4, 4); g.strokeRect(3.5, -38.5, 4, 4);
  } else if (look.extra === 'fiore') {
    const fx = back ? 4 : -5, fy = -45;
    g.fillStyle = '#e85d75'; g.fillRect(fx - 2, fy, 2, 2); g.fillRect(fx + 2, fy, 2, 2); g.fillRect(fx, fy - 2, 2, 2); g.fillRect(fx, fy + 2, 2, 2);
    g.fillStyle = '#f6d84a'; g.fillRect(fx, fy, 2, 2);
  }
  g.restore();
}
// Anteprima per l'editor del personaggio: cammina sul posto e si gira nelle quattro direzioni.
export function drawAvatarPreview(canvas, look, t) {
  const g = canvas.getContext('2d');
  const dirs = ['SE', 'SW', 'NW', 'NE'];
  const k = t / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingEnabled = false;
  const s = Math.max(1, Math.floor(canvas.width / 70));
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height * 0.86);
  diamond(g, 0, -16); g.fillStyle = '#9fcf6c'; g.fill(); g.strokeStyle = '#6f9f4a'; g.lineWidth = 1; g.stroke();
  drawAvatar(g, 0, 0, dirs[Math.floor(k / 1.4) % 4], (Math.floor(k * 4.5) % 2) + 1, look);
}

/* Nuvole ------------------------------------------------------------------ */

let cloudSprites = null;
function makeCloudSprites() {
  const mk = (color, blur) => {
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 180;
    const c = cv.getContext('2d');
    c.filter = `blur(${blur}px)`;
    c.fillStyle = color;
    for (const [x, y, r] of [[110, 105, 48], [165, 80, 62], [228, 100, 50], [270, 118, 34], [80, 122, 30], [185, 122, 52]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    return cv;
  };
  return { cloud: mk('rgba(255,255,255,0.92)', 6), shadow: mk('rgba(20,40,30,1)', 14) };
}
const WORLD = { x0: -H * 32, x1: W * 32, y0: -80, y1: (W + H) * 16 + 60 };
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: WORLD.x0 + ih(i, 1, 70) * (WORLD.x1 - WORLD.x0), y: ih(i, 2, 70) * WORLD.y1, s: 0.8 + ih(i, 3, 70) * 0.8, v: 6 + ih(i, 4, 70) * 8 }));
function drawClouds(g, cam, vw, vh, dpr, t, night) {
  const fade = clamp01((1.1 - cam.z) / 0.7);
  if (fade <= 0.01) return;
  if (!cloudSprites) cloudSprites = makeCloudSprites();
  const s = t / 1000;
  const span = WORLD.x1 - WORLD.x0 + 900;
  g.save();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = true;
  for (const c of CLOUDS) {
    const wx = WORLD.x0 + ((c.x - WORLD.x0 + s * c.v) % span) - 450;
    const size = 420 * c.s;
    const gx = (wx + 80 - cam.x) * cam.z + vw / 2, gy = (c.y + 120 - cam.y) * cam.z + vh / 2;
    const gw = size * cam.z, gh = size * 0.5 * cam.z;
    if (gx + gw / 2 > 0 && gx - gw / 2 < vw && gy + gh / 2 > 0 && gy - gh / 2 < vh) {
      g.globalAlpha = (night ? 0.05 : 0.13) * fade;
      g.drawImage(cloudSprites.shadow, gx - gw / 2, gy - gh / 2, gw, gh);
    }
    const k = 1.35;
    const cx = (wx - cam.x) * cam.z * k + vw / 2, cy = (c.y - cam.y) * cam.z * k + vh / 2;
    const cw = size * cam.z * k, ch = size * 0.5 * cam.z * k;
    if (cx + cw / 2 > 0 && cx - cw / 2 < vw && cy + ch / 2 > 0 && cy - ch / 2 < vh) {
      g.globalAlpha = (night ? 0.18 : 0.5) * fade;
      g.drawImage(cloudSprites.cloud, cx - cw / 2, cy - ch / 2, cw, ch);
    }
  }
  g.restore();
}

/* Mappa ------------------------------------------------------------------ */

const DIR_OF = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'SE' : 'NW') : (dy > 0 ? 'SW' : 'NE'));

export class CityMap {
  constructor(canvas, { onTap, onCamera } = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.layer = document.createElement('canvas');   // strato fisso, a bassa risoluzione
    this.frame = document.createElement('canvas');   // fotogramma completo, a bassa risoluzione
    this.onTap = onTap;
    this.onCamera = onCamera;
    this.city = null;
    this.opts = { mode: 'browse', meId: null, friends: new Set(), online: new Set(), night: false, selected: null };
    this.cam = { x: 0, y: 900, z: 1 };
    this.born = new Map();
    this.avatars = new Map();
    this.objects = [];
    this.labels = [];
    this.dirty = true;
    this.lastAmbient = 0;
    this.interactUntil = 0;
    this.pointers = new Map();
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    // Durante un gesto si sposta l'ultima immagine pronta; a gesto finito lo zoom si aggancia
    // a un multiplo intero dei pixel (immagine nitida) e la città si ridisegna.
    const loop = (t) => {
      this.now = t;
      const interacting = this.pointers.size > 0 || t < this.interactUntil;
      if (!interacting && this.needSnap) { this.needSnap = false; this.snapZoom(); }
      const growing = this.animating(t);
      const walking = this.tickAvatars(t);
      if ((this.dirty || growing) && interacting && this.layerCam && !this.stale()) this.fast();
      else if (this.dirty || growing) { this.dirty = false; this.render(t, true); this.lastAmbient = t; }
      else if ((walking || this.bubbling(t)) && t - this.lastAmbient > 33) { this.render(t, false); this.lastAmbient = t; }
      else if (this.avatarsDirty || (!this.still && t - this.lastAmbient > 66)) { this.avatarsDirty = false; this.render(t, false); this.lastAmbient = t; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  levelOf(x, y) { return this.city ? levelAt(Math.round(x), Math.round(y), this.city.openDistricts) : 0; }

  /* Omini */
  setAvatars(list) {
    const ids = new Set(list.map((a) => a.id));
    for (const id of this.avatars.keys()) if (!ids.has(id)) this.avatars.delete(id);
    for (const a of list) {
      const cur = this.avatars.get(a.id);
      if (cur) { cur.name = a.name; cur.me = a.me; cur.look = avatarLook(a.name, a.look); continue; }
      this.avatars.set(a.id, { id: a.id, x: a.pos[0], y: a.pos[1], path: [], dir: 'SE', look: avatarLook(a.name, a.look), name: a.name, me: a.me, walked: 0, bubble: null });
    }
    this.avatarsDirty = true;
  }
  walk(id, tx, ty) {
    const a = this.avatars.get(id);
    if (!a || !this.city) return false;
    const path = walkPath(this.city, [Math.round(a.x), Math.round(a.y)], [tx, ty]);
    if (!path) return false;
    a.path = path;
    this.avatarsDirty = true;
    return true;
  }
  say(id, text) {
    const a = this.avatars.get(id);
    if (!a) return;
    a.bubble = { text, t0: performance.now() };
    this.avatarsDirty = true;
  }
  bubbling(t) { for (const a of this.avatars.values()) if (a.bubble && t - a.bubble.t0 < 6500) return true; return false; }
  avatarOf(id) { return this.avatars.get(id); }
  avatarScreen(a) {
    const [cx, cy] = tileCenter(a.x, a.y, this.levelOf(a.x, a.y));
    return [cx, cy + 2];
  }
  tickAvatars(t) {
    const dt = Math.min(0.1, (t - (this.lastTick || t)) / 1000);
    this.lastTick = t;
    let moving = false;
    for (const a of this.avatars.values()) {
      if (!a.path.length) continue;
      moving = true;
      let left = dt * 3.2; // caselle al secondo
      while (left > 0 && a.path.length) {
        const [nx, ny] = a.path[0];
        const dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy);
        if (d > 0.001) a.dir = DIR_OF(dx, dy);
        if (d <= left) { a.x = nx; a.y = ny; a.path.shift(); left -= d; } else { a.x += (dx / d) * left; a.y += (dy / d) * left; left = 0; }
      }
      a.walked += dt * 3.2;
      // La telecamera segue il proprio omino quando esce dal centro dello schermo.
      if (a.me && !this.pointers.size) {
        const [wx, wy] = this.avatarScreen(a);
        const sx = (wx - this.cam.x) * this.cam.z, sy = (wy - 24 - this.cam.y) * this.cam.z;
        const mx = this.vw * 0.28, my = this.vh * 0.2;
        if (Math.abs(sx) > mx || Math.abs(sy) > my) {
          this.cam.x += (sx - Math.sign(sx) * Math.min(Math.abs(sx), mx)) / this.cam.z * 0.12;
          this.cam.y += (sy - Math.sign(sy) * Math.min(Math.abs(sy), my)) / this.cam.z * 0.12;
          this.clamp();
          this.interactUntil = t + 200;
          this.dirty = true;
        }
      }
    }
    if (!moving && this.wasWalking) this.dirty = true;
    this.wasWalking = moving;
    return moving;
  }
  drawAvatars(g, night, occlude) {
    const list = [...this.avatars.values()].sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const a of list) {
      const [x, y] = this.avatarScreen(a);
      const step = a.path.length ? (Math.floor(a.walked * 2.6) % 2) + 1 : 0;
      drawAvatar(g, x, y, a.dir, step, a.look, { night });
      if (!occlude) continue;
      // Ciò che sta davanti all'omino (case, alberi) lo ricopre, come in Habbo.
      const depth = a.x + a.y;
      for (const ob of this.objects) {
        if (ob.depth <= depth + 0.6) continue;
        const [x0, y0, x1, y1] = ob.box;
        if (x + 10 < x0 || x - 10 > x1 || y < y0 || y - 50 > y1) continue;
        ob.draw(g);
      }
    }
  }

  setCity(city, { animateNew = true } = {}) {
    if (this.city && animateNew) {
      for (const slot of Object.keys(city.houses)) {
        const was = this.city.houses[slot];
        if (!was || was.status !== city.houses[slot].status) this.born.set(slot, performance.now());
      }
    }
    this.city = city;
    this.dirty = true;
  }
  set(opts) { Object.assign(this.opts, opts); this.dirty = true; }
  animating(t) {
    for (const [slot, t0] of this.born) { if (t - t0 < 1400) return true; this.born.delete(slot); }
    return false;
  }

  /* Telecamera: cam.x, cam.y nel mondo (pixel d'arte), cam.z = pixel CSS per pixel d'arte */
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = Math.max(1, r.width);
    this.vh = Math.max(1, r.height);
    this.cv.width = Math.round(this.vw * this.dpr);
    this.cv.height = Math.round(this.vh * this.dpr);
    if (!this.fitted && this.vw > 50) { this.fitted = true; this.fitCentro(); }
    this.clamp();
    this.dirty = true;
  }
  fitCentro() {
    const d = districtById(1).rect;
    const span = (d[2] - d[0] + d[3] - d[1] + 4) * 32;
    // Mai più lontano di un pixel d'arte per pixel dello schermo: la città si vede nitida da subito.
    this.cam.z = Math.max(1, Math.round((this.vw / span) * this.dpr)) / this.dpr;
    [this.cam.x, this.cam.y] = tileCenter((d[0] + d[2]) / 2, (d[1] + d[3]) / 2, 1);
    this.clamp();
    this.dirty = true;
  }
  focus(slotOrXY) {
    const [x, y] = typeof slotOrXY === 'string' ? parseKey(slotOrXY) : slotOrXY;
    [this.cam.x, this.cam.y] = tileCenter(x, y, this.levelOf(x, y));
    this.cam.y -= 16;
    if (this.cam.z * this.dpr < 2) this.cam.z = 2 / this.dpr;
    this.clamp();
    this.dirty = true;
  }
  zoomLimits() {
    const minZ = Math.max(this.vw / (WORLD.x1 - WORLD.x0 + 200), this.vh / (WORLD.y1 - WORLD.y0 + 200));
    return [minZ, Math.min(4 / this.dpr, 3)];
  }
  clamp() {
    const [minZ, maxZ] = this.zoomLimits();
    this.cam.z = Math.max(minZ, Math.min(maxZ, this.cam.z));
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    this.cam.x = Math.max(Math.min(WORLD.x0 + hw - 100, 0), Math.min(Math.max(WORLD.x1 - hw + 100, 0), this.cam.x));
    this.cam.y = Math.max(WORLD.y0 + hh - 100, Math.min(WORLD.y1 - hh + 100, this.cam.y));
    this.onCamera?.(this.cam);
  }
  // Lo zoom si ferma su multipli interi dei pixel dello schermo: pixel d'arte nitidi, come in Habbo.
  snapZoom() {
    const n = this.cam.z * this.dpr;
    if (n >= 0.85) this.cam.z = Math.max(1, Math.round(n)) / this.dpr;
    else if (n >= 0.4) this.cam.z = 0.5 / this.dpr;
    this.clamp();
    this.dirty = true;
  }
  zoomStep(dir) {
    const steps = [0.25, 0.5, 1, 2, 3, 4];
    const n = this.cam.z * this.dpr;
    let i = steps.findIndex((s) => s >= n - 0.01);
    if (i < 0) i = steps.length - 1;
    i = Math.max(0, Math.min(steps.length - 1, i + (dir > 0 ? 1 : -1)));
    this.cam.z = steps[i] / this.dpr;
    this.clamp();
    this.dirty = true;
  }
  toWorld(sx, sy) { return [(sx - this.vw / 2) / this.cam.z + this.cam.x, (sy - this.vh / 2) / this.cam.z + this.cam.y]; }
  zoomAt(sx, sy, factor) {
    this.interactUntil = performance.now() + 160;
    this.needSnap = true;
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.z *= factor;
    this.clamp();
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny;
    this.clamp();
    this.dirty = true;
  }

  bind() {
    const cv = this.cv;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size === 1) this.drag = { x: e.offsetX, y: e.offsetY, moved: 0 };
      else { this.drag = null; this.pinch = this.pinchInfo(); }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pinch && this.pointers.size === 2) {
        const p = this.pinchInfo();
        this.zoomAt(p.cx, p.cy, p.d / this.pinch.d);
        this.cam.x -= (p.cx - this.pinch.cx) / this.cam.z;
        this.cam.y -= (p.cy - this.pinch.cy) / this.cam.z;
        this.clamp();
        this.pinch = p;
      } else if (this.drag) {
        const dx = e.offsetX - this.drag.x, dy = e.offsetY - this.drag.y;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z;
        this.drag.x = e.offsetX; this.drag.y = e.offsetY;
        this.clamp();
      }
      this.dirty = true;
    });
    const up = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.drag && this.drag.moved < 8 && e.type === 'pointerup') this.tap(e.offsetX, e.offsetY);
      this.drag = null;
      if (this.pointers.size < 2) this.pinch = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
  pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // Dal punto toccato alla cosa: prima gli omini, poi le case, poi il terreno più vicino a chi guarda.
  tap(sx, sy) {
    if (!this.city) return;
    const [wx, wy] = this.toWorld(sx, sy);
    let best = null;
    for (const a of this.avatars.values()) {
      const [x, y] = this.avatarScreen(a);
      if (wx > x - 10 && wx < x + 10 && wy > y - 50 && wy < y + 3 && (!best || a.x + a.y > best.d)) best = { d: a.x + a.y, id: a.id };
    }
    if (best) return this.onTap?.({ kind: 'avatar', id: best.id });
    let house = null;
    for (const ob of this.objects) {
      if (ob.type !== 'house') continue;
      const [x0, y0, x1, y1] = ob.box;
      if (wx >= x0 && wx <= x1 && wy >= y0 && wy <= y1 && (!house || ob.depth > house.depth)) house = ob;
    }
    let tile = null;
    for (let L = 3; L >= -1; L--) {
      const yy = wy + elev(L);
      const tx = Math.floor((yy / 16 + wx / 32) / 2), ty = Math.floor((yy / 16 - wx / 32) / 2);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      if (levelAt(tx, ty, this.city.openDistricts) !== L) continue;
      if (!tile || tx + ty > tile[0] + tile[1]) tile = [tx, ty];
    }
    if (house && (!tile || house.depth >= tile[0] + tile[1] - 1)) {
      const [x, y] = parseKey(house.slot);
      return this.onTap?.({ kind: 'house', slot: house.slot, house: this.city.houses[house.slot], x, y });
    }
    if (!tile) return this.onTap?.({ kind: 'none' });
    const [x, y] = tile;
    const k = key(x, y);
    const at = { x, y };
    if (this.city.houses[k]) return this.onTap?.({ kind: 'house', slot: k, house: this.city.houses[k], ...at });
    if (inPiazza(x, y)) {
      const [ex, ey] = PIAZZA_SPOTS.edicola;
      if (x === ex && y === ey) return this.onTap?.({ kind: 'giornale', ...at });
      if (PIAZZA_SPOTS.muro.some(([mx, my]) => mx === x && my === y)) return this.onTap?.({ kind: 'muro', ...at });
      return this.onTap?.({ kind: 'piazza', ...at });
    }
    const d = districtAt(x, y);
    if (PLAN.lots.has(k) && d && d <= this.city.openDistricts) return this.onTap?.({ kind: 'lot', slot: k, ...at });
    if (d && d > this.city.openDistricts) return this.onTap?.({ kind: 'locked', district: d, ...at });
    this.onTap?.({ kind: 'none', ...at });
  }

  view(cam = this.cam) {
    const hw = this.vw / 2 / cam.z, hh = this.vh / 2 / cam.z;
    return { L: cam.x - hw, R: cam.x + hw, T: cam.y - hh, B: cam.y + hh };
  }
  stale() {
    const L = this.layerCam, c = this.cam;
    const s = c.z / L.z;
    const dx = Math.abs(L.x - c.x) * c.z, dy = Math.abs(L.y - c.y) * c.z;
    return s < 0.6 || s > 2.4 || dx > this.vw * 0.4 || dy > this.vh * 0.35;
  }
  // Pixel interi: il buffer è grande quanto lo schermo diviso per q, poi si ingrandisce di q senza sfumare.
  pixelScale() {
    const n = this.cam.z * this.dpr;
    const q = n >= 1 ? Math.max(1, Math.round(n)) : 1;
    return { q, s: n / q };
  }
  fast() {
    const L = this.layerCam, c = this.cam, d = this.dpr;
    const s = c.z / L.z;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#a9d4e6'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.imageSmoothingEnabled = false;
    g.setTransform(s, 0, 0, s, d * ((this.vw / 2) * (1 - s) + (L.x - c.x) * c.z), d * ((this.vh / 2) * (1 - s) + (L.y - c.y) * c.z));
    g.drawImage(this.layer, 0, 0, this.layer.width * L.q, this.layer.height * L.q);
    this.worldTransform(g, c.z * d);
    this.drawAvatars(g, this.opts.night, false);
    drawClouds(g, c, this.vw, this.vh, d, this.still ? 0 : this.now, this.opts.night);
  }
  worldTransform(g, scale, w = this.cv.width, h = this.cv.height) {
    g.setTransform(scale, 0, 0, scale, w / 2 - this.cam.x * scale, h / 2 - this.cam.y * scale);
  }

  render(t, full) {
    if (!this.city) return;
    const { q, s } = this.pixelScale();
    const bw = Math.ceil(this.cv.width / q), bh = Math.ceil(this.cv.height / q);
    for (const cv of [this.layer, this.frame]) if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; full = true; }
    const o = { ...this.opts, t, born: this.born, z: this.cam.z, detail: this.cam.z * this.dpr >= 0.75 };
    const view = this.view();
    if (full) {
      const lg = this.layer.getContext('2d');
      lg.setTransform(1, 0, 0, 1, 0, 0);
      const sky = lg.createLinearGradient(0, 0, 0, bh);
      sky.addColorStop(0, o.night ? '#1b2340' : '#c7e7f2'); sky.addColorStop(1, o.night ? '#2a3557' : '#9ccbe0');
      lg.fillStyle = sky; lg.fillRect(0, 0, bw, bh);
      this.worldTransform(lg, s, bw, bh);
      const res = drawWorld(lg, this.city, view, o);
      this.objects = res.objects;
      this.labels = res.labels;
      this.layerCam = { ...this.cam, q };
    }
    // Fotogramma: strato fisso, poi acqua, auto e omini nello stesso buffer (stessi pixel).
    const fg = this.frame.getContext('2d');
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.drawImage(this.layer, 0, 0);
    this.worldTransform(fg, s, bw, bh);
    drawAmbient(fg, this.city, view, o, this.still ? 0 : t);
    if (this.opts.mode === 'choose') {
      const pulse = 0.5 + 0.5 * Math.sin(t / 300);
      fg.fillStyle = `rgba(255,236,160,${0.25 + pulse * 0.3})`;
      for (const [x, y] of visibleTiles(view)) {
        const k = key(x, y);
        if (!PLAN.lots.has(k) || this.city.houses[k] || districtAt(x, y) > this.city.openDistricts) continue;
        diamond(fg, isoX(x, y), isoY(x, y) - elev(this.levelOf(x, y)), 4); fg.fill();
      }
    }
    this.drawAvatars(fg, o.night, true);
    // Sullo schermo: ingrandimento a pixel interi, poi scritte e nuvole a piena risoluzione.
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.frame, 0, 0, bw * q, bh * q);
    this.overlay(g, t, o);
    drawClouds(g, this.cam, this.vw, this.vh, this.dpr, this.still ? 0 : t, o.night);
  }

  // Etichette, selezione, nuvolette e scintille: a piena risoluzione, sopra i pixel.
  overlay(g, t, o) {
    this.worldTransform(g, this.cam.z * this.dpr);
    g.imageSmoothingEnabled = true;
    const z = this.cam.z;
    if (o.selected) {
      const [x, y] = parseKey(o.selected);
      g.save(); g.lineWidth = 2.5 / z; g.strokeStyle = this.city.houses[o.selected] ? '#ffd34d' : '#d4462f';
      diamond(g, isoX(x, y), isoY(x, y) - elev(this.levelOf(x, y)), 2); g.stroke(); g.restore();
    }
    // Come in Habbo i nomi stanno sugli omini; sulle case solo su quella selezionata.
    for (const l of this.labels) if (l.slot === o.selected) label(g, l.x, l.y + 4, l.text, l.me, z);
    for (const a of this.avatars.values()) {
      const [x, y] = this.avatarScreen(a);
      if (a.me) {
        const bob = Math.sin(t / 300) * 1.5;
        g.fillStyle = '#ffd34d'; g.strokeStyle = 'rgba(60,40,0,0.6)'; g.lineWidth = 1 / z;
        g.beginPath(); g.moveTo(x - 4, y - 60 + bob); g.lineTo(x + 4, y - 60 + bob); g.lineTo(x, y - 54 + bob); g.closePath(); g.fill(); g.stroke();
      }
      if (a.me || z * this.dpr >= 3) label(g, x, y + 8, a.name, a.me, z);
      if (a.bubble) {
        const age = t - a.bubble.t0;
        if (age > 6500) { a.bubble = null; continue; }
        bubble(g, x, y - 62 - Math.min(age / 900, 1) * 4, a.name, a.bubble.text, z, age > 5800 ? 1 - (age - 5800) / 700 : 1);
      }
    }
    for (const [slot, t0] of this.born) {
      const [x, y] = parseKey(slot);
      if (t - t0 < 1400) sparkle(g, isoX(x + 0.5, y + 0.5), isoY(x + 0.5, y + 0.5) - elev(1) - 20, t - t0);
    }
  }
}

// Nomi a dimensione fissa sullo schermo, accorciati per non sovrapporsi.
function label(g, x, y, text, mine, z = 1) {
  g.save();
  const fs = 11 / z;
  g.font = `800 ${fs}px Nunito, "Trebuchet MS", sans-serif`;
  const maxW = 84 / z;
  let t = text;
  if (g.measureText(t).width > maxW) { while (t.length > 3 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; }
  const w = g.measureText(t).width + fs, hgt = fs * 1.5;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.roundRect(x - w / 2, y - hgt / 2 + 1 / z, w, hgt, 3 / z); g.fill();
  g.fillStyle = mine ? '#ffd34d' : 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(x - w / 2, y - hgt / 2, w, hgt, 3 / z); g.fill();
  g.strokeStyle = 'rgba(30,22,16,0.7)'; g.lineWidth = 1 / z; g.stroke();
  g.fillStyle = '#1f1f1f'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(t, x, y + fs * 0.05);
  g.restore();
}
// Nuvoletta alla Habbo: riquadro bianco con bordo nero, nome in grassetto e messaggio.
function bubble(g, x, y, name, text, z, alpha) {
  g.save();
  g.globalAlpha = Math.max(0, alpha);
  const fs = 12 / z;
  g.font = `800 ${fs}px Nunito, sans-serif`;
  const nw = g.measureText(name + ': ').width;
  g.font = `600 ${fs}px Nunito, sans-serif`;
  let t = text;
  const maxW = 220 / z;
  if (nw + g.measureText(t).width > maxW) { while (t.length > 2 && nw + g.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; }
  const w = nw + g.measureText(t).width + fs * 1.4, hgt = fs * 2;
  const bx = x - w / 2, by = y - hgt;
  g.fillStyle = '#ffffff'; g.strokeStyle = '#1f1f1f'; g.lineWidth = 1.5 / z;
  g.beginPath(); g.roundRect(bx, by, w, hgt, 5 / z); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 4 / z, by + hgt - 0.8 / z); g.lineTo(x, by + hgt + 6 / z); g.lineTo(x + 4 / z, by + hgt - 0.8 / z); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x - 4 / z, by + hgt); g.lineTo(x, by + hgt + 6 / z); g.lineTo(x + 4 / z, by + hgt); g.stroke();
  g.textBaseline = 'middle'; g.fillStyle = '#1f1f1f';
  g.font = `800 ${fs}px Nunito, sans-serif`; g.fillText(name + ':', bx + fs * 0.7, by + hgt / 2);
  g.font = `600 ${fs}px Nunito, sans-serif`; g.fillText(t, bx + fs * 0.7 + nw, by + hgt / 2);
  g.restore();
}
function sparkle(g, x, y, age) {
  const p = age / 1400;
  g.save(); g.globalAlpha = 1 - p;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + p, r = 8 + p * 30;
    g.fillStyle = i % 2 ? '#fff3b0' : '#ffffff';
    g.fillRect(x + Math.cos(a) * r - 1.5, y + Math.sin(a) * r * 0.6 - 1.5, 3, 3);
  }
  g.restore();
}
function easeOutBack(p) { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

/* Anteprima della casa e cartoline per Instagram -------------------------- */

export function drawPreview(canvas, style, { cantiere = false } = {}) {
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#d7eef7'); sky.addColorStop(1, '#b6dcea');
  g.fillStyle = sky; g.fillRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 104;
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height * 0.5);
  // Un piccolo pezzo di terreno sospeso, con la casa al centro e il vialetto davanti
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const sx = (dx - dy) * 32, sy = (dx + dy) * 16;
    diamond(g, sx, sy); g.fillStyle = dy === 1 ? '#c7b28a' : '#9fcf6c'; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1; g.stroke();
  }
  const edge = (a, b, c1) => { poly(g, [a, b, add(b, 0, 14), add(a, 0, 14)]); g.fillStyle = c1; g.fill(); };
  edge([-96, 48], [-64, 64], '#b98b5c'); edge([-64, 64], [0, 96], '#b98b5c'); edge([0, 96], [96, 48], '#8a6240');
  drawHouse(g, style, 0, 0, { cantiere, door: 'S' });
}

export async function renderPoster(city, news, format = 'post') {
  try { await Promise.all([document.fonts.load('400 80px "Abril Fatface"'), document.fonts.load('700 40px Nunito'), document.fonts.load('600 40px Fredoka')]); } catch { /* caratteri di riserva */ }
  const Wp = 1080, Hp = format === 'story' ? 1920 : 1350;
  const cv = document.createElement('canvas');
  cv.width = Wp; cv.height = Hp;
  const g = cv.getContext('2d');
  const ink = '#1f2a26', red = '#b8322a';
  g.fillStyle = '#f6f1e3'; g.fillRect(0, 0, Wp, Hp);
  const top = format === 'story' ? 150 : 60;
  g.fillStyle = ink; g.textAlign = 'center';
  g.font = '400 96px "Abril Fatface", Georgia, serif';
  g.fillText(CITY.toUpperCase(), Wp / 2, top + 90);
  g.fillStyle = red; g.fillRect(70, top + 118, Wp - 140, 6);
  g.fillStyle = ink; g.font = '700 30px Nunito, sans-serif';
  const date = new Date(news.at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(`${PAPER.toUpperCase()}  ·  ${date.toUpperCase()}`, Wp / 2, top + 166);
  g.fillRect(70, top + 190, Wp - 140, 2);
  const mapY = top + 220, mapH = format === 'story' ? 900 : 640, mapX = 70, mapW = Wp - 140;
  const [fx, fy] = news.slot ? parseKey(news.slot) : FOUNTAIN_TILE;
  const z = 2;
  const [cx, cy] = tileCenter(fx, fy, levelAt(fx, fy, city.openDistricts));
  g.save();
  g.beginPath(); g.rect(mapX, mapY, mapW, mapH); g.clip();
  const sky = g.createLinearGradient(0, mapY, 0, mapY + mapH);
  sky.addColorStop(0, '#c7e7f2'); sky.addColorStop(1, '#9ccbe0');
  g.fillStyle = sky; g.fillRect(mapX, mapY, mapW, mapH);
  g.setTransform(z, 0, 0, z, mapX + mapW / 2 - cx * z, mapY + mapH / 2 - (cy - 10) * z);
  const view = { L: cx - mapW / 2 / z, R: cx + mapW / 2 / z, T: cy - mapH / 2 / z, B: cy + mapH / 2 / z };
  const o = { selected: null, t: 0, detail: true };
  drawWorld(g, city, view, o);
  drawAmbient(g, city, view, o, 4200);
  g.restore();
  g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(mapX, mapY, mapW, mapH);
  const f = formatNews(news, city);
  g.textAlign = 'left'; g.fillStyle = ink;
  g.font = '400 64px "Abril Fatface", Georgia, serif';
  let y = wrap(g, f.title, 70, mapY + mapH + 100, Wp - 140, 74);
  g.font = '600 36px Nunito, sans-serif'; g.fillStyle = '#3b4642';
  y = wrap(g, f.text, 70, y + 30, Wp - 140, 50);
  g.fillStyle = red; g.fillRect(0, Hp - (format === 'story' ? 210 : 110), Wp, format === 'story' ? 210 : 110);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '700 38px Fredoka, Nunito, sans-serif';
  g.fillText('Vieni ad abitare qui · link in bio', Wp / 2, Hp - (format === 'story' ? 130 : 45));
  return cv;
}
function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) g.fillText(line, x, y);
  return y;
}
