// Disegno della città su canvas, tutto vettoriale così resta nitido a ogni zoom: campagna a campi,
// strade con marciapiedi e sampietrini, case in vista tre quarti con persiane e tetti in coppi,
// alberi italiani, piazza, mare. Uno strato fisso si ridisegna solo quando cambia qualcosa;
// sopra, uno strato leggero anima onde, fontana, barche e automobili.
import {
  W, H, MAIN_Y, SEA_Y, PIAZZA, DISTRICTS, PLAN, ROOFS, DOORS, FOUNTAIN_AT,
  key, parseKey, districtAt, districtById, inPiazza, builtCount, isFounder, formatNews, CITY, PAPER, levelAt, hash, walkPath,
} from './core.js';

export const T = 32; // lato di una casella in unità del mondo
const PS = 6;        // risoluzione delle trame: pixel per unità del mondo
const BAR_AT = 50;   // al traguardo dei 50 abitanti in piazza arrivano i tavolini del bar

const roofColor = (id) => (ROOFS.find((r) => r.id === id) || ROOFS[0]).color;
const doorColor = (id) => (DOORS.find((r) => r.id === id) || DOORS[0]).color;

/* Colori e rumore ------------------------------------------------------- */

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]) {
  const f = (c) => Math.max(0, Math.min(255, Math.round(c)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function shade(hex, amt) {
  const c = rgb(hex);
  return toHex(c.map((v) => v + amt * 255));
}
// Hash intero veloce e rumore morbido, per variazioni naturali e sempre uguali.
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

/* Trame (create una volta per contesto, ad alta risoluzione) ----------- */

const patternCache = new WeakMap();
function makePattern(g, w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * PS);
  cv.height = Math.round(h * PS);
  const c = cv.getContext('2d');
  c.scale(PS, PS);
  draw(c, w, h);
  const p = g.createPattern(cv, 'repeat');
  if (p && typeof p.setTransform === 'function') p.setTransform(new DOMMatrix([1 / PS, 0, 0, 1 / PS, 0, 0]));
  return p;
}
function pats(g) {
  let p = patternCache.get(g);
  if (p) return p;
  p = {};
  p.grass = makePattern(g, 32, 32, (c) => {
    for (let i = 0; i < 46; i++) {
      const x = ih(i, 1, 9) * 32, y = ih(i, 2, 9) * 32, l = 1.2 + ih(i, 3, 9) * 1.6;
      c.strokeStyle = ih(i, 4, 9) > 0.5 ? 'rgba(40,90,30,0.22)' : 'rgba(255,255,220,0.2)';
      c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (ih(i, 5, 9) - 0.5) * 1.2, y - l); c.stroke();
    }
  });
  p.asphalt = makePattern(g, 24, 24, (c) => {
    for (let i = 0; i < 70; i++) {
      c.fillStyle = ih(i, 7, 3) > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      c.fillRect(ih(i, 8, 3) * 24, ih(i, 9, 3) * 24, 0.5 + ih(i, 1, 3) * 0.6, 0.5 + ih(i, 2, 3) * 0.6);
    }
  });
  // Sampietrini: file sfalsate di pietre arrotondate.
  p.cobble = makePattern(g, 12, 6, (c) => {
    c.fillStyle = '#a9946f'; c.fillRect(0, 0, 12, 6);
    for (let r = 0; r < 2; r++) {
      for (let k = -1; k < 4; k++) {
        const x = k * 3.2 + (r ? 1.6 : 0) + 0.2, y = r * 3 + 0.25;
        const t = ih(k + 5, r, 11);
        c.fillStyle = mix('#d9c8a3', '#c3ad85', t);
        c.beginPath(); c.roundRect(x, y, 2.8, 2.5, 0.9); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + 0.5, y + 0.4, 1.4, 0.45);
      }
    }
  });
  // Lastricato della piazza: lastre grandi sfalsate.
  p.paving = makePattern(g, 32, 20, (c) => {
    c.fillStyle = '#cdbd9f'; c.fillRect(0, 0, 32, 20);
    for (let r = 0; r < 2; r++) {
      for (let k = -1; k < 4; k++) {
        const x = k * 10 + (r ? 5 : 0) + 0.3, y = r * 10 + 0.3;
        c.fillStyle = mix('#ece1cb', '#dccfb4', ih(k + 3, r, 21));
        c.fillRect(x, y, 9.4, 9.4);
        c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(x, y, 9.4, 0.6);
      }
    }
  });
  p.sand = makePattern(g, 16, 16, (c) => {
    for (let i = 0; i < 40; i++) {
      c.fillStyle = ih(i, 3, 5) > 0.5 ? 'rgba(160,120,60,0.18)' : 'rgba(255,255,255,0.3)';
      c.fillRect(ih(i, 1, 5) * 16, ih(i, 2, 5) * 16, 0.5, 0.5);
    }
  });
  p.water = makePattern(g, 48, 24, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.13)';
    c.lineWidth = 0.6;
    for (let i = 0; i < 7; i++) {
      const x = ih(i, 1, 13) * 48, y = ih(i, 2, 13) * 24;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3, y - 1.2, x + 6, y); c.stroke();
    }
  });
  p.stucco = makePattern(g, 10, 10, (c) => {
    for (let i = 0; i < 18; i++) {
      c.fillStyle = ih(i, 3, 17) > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
      c.fillRect(ih(i, 1, 17) * 10, ih(i, 2, 17) * 10, 0.6, 0.6);
    }
  });
  // Tetto in coppi: file di tegole curve, da sovrapporre al colore del tetto.
  p.roof = makePattern(g, 3, 2.2, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(0, 1.75, 3, 0.45);
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 0.25;
    c.beginPath(); c.moveTo(1.5, 0); c.lineTo(1.5, 1.8); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(0.2, 0.15, 1, 0.5); c.fillRect(1.7, 0.15, 1, 0.5);
  });
  // Campi: file di coltivazione orizzontali o verticali.
  for (const [crop, base, row, extra] of [
    ['wheat', '#e3c76d', '#cfae4f', 'rgba(255,240,180,0.35)'],
    ['vine', '#c8b285', '#5f8f3c', '#7aa94f'],
    ['green', '#b8d074', '#97b556', 'rgba(255,255,255,0.15)'],
    ['plow', '#b98f66', '#9b724d', 'rgba(255,230,200,0.15)'],
  ]) {
    for (const dir of ['h', 'v']) {
      p[`${crop}-${dir}`] = makePattern(g, 16, 16, (c) => {
        c.fillStyle = base; c.fillRect(0, 0, 16, 16);
        if (dir === 'v') { c.translate(16, 0); c.rotate(Math.PI / 2); }
        for (let r = 0; r < 4; r++) {
          const y = r * 4 + 1.2;
          if (crop === 'vine') {
            c.fillStyle = 'rgba(90,60,30,0.35)'; c.fillRect(0, y + 1.2, 16, 0.35);
            for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? row : extra; c.beginPath(); c.arc(k * 2.7 + 1.3, y + 1, 1.15, 0, 7); c.fill(); }
          } else {
            c.fillStyle = row; c.fillRect(0, y, 16, 1.5);
            c.fillStyle = extra; c.fillRect(0, y + 1.6, 16, 0.6);
            if (crop === 'wheat') for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(160,120,40,0.35)'; c.fillRect(k * 2 + 0.5, y - 0.6, 0.35, 0.8); }
            if (crop === 'green') for (let k = 0; k < 5; k++) { c.fillStyle = '#7fa646'; c.beginPath(); c.arc(k * 3.2 + 1.6, y + 0.7, 0.9, 0, 7); c.fill(); }
          }
        }
      });
    }
  }
  patternCache.set(g, p);
  return p;
}

/* Terreno e alberi (calcolati una volta per numero di quartieri aperti) --- */

const CROPS = ['wheat', 'wheat', 'vine', 'green', 'plow', 'olive', 'wheat', 'vine'];
const groundCache = new Map();

function getGround(open) {
  if (groundCache.has(open)) return groundCache.get(open);
  const kind = new Uint8Array(W * H);  // 0 erba quartiere, 1 prato, 2 campo, 3 spiaggia, 4 mare, 5 uliveto
  const color = new Array(W * H);
  const crop = new Array(W * H);
  const parcel = new Int32Array(W * H);
  const trees = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = districtAt(x, y);
      const n = vnoise(x / 7, y / 7, 1);
      const j = (ih(x, y, 2) - 0.5) * 0.08;
      if (y > SEA_Y) {
        kind[i] = 4;
        color[i] = mix('#86cfe2', '#3c8cbb', clamp01((y - SEA_Y - 1) / 6 + (vnoise(x / 5, y / 3, 4) - 0.5) * 0.25));
      } else if (y === SEA_Y) {
        kind[i] = 3;
        color[i] = mix('#f1dea9', '#e8d197', ih(x, y, 3));
      } else if (d && d <= open) {
        kind[i] = 0;
        color[i] = mix('#b6d987', '#90bf68', clamp01(n + j));
      } else if (d) {
        // Campagna dei quartieri futuri: appezzamenti a mosaico.
        const px = Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6), py = Math.floor(y / 4);
        const c = CROPS[Math.floor(ih(px, py, 7) * CROPS.length)];
        parcel[i] = px * 1000 + py;
        crop[i] = c === 'olive' ? 'olive' : `${c}-${ih(px, py, 8) > 0.5 ? 'h' : 'v'}`;
        kind[i] = c === 'olive' ? 5 : 2;
        color[i] = c === 'olive' ? mix('#c3d394', '#aac07c', n) : { wheat: '#e3c76d', vine: '#c8b285', green: '#b8d074', plow: '#b98f66' }[c];
        if (c === 'olive' && x % 2 === 0 && y % 2 === 1 && !PLAN.futureRoads.has(key(x, y))) {
          trees.push({ x: x * T + 16 + (ih(x, y, 9) - 0.5) * 8, y: y * T + 26, kind: 'ulivo', s: 0.8 + ih(x, y, 10) * 0.25 });
        }
      } else {
        kind[i] = 1;
        color[i] = mix('#a9d27a', '#7fae58', clamp01(n + j));
      }
    }
  }
  // Boschi e filari fuori dal piano regolatore.
  for (let y = 0; y < SEA_Y; y++) {
    for (let x = 0; x < W; x++) {
      if (districtAt(x, y) || Math.abs(y - MAIN_Y) <= 0) continue;
      const tx = x * T + 16 + (ih(x, y, 11) - 0.5) * 14, ty = y * T + 20 + (ih(x, y, 12) - 0.5) * 12;
      if (Math.abs(y - MAIN_Y) === 1) {
        // Cipressi lungo la strada principale, come nelle strade di campagna toscane.
        if (x % 2 === 0) trees.push({ x: x * T + 16, y: y === MAIN_Y - 1 ? y * T + 27 : y * T + 30, kind: 'cipresso', s: 0.95 + ih(x, y, 13) * 0.2 });
        continue;
      }
      const forest = vnoise(x / 5, y / 5, 6);
      const p = forest > 0.58 ? 0.8 : 0.07;
      if (ih(x, y, 14) > p) continue;
      const kindT = y >= SEA_Y - 6 ? 'pino' : ih(x, y, 15) > 0.78 ? 'cipresso' : 'tondo';
      trees.push({ x: tx, y: ty, kind: kindT, s: 0.85 + ih(x, y, 16) * 0.4 });
    }
  }
  // Pini marittimi sulla costa della Marina, fuori dai lotti.
  for (let x = 0; x < W; x += 1) {
    const y = SEA_Y - 1;
    if (districtAt(x, y) && districtAt(x, y) <= open) continue;
    if (ih(x, y, 17) > 0.35) continue;
    trees.push({ x: x * T + 16, y: y * T + 28, kind: 'pino', s: 0.9 + ih(x, y, 18) * 0.3 });
  }
  const level = new Int8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) level[y * W + x] = levelAt(x, y, open);
  // In alto e in montagna l'erba è più scura e fitta di pini e cipressi.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, L = level[i];
    if (L >= 2 && kind[i] === 1) {
      color[i] = mix(color[i], L === 3 ? '#5f8f4a' : '#7aa85a', 0.55);
      if (ih(x, y, 77) < (L === 3 ? 0.55 : 0.35)) trees.push({ x: x * T + 16 + (ih(x, y, 78) - 0.5) * 10, y: y * T + 24, kind: ih(x, y, 79) > 0.5 ? 'cipresso' : 'tondo', s: 0.9 + ih(x, y, 80) * 0.35 });
    }
  }
  const gcache = { kind, color, crop, parcel, trees, level };
  groundCache.set(open, gcache);
  return gcache;
}

// Scarpate tra un livello e l'altro, viste di fronte come nei Pokémon: sul lato sud di ogni gradone
// si vede la parete (muro di pietra per il paese, roccia e terra per colline e montagne),
// con l'ombra sotto e verso est. Dove passa una strada al posto della parete c'è una scalinata.
const STEP_H = 13;
function drawCliffs(g, G, roads, view, det) {
  const { x0, y0, x1, y1 } = view;
  const L = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : G.level[y * W + x]);
  // Bordo luminoso in cima ai gradoni (nord e ovest, da dove viene la luce).
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const l = L(x, y);
    if (l <= 0) continue;
    g.fillStyle = 'rgba(255,250,220,0.5)';
    if (L(x, y - 1) < l) g.fillRect(x * T, y * T, T, 1.4);
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const here = L(x, y), up = L(x, y - 1);
      const px = x * T, py = y * T;
      if (L(x - 1, y) > here) {
        const sh = g.createLinearGradient(px, 0, px + 12, 0);
        sh.addColorStop(0, 'rgba(25,35,15,0.3)'); sh.addColorStop(1, 'rgba(25,35,15,0)');
        g.fillStyle = sh; g.fillRect(px, py, 12, T);
      }
      if (up <= here) continue;
      const hgt = Math.min(T * 0.85, (up - here) * STEP_H);
      const stairs = roads[key(x, y)] && roads[key(x, y - 1)];
      // Ombra portata ai piedi della parete
      const sh = g.createLinearGradient(0, py + hgt, 0, py + hgt + 14);
      sh.addColorStop(0, 'rgba(25,35,15,0.38)'); sh.addColorStop(1, 'rgba(25,35,15,0)');
      g.fillStyle = sh; g.fillRect(px, py + hgt, T, 14);
      if (stairs) { drawStairs(g, px, py, hgt, roads[key(x, y)], det); continue; }
      if (here === -1) {
        // Riva: la sabbia scende nel mare.
        const rg = g.createLinearGradient(0, py, 0, py + 8);
        rg.addColorStop(0, '#d9c28c'); rg.addColorStop(1, '#a98f5e');
        g.fillStyle = rg; g.fillRect(px, py, T, 8);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(px, py + 7, T, 1.4);
        continue;
      }
      const town = up === 1 && here < 1;
      const top = town ? '#dcc8a2' : '#b98b5c', bottom = town ? '#a48c66' : '#7b5636';
      const wg = g.createLinearGradient(0, py, 0, py + hgt);
      wg.addColorStop(0, top); wg.addColorStop(1, bottom);
      g.fillStyle = wg; g.fillRect(px, py, T, hgt);
      if (det) {
        if (town) {
          g.strokeStyle = 'rgba(90,70,40,0.35)'; g.lineWidth = 0.4;
          for (let r = 0; r * 3.4 < hgt - 1; r++) for (let k = 0; k < 6; k++) g.strokeRect(px + k * 7 + (r % 2) * 3.5 - 3.5, py + 1 + r * 3.4, 7, 3.4);
        } else {
          // Roccia: venature verticali e qualche sasso.
          for (let k = 0; k < 7; k++) {
            const vx = px + 2 + k * 4.4 + (ih(x, k, 90) - 0.5) * 2;
            g.fillStyle = 'rgba(60,35,15,0.28)'; g.fillRect(vx, py + 3 + ih(x, k, 91) * 3, 0.9, hgt - 6 - ih(x, k, 92) * 4);
            g.fillStyle = 'rgba(255,230,190,0.18)'; g.fillRect(vx + 1, py + 3, 0.6, hgt - 8);
          }
          for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(70,45,25,0.35)'; g.beginPath(); g.ellipse(px + 5 + ih(x, y + k, 93) * 22, py + hgt - 2.5, 2.2, 1.2, 0, 0, 7); g.fill(); }
        }
      }
      // Orlo superiore: muretto chiaro per il paese, erba che sporge per le alture.
      if (town) { g.fillStyle = '#f0e4c8'; g.fillRect(px, py, T, 1.6); }
      else {
        g.fillStyle = G.color[(y - 1) * W + x] || '#7aa85a';
        g.beginPath(); g.moveTo(px, py);
        for (let k = 0; k <= 8; k++) g.lineTo(px + k * 4, py + 1.8 + (k % 2 ? 1.6 : 0.4));
        g.lineTo(px + T, py); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(30,20,10,0.35)'; g.fillRect(px, py + hgt - 0.8, T, 0.8);
    }
  }
}
function drawStairs(g, px, py, hgt, type, det) {
  const w = (type === 'lane' ? 0.42 : type === 'piazza' ? 1 : type === 'main' ? 0.96 : 0.8) * T;
  const x = px + (T - w) / 2;
  const n = Math.max(3, Math.round(hgt / 2.6));
  for (let i = 0; i < n; i++) {
    const sy = py + (i * hgt) / n;
    g.fillStyle = i % 2 ? '#cbbd9f' : '#ddd1b8';
    g.fillRect(x, sy, w, hgt / n + 0.3);
    g.fillStyle = 'rgba(80,60,35,0.35)'; g.fillRect(x, sy + hgt / n - 0.5, w, 0.5);
  }
  // Muretti laterali della scala
  g.fillStyle = '#a48c66'; g.fillRect(x - 1.6, py, 1.6, hgt); g.fillRect(x + w, py, 1.6, hgt);
  if (det) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 1.6, py, 0.5, hgt); }
}

function drawGround(g, G, view, det) {
  const P = det ? pats(g) : null;
  const { x0, y0, x1, y1 } = view;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const px = x * T, py = y * T;
      g.fillStyle = G.color[i];
      g.fillRect(px, py, T + (P ? 0.5 : 2), T + (P ? 0.5 : 2));
      if (!P) continue;
      const k = G.kind[i];
      if (k === 0 || k === 1 || k === 5) {
        g.fillStyle = P.grass; g.fillRect(px, py, T, T);
        if (k !== 5 && ih(x, y, 20) > 0.86) flowers(g, px, py, ih(x, y, 21));
      } else if (k === 2) {
        g.fillStyle = P[G.crop[i]]; g.fillRect(px, py, T, T);
      } else if (k === 3) {
        g.fillStyle = P.sand; g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(190,160,100,0.35)'; g.fillRect(px, py + T - 7, T, 3);
      } else if (k === 4) {
        g.fillStyle = P.water; g.fillRect(px, py, T, T);
      }
    }
  }
  if (!P) return;
  // Siepi tra un campo e l'altro.
  g.fillStyle = '#6f9a4f';
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (G.kind[i] !== 2 && G.kind[i] !== 5) continue;
      if (x + 1 < W && (G.kind[i + 1] === 2 || G.kind[i + 1] === 5) && G.parcel[i + 1] !== G.parcel[i]) hedge(g, x * T + T - 1.5, y * T, 3, T);
      if (y + 1 < H && (G.kind[i + W] === 2 || G.kind[i + W] === 5) && G.parcel[i + W] !== G.parcel[i]) hedge(g, x * T, y * T + T - 1.5, T, 3);
    }
  }
}
function hedge(g, x, y, w, h) {
  g.fillStyle = '#5f8d44'; g.beginPath(); g.roundRect(x, y, w, h, 1.5); g.fill();
  g.fillStyle = 'rgba(160,210,110,0.4)';
  g.fillRect(x + (w > h ? 0 : 0.5), y + (w > h ? 0.4 : 0), w > h ? w : 1, w > h ? 0.8 : h);
}
function flowers(g, px, py, r) {
  const cols = ['#ffffff', '#f6d84a', '#e86b8a', '#b48be0'];
  for (let k = 0; k < 4; k++) {
    g.fillStyle = cols[(k + Math.floor(r * 4)) % 4];
    g.beginPath(); g.arc(px + 6 + ih(k, r * 100, 1) * 20, py + 6 + ih(k, r * 100, 2) * 20, 0.9, 0, 7); g.fill();
  }
}

/* Alberi ------------------------------------------------------------------ */

function treeShadow(g, x, y, rx) {
  g.fillStyle = 'rgba(30,50,20,0.22)';
  g.beginPath(); g.ellipse(x + 4, y + 0.5, rx, rx * 0.36, 0, 0, Math.PI * 2); g.fill();
}
function drawTree(g, t, det) {
  const { x, y, s } = t;
  if (t.kind === 'cipresso') {
    treeShadow(g, x + 2, y, 5 * s);
    g.fillStyle = '#2c5537';
    g.beginPath(); g.ellipse(x, y - 14 * s, 4.4 * s, 14.5 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d7049';
    g.beginPath(); g.ellipse(x - 1.3 * s, y - 15 * s, 2.3 * s, 12.5 * s, 0, 0, Math.PI * 2); g.fill();
    if (det) { g.fillStyle = 'rgba(160,220,140,0.25)'; g.beginPath(); g.ellipse(x - 1.8 * s, y - 19 * s, 0.9 * s, 6 * s, 0, 0, 7); g.fill(); }
  } else if (t.kind === 'pino') {
    treeShadow(g, x + 5, y, 10 * s);
    g.strokeStyle = '#6b4a2f'; g.lineWidth = 2.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 1 * s, y - 10 * s, x + 2.5 * s, y - 17 * s); g.stroke();
    g.fillStyle = '#365f36';
    g.beginPath(); g.ellipse(x + 2.5 * s, y - 19 * s, 12 * s, 5.8 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4f8248';
    g.beginPath(); g.ellipse(x + 1 * s, y - 20.5 * s, 8.5 * s, 3.6 * s, 0, 0, Math.PI * 2); g.fill();
    if (det) { g.fillStyle = 'rgba(190,230,150,0.3)'; g.beginPath(); g.ellipse(x - 1 * s, y - 21.5 * s, 4 * s, 1.4 * s, 0, 0, 7); g.fill(); }
  } else if (t.kind === 'ulivo') {
    treeShadow(g, x, y, 7 * s);
    g.strokeStyle = '#76604a'; g.lineWidth = 1.8 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2 * s, y - 4 * s, x - 0.5 * s, y - 8 * s); g.moveTo(x + 0.6 * s, y - 3 * s); g.lineTo(x + 3 * s, y - 7 * s); g.stroke();
    for (const [dx, dy, r, c] of [[-2.5, -10, 5, '#8fa36e'], [3, -10.5, 4.6, '#8fa36e'], [0, -13, 5, '#9db37c'], [-1.5, -13.8, 2.6, '#bccb9d']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill();
    }
  } else if (t.kind === 'cespuglio') {
    treeShadow(g, x, y, 5 * s);
    for (const [dx, dy, r, c] of [[-2.5, -3, 3.6, '#4f8a45'], [2.5, -3, 3.4, '#4f8a45'], [0, -5, 3.8, '#62a052'], [-1, -6.4, 1.6, '#86bd6c']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill();
    }
  } else {
    treeShadow(g, x, y, 9 * s);
    g.fillStyle = '#76533a'; g.fillRect(x - 1.4 * s, y - 8 * s, 2.8 * s, 8 * s);
    for (const [dx, dy, r, c] of [[0, -13, 8.5, '#3f7a3b'], [-3.5, -15, 6.2, '#4f8c45'], [3.6, -12, 5.8, '#4a8541'], [-0.5, -17.5, 5.4, '#5c9c50'], [-3.2, -17, 2.8, '#7cb766']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill();
    }
    if (det) {
      g.fillStyle = 'rgba(200,240,160,0.35)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (ih(k, x | 0, 3) - 0.6) * 9 * s, y + (-18 + ih(k, y | 0, 4) * 8) * s, 0.8 * s, 0, 7); g.fill(); }
    }
  }
}

/* Strade ------------------------------------------------------------------ */

// Ogni tipo ha un bordo (marciapiede o cordolo) e una superficie.
const ROAD = {
  main: { side: 0.96, surf: 0.66, sideColor: '#d8d1c3', surfColor: '#5b5f66' },
  dorsal: { side: 0.8, surf: 0.54, sideColor: '#d8d1c3', surfColor: '#62666d' },
  lane: { side: 0.42, surf: 0.34, sideColor: '#a8936d', surfColor: '#d6c49f' },
};

function roadPass(g, roads, view, types, layer, fill) {
  const { x0, y0, x1, y1 } = view;
  g.fillStyle = fill;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = roads[key(x, y)];
      if (!types.includes(t)) continue;
      const w = ROAD[t][layer] * T;
      const cx = x * T + T / 2, cy = y * T + T / 2;
      g.beginPath();
      g.roundRect(cx - w / 2, cy - w / 2, w, w, t === 'lane' ? w / 3 : 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = roads[key(x + dx, y + dy)];
        if (!n || n === 'piazza') { if (n === 'piazza' && t === 'lane') g.rect(dx ? (dx > 0 ? cx : cx - T / 2) : cx - w / 2, dy ? (dy > 0 ? cy : cy - T / 2) : cy - w / 2, dx ? T / 2 : w, dy ? T / 2 : w); continue; }
        const aw = Math.min(w, ROAD[n][layer] * T);
        if (dx) g.rect(dx > 0 ? cx : cx - T / 2 - 0.3, cy - aw / 2, T / 2 + 0.3, aw);
        else g.rect(cx - aw / 2, dy > 0 ? cy : cy - T / 2 - 0.3, aw, T / 2 + 0.3);
      }
      g.fill();
    }
  }
}

function drawRoads(g, roads, view, det) {
  const P = det ? pats(g) : null;
  roadPass(g, roads, view, ['lane'], 'side', ROAD.lane.sideColor);
  roadPass(g, roads, view, ['lane'], 'surf', P ? P.cobble : ROAD.lane.surfColor);
  roadPass(g, roads, view, ['dorsal', 'main'], 'side', '#c9c1b1');
  if (P) { g.save(); g.translate(0, -0.8); roadPass(g, roads, view, ['dorsal', 'main'], 'side', ROAD.main.sideColor); g.restore(); }
  roadPass(g, roads, view, ['dorsal', 'main'], 'surf', ROAD.main.surfColor);
  if (P) roadPass(g, roads, view, ['dorsal', 'main'], 'surf', P.asphalt);
  curbs(g, roads, view);
  // Segnaletica: tratteggio centrale, linee di bordo, strisce pedonali dove arriva una via.
  const { x0, y0, x1, y1 } = view;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = roads[key(x, y)];
      if (t !== 'main' && t !== 'dorsal') continue;
      const horiz = roads[key(x - 1, y)] === t || roads[key(x + 1, y)] === t;
      const vert = roads[key(x, y - 1)] === t || roads[key(x, y + 1)] === t;
      const cx = x * T + T / 2, cy = y * T + T / 2, hw = (ROAD[t].surf * T) / 2;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      if (horiz && !vert) {
        g.fillRect(x * T + 7, cy - 0.6, 16, 1.2);
        if (det) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x * T, cy - hw + 1.2, T, 0.6); g.fillRect(x * T, cy + hw - 1.8, T, 0.6); }
        // Strisce pedonali dove la strada si attraversa davvero, e davanti alla piazza.
        const side = (dy) => ['lane', 'dorsal'].includes(roads[key(x, y + dy)]);
        if (det && t === 'main' && ((side(-1) && side(1)) || x === PIAZZA.x0 + 3)) {
          g.fillStyle = 'rgba(255,255,255,0.9)';
          for (let k = 0; k < 5; k++) g.fillRect(cx - 5, cy - hw + 1.5 + k * ((hw * 2 - 3) / 5), 10, 2.2);
        }
      } else if (vert && !horiz) {
        g.fillRect(cx - 0.6, y * T + 7, 1.2, 16);
      }
    }
  }
}

// Il marciapiede a nord mostra il suo cordolo e fa ombra sull'asfalto; quello a sud ha il bordo in luce.
function curbs(g, roads, view) {
  const { x0, y0, x1, y1 } = view;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = roads[key(x, y)];
      if (t !== 'main' && t !== 'dorsal') continue;
      const horiz = roads[key(x - 1, y)] === t || roads[key(x + 1, y)] === t;
      const vert = roads[key(x, y - 1)] === t || roads[key(x, y + 1)] === t;
      const hw = (ROAD[t].surf * T) / 2, cx = x * T + T / 2, cy = y * T + T / 2;
      if (horiz && !vert) {
        const openN = roads[key(x, y - 1)] && roads[key(x, y - 1)] !== 'piazza';
        if (!openN) {
          g.fillStyle = '#9d978b'; g.fillRect(x * T, cy - hw, T, 1.6);
          const sh = g.createLinearGradient(0, cy - hw + 1.6, 0, cy - hw + 5);
          sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sh; g.fillRect(x * T, cy - hw + 1.6, T, 3.4);
        }
        if (!roads[key(x, y + 1)]) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x * T, cy + hw - 0.1, T, 0.7); }
      } else if (vert && !horiz) {
        const sh = g.createLinearGradient(cx - hw, 0, cx - hw + 4, 0);
        sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh; g.fillRect(cx - hw, y * T, 4, T);
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(cx + hw - 0.4, y * T, 0.6, T);
      }
    }
  }
}

function drawFutureRoads(g, openDistricts, view) {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 2.4;
  g.setLineDash([7, 6]);
  g.lineCap = 'round';
  for (const d of DISTRICTS) {
    if (!d.dorsal || d.id <= openDistricts) continue;
    const r = d.dorsal;
    g.beginPath();
    if (r.x !== undefined) { if (r.x < view.x0 - 1 || r.x > view.x1 + 1) continue; g.moveTo(r.x * T + T / 2, r.y0 * T); g.lineTo(r.x * T + T / 2, (r.y1 + 1) * T); }
    else { if (r.y < view.y0 - 1 || r.y > view.y1 + 1) continue; g.moveTo(r.x0 * T, r.y * T + T / 2); g.lineTo((r.x1 + 1) * T, r.y * T + T / 2); }
    g.stroke();
  }
  g.restore();
}

/* Piazza ------------------------------------------------------------------ */

export const PIAZZA_SPOTS = {
  edicola: [PIAZZA.x0, PIAZZA.y0],
  muro: [[PIAZZA.x0 + 3, PIAZZA.y0], [PIAZZA.x0 + 4, PIAZZA.y0], [PIAZZA.x0 + 5, PIAZZA.y0]],
};
const FOUNTAIN = { x: (PIAZZA.x0 + 4) * T, y: (PIAZZA.y0 + 1.62) * T };

function drawPiazzaFloor(g, city, det) {
  const px = PIAZZA.x0 * T, py = PIAZZA.y0 * T;
  const w = (PIAZZA.x1 - PIAZZA.x0 + 1) * T, h = (PIAZZA.y1 - PIAZZA.y0 + 1) * T;
  // Gradino verso la strada e ombra a destra: la piazza sta un po' più in alto.
  const psh = g.createLinearGradient(px + w, 0, px + w + 7, 0);
  psh.addColorStop(0, 'rgba(0,0,0,0.22)'); psh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = psh; g.fillRect(px + w, py + 3, 7, h);
  g.fillStyle = det ? pats(g).paving : '#e4d8c0';
  g.fillRect(px, py, w, h);
  g.strokeStyle = '#bba98a'; g.lineWidth = 1.2; g.strokeRect(px + 0.6, py + 0.6, w - 1.2, h - 1.2);
  const step = g.createLinearGradient(0, py + h - 3.2, 0, py + h);
  step.addColorStop(0, '#c4b292'); step.addColorStop(1, '#a8957a');
  g.fillStyle = step; g.fillRect(px, py + h - 3.2, w, 3.2);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(px, py + h - 3.4, w, 0.6);
  // Rosone di pietra attorno alla fontana.
  const { x: fx, y: fy } = FOUNTAIN;
  g.save();
  g.translate(fx, fy); g.scale(1, 0.62);
  g.fillStyle = '#d9c9a8'; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill();
  g.strokeStyle = '#b39d78'; g.lineWidth = 1.4;
  for (const r of [44, 37]) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
  if (det) {
    g.lineWidth = 0.8;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 37, Math.sin(a) * 37); g.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); g.stroke(); }
  }
  g.restore();
  const built = builtCount(city);
  if (built >= FOUNTAIN_AT) {
    g.fillStyle = 'rgba(40,40,30,0.18)'; g.beginPath(); g.ellipse(fx + 3, fy + 3, 30, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#d7cbb2'; g.beginPath(); g.ellipse(fx, fy, 30, 17, 0, 0, 7); g.fill();
    g.fillStyle = '#b9aa8c'; g.beginPath(); g.ellipse(fx, fy + 1.5, 30, 16, 0, 0, Math.PI); g.fill();
    const wg = g.createRadialGradient(fx - 6, fy - 4, 2, fx, fy, 26);
    wg.addColorStop(0, '#a8e0f0'); wg.addColorStop(1, '#4fa3c8');
    g.fillStyle = wg; g.beginPath(); g.ellipse(fx, fy, 25, 13, 0, 0, 7); g.fill();
    g.fillStyle = '#cdbf9f'; g.fillRect(fx - 2.6, fy - 15, 5.2, 15);
    g.fillStyle = '#e2d7bf'; g.beginPath(); g.ellipse(fx, fy - 15, 8, 3.2, 0, 0, 7); g.fill();
    g.fillStyle = '#7cc6df'; g.beginPath(); g.ellipse(fx, fy - 15.4, 6.2, 2.2, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = '#6aa25a'; g.beginPath(); g.ellipse(fx, fy, 24, 13, 0, 0, 7); g.fill();
    g.fillStyle = '#7fb069'; g.beginPath(); g.ellipse(fx, fy - 1, 21, 10.5, 0, 0, 7); g.fill();
    if (det) flowers(g, fx - 16, fy - 16, 0.3);
    g.fillStyle = '#8a6a3e'; g.fillRect(fx - 0.8, fy - 20, 1.6, 16);
    g.fillStyle = '#f7f1e1'; g.beginPath(); g.roundRect(fx - 15, fy - 28, 30, 10, 2); g.fill();
    g.strokeStyle = '#8a6a3e'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = '#5b4a2c'; g.font = '700 4.6px Nunito, sans-serif'; g.textAlign = 'center';
    g.fillText(`FONTANA A ${FOUNTAIN_AT}`, fx, fy - 21.6);
    g.textAlign = 'left';
  }
}

// Oggetti della piazza che hanno profondità: ordinati insieme a case e alberi.
function piazzaProps(city) {
  const out = [];
  const built = builtCount(city);
  const founders = Object.values(city.residents).filter(isFounder).length;
  const [ex, ey] = PIAZZA_SPOTS.edicola;
  out.push({ y: ey * T + 28, draw: (g) => edicola(g, ex * T, ey * T) });
  const [mx, my] = PIAZZA_SPOTS.muro[0];
  out.push({ y: my * T + 22, draw: (g, det) => muro(g, mx * T, my * T, founders, det) });
  for (const bx of [PIAZZA.x0 + 1.3, PIAZZA.x0 + 6.2]) out.push({ y: (PIAZZA.y0 + 2.62) * T, draw: (g) => bench(g, bx * T, (PIAZZA.y0 + 2.35) * T) });
  for (const [px, py] of [[PIAZZA.x0 + 0.35, PIAZZA.y1 + 0.72], [PIAZZA.x1 + 0.65, PIAZZA.y1 + 0.72], [PIAZZA.x0 + 2.6, PIAZZA.y0 + 0.62]]) {
    out.push({ y: py * T + 3, draw: (g) => planter(g, px * T, py * T) });
  }
  for (const lx of [PIAZZA.x0 + 2.5, PIAZZA.x1 - 1.5]) out.push({ y: (PIAZZA.y1 + 0.95) * T, lamp: true, x: lx * T, draw: (g) => lampPost(g, lx * T, (PIAZZA.y1 + 0.95) * T) });
  if (built >= BAR_AT) {
    for (const [tx, ty] of [[PIAZZA.x1 - 0.9, PIAZZA.y0 + 0.75], [PIAZZA.x1 - 0.1, PIAZZA.y0 + 1.35], [PIAZZA.x1 - 1.4, PIAZZA.y0 + 1.6]]) {
      out.push({ y: ty * T + 6, draw: (g) => cafeTable(g, tx * T, ty * T) });
    }
  }
  return out;
}
function edicola(g, ox, oy) {
  g.fillStyle = 'rgba(30,30,20,0.2)'; g.beginPath(); g.ellipse(ox + 18, oy + 28.5, 14, 3, 0, 0, 7); g.fill();
  g.fillStyle = '#285447'; g.fillRect(ox + 5, oy + 11, 22, 17);
  g.fillStyle = '#1e4339'; g.fillRect(ox + 27, oy + 10, 3, 17.5);
  g.fillStyle = '#f4ecd8'; g.fillRect(ox + 7.5, oy + 14.5, 17, 9);
  const mags = ['#e85d4a', '#3f6aa1', '#f2c14e', '#7a4a6b', '#4f8a72', '#e08a3a'];
  for (let k = 0; k < 6; k++) { g.fillStyle = mags[k]; g.fillRect(ox + 8.3 + k * 2.75, oy + 15.5 + (k % 2), 2.3, 3.2); g.fillRect(ox + 8.3 + k * 2.75, oy + 19.5 - (k % 2), 2.3, 3); }
  // Tendina a strisce
  for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#f6efe0' : '#c0392b'; g.fillRect(ox + 3 + k * 3.8, oy + 6, 3.8, 5.5); }
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(ox + 3, oy + 11, 26.6, 1);
  g.fillStyle = '#c0392b'; g.fillRect(ox + 4, oy + 1, 24, 5.2);
  g.fillStyle = '#fff'; g.font = '800 4.2px Nunito, sans-serif'; g.textAlign = 'center';
  g.fillText('GIORNALE', ox + 16, oy + 5); g.textAlign = 'left';
}
function muro(g, ox, oy, founders, det) {
  g.fillStyle = 'rgba(30,30,20,0.18)'; g.fillRect(ox + 4, oy + 22, 3 * T - 4, 3);
  g.fillStyle = '#b8a789'; g.fillRect(ox + 2, oy + 5, 3 * T - 4, 17);
  g.fillStyle = '#cdbd9f'; g.fillRect(ox + 1, oy + 3, 3 * T - 2, 3);
  g.fillStyle = '#9f8e70'; g.fillRect(ox + 2, oy + 19.5, 3 * T - 4, 2.5);
  if (det) {
    g.strokeStyle = 'rgba(90,70,40,0.25)'; g.lineWidth = 0.4;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 12; k++) g.strokeRect(ox + 2 + k * 7.7 + (r % 2) * 3.8, oy + 6 + r * 4.5, 7.7, 4.5);
  }
  const n = Math.min(founders, 24);
  for (let i = 0; i < 24; i++) {
    g.fillStyle = i < n ? '#d9b44a' : 'rgba(255,255,255,0.18)';
    g.fillRect(ox + 6 + (i % 12) * 7.2, oy + 8 + Math.floor(i / 12) * 5.6, 5.2, 3.8);
  }
}
function bench(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.2)'; g.fillRect(x + 1, y + 6.5, 19, 2);
  g.fillStyle = '#3b3f45'; g.fillRect(x + 1.5, y + 3, 1.2, 4.5); g.fillRect(x + 16.5, y + 3, 1.2, 4.5);
  g.fillStyle = '#8b5e3c'; for (let k = 0; k < 3; k++) g.fillRect(x, y + k * 1.7, 19, 1.3);
}
function planter(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.2)'; g.beginPath(); g.ellipse(x + 2, y + 3, 6, 2, 0, 0, 7); g.fill();
  g.fillStyle = '#b8643d'; g.beginPath(); g.moveTo(x - 4.5, y - 4); g.lineTo(x + 4.5, y - 4); g.lineTo(x + 3.4, y + 3); g.lineTo(x - 3.4, y + 3); g.closePath(); g.fill();
  g.fillStyle = '#d07a4e'; g.fillRect(x - 5, y - 5, 10, 1.6);
  g.fillStyle = '#4f8a45'; g.beginPath(); g.arc(x, y - 7.5, 4.6, 0, 7); g.fill();
  for (const [dx, dy, c] of [[-2, -9, '#e85d75'], [1.8, -8.5, '#f6d84a'], [0, -11, '#e85d75'], [2.6, -6, '#ffffff']]) { g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, 1, 0, 7); g.fill(); }
}
function lampPost(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.2)'; g.beginPath(); g.ellipse(x + 2, y, 3.5, 1.2, 0, 0, 7); g.fill();
  g.fillStyle = '#2f3338'; g.fillRect(x - 0.8, y - 20, 1.6, 20); g.fillRect(x - 1.8, y - 1.5, 3.6, 1.5);
  g.fillStyle = '#2f3338'; g.beginPath(); g.moveTo(x - 2.6, y - 20); g.lineTo(x + 2.6, y - 20); g.lineTo(x + 1.6, y - 25); g.lineTo(x - 1.6, y - 25); g.closePath(); g.fill();
  g.fillStyle = '#f3e6c2'; g.fillRect(x - 1.5, y - 24, 3, 3.6);
}
function cafeTable(g, x, y) {
  g.fillStyle = 'rgba(30,30,20,0.18)'; g.beginPath(); g.ellipse(x + 3, y + 6, 10, 3.5, 0, 0, 7); g.fill();
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 0.5, y - 10, 1, 14);
  g.fillStyle = '#f2ead6'; g.beginPath(); g.ellipse(x, y + 2, 4, 2, 0, 0, 7); g.fill();
  for (const dx of [-6, 6]) { g.fillStyle = '#3b3f45'; g.fillRect(x + dx - 1.4, y + 1, 2.8, 3); }
  for (let k = 0; k < 8; k++) {
    g.fillStyle = k % 2 ? '#f6efe0' : '#2f6b4f';
    g.beginPath(); g.moveTo(x, y - 14); g.arc(x, y - 10, 9.5, Math.PI + (k / 8) * Math.PI, Math.PI + ((k + 1) / 8) * Math.PI); g.closePath(); g.fill();
  }
}

/* Case -------------------------------------------------------------------- */

function wallFace(c, x, y, w, h) {
  const { g, wall, P } = c;
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, shade(wall, 0.04)); gr.addColorStop(1, shade(wall, -0.05));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  if (P) { g.fillStyle = P.stucco; g.fillRect(x, y, w, h); }
  g.fillStyle = shade(wall, -0.2); g.fillRect(x, y + h - 1.6, w, 1.6);
}
function sideFace(c, pts) {
  const { g, wall } = c;
  poly(g, pts); g.fillStyle = shade(wall, -0.17); g.fill();
  g.fillStyle = shade(wall, -0.3); g.fillRect(pts[3][0], pts[3][1] - 1.6, pts[2][0] - pts[3][0], 1.6);
}
function roofPoly(c, pts, color) {
  const { g, P } = c;
  poly(g, pts); g.fillStyle = color; g.fill();
  if (P) { g.fillStyle = P.roof; g.fill(); }
  g.strokeStyle = shade(color, -0.25); g.lineWidth = 0.7; g.lineJoin = 'round'; g.stroke();
}
function poly(g, pts) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}
function eaveShadow(g, x, y, w) {
  const gr = g.createLinearGradient(0, y, 0, y + 2.6);
  gr.addColorStop(0, 'rgba(40,25,10,0.32)'); gr.addColorStop(1, 'rgba(40,25,10,0)');
  g.fillStyle = gr; g.fillRect(x, y, w, 2.6);
}
function windowAt(c, x, y, w, h, { shutters = true, arch = false } = {}) {
  const { g, door, lit, night, detail } = c;
  if (shutters && detail) {
    const sc = door === '#f1ede4' ? '#e6e1d5' : door;
    for (const sx of [x - 1.65, x + w + 0.15]) {
      g.fillStyle = sc; g.fillRect(sx, y - 0.2, 1.5, h + 0.4);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 0.7; k < h; k += 1) g.fillRect(sx + 0.15, y + k, 1.2, 0.25);
    }
  }
  g.fillStyle = '#f6f1e6';
  if (arch) { g.beginPath(); g.moveTo(x - 0.6, y + h + 0.6); g.lineTo(x - 0.6, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 0.6, Math.PI, 0); g.lineTo(x + w + 0.6, y + h + 0.6); g.closePath(); g.fill(); }
  else g.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2);
  let glass;
  if (lit) glass = '#ffd36b';
  else if (night) glass = '#24314f';
  else { glass = g.createLinearGradient(0, y, 0, y + h); glass.addColorStop(0, '#d8eef8'); glass.addColorStop(1, '#86bcd9'); }
  g.fillStyle = glass;
  if (arch) { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.fill(); }
  else g.fillRect(x, y, w, h);
  if (detail) {
    g.fillStyle = 'rgba(246,241,230,0.95)'; g.fillRect(x + w / 2 - 0.25, y, 0.5, h); g.fillRect(x, y + h * 0.45, w, 0.45);
    if (!lit && !night) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(x + 0.3, y + h - 0.5); g.lineTo(x + 0.3, y + 0.4); g.lineTo(x + w * 0.4, y + 0.4); g.closePath(); g.fill(); }
  }
  g.fillStyle = '#efe9dc'; g.fillRect(x - 1, y + h + 0.3, w + 2, 0.9);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 1, y + h + 1.2, w + 2, 0.4);
  c.wins.push([x, y, w, h]);
}
function doorAt(c, x, y, w, h) {
  const { g, door, detail } = c;
  g.fillStyle = '#e9e1cf';
  g.beginPath(); g.moveTo(x - 0.8, y + h); g.lineTo(x - 0.8, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 0.8, Math.PI, 0); g.lineTo(x + w + 0.8, y + h); g.closePath(); g.fill();
  g.fillStyle = door;
  g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.fill();
  if (detail) {
    g.strokeStyle = shade(door === '#f1ede4' ? '#c9c3b5' : door, -0.18); g.lineWidth = 0.35;
    g.strokeRect(x + 0.7, y + w / 2 + 0.6, w / 2 - 1, h - w / 2 - 1.6); g.strokeRect(x + w / 2 + 0.3, y + w / 2 + 0.6, w / 2 - 1, h - w / 2 - 1.6);
    g.fillStyle = '#d8b34a'; g.beginPath(); g.arc(x + w * 0.72, y + h * 0.62, 0.38, 0, 7); g.fill();
  }
  g.fillStyle = '#cfc6b2'; g.fillRect(x - 1.4, y + h - 0.2, w + 2.8, 1.2);
}
function chimney(c, x, y) {
  const { g, wall } = c;
  g.fillStyle = shade(wall, -0.12); g.fillRect(x, y, 3, 5.5);
  g.fillStyle = shade(wall, -0.25); g.fillRect(x + 2, y, 1, 5.5);
  g.fillStyle = '#8c4a35'; g.fillRect(x - 0.6, y - 1, 4.2, 1.3);
}

// Forme delle case in stile Pokémon: tetto grande visto dall'alto (falda posteriore più chiara,
// colmo, falda anteriore) e facciata alta sotto. Le case sporgono un po' sopra la loro casella.
function ridge(c, x, y, w) {
  c.g.fillStyle = shade(c.roof, 0.28); c.g.fillRect(x, y, w, 1);
  c.g.fillStyle = 'rgba(0,0,0,0.12)'; c.g.fillRect(x, y + 1, w, 0.5);
}
function eaveEdge(c, x, y, w) {
  c.g.fillStyle = shade(c.roof, -0.3); c.g.fillRect(x, y, w, 1.3);
  c.g.fillStyle = 'rgba(255,255,255,0.18)'; c.g.fillRect(x, y, w, 0.35);
}
function doormat(g, x, y) { g.fillStyle = '#a5483a'; g.beginPath(); g.roundRect(x, y, 5.6, 1.5, 0.5); g.fill(); }

const SHAPES_DRAW = {
  casa(c) {
    const { g } = c;
    sideFace(c, [[28, 15], [30.6, 13.6], [30.6, 26.8], [28, 28]]);
    wallFace(c, 4, 14.5, 24, 13.5);
    roofPoly(c, [[5.5, -3.6], [26.5, -3.6], [29.6, 2.6], [2.4, 2.6]], shade(c.roof, 0.14));
    chimney(c, 20, -6.2);
    roofPoly(c, [[2.4, 2.6], [29.6, 2.6], [31.6, 15.2], [0.4, 15.2]], c.roof);
    ridge(c, 2.4, 2.1, 27.2);
    eaveEdge(c, 0.4, 14.4, 31.2);
    eaveShadow(g, 4, 15.7, 24);
    windowAt(c, 6.8, 18.2, 4, 4.4);
    windowAt(c, 21.2, 18.2, 4, 4.4);
    doorAt(c, 13.9, 19.4, 4.2, 8.6);
    doormat(g, 13.2, 28.2);
    c.plaque = [11.3, 24];
  },
  villetta(c) {
    const { g } = c;
    sideFace(c, [[29, 17], [31.4, 15.6], [31.4, 26.8], [29, 28]]);
    wallFace(c, 2, 16.6, 27, 11.4);
    roofPoly(c, [[8, -1.6], [24, -1.6], [29, 3.6], [3, 3.6]], shade(c.roof, 0.14));
    chimney(c, 9.5, -4);
    roofPoly(c, [[3, 3.6], [29, 3.6], [31.6, 17], [0.4, 17]], c.roof);
    ridge(c, 8, -1.9, 16);
    eaveEdge(c, 0.4, 16.2, 31.2);
    eaveShadow(g, 2, 17.5, 27);
    windowAt(c, 4.8, 19.8, 3.6, 4.2);
    windowAt(c, 23.6, 19.8, 3.6, 4.2);
    doorAt(c, 13.4, 20.4, 4.2, 7.6);
    roofPoly(c, [[11.4, 20.4], [19.6, 20.4], [18.8, 18.4], [12.2, 18.4]], shade(c.roof, 0.06));
    doormat(g, 12.7, 28.2);
    c.plaque = [10.4, 24.4];
  },
  torretta(c) {
    const { g } = c;
    wallFace(c, 3, 16, 16, 12);
    roofPoly(c, [[4, -0.6], [17, -0.6], [20, 4], [1.5, 4]], shade(c.roof, 0.14));
    roofPoly(c, [[1.5, 4], [20, 4], [21.5, 16.6], [0, 16.6]], c.roof);
    ridge(c, 1.5, 3.5, 18.5);
    eaveEdge(c, 0, 16, 21.5);
    eaveShadow(g, 3, 17.3, 16);
    sideFace(c, [[29, 6], [31.2, 4.8], [31.2, 26.8], [29, 28]]);
    wallFace(c, 18.5, 6, 10.5, 22);
    roofPoly(c, [[23.75, -7], [31.6, 5.2], [29.9, 6.6]], shade(c.roof, -0.12));
    roofPoly(c, [[17.6, 6.6], [23.75, -7], [29.9, 6.6]], c.roof);
    g.fillStyle = shade(c.roof, 0.25); g.beginPath(); g.moveTo(23.75, -7); g.lineTo(21, 1.5); g.lineTo(22.2, 1.5); g.closePath(); g.fill();
    eaveShadow(g, 18.5, 6.6, 10.5);
    windowAt(c, 21.7, 8.8, 4, 5, { shutters: false, arch: true });
    windowAt(c, 21.7, 16.2, 4, 4.4);
    g.fillStyle = '#e8e0cf'; g.fillRect(20, 21.6, 7.4, 1);
    if (c.detail) { g.fillStyle = '#3b3f45'; for (let k = 0; k < 8; k++) g.fillRect(20.2 + k * 1, 19.6, 0.3, 2); g.fillRect(20, 19.4, 7.4, 0.4); }
    windowAt(c, 6.2, 19.6, 3.6, 4.2);
    doorAt(c, 12.6, 20.2, 4.2, 7.8);
    doormat(g, 11.9, 28.2);
    c.plaque = [4.6, 25.4];
  },
};

function yard(g, garden, P) {
  if (garden === 'nessuno') {
    g.fillStyle = '#e2d4b2'; g.beginPath(); g.roundRect(1, 27, 30, 4.6, 1.5); g.fill();
    if (P) { g.fillStyle = P.sand; g.fillRect(1, 27, 30, 4.6); }
  } else if (garden === 'prato') {
    g.fillStyle = 'rgba(200,235,150,0.45)'; g.beginPath(); g.roundRect(1.5, 27.6, 29, 4, 1.5); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 5; k++) g.fillRect(2 + k * 6, 27.8, 3, 3.6);
  }
}
function frontGarden(c, garden, deco) {
  const { g } = c;
  if (garden === 'fiori') {
    const cols = ['#e85d75', '#f2c14e', '#ffffff', '#b07cd8', '#ff8a5c'];
    const bed = (x, w) => {
      g.fillStyle = '#7a5a3c'; g.beginPath(); g.roundRect(x, 27.3, w, 3.6, 1.4); g.fill();
      g.fillStyle = '#4f8a45'; for (let k = 0; k < w / 1.6; k++) { g.beginPath(); g.arc(x + 0.8 + k * 1.6, 28.4 + (k % 2) * 1.2, 0.9, 0, 7); g.fill(); }
      for (let k = 0; k < w / 1.4; k++) { g.fillStyle = cols[k % cols.length]; g.beginPath(); g.arc(x + 0.7 + k * 1.4, 28 + ((k * 7) % 3) * 0.9, 0.6, 0, 7); g.fill(); }
    };
    bed(0.8, 5);
    if (deco === 'nessuno') bed(26.2, 5);
    // Vasi di gerani sotto le finestre al piano terra
    for (const [x, y, w, h] of c.wins) {
      if (y < 15) continue;
      g.fillStyle = '#b8643d'; g.fillRect(x - 0.5, y + h + 1.5, w + 1, 1.1);
      for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#e83f4f' : '#4f8a45'; g.beginPath(); g.arc(x + 0.3 + k * (w / 3.3), y + h + 1.3, 0.7, 0, 7); g.fill(); }
    }
  } else if (garden === 'orto') {
    g.fillStyle = '#7a5a3c'; g.beginPath(); g.roundRect(0.4, 21, 4.8, 9.8, 1); g.fill();
    g.fillStyle = '#5b3f28'; g.fillRect(0.4, 30.2, 4.8, 0.6);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) { g.fillStyle = r % 2 ? '#7fbf4a' : '#5f9e3a'; g.beginPath(); g.arc(1.7 + k * 2.2, 22.4 + r * 2.2, 0.95, 0, 7); g.fill(); }
    g.fillStyle = '#d8442f'; g.beginPath(); g.arc(3.9, 24.6, 0.5, 0, 7); g.arc(1.6, 28.9, 0.5, 0, 7); g.fill();
  } else if (garden === 'ulivo') {
    drawTree(g, { x: 3.2, y: 29.5, kind: 'ulivo', s: 0.62 }, c.detail);
  }
}

function drawDeco(g, deco) {
  if (deco === 'vespa') {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(26.4, 30.4, 4.6, 1, 0, 0, 7); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(23.4, 29.6, 1.25, 0, 7); g.arc(29.2, 29.6, 1.25, 0, 7); g.fill();
    g.fillStyle = '#9adbc6'; g.beginPath(); g.ellipse(24.6, 27.6, 2.5, 1.9, 0, 0, 7); g.fill();
    g.fillStyle = '#86cdb8'; g.beginPath(); g.moveTo(26, 28.8); g.lineTo(28.8, 28.8); g.lineTo(29.6, 25); g.lineTo(28.4, 25); g.closePath(); g.fill();
    g.fillStyle = '#5a3a2a'; g.beginPath(); g.roundRect(22.6, 25.4, 4, 1.1, 0.5); g.fill();
    g.fillStyle = '#c9c9c9'; g.fillRect(28.4, 23.6, 2.6, 0.5);
    g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(29.6, 25.2, 0.55, 0, 7); g.fill();
  } else if (deco === 'bici') {
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 0.5;
    for (const cx of [23.6, 28.6]) { g.beginPath(); g.arc(cx, 28.6, 1.9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx - 1.9, 28.6); g.lineTo(cx + 1.9, 28.6); g.moveTo(cx, 26.7); g.lineTo(cx, 30.5); g.lineWidth = 0.2; g.stroke(); g.lineWidth = 0.5; }
    g.strokeStyle = '#c0392b'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(23.6, 28.6); g.lineTo(25.8, 26.2); g.lineTo(28.6, 28.6); g.lineTo(26.4, 28.6); g.lineTo(25.8, 26.2); g.moveTo(27.6, 25.6); g.lineTo(28.6, 28.6); g.stroke();
    g.fillStyle = '#222'; g.fillRect(25, 25.6, 1.8, 0.6); g.fillRect(27, 25.3, 1.6, 0.5);
  } else if (deco === 'panchina') {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(22.6, 30, 8, 1);
    g.fillStyle = '#3b3f45'; g.fillRect(23, 27.4, 0.7, 2.8); g.fillRect(29.2, 27.4, 0.7, 2.8);
    g.fillStyle = '#8b5e3c'; for (let k = 0; k < 3; k++) g.fillRect(22.5, 25.2 + k * 1.15, 8, 0.85);
  } else if (deco === 'limoni') {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(27.8, 30.6, 3.4, 0.9, 0, 0, 7); g.fill();
    g.fillStyle = '#c4673d'; g.beginPath(); g.moveTo(24.8, 26.4); g.lineTo(30, 26.4); g.lineTo(29.3, 30.4); g.lineTo(25.5, 30.4); g.closePath(); g.fill();
    g.fillStyle = '#d98458'; g.fillRect(24.5, 26, 5.8, 0.9);
    g.fillStyle = '#76533a'; g.fillRect(27.2, 23, 0.7, 3.2);
    g.fillStyle = '#3f7d34'; g.beginPath(); g.arc(27.5, 21.6, 3.4, 0, 7); g.fill();
    g.fillStyle = '#58a046'; g.beginPath(); g.arc(26.6, 20.8, 1.9, 0, 7); g.fill();
    g.fillStyle = '#f6d533'; for (const [x, y] of [[26, 22.2], [28.8, 21], [27.6, 23.2], [29.2, 22.8]]) { g.beginPath(); g.ellipse(x, y, 0.7, 0.55, 0.3, 0, 7); g.fill(); }
  } else if (deco === 'cane') {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(22.6, 29.6, 8, 1.2);
    g.fillStyle = '#c4935e'; g.fillRect(23, 25.6, 5.4, 4.4);
    g.fillStyle = '#b5523b'; g.beginPath(); g.moveTo(22.3, 25.9); g.lineTo(25.7, 22.8); g.lineTo(29.1, 25.9); g.closePath(); g.fill();
    g.fillStyle = '#3d2a1c'; g.beginPath(); g.moveTo(24.7, 30); g.lineTo(24.7, 27.6); g.arc(25.7, 27.6, 1, Math.PI, 0); g.lineTo(26.7, 30); g.closePath(); g.fill();
    // Il cane, seduto accanto
    g.fillStyle = '#e8c48f'; g.beginPath(); g.ellipse(29.8, 29, 1.5, 1.4, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(30.2, 27.3, 1.1, 0, 7); g.fill();
    g.fillStyle = '#8a5a32'; g.beginPath(); g.ellipse(29.5, 26.9, 0.45, 0.8, -0.4, 0, 7); g.fill();
    g.fillStyle = '#222'; g.fillRect(30.4, 27.1, 0.35, 0.35);
  }
}

function drawSite(g, P) {
  g.fillStyle = '#cfc8bb'; g.fillRect(4, 22, 24, 6.6);
  g.fillStyle = '#b8b0a2'; g.fillRect(4, 27.8, 24, 0.8);
  // Muri in mattoni a metà
  g.fillStyle = '#b8684a'; g.fillRect(6, 16, 20, 7);
  g.strokeStyle = 'rgba(80,40,20,0.35)'; g.lineWidth = 0.3;
  for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) g.strokeRect(6 + k * 2.9 + (r % 2) * 1.45, 16 + r * 1.75, 2.9, 1.75);
  // Ponteggio
  g.strokeStyle = '#8a6a3e'; g.lineWidth = 0.9;
  g.beginPath();
  for (const x of [4.6, 16, 27.4]) { g.moveTo(x, 28.4); g.lineTo(x, 7); }
  g.moveTo(4.6, 22); g.lineTo(16, 12); g.moveTo(16, 22); g.lineTo(27.4, 12);
  g.stroke();
  g.fillStyle = '#c99a5a'; g.fillRect(3.6, 11.4, 25, 1.4); g.fillRect(3.6, 19.8, 25, 1.4);
  if (P) { g.fillStyle = 'rgba(0,0,0,0.15)'; for (let k = 0; k < 8; k++) { g.fillRect(4 + k * 3.1, 11.4, 0.3, 1.4); g.fillRect(4 + k * 3.1, 19.8, 0.3, 1.4); } }
  // Mattoni sul bancale, cono e cartello
  g.fillStyle = '#8a6a3e'; g.fillRect(0.6, 28.6, 5, 1);
  g.fillStyle = '#c0583f'; for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) g.fillRect(0.8 + k * 2.4, 26 + r * 1.3, 2.2, 1.1);
  g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(28.5, 30.6); g.lineTo(31.5, 30.6); g.lineTo(30, 25.6); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(29.2, 27.6, 1.6, 0.8);
  g.fillStyle = '#f2c230'; g.fillRect(19, 24, 8, 4.4);
  g.fillStyle = '#222'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(19 + i * 2, 28.4); g.lineTo(20 + i * 2, 24); g.lineTo(21 + i * 2, 24); g.lineTo(20 + i * 2, 28.4); g.closePath(); g.fill(); }
}

// Disegna una casa nella casella (coordinate locali 0..32). Restituisce le finestre, per accenderle di sera.
export function drawHouse(g, style, { lit = false, night = false, founder = false, cantiere = false, flag = null, detail = true } = {}) {
  const P = detail ? pats(g) : null;
  const wins = [];
  // Ombra proiettata (sole da nord-ovest) e ombra di contatto alla base.
  const tall = style.shape === 'torretta' ? 1.35 : style.shape === 'villetta' ? 0.85 : 1;
  const cs = g.createLinearGradient(26, 0, 26 + 9 * tall, 0);
  cs.addColorStop(0, 'rgba(25,40,15,0.3)'); cs.addColorStop(1, 'rgba(25,40,15,0)');
  g.fillStyle = cs;
  g.beginPath(); g.moveTo(26, 28.4); g.lineTo(26, 14); g.lineTo(26 + 7 * tall, 17 + 2 * tall); g.lineTo(26 + 9 * tall, 30.5); g.lineTo(8, 30.8); g.closePath(); g.fill();
  g.fillStyle = 'rgba(25,40,15,0.3)';
  g.beginPath(); g.ellipse(17, 28.4, 14, 2.2, 0, 0, Math.PI * 2); g.fill();
  yard(g, style.garden, P);
  if (cantiere) { drawSite(g, P); return wins; }
  const c = { g, P, wall: style.wall, roof: roofColor(style.roof), door: doorColor(style.door), lit, night, wins, detail, plaque: null };
  (SHAPES_DRAW[style.shape] || SHAPES_DRAW.casa)(c);
  if (founder && c.plaque) {
    const [px, py] = c.plaque;
    g.fillStyle = '#e2bf4f'; g.beginPath(); g.roundRect(px, py, 2.3, 1.8, 0.4); g.fill();
    g.fillStyle = '#9b7a16'; g.fillRect(px + 0.5, py + 0.7, 1.3, 0.35);
  }
  if (detail) frontGarden(c, style.garden, style.deco);
  else if (style.garden === 'ulivo') frontGarden(c, style.garden, style.deco);
  drawDeco(g, style.deco);
  if (flag) {
    g.fillStyle = '#4a4a4a'; g.fillRect(2.6, 4, 0.7, 12);
    g.fillStyle = flag; g.beginPath(); g.moveTo(3.3, 4); g.quadraticCurveTo(6, 4.8, 8.6, 5.6); g.quadraticCurveTo(6, 6.6, 3.3, 7.6); g.closePath(); g.fill();
  }
  return wins;
}

/* Lampioni e luci della notte ----------------------------------------------- */

function streetLamps(view) {
  const out = [];
  for (let x = Math.max(1, view.x0 - (view.x0 % 5)); x <= view.x1; x += 5) {
    if (x >= PIAZZA.x0 && x <= PIAZZA.x1) continue;
    out.push({ x: x * T + 6, y: MAIN_Y * T + 3.5 });
    out.push({ x: (x + 2) * T + 26, y: (MAIN_Y + 1) * T - 1.2 });
  }
  return out;
}
function glow(g, x, y, r, a, color = '255,214,110') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${color},${a})`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/* Strato fisso del mondo ---------------------------------------------------- */

// Disegna la porzione `view` (in caselle) sul contesto già trasformato in unità del mondo.
export function drawWorld(g, city, view, o) {
  const { x0, y0, x1, y1 } = view;
  const night = !!o.night;
  const det = o.detail !== false;
  const G = getGround(city.openDistricts);
  drawGround(g, G, view, det);
  drawFutureRoads(g, city.openDistricts, view);
  drawRoads(g, city.roads, view, det);
  const piazzaVisible = PIAZZA.x1 >= x0 && PIAZZA.x0 <= x1 && PIAZZA.y1 >= y0 && PIAZZA.y0 <= y1;
  if (piazzaVisible) drawPiazzaFloor(g, city, det);
  drawCliffs(g, G, city.roads, view, det);

  // Lotti liberi: contorno tratteggiato e, da vicino, il picchetto "libero".
  g.save();
  g.setLineDash([3.5, 2.5]);
  g.lineWidth = 1.1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = key(x, y);
      if (!PLAN.lots.has(k) || city.houses[k] || districtAt(x, y) > city.openDistricts) continue;
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath(); g.roundRect(x * T + 3, y * T + 3, T - 6, T - 6, 4); g.fill();
      g.strokeStyle = o.mode === 'choose' ? '#7a5b14' : 'rgba(255,255,255,0.75)';
      g.stroke();
      if (det) {
        g.save(); g.setLineDash([]);
        g.fillStyle = '#8a6a3e'; g.fillRect(x * T + 22, y * T + 15, 0.9, 10);
        g.fillStyle = '#fffaf0'; g.fillRect(x * T + 18.5, y * T + 12, 8, 4.6);
        g.strokeStyle = '#8a6a3e'; g.lineWidth = 0.4; g.strokeRect(x * T + 18.5, y * T + 12, 8, 4.6);
        g.fillStyle = '#2f6b4f'; g.font = '800 2.6px Nunito, sans-serif'; g.fillText('LIBERO', x * T + 19.1, y * T + 15.2);
        g.restore();
      }
    }
  }
  g.restore();

  // Vialetti dalle porte alle corsie.
  const houses = Object.values(city.houses).filter((h) => {
    const [x, y] = parseKey(h.slot);
    return x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1;
  });
  for (const h of houses) {
    const dir = city.doors?.[h.slot];
    if (!dir) continue;
    const [x, y] = parseKey(h.slot);
    const cx = x * T + T / 2, cy = y * T + T / 2;
    g.fillStyle = '#d9c8a3';
    if (dir === 'S') g.fillRect(cx - 2.4, cy + 12, 4.8, T / 2 - 12);
    else if (dir === 'N') g.fillRect(cx - 2.4, y * T, 4.8, 4);
    else if (dir === 'E') g.fillRect(cx + 10, cy + 10, T / 2 - 10, 4.6);
    else g.fillRect(x * T, cy + 10, T / 2 - 10, 4.6);
  }

  // Tutto ciò che ha altezza, ordinato dal fondo verso chi guarda.
  const items = [];
  for (const t of G.trees) {
    if (t.x < x0 * T - 40 || t.x > (x1 + 1) * T + 40 || t.y < y0 * T - 10 || t.y > (y1 + 2) * T + 40) continue;
    items.push({ y: t.y, tree: t });
  }
  // Cespugli negli incroci liberi delle corsie dei quartieri aperti.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x % 3 || y % 3 || y === MAIN_Y) continue;
      const d = districtAt(x, y);
      if (!d || d > city.openDistricts || city.roads[key(x, y)] || inPiazza(x, y) || ih(x, y, 30) > 0.45) continue;
      items.push({ y: y * T + 24, tree: { x: x * T + 16, y: y * T + 24, kind: 'cespuglio', s: 0.8 + ih(x, y, 31) * 0.3 } });
    }
  }
  for (const h of houses) items.push({ y: (parseKey(h.slot)[1] + 1) * T - 3, house: h });
  if (piazzaVisible) for (const p of piazzaProps(city)) items.push(p);
  const lamps = streetLamps(view);
  for (const l of lamps) items.push({ y: l.y, draw: (gg) => lampPost(gg, l.x, l.y) });
  // Ombrelloni sulla spiaggia
  if (SEA_Y >= y0 && SEA_Y <= y1) {
    for (let x = x0; x <= x1; x++) if (x % 3 === 1 && x > 12 && x < 72) items.push({ y: SEA_Y * T + 20, draw: (gg) => umbrella(gg, x * T + 16, SEA_Y * T + 18, x) });
  }
  items.sort((a, b) => a.y - b.y);

  const lights = [];
  for (const it of items) {
    if (it.tree) { drawTree(g, it.tree, det); continue; }
    if (it.draw) { it.draw(g, det); continue; }
    const h = it.house;
    const [x, y] = parseKey(h.slot);
    const r = city.residents[h.residentId];
    const online = o.online?.has(h.residentId);
    const t0 = o.born?.get(h.slot);
    const age = t0 !== undefined ? (o.t || 0) - t0 : Infinity;
    const grow = age < 900 ? easeOutBack(Math.max(0, age) / 900) : 1;
    g.save();
    g.translate(x * T + T / 2, y * T + T);
    g.scale(grow, grow);
    g.translate(-T / 2, -T);
    const wins = drawHouse(g, h.style, {
      lit: night && online, night, founder: isFounder(r), cantiere: h.status === 'cantiere', detail: det,
      flag: h.residentId === o.meId ? '#e0a92a' : o.friends?.has(h.residentId) ? '#3f6aa1' : null,
    });
    g.restore();
    if (night && online) for (const [wx, wy, ww, wh] of wins) lights.push([x * T + wx, y * T + wy, ww, wh]);
  }

  if (night) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#56649a';
    g.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(8,12,34,0.28)';
    g.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    g.globalCompositeOperation = 'lighter';
    for (const [lx, ly, lw, lh] of lights) glow(g, lx + lw / 2, ly + lh / 2, 16, 0.35);
    for (const l of lamps) { glow(g, l.x, l.y - 22, 9, 0.6); glow(g, l.x, l.y, 26, 0.22); }
    if (piazzaVisible) {
      for (const p of piazzaProps(city)) if (p.lamp) { glow(g, p.x, p.y - 22, 9, 0.6); glow(g, p.x, p.y, 34, 0.25); }
      const [ex, ey] = PIAZZA_SPOTS.edicola;
      glow(g, ex * T + 16, ey * T + 18, 22, 0.3);
    }
    g.restore();
    for (const [lx, ly, lw, lh] of lights) { g.fillStyle = '#ffdc8a'; g.fillRect(lx, ly, lw, lh); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(lx + lw / 2 - 0.25, ly, 0.5, lh); }
  }

  // Selezione, nomi, quartieri chiusi.
  const showNames = (o.z || 1) >= 2.2;
  for (const h of houses) {
    const [x, y] = parseKey(h.slot);
    const r = city.residents[h.residentId];
    const sel = o.selected === h.slot;
    if (sel) {
      g.save();
      g.strokeStyle = '#ffd34d'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(x * T + 17, y * T + 28.5, 16, 4.8, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    if (r && (showNames || sel || h.residentId === o.meId)) label(g, x * T + 16, y * T + T + 1, r.username, h.residentId === o.meId, o.z || 1);
  }
  if (o.selected && !city.houses[o.selected] && PLAN.lots.has(o.selected)) {
    const [x, y] = parseKey(o.selected);
    g.save();
    g.strokeStyle = '#d4462f'; g.lineWidth = 2.6;
    g.beginPath(); g.roundRect(x * T + 2, y * T + 2, T - 4, T - 4, 5); g.stroke();
    g.restore();
  }
  g.save();
  g.textAlign = 'center';
  for (const d of DISTRICTS) {
    if (d.id <= city.openDistricts) continue;
    const [a, b, c, e] = d.rect;
    const cx = ((a + c + 1) / 2) * T, cy = ((b + e + 1) / 2) * T + (d.id === 4 ? -2 * T : d.id === 5 ? 2 * T : 0);
    if (cx < x0 * T - 200 || cx > x1 * T + 200 || cy < y0 * T - 100 || cy > y1 * T + 100) continue;
    const z = o.z || 1;
    g.font = `700 ${Math.max(20, 15 / z)}px Fredoka, "Trebuchet MS", sans-serif`;
    g.lineWidth = 4 / Math.max(z, 0.6); g.strokeStyle = 'rgba(255,250,235,0.75)'; g.lineJoin = 'round';
    g.strokeText(d.name, cx, cy);
    g.fillStyle = 'rgba(60,48,20,0.78)'; g.fillText(d.name, cx, cy);
    g.font = `700 ${Math.max(11, 9 / z)}px Nunito, "Trebuchet MS", sans-serif`;
    const sub = d.id === city.openDistricts + 1 ? 'il prossimo quartiere ad aprire' : 'quartiere futuro';
    g.strokeText(sub, cx, cy + Math.max(18, 14 / z)); g.fillText(sub, cx, cy + Math.max(18, 14 / z));
  }
  g.restore();
}

function umbrella(g, x, y, seed) {
  const cols = [['#e85d4a', '#fff'], ['#2f6b9f', '#fff'], ['#f2b632', '#fff'], ['#4f8a72', '#f6efe0']][seed % 4];
  g.fillStyle = 'rgba(120,90,40,0.25)'; g.beginPath(); g.ellipse(x + 4, y + 4, 9, 3.4, 0, 0, 7); g.fill();
  g.fillStyle = '#f6efe0'; g.fillRect(x - 6, y + 2.5, 5, 2.4);
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 0.4, y - 8, 0.8, 11);
  for (let k = 0; k < 8; k++) {
    g.fillStyle = cols[k % 2];
    g.beginPath(); g.moveTo(x, y - 9); g.arc(x, y - 6.5, 8, Math.PI + (k / 8) * Math.PI, Math.PI + ((k + 1) / 8) * Math.PI); g.closePath(); g.fill();
  }
}

/* Strato animato: onde, fontana, barche, automobili ----------------------- */

const CAR_KINDS = ['cinquecento', 'cinquecento', 'ape', 'auto', 'auto', 'bus', 'vespa', 'auto', 'cinquecento', 'auto'];
const CAR_COLORS = ['#e8c95a', '#d9442f', '#6fb3c8', '#f1ede4', '#3f6aa1', '#4f8a72', '#c7c2b8', '#e88a3a'];
function carsFor(built) {
  const n = Math.max(2, Math.min(10, 2 + Math.floor(built / 6)));
  return Array.from({ length: n }, (_, i) => ({
    kind: CAR_KINDS[i % CAR_KINDS.length],
    color: CAR_COLORS[Math.floor(ih(i, 1, 40) * CAR_COLORS.length)],
    dir: i % 2 ? -1 : 1,
    speed: 26 + ih(i, 2, 40) * 22,
    offset: ih(i, 3, 40) * W * T,
  }));
}

function drawCar(g, car, x, y, night) {
  const d = car.dir;
  g.save();
  g.translate(x, y);
  if (d < 0) g.scale(-1, 1);
  const body = night ? shade(car.color, -0.25) : car.color;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(-7, 1.5, 15, 4.5, 2); g.fill();
  if (car.kind === 'bus') {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(-13, 1.8, 27, 5, 2); g.fill();
    g.fillStyle = night ? '#b07a26' : '#e5a12a'; g.beginPath(); g.roundRect(-13, -4, 26, 8.6, 1.6); g.fill();
    g.fillStyle = night ? '#ffe39a' : '#2d3a4a'; for (let k = 0; k < 6; k++) g.fillRect(-11 + k * 3.8, -3, 2.8, 2.2);
    g.fillStyle = '#f6efe0'; g.fillRect(-13, 1.2, 26, 1);
    g.fillStyle = '#2d3a4a'; g.fillRect(10.6, -3, 2, 5);
  } else if (car.kind === 'ape') {
    g.fillStyle = '#8b5e3c'; g.fillRect(-7, -2.6, 7, 5.4);
    g.fillStyle = '#e9b44c'; g.fillRect(-6.4, -3.6, 2.6, 2.6); g.fillStyle = '#e85d4a'; g.fillRect(-3.4, -3.4, 2.6, 2.4);
    g.fillStyle = body; g.beginPath(); g.roundRect(0, -3, 6.2, 6, 2.2); g.fill();
    g.fillStyle = '#2d3a4a'; g.fillRect(3.4, -2.2, 2, 4.4);
  } else if (car.kind === 'vespa') {
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 4.4, 1.4, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a2a'; g.beginPath(); g.arc(-0.6, -0.2, 1.5, 0, 7); g.fill();
    g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(-0.6, -0.2, 0.9, 0, 7); g.fill();
  } else {
    const len = car.kind === 'cinquecento' ? 12 : 15, wid = car.kind === 'cinquecento' ? 7.4 : 7.8;
    g.fillStyle = '#1f1f1f'; for (const [wx, wy] of [[-len / 2 + 2, -wid / 2 - 0.6], [len / 2 - 4.5, -wid / 2 - 0.6], [-len / 2 + 2, wid / 2 - 1], [len / 2 - 4.5, wid / 2 - 1]]) g.fillRect(wx, wy, 2.6, 1.6);
    g.fillStyle = body; g.beginPath(); g.roundRect(-len / 2, -wid / 2, len, wid, car.kind === 'cinquecento' ? 3.4 : 2); g.fill();
    g.fillStyle = shade(body, 0.12); g.beginPath(); g.roundRect(-len / 2 + 3, -wid / 2 + 1.1, len - 6.5, wid - 2.2, 1.6); g.fill();
    g.fillStyle = night ? '#1b2333' : '#33465a'; g.beginPath(); g.roundRect(len / 2 - 4, -wid / 2 + 1, 1.8, wid - 2, 0.6); g.fill();
    g.fillRect(-len / 2 + 1.6, -wid / 2 + 1.4, 1.2, wid - 2.8);
    g.fillStyle = '#fff6c9'; g.fillRect(len / 2 - 0.8, -wid / 2 + 0.8, 0.8, 1.2); g.fillRect(len / 2 - 0.8, wid / 2 - 2, 0.8, 1.2);
    g.fillStyle = '#c0392b'; g.fillRect(-len / 2, -wid / 2 + 0.8, 0.6, 1.1); g.fillRect(-len / 2, wid / 2 - 1.9, 0.6, 1.1);
  }
  if (night) {
    g.globalCompositeOperation = 'lighter';
    const front = car.kind === 'bus' ? 13 : car.kind === 'vespa' ? 4.4 : 7.5;
    const gr = g.createLinearGradient(front, 0, front + 22, 0);
    gr.addColorStop(0, 'rgba(255,240,180,0.45)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(front, -2.5); g.lineTo(front + 22, -7); g.lineTo(front + 22, 7); g.lineTo(front, 2.5); g.closePath(); g.fill();
    glow(g, -front, 0, 4, 0.5, '255,60,40');
  }
  g.restore();
}

function drawBoat(g, x, y, i, night) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-14, 1); g.lineTo(-30, -1); g.lineTo(-30, 3); g.closePath(); g.fill();
  g.fillStyle = night ? '#c9c4b8' : '#fbf7ee'; g.beginPath(); g.moveTo(-9, -2.6); g.lineTo(7, -2.6); g.quadraticCurveTo(11, 0, 7, 2.6); g.lineTo(-9, 2.6); g.closePath(); g.fill();
  g.fillStyle = '#8b5e3c'; g.fillRect(-6, -1.4, 10, 2.8);
  g.fillStyle = i % 2 ? '#e85d4a' : '#f6efe0'; g.beginPath(); g.moveTo(-1, -1); g.lineTo(-1, -15); g.lineTo(8, -2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(-1, -15); g.lineTo(-1, -1); g.lineTo(2, -1); g.closePath(); g.fill();
  g.restore();
}

export function drawAmbient(g, city, view, o, t) {
  const night = !!o.night;
  const s = t / 1000;
  const { x0, y0, x1, y1 } = view;
  // Onde e schiuma
  if (y1 >= SEA_Y) {
    g.save();
    g.strokeStyle = night ? 'rgba(200,220,255,0.25)' : 'rgba(255,255,255,0.55)';
    g.lineWidth = 0.9; g.lineCap = 'round';
    for (let y = Math.max(SEA_Y + 1, y0); y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const r = ih(x, y, 50);
        if (r < 0.55) continue;
        const ph = (s * 0.5 + r * 10) % 1;
        const wx = x * T + ((r * 97 + s * 7) % T), wy = y * T + 8 + r * 16;
        g.globalAlpha = Math.sin(ph * Math.PI);
        g.beginPath(); g.moveTo(wx - 4, wy); g.quadraticCurveTo(wx, wy - 1.6, wx + 4, wy); g.stroke();
      }
    }
    g.globalAlpha = 1;
    if (SEA_Y >= y0 && SEA_Y <= y1) {
      g.strokeStyle = night ? 'rgba(220,235,255,0.5)' : 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.8;
      g.beginPath();
      for (let px = x0 * T; px <= (x1 + 1) * T; px += 4) {
        const py = SEA_Y * T + T - 2.5 + Math.sin(px / 11 + s * 1.6) * 1.4 + Math.sin(px / 37 - s) * 1;
        if (px === x0 * T) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const bx = ((s * (6 + i * 2) + ih(i, 9, 60) * W * T) % (W * T + 80)) - 40;
      const by = (SEA_Y + 2.4 + i * 1.9) * T;
      if (bx > x0 * T - 40 && bx < (x1 + 1) * T + 40 && by < (y1 + 1) * T + 20) drawBoat(g, bx, by + Math.sin(s * 1.3 + i) * 1.2, i, night);
    }
    g.restore();
  }
  // Fontana: zampillo e cerchi nell'acqua
  if (builtCount(city) >= FOUNTAIN_AT && PIAZZA.x1 >= x0 && PIAZZA.x0 <= x1 && PIAZZA.y1 >= y0 && PIAZZA.y0 <= y1) {
    const { x: fx, y: fy } = FOUNTAIN;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.6;
    for (let k = 0; k < 2; k++) {
      const p = (s * 0.45 + k / 2) % 1;
      g.globalAlpha = 1 - p;
      g.beginPath(); g.ellipse(fx, fy, 7 + p * 16, (7 + p * 16) * 0.5, 0, 0, 7); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(225,245,255,0.9)';
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const p = (s * 1.4 + k * 0.137) % 1;
      const px = fx + Math.cos(a) * p * 7;
      const py = fy - 17 - Math.sin(p * Math.PI) * 6 + p * 4 + Math.sin(a) * p * 3;
      g.beginPath(); g.arc(px, py, 0.7, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(235,250,255,0.85)'; g.beginPath(); g.ellipse(fx, fy - 18.5 - Math.sin(s * 6) * 0.5, 1.3, 3, 0, 0, 7); g.fill();
    g.restore();
  }
  // Automobili sulla strada principale
  if (MAIN_Y >= y0 - 1 && MAIN_Y <= y1 + 1) {
    const L = W * T + 120;
    for (const car of carsFor(builtCount(city))) {
      let x = ((s * car.speed + car.offset) % L);
      if (car.dir < 0) x = L - x;
      x -= 60;
      if (x < x0 * T - 30 || x > (x1 + 1) * T + 30) continue;
      drawCar(g, car, x, MAIN_Y * T + (car.dir > 0 ? 20.5 : 11.5), night);
    }
  }
}

/* Abitanti a passeggio ------------------------------------------------------ */

const SKINS = ['#f3d2b3', '#e8b98f', '#c98d63', '#8d5b3d', '#f6dcc6'];
const HAIRS = ['#3b2a1e', '#6b4226', '#d9a441', '#1f1a17', '#a4532e', '#8a8a8a'];
const SHIRTS = ['#d9442f', '#3f6aa1', '#2f7d4f', '#e0a92a', '#7a4a6b', '#e86b8a', '#4fb3c8', '#f1ede4'];
export function avatarLook(name) {
  const h = hash(String(name));
  return {
    skin: SKINS[h % SKINS.length], hair: HAIRS[(h >>> 3) % HAIRS.length], shirt: SHIRTS[(h >>> 6) % SHIRTS.length],
    pants: ['#2d3a4a', '#4b4f56', '#6b4a2f', '#2f4f6f'][(h >>> 9) % 4], cap: (h >>> 12) % 3 === 0, long: (h >>> 14) % 2 === 0,
  };
}

// L'omino in stile Pokémon: testa grande, quattro direzioni, due pose di camminata.
// (x, y) sono i piedi, in unità del mondo; `step` alterna le gambe.
export function drawAvatar(g, x, y, dir, step, look, { me = false, night = false, bob = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(20,30,15,0.3)'; g.beginPath(); g.ellipse(0, 0, 5.4, 1.9, 0, 0, 7); g.fill();
  const lift = step ? 1.1 : 0;
  const side = dir === 'E' || dir === 'W';
  if (dir === 'W') g.scale(-1, 1);
  // Gambe
  g.fillStyle = look.pants;
  if (side) { g.fillRect(-2.2 + (step ? 1.2 : -0.6), -6, 2.4, 6); g.fillRect(-0.2 - (step ? 1.2 : -0.6), -6, 2.4, 6 - lift); }
  else { g.fillRect(-3, -6, 2.5, 6 - (step === 1 ? lift : 0)); g.fillRect(0.5, -6, 2.5, 6 - (step === 2 ? lift : 0)); }
  g.fillStyle = '#2b2b2b';
  if (!side) { g.fillRect(-3.2, -0.9 - (step === 1 ? lift : 0), 2.9, 1.1); g.fillRect(0.3, -0.9 - (step === 2 ? lift : 0), 2.9, 1.1); }
  // Corpo e braccia
  g.fillStyle = look.shirt; g.beginPath(); g.roundRect(-4.4, -13.4, 8.8, 8.2, 2.4); g.fill();
  g.fillStyle = shade(look.shirt, -0.15);
  if (side) g.fillRect(-1, -12.5 + (step ? 0.6 : 0), 2.4, 6);
  else { g.fillRect(-5.6, -12.4 + (step === 1 ? 0.8 : 0), 1.6, 5.6); g.fillRect(4, -12.4 + (step === 2 ? 0.8 : 0), 1.6, 5.6); }
  g.fillStyle = look.skin;
  if (!side) { g.fillRect(-5.6, -7, 1.6, 1.4); g.fillRect(4, -7, 1.6, 1.4); }
  // Testa
  const hy = -18.4 + bob;
  g.fillStyle = look.skin; g.beginPath(); g.arc(0, hy, 5.4, 0, 7); g.fill();
  g.fillStyle = look.hair;
  if (dir === 'N') { g.beginPath(); g.arc(0, hy, 5.6, 0, 7); g.fill(); if (look.long) g.fillRect(-4.6, hy, 9.2, 5); }
  else {
    g.beginPath(); g.arc(0, hy - 0.6, 5.6, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(5.4, hy - 0.5); g.lineTo(-5.4, hy - 0.5); g.closePath(); g.fill();
    if (look.long) { g.fillRect(-5.6, hy - 1, 2, 6); if (!side) g.fillRect(3.6, hy - 1, 2, 6); }
    g.fillStyle = '#1f1f1f';
    if (side) g.fillRect(2.4, hy + 0.2, 1.1, 1.8);
    else { g.fillRect(-2.4, hy + 0.2, 1.1, 1.8); g.fillRect(1.3, hy + 0.2, 1.1, 1.8); }
    g.fillStyle = 'rgba(230,110,110,0.35)';
    if (!side) { g.fillRect(-3.8, hy + 2.2, 1.4, 0.8); g.fillRect(2.4, hy + 2.2, 1.4, 0.8); }
  }
  if (look.cap) {
    g.fillStyle = shade(look.shirt, -0.05);
    g.beginPath(); g.arc(0, hy - 1.4, 5.7, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(-1.4, hy - 6, 2.8, 1.6);
    g.fillStyle = shade(look.shirt, -0.25);
    if (side) g.fillRect(2, hy - 2, 5, 1.4);
    else if (dir === 'S') g.fillRect(-5, hy - 1.6, 10, 1.5);
  }
  g.restore();
  if (me) {
    // Indicatore giallo sopra la testa: sei tu.
    g.fillStyle = '#ffd34d'; g.strokeStyle = 'rgba(60,40,0,0.5)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(x - 2.6, y - 29 + bob); g.lineTo(x + 2.6, y - 29 + bob); g.lineTo(x, y - 25.6 + bob); g.closePath(); g.fill(); g.stroke();
  }
  if (night) glow(g, x, y - 10, 12, 0.12, '255,240,200');
}

/* Nuvole ------------------------------------------------------------------ */

// Le nuvole stanno "più in alto" della città: scorrono più veloci del terreno quando si sposta
// la mappa (parallasse) e proiettano un'ombra morbida a terra. Spariscono quando si guarda da vicino.
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
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: ih(i, 1, 70) * W * T, y: ih(i, 2, 70) * H * T, s: 0.7 + ih(i, 3, 70) * 0.7, v: 5 + ih(i, 4, 70) * 6 }));
function drawClouds(g, cam, vw, vh, dpr, t, night) {
  const fade = clamp01((2.4 - cam.z) / 1.6);
  if (fade <= 0.01) return;
  if (!cloudSprites) cloudSprites = makeCloudSprites();
  const s = t / 1000;
  const span = W * T + 900;
  g.save();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const c of CLOUDS) {
    const wx = ((c.x + s * c.v) % span) - 450;
    const size = 300 * c.s;
    const gx = (wx + 70 - cam.x) * cam.z + vw / 2, gy = (c.y + 110 - cam.y) * cam.z + vh / 2;
    const gw = size * cam.z, gh = size * 0.5 * cam.z;
    if (gx + gw / 2 > 0 && gx - gw / 2 < vw && gy + gh / 2 > 0 && gy - gh / 2 < vh) {
      g.globalAlpha = (night ? 0.05 : 0.13) * fade;
      g.drawImage(cloudSprites.shadow, gx - gw / 2, gy - gh / 2, gw, gh);
    }
    const k = 1.35;
    const cx = (wx - cam.x) * cam.z * k + vw / 2, cy = (c.y - cam.y) * cam.z * k + vh / 2;
    const cw = size * cam.z * k, ch = size * 0.5 * cam.z * k;
    if (cx + cw / 2 > 0 && cx - cw / 2 < vw && cy + ch / 2 > 0 && cy - ch / 2 < vh) {
      g.globalAlpha = (night ? 0.18 : 0.55) * fade;
      g.drawImage(cloudSprites.cloud, cx - cw / 2, cy - ch / 2, cw, ch);
    }
  }
  g.restore();
}

/* Mappa ------------------------------------------------------------------ */

export class CityMap {
  constructor(canvas, { onTap, onCamera } = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.layer = document.createElement('canvas');
    this.lg = this.layer.getContext('2d');
    this.onTap = onTap;
    this.onCamera = onCamera;
    this.city = null;
    this.opts = { mode: 'browse', meId: null, friends: new Set(), online: new Set(), night: false, selected: null };
    this.cam = { x: 41.5 * T, y: 30 * T, z: 1 };
    this.born = new Map();   // lotto → istante in cui è comparsa (animazione di costruzione)
    this.avatars = new Map(); // id abitante → { x, y (caselle), path, dir, look, name, me }
    this.lastTick = 0;
    this.dirty = true;
    this.lastAmbient = 0;
    this.pointers = new Map();
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.lastFull = 0;
    this.interactUntil = 0;
    // Durante un gesto si sposta l'ultima immagine pronta (costa pochissimo); la città si ridisegna
    // nitida appena il dito si ferma, o prima se il gesto ha scoperto troppa mappa. Le animazioni vanno a 15 fotogrammi al secondo.
    const loop = (t) => {
      this.now = t;
      const interacting = this.pointers.size > 0 || t < this.interactUntil;
      const growing = this.animating(t);
      const walking = this.tickAvatars(t);
      if ((this.dirty || growing) && interacting && this.layerCam && !this.stale()) this.fast();
      else if (this.dirty || growing) { this.dirty = false; this.render(t, true); this.lastFull = this.lastAmbient = t; }
      else if (walking && t - this.lastAmbient > 30) { this.render(t, false); this.lastAmbient = t; }
      else if (this.avatarsDirty || (!this.still && this.ambientVisible && t - this.lastAmbient > 66)) { this.avatarsDirty = false; this.render(t, false); this.lastAmbient = t; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Allinea gli omini a chi è in città: chi entra compare, chi esce sparisce.
  setAvatars(list) {
    const ids = new Set(list.map((a) => a.id));
    for (const id of this.avatars.keys()) if (!ids.has(id)) this.avatars.delete(id);
    for (const a of list) {
      const cur = this.avatars.get(a.id);
      if (cur) { cur.name = a.name; cur.me = a.me; continue; }
      this.avatars.set(a.id, { id: a.id, x: a.pos[0], y: a.pos[1], path: [], dir: 'S', look: avatarLook(a.name), name: a.name, me: a.me, walked: 0 });
    }
    this.avatarsDirty = true;
  }
  // Fa camminare un omino fino alla casella indicata, seguendo strade e scale.
  walk(id, tx, ty) {
    const a = this.avatars.get(id);
    if (!a || !this.city) return false;
    const from = [Math.round(a.x), Math.round(a.y)];
    const path = walkPath(this.city, from, [tx, ty]);
    if (!path) return false;
    a.path = path;
    this.avatarsDirty = true;
    return true;
  }
  avatarOf(id) { return this.avatars.get(id); }
  tickAvatars(t) {
    const dt = Math.min(0.1, (t - (this.lastTick || t)) / 1000);
    this.lastTick = t;
    let moving = false;
    for (const a of this.avatars.values()) {
      if (!a.path.length) continue;
      moving = true;
      let left = dt * 4.2; // caselle al secondo
      while (left > 0 && a.path.length) {
        const [nx, ny] = a.path[0];
        const dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy);
        if (d > 0.001) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
        if (d <= left) { a.x = nx; a.y = ny; a.path.shift(); left -= d; } else { a.x += (dx / d) * left; a.y += (dy / d) * left; left = 0; }
        a.walked += dt * 4.2;
      }
      // La telecamera segue il proprio omino quando esce dal centro dello schermo.
      if (a.me && !this.pointers.size) {
        const sx = ((a.x + 0.5) * T - this.cam.x) * this.cam.z, sy = ((a.y + 0.5) * T - this.cam.y) * this.cam.z;
        const mx = this.vw * 0.28, my = this.vh * 0.22;
        if (Math.abs(sx) > mx || Math.abs(sy) > my) {
          this.cam.x += (sx - Math.sign(sx) * Math.min(Math.abs(sx), mx)) / this.cam.z * 0.12;
          this.cam.y += (sy - Math.sign(sy) * Math.min(Math.abs(sy), my)) / this.cam.z * 0.12;
          this.clamp();
          this.interactUntil = t + 200;
          this.dirty = true;
        }
      }
    }
    if (!moving && this.wasWalking) this.dirty = true; // a fine passeggiata, un ridisegno nitido
    this.wasWalking = moving;
    return moving;
  }
  drawAvatars(g, night) {
    const list = [...this.avatars.values()].sort((a, b) => a.y - b.y);
    const z = this.cam.z;
    for (const a of list) {
      const x = (a.x + 0.5) * T, y = (a.y + 0.5) * T + 6;
      const step = a.path.length ? (Math.floor(a.walked * 2.2) % 2) + 1 : 0;
      // Proporzioni da Pokémon: l'omino è alto circa metà di una casa.
      g.save(); g.translate(x, y); g.scale(0.62, 0.62);
      drawAvatar(g, 0, 0, a.dir, step, a.look, { me: a.me, night, bob: a.path.length ? 0 : Math.sin((this.now || 0) / 500) * 0.3 });
      g.restore();
      if (a.me || z >= 2.8) label(g, x, y + 3.5, a.name, a.me, z);
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

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = Math.max(1, r.width);
    this.vh = Math.max(1, r.height);
    this.cv.width = this.layer.width = Math.round(this.vw * dpr);
    this.cv.height = this.layer.height = Math.round(this.vh * dpr);
    this.dpr = dpr;
    if (!this.fitted && this.vw > 50) { this.fitted = true; this.fitCentro(); }
    this.clamp();
    this.dirty = true;
  }
  fitCentro() {
    const d = districtById(1).rect;
    const wTiles = d[2] - d[0] + 3, hTiles = d[3] - d[1] + 6;
    this.cam.z = Math.max(0.55, Math.min(2.2, Math.min(this.vw / (wTiles * T), this.vh / (hTiles * T))));
    this.cam.x = ((d[0] + d[2] + 1) / 2) * T;
    this.cam.y = ((d[1] + d[3] + 1) / 2) * T;
    this.clamp();
    this.dirty = true;
  }
  focus(slotOrXY, z) {
    const [x, y] = typeof slotOrXY === 'string' ? parseKey(slotOrXY) : slotOrXY;
    this.cam.x = (x + 0.5) * T;
    this.cam.y = (y + 0.5) * T;
    if (z) this.cam.z = z;
    this.clamp();
    this.dirty = true;
  }
  clamp() {
    const minZ = Math.max(this.vw / (W * T), this.vh / (H * T));
    this.cam.z = Math.max(minZ, Math.min(3.2, this.cam.z));
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    this.cam.x = Math.max(hw, Math.min(W * T - hw, this.cam.x));
    this.cam.y = Math.max(hh, Math.min(H * T - hh, this.cam.y));
    this.onCamera?.(this.cam);
  }
  toWorld(sx, sy) {
    return [(sx - this.vw / 2) / this.cam.z + this.cam.x, (sy - this.vh / 2) / this.cam.z + this.cam.y];
  }
  zoomAt(sx, sy, factor) {
    this.interactUntil = performance.now() + 160;
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.z *= factor;
    this.clamp();
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.x += wx - nx;
    this.cam.y += wy - ny;
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
        this.cam.x -= dx / this.cam.z;
        this.cam.y -= dy / this.cam.z;
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
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }
  pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  tap(sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    let x = Math.floor(wx / T), y = Math.floor(wy / T);
    // Le case sporgono verso l'alto: un tocco sul tetto conta per la casa sotto.
    if (!this.city.houses[key(x, y)] && this.city.houses[key(x, y + 1)] && wy - y * T > T * 0.4) y += 1;
    const k = key(x, y);
    const h = this.city.houses[k];
    const at = { x, y };
    if (h) return this.onTap?.({ kind: 'house', slot: k, house: h, ...at });
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

  view() {
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    return {
      x0: Math.max(0, Math.floor((this.cam.x - hw) / T) - 1), y0: Math.max(0, Math.floor((this.cam.y - hh) / T) - 1),
      x1: Math.min(W - 1, Math.ceil((this.cam.x + hw) / T) + 1), y1: Math.min(H - 1, Math.ceil((this.cam.y + hh) / T) + 2),
    };
  }
  stale() {
    const L = this.layerCam, c = this.cam;
    const s = c.z / L.z;
    const dx = Math.abs(L.x - c.x) * c.z, dy = Math.abs(L.y - c.y) * c.z;
    return s < 0.7 || s > 2.2 || dx > this.vw * 0.4 || dy > this.vh * 0.35;
  }
  // Ridisegno veloce durante i gesti: l'ultima immagine pronta, spostata e scalata sulla camera attuale.
  fast() {
    const L = this.layerCam, c = this.cam, d = this.dpr;
    const s = c.z / L.z;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#9fc87a';
    g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(s, 0, 0, s, d * ((this.vw / 2) * (1 - s) + (L.x - c.x) * c.z), d * ((this.vh / 2) * (1 - s) + (L.y - c.y) * c.z));
    g.drawImage(this.layer, 0, 0);
    this.worldTransform(g);
    this.drawAvatars(g, this.opts.night);
    drawClouds(g, c, this.vw, this.vh, d, this.still ? 0 : this.now, this.opts.night);
  }
  worldTransform(g) {
    const s = this.dpr * this.cam.z;
    g.setTransform(s, 0, 0, s, this.dpr * this.vw / 2 - this.cam.x * s, this.dpr * this.vh / 2 - this.cam.y * s);
  }

  render(t, full) {
    if (!this.city) return;
    const view = this.view();
    const o = { ...this.opts, t, born: this.born, z: this.cam.z, detail: this.cam.z * this.dpr >= 2.4 };
    if (full) {
      this.layerCam = { ...this.cam };
      this.ambientVisible = view.y1 >= SEA_Y || (MAIN_Y >= view.y0 && MAIN_Y <= view.y1) ||
        (builtCount(this.city) >= FOUNTAIN_AT && PIAZZA.x1 >= view.x0 && PIAZZA.x0 <= view.x1 && PIAZZA.y1 >= view.y0 && PIAZZA.y0 <= view.y1);
      const lg = this.lg;
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.fillStyle = '#4b97bd';
      lg.fillRect(0, 0, this.layer.width, this.layer.height);
      this.worldTransform(lg);
      drawWorld(lg, this.city, view, o);
      // Vignettatura leggera ai bordi dello schermo.
      lg.setTransform(1, 0, 0, 1, 0, 0);
      const w = this.layer.width, h = this.layer.height;
      const vg = lg.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(20,30,20,0)'); vg.addColorStop(1, o.night ? 'rgba(5,8,25,0.4)' : 'rgba(30,40,20,0.16)');
      lg.fillStyle = vg; lg.fillRect(0, 0, w, h);
    }
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.layer, 0, 0);
    this.worldTransform(g);
    drawAmbient(g, this.city, view, o, this.still ? 0 : t);
    this.drawAvatars(g, o.night);
    drawClouds(g, this.cam, this.vw, this.vh, this.dpr, this.still ? 0 : t, o.night);
    this.worldTransform(g);
    if (this.opts.mode === 'choose') {
      const pulse = 0.5 + 0.5 * Math.sin(t / 300);
      g.fillStyle = `rgba(255,236,160,${0.22 + pulse * 0.3})`;
      for (let y = view.y0; y <= view.y1; y++) for (let x = view.x0; x <= view.x1; x++) {
        const k = key(x, y);
        if (PLAN.lots.has(k) && !this.city.houses[k] && districtAt(x, y) <= this.city.openDistricts) { g.beginPath(); g.roundRect(x * T + 3, y * T + 3, T - 6, T - 6, 4); g.fill(); }
      }
    }
    for (const [slot, t0] of this.born) {
      const [x, y] = parseKey(slot);
      if (t - t0 < 1400) sparkle(g, x * T + 16, y * T + 14, t - t0);
    }
  }
}

// Nomi a dimensione fissa sullo schermo, accorciati alla larghezza del lotto per non sovrapporsi.
function label(g, x, y, text, mine, z = 1) {
  g.save();
  const fs = 11 / z;
  g.font = `800 ${fs}px Nunito, "Trebuchet MS", sans-serif`;
  const maxW = T * 0.94 - fs;
  let t = text;
  if (g.measureText(t).width > maxW) {
    while (t.length > 3 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    t += '…';
  }
  const w = g.measureText(t).width + fs;
  const hgt = fs * 1.5;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.roundRect(x - w / 2, y - hgt / 2 + fs * 0.12, w, hgt, hgt / 2); g.fill();
  g.fillStyle = mine ? '#ffd34d' : 'rgba(255,255,255,0.95)';
  g.beginPath(); g.roundRect(x - w / 2, y - hgt / 2, w, hgt, hgt / 2); g.fill();
  g.fillStyle = '#2b2a26';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(t, x, y + fs * 0.05);
  g.restore();
}
function sparkle(g, x, y, age) {
  const p = age / 1400;
  g.save();
  g.globalAlpha = 1 - p;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + p;
    const r = 6 + p * 22;
    g.fillStyle = i % 2 ? '#fff3b0' : '#ffffff';
    g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 1.6 - p, 0, 7); g.fill();
  }
  g.restore();
}
function easeOutBack(p) {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}

/* Anteprima della casa e cartoline per Instagram ---------------------- */

export function drawPreview(canvas, style, { cantiere = false } = {}) {
  const g = canvas.getContext('2d');
  const s = canvas.width / 46;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#bfe0a0'); sky.addColorStop(1, '#93c26b');
  g.fillStyle = sky;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  g.fillStyle = pats(g).grass; g.fillRect(0, 0, 46, 35);
  g.fillStyle = '#a8936d'; g.fillRect(0, 31.6, 46, 4);
  g.fillStyle = pats(g).cobble; g.fillRect(0, 32, 46, 3.4);
  drawTree(g, { x: 2.5, y: 24, kind: 'cipresso', s: 0.8 }, true);
  drawTree(g, { x: 43.5, y: 25, kind: 'tondo', s: 0.7 }, true);
  g.setTransform(s, 0, 0, s, 7 * s, 4.2 * s);
  drawHouse(g, style, { cantiere });
}

// Cartolina per il giornale: testata, ritaglio della mappa sulla zona della notizia, titolo e testo.
export async function renderPoster(city, news, format = 'post') {
  try { await Promise.all([document.fonts.load('400 80px "Abril Fatface"'), document.fonts.load('700 40px Nunito'), document.fonts.load('600 40px Fredoka')]); } catch { /* caratteri di riserva */ }
  const Wp = 1080, Hp = format === 'story' ? 1920 : 1350;
  const cv = document.createElement('canvas');
  cv.width = Wp; cv.height = Hp;
  const g = cv.getContext('2d');
  const paper = '#f6f1e3', ink = '#1f2a26', red = '#b8322a';
  g.fillStyle = paper; g.fillRect(0, 0, Wp, Hp);
  const top = format === 'story' ? 150 : 60;
  g.fillStyle = ink; g.textAlign = 'center';
  g.font = '400 96px "Abril Fatface", Georgia, serif';
  g.fillText(CITY.toUpperCase(), Wp / 2, top + 90);
  g.fillStyle = red; g.fillRect(70, top + 118, Wp - 140, 6);
  g.fillStyle = ink; g.font = '700 30px Nunito, sans-serif';
  const date = new Date(news.at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(`${PAPER.toUpperCase()}  ·  ${date.toUpperCase()}`, Wp / 2, top + 166);
  g.fillRect(70, top + 190, Wp - 140, 2);

  // Mappa
  const mapY = top + 220, mapH = format === 'story' ? 900 : 640, mapX = 70, mapW = Wp - 140;
  const [fx, fy] = news.slot ? parseKey(news.slot) : [PIAZZA.x0 + 4, PIAZZA.y0 + 1];
  const z = 2.8;
  g.save();
  g.beginPath(); g.rect(mapX, mapY, mapW, mapH); g.clip();
  g.translate(mapX + mapW / 2, mapY + mapH / 2);
  g.scale(z, z);
  g.translate(-(fx + 0.5) * T, -(fy + 0.5) * T);
  const hw = mapW / 2 / z / T, hh = mapH / 2 / z / T;
  const view = {
    x0: Math.max(0, Math.floor(fx - hw) - 1), y0: Math.max(0, Math.floor(fy - hh) - 1),
    x1: Math.min(W - 1, Math.ceil(fx + hw) + 1), y1: Math.min(H - 1, Math.ceil(fy + hh) + 2),
  };
  const o = { z: 2, selected: null, t: 0, detail: true };
  drawWorld(g, city, view, o);
  drawAmbient(g, city, view, o, 4200);
  g.restore();
  g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(mapX, mapY, mapW, mapH);

  const f = formatNews(news, city);
  g.textAlign = 'left';
  g.fillStyle = ink;
  g.font = '400 64px "Abril Fatface", Georgia, serif';
  let y = wrap(g, f.title, 70, mapY + mapH + 100, Wp - 140, 74);
  g.font = '600 36px Nunito, sans-serif';
  g.fillStyle = '#3b4642';
  y = wrap(g, f.text, 70, y + 30, Wp - 140, 50);
  g.fillStyle = red;
  g.fillRect(0, Hp - (format === 'story' ? 210 : 110), Wp, format === 'story' ? 210 : 110);
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
