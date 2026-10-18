// Disegno della città su canvas: terreno, strade con incroci automatici, case in vista tre quarti,
// notte con finestre accese, cartoline per il giornale. Nessuna libreria.
import {
  W, H, MAIN_Y, SEA_Y, PIAZZA, DISTRICTS, PLAN, ROOFS, DOORS, FOUNTAIN_AT,
  key, parseKey, districtAt, districtById, inPiazza, hash, builtCount, isFounder, formatNews, CITY, PAPER,
} from './core.js';

export const T = 32; // lato di una casella in pixel del mondo

const C = {
  grass: '#a9cf7f', grass2: '#9dc574', meadow: '#b7d58c', field1: '#d8c873', field2: '#c7cf7a',
  sand: '#ecd9a6', sea: '#5aa6c9', sea2: '#4b97bd', foam: '#e9f6fb',
  asphalt: '#5d6168', asphaltEdge: '#474a50', dorsal: '#6d7178', lane: '#dcc89f', laneEdge: '#c3ab7f',
  stone: '#e6d9c1', stoneLine: '#cdbd9f', tree: '#5d9a4f', tree2: '#4c8743', trunk: '#7a5636',
  lot: 'rgba(255,255,255,0.55)', lotChoose: '#fff7d6', night: 'rgba(16,26,58,0.52)', lit: '#ffd56e',
};
const roofColor = (id) => (ROOFS.find((r) => r.id === id) || ROOFS[0]).color;
const doorColor = (id) => (DOORS.find((r) => r.id === id) || DOORS[0]).color;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}
const rnd = (x, y, salt = 0) => (hash(x + ':' + y + ':' + salt) % 1000) / 1000;

/* Terreno (in cache finché non si apre un quartiere) ------------------ */

function drawTerrain(openDistricts) {
  const cv = document.createElement('canvas');
  cv.width = W * T;
  cv.height = H * T;
  const g = cv.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * T, py = y * T;
      const d = districtAt(x, y);
      if (y > SEA_Y) {
        g.fillStyle = (x + y) % 2 ? C.sea : C.sea2;
        g.fillRect(px, py, T, T);
        if (rnd(x, y, 1) > 0.82) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px + 6, py + 12, 12, 2); }
        continue;
      }
      if (y === SEA_Y) {
        g.fillStyle = C.sand; g.fillRect(px, py, T, T);
        g.fillStyle = C.foam; g.fillRect(px, py + T - 5, T, 5);
        continue;
      }
      if (d && d <= openDistricts) {
        g.fillStyle = rnd(x, y) > 0.5 ? C.grass : C.grass2;
        g.fillRect(px, py, T, T);
        if (rnd(x, y, 2) > 0.9) dots(g, px, py, '#f4f1e6');
      } else if (d) {
        // Campagna dei quartieri futuri: campi coltivati a strisce.
        const band = Math.floor(y / 3 + x / 9) % 2;
        g.fillStyle = band ? C.field1 : C.field2;
        g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(0,0,0,0.06)';
        for (let i = 4; i < T; i += 8) g.fillRect(px, py + i, T, 2);
      } else {
        g.fillStyle = rnd(x, y) > 0.5 ? C.meadow : C.grass;
        g.fillRect(px, py, T, T);
      }
    }
  }
  // Alberi: boschi fuori dal piano, filari sparsi nella campagna.
  for (let y = 0; y < SEA_Y - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (y === MAIN_Y || y === MAIN_Y - 1 || y === MAIN_Y + 1) continue;
      const d = districtAt(x, y);
      const p = d ? (d <= openDistricts ? 0 : 0.1) : (y < 8 || x < 10 || x > 74 ? 0.55 : 0.3);
      if (PLAN.futureRoads.has(key(x, y))) continue;
      if (rnd(x, y, 3) < p) tree(g, x * T + 6 + rnd(x, y, 4) * 12, y * T + 8 + rnd(x, y, 5) * 10, 0.8 + rnd(x, y, 6) * 0.5);
    }
  }
  return cv;
}
function dots(g, px, py, color) {
  g.fillStyle = color;
  for (let i = 0; i < 3; i++) g.fillRect(px + 6 + i * 8, py + 10 + (i % 2) * 9, 2, 2);
}
function tree(g, x, y, s = 1) {
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.beginPath(); g.ellipse(x + 2, y + 14 * s, 9 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.trunk; g.fillRect(x - 1.5 * s, y + 6 * s, 3 * s, 8 * s);
  g.fillStyle = C.tree2;
  g.beginPath(); g.arc(x, y + 2 * s, 8 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.tree;
  g.beginPath(); g.arc(x - 2 * s, y, 6 * s, 0, Math.PI * 2); g.fill();
}

/* Strade ------------------------------------------------------------- */

const ROAD_W = { main: 0.8, dorsal: 0.64, lane: 0.34, piazza: 1 };

function drawRoads(g, roads, x0, y0, x1, y1) {
  const typeAt = (x, y) => roads[key(x, y)];
  const pass = (types, edge) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = typeAt(x, y);
        if (!t || !types.includes(t)) continue;
        if (t === 'piazza') continue;
        const w = ROAD_W[t] * T + (edge ? 3 : 0);
        const cx = x * T + T / 2, cy = y * T + T / 2;
        g.fillStyle = edge ? (t === 'lane' ? C.laneEdge : C.asphaltEdge) : (t === 'lane' ? C.lane : t === 'main' ? C.asphalt : C.dorsal);
        g.fillRect(cx - w / 2, cy - w / 2, w, w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = typeAt(x + dx, y + dy);
          if (!n) continue;
          const aw = Math.min(w, ROAD_W[n] * T + (edge ? 3 : 0));
          if (dx) g.fillRect(dx > 0 ? cx : cx - T / 2, cy - aw / 2, T / 2, aw);
          else g.fillRect(cx - aw / 2, dy > 0 ? cy : cy - T / 2, aw, T / 2);
        }
      }
    }
  };
  pass(['lane'], true); pass(['lane'], false);
  pass(['dorsal', 'main'], true); pass(['dorsal', 'main'], false);
  // Segnaletica: tratteggio sulla strada principale e sulle dorsali.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = typeAt(x, y);
      if (t !== 'main' && t !== 'dorsal') continue;
      const horiz = typeAt(x - 1, y) === t || typeAt(x + 1, y) === t;
      const vert = typeAt(x, y - 1) === t || typeAt(x, y + 1) === t;
      if (horiz && !vert) g.fillRect(x * T + 8, y * T + T / 2 - 1, 14, 2);
      else if (vert && !horiz) g.fillRect(x * T + T / 2 - 1, y * T + 8, 2, 14);
    }
  }
}

function drawFutureRoads(g, openDistricts, x0, y0, x1, y1) {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 3;
  g.setLineDash([7, 7]);
  for (const d of DISTRICTS) {
    if (!d.dorsal || d.id <= openDistricts) continue;
    const r = d.dorsal;
    g.beginPath();
    if (r.x !== undefined) { if (r.x < x0 - 1 || r.x > x1 + 1) continue; g.moveTo(r.x * T + T / 2, r.y0 * T); g.lineTo(r.x * T + T / 2, (r.y1 + 1) * T); }
    else { if (r.y < y0 - 1 || r.y > y1 + 1) continue; g.moveTo(r.x0 * T, r.y * T + T / 2); g.lineTo((r.x1 + 1) * T, r.y * T + T / 2); }
    g.stroke();
  }
  g.restore();
}

/* Piazza ------------------------------------------------------------- */

export const PIAZZA_SPOTS = {
  edicola: [PIAZZA.x0, PIAZZA.y0],
  muro: [[PIAZZA.x0 + 3, PIAZZA.y0], [PIAZZA.x0 + 4, PIAZZA.y0], [PIAZZA.x0 + 5, PIAZZA.y0]],
};

function drawPiazza(g, built, night) {
  const px = PIAZZA.x0 * T, py = PIAZZA.y0 * T;
  const w = (PIAZZA.x1 - PIAZZA.x0 + 1) * T, h = (PIAZZA.y1 - PIAZZA.y0 + 1) * T;
  g.fillStyle = C.stone;
  g.fillRect(px, py, w, h);
  g.strokeStyle = C.stoneLine;
  g.lineWidth = 1;
  for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(px + i, py); g.lineTo(px + i, py + h); g.stroke(); }
  for (let j = 0; j <= h; j += 16) { g.beginPath(); g.moveTo(px, py + j); g.lineTo(px + w, py + j); g.stroke(); }
  // Muro dei Fondatori.
  const [mx, my] = PIAZZA_SPOTS.muro[0];
  g.fillStyle = '#b8a789'; g.fillRect(mx * T + 2, my * T + 4, 3 * T - 4, 20);
  g.fillStyle = '#9c8b6e'; g.fillRect(mx * T + 2, my * T + 20, 3 * T - 4, 4);
  g.fillStyle = '#d7b85a';
  for (let i = 0; i < 7; i++) g.fillRect(mx * T + 8 + i * 12, my * T + 9, 7, 5);
  // Edicola del giornale.
  const [ex, ey] = PIAZZA_SPOTS.edicola;
  const ox = ex * T, oy = ey * T;
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(ox + 4, oy + 26, 26, 4);
  g.fillStyle = '#2f5d50'; g.fillRect(ox + 5, oy + 10, 22, 17);
  g.fillStyle = '#f2e9d5'; g.fillRect(ox + 8, oy + 14, 16, 8);
  g.fillStyle = '#c0392b'; g.fillRect(ox + 3, oy + 5, 26, 6);
  g.fillStyle = '#fff'; g.font = 'bold 5px sans-serif'; g.fillText('GIORNALE', ox + 5, oy + 10);
  g.fillStyle = '#1d1d1d';
  for (let i = 0; i < 3; i++) g.fillRect(ox + 10 + i * 5, oy + 16, 3, 4);
  // Fontana al traguardo dei 25 abitanti, altrimenti l'aiuola con il cartello.
  const fx = (PIAZZA.x0 + 4) * T, fy = (PIAZZA.y0 + 1.6) * T;
  if (built >= FOUNTAIN_AT) {
    g.fillStyle = '#cbbd9f'; g.beginPath(); g.ellipse(fx, fy, 26, 15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6fb7d6'; g.beginPath(); g.ellipse(fx, fy, 21, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cbbd9f'; g.fillRect(fx - 3, fy - 14, 6, 14);
    g.fillStyle = night ? '#bfe6ff' : '#e6f6ff';
    g.beginPath(); g.arc(fx, fy - 16, 5, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = '#7fb069'; g.beginPath(); g.ellipse(fx, fy, 22, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e2a33a'; g.fillRect(fx - 1, fy - 18, 2, 14);
    g.fillStyle = '#f7f1e1'; g.fillRect(fx - 12, fy - 24, 24, 9);
    g.fillStyle = '#5b4a2c'; g.font = 'bold 5px sans-serif'; g.fillText('FONTANA', fx - 10, fy - 18);
  }
  // Panchine e lampioni.
  for (const bx of [PIAZZA.x0 + 1.4, PIAZZA.x0 + 6.4]) {
    g.fillStyle = '#7a5636'; g.fillRect(bx * T, (PIAZZA.y0 + 2.3) * T, 18, 4);
    g.fillRect(bx * T + 2, (PIAZZA.y0 + 2.3) * T + 4, 2, 3); g.fillRect(bx * T + 14, (PIAZZA.y0 + 2.3) * T + 4, 2, 3);
  }
}

function lamps(g, x0, x1, night) {
  for (let x = Math.max(1, x0 - (x0 % 5)); x <= x1; x += 5) {
    const lx = x * T + 4, ly = (MAIN_Y - 1) * T + 10;
    g.fillStyle = '#3b3f45'; g.fillRect(lx, ly, 2, 20); g.fillRect(lx, ly, 7, 2);
    g.fillStyle = night ? C.lit : '#f4efe0'; g.fillRect(lx + 5, ly + 2, 4, 3);
  }
}
function lampGlow(g, x0, x1) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let x = Math.max(1, x0 - (x0 % 5)); x <= x1; x += 5) glow(g, x * T + 11, (MAIN_Y - 1) * T + 15, 26, 0.35);
  g.restore();
}
function glow(g, x, y, r, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,214,110,${a})`);
  gr.addColorStop(1, 'rgba(255,214,110,0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/* Case --------------------------------------------------------------- */

// Disegna una casa nella casella (coordinate locali 0..32). `lit` accende le finestre.
export function drawHouse(g, style, { lit = false, night = false, founder = false, cantiere = false, flag = null } = {}) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.ellipse(16, 28.5, 14, 3.2, 0, 0, Math.PI * 2); g.fill();
  if (style.garden === 'nessuno') { g.fillStyle = '#e4d7b8'; g.fillRect(1, 25, 30, 6); }
  if (cantiere) return drawSite(g);
  const wall = style.wall, roof = roofColor(style.roof), door = doorColor(style.door);
  const win = (x, y, w = 4, h = 4) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(x - 0.7, y - 0.7, w + 1.4, h + 1.4);
    g.fillStyle = lit ? C.lit : night ? '#22304d' : '#a9d3ea';
    g.fillRect(x, y, w, h);
    if (!lit) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x, y, w / 2, 1); }
  };
  if (style.shape === 'villetta') {
    g.fillStyle = wall; g.fillRect(3, 15, 26, 13);
    g.fillStyle = shade(wall, -0.08); g.fillRect(3, 15, 26, 2);
    g.fillStyle = roof;
    g.beginPath(); g.moveTo(1, 16); g.lineTo(7, 7); g.lineTo(25, 7); g.lineTo(31, 16); g.closePath(); g.fill();
    g.fillStyle = shade(roof, 0.1);
    g.beginPath(); g.moveTo(7, 7); g.lineTo(25, 7); g.lineTo(23, 10); g.lineTo(9, 10); g.closePath(); g.fill();
    win(6, 19); win(22, 19); win(10.5, 19, 3, 4);
    g.fillStyle = door; g.fillRect(14, 20, 5, 8);
  } else if (style.shape === 'torretta') {
    g.fillStyle = wall; g.fillRect(5, 14, 16, 14);
    g.fillStyle = shade(wall, -0.06); g.fillRect(19, 6, 9, 22);
    g.fillStyle = roof;
    g.beginPath(); g.moveTo(3, 15); g.lineTo(12, 6); g.lineTo(21, 15); g.closePath(); g.fill();
    g.fillStyle = shade(roof, -0.1);
    g.beginPath(); g.moveTo(18, 7); g.lineTo(23.5, 0.5); g.lineTo(29, 7); g.closePath(); g.fill();
    win(21.5, 9, 4, 4); win(21.5, 17, 4, 4); win(7, 17);
    g.fillStyle = door; g.fillRect(12, 20, 5, 8);
  } else {
    g.fillStyle = wall; g.fillRect(6, 13, 20, 15);
    g.fillStyle = shade(wall, -0.07); g.fillRect(6, 13, 20, 2);
    g.fillStyle = roof;
    g.beginPath(); g.moveTo(3, 14.5); g.lineTo(16, 2.5); g.lineTo(29, 14.5); g.closePath(); g.fill();
    g.fillStyle = shade(roof, 0.12);
    g.beginPath(); g.moveTo(16, 2.5); g.lineTo(29, 14.5); g.lineTo(25, 14.5); g.lineTo(16, 6.5); g.closePath(); g.fill();
    g.fillStyle = shade(roof, -0.15); g.fillRect(21, 4, 3, 5);
    win(8.5, 17); win(19.5, 17);
    g.fillStyle = door; g.fillRect(13.5, 19, 5, 9);
  }
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(17, 23.5, 0.9, 0.9);
  if (founder) { g.fillStyle = '#d4af37'; g.fillRect(9, 22.5, 3, 2.4); g.fillStyle = '#8a6d12'; g.fillRect(9.8, 23.3, 1.4, 0.8); }
  drawGarden(g, style.garden);
  drawDeco(g, style.deco);
  if (flag) {
    g.fillStyle = '#4a4a4a'; g.fillRect(4, 2, 0.9, 11);
    g.fillStyle = flag; g.beginPath(); g.moveTo(4.9, 2); g.lineTo(10, 4); g.lineTo(4.9, 6); g.closePath(); g.fill();
  }
}

function drawSite(g) {
  g.fillStyle = '#c9c1b2'; g.fillRect(6, 19, 20, 9);
  g.fillStyle = '#b5ab99';
  for (let i = 0; i < 4; i++) g.fillRect(6 + i * 5 + (i % 2), 19, 4, 2);
  g.strokeStyle = '#8a6a3e'; g.lineWidth = 1.2;
  g.beginPath();
  for (const x of [5, 16, 27]) { g.moveTo(x, 28); g.lineTo(x, 9); }
  for (const y of [11, 18]) { g.moveTo(5, y); g.lineTo(27, y); }
  g.moveTo(5, 18); g.lineTo(16, 11); g.moveTo(16, 18); g.lineTo(27, 11);
  g.stroke();
  g.fillStyle = '#f2c230'; g.fillRect(20, 23, 8, 5);
  g.fillStyle = '#222';
  for (let i = 0; i < 4; i++) g.fillRect(20 + i * 2, 23, 1, 5);
}

function drawGarden(g, garden) {
  if (garden === 'fiori') {
    const cols = ['#e85d75', '#f2c14e', '#ffffff', '#b07cd8'];
    for (let i = 0; i < 6; i++) { g.fillStyle = cols[i % 4]; g.fillRect(1.5 + (i % 3) * 1.8, 25 + Math.floor(i / 3) * 2, 1.4, 1.4); }
    for (let i = 0; i < 4; i++) { g.fillStyle = cols[(i + 1) % 4]; g.fillRect(27 + (i % 2) * 2, 24 + Math.floor(i / 2) * 2, 1.4, 1.4); }
  } else if (garden === 'orto') {
    g.fillStyle = '#8a6440'; g.fillRect(0.5, 23, 5, 7);
    g.fillStyle = '#4f9a3c';
    for (let i = 0; i < 3; i++) g.fillRect(1.2, 24 + i * 2.2, 3.6, 1.1);
  } else if (garden === 'ulivo') {
    g.fillStyle = '#7a5636'; g.fillRect(2.5, 20, 1.6, 7);
    g.fillStyle = '#8fa66b'; g.beginPath(); g.arc(3.3, 18.5, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a7bb83'; g.beginPath(); g.arc(2.3, 17.5, 2.4, 0, Math.PI * 2); g.fill();
  }
}

function drawDeco(g, deco) {
  if (deco === 'vespa') {
    g.fillStyle = '#7cc7b2'; g.fillRect(22.5, 26, 6, 2.5); g.fillRect(27, 23.5, 1.5, 3);
    g.fillStyle = '#333'; g.beginPath(); g.arc(23.3, 29, 1.3, 0, 7); g.arc(27.8, 29, 1.3, 0, 7); g.fill();
  } else if (deco === 'bici') {
    g.strokeStyle = '#2f4f6f'; g.lineWidth = 0.8;
    g.beginPath(); g.arc(23.5, 28, 2, 0, 7); g.moveTo(30, 28); g.arc(28, 28, 2, 0, 7); g.moveTo(23.5, 28); g.lineTo(26, 25.5); g.lineTo(28, 28); g.stroke();
  } else if (deco === 'panchina') {
    g.fillStyle = '#7a5636'; g.fillRect(22, 25.5, 8, 1.6); g.fillRect(22, 27.6, 8, 1.2); g.fillRect(22.5, 28.8, 1, 1.6); g.fillRect(28.5, 28.8, 1, 1.6);
  } else if (deco === 'limoni') {
    g.fillStyle = '#c4673d'; g.fillRect(25, 26, 4.5, 4);
    g.fillStyle = '#4f8f3a'; g.beginPath(); g.arc(27.2, 23.5, 3.2, 0, 7); g.fill();
    g.fillStyle = '#f4d23c'; g.fillRect(26, 22.5, 1.2, 1.2); g.fillRect(28.2, 24, 1.2, 1.2);
  } else if (deco === 'cane') {
    g.fillStyle = '#b5523b'; g.beginPath(); g.moveTo(23, 25.5); g.lineTo(26, 23); g.lineTo(29, 25.5); g.closePath(); g.fill();
    g.fillStyle = '#d9a066'; g.fillRect(23.5, 25.5, 5, 4);
    g.fillStyle = '#4a2f1d'; g.fillRect(25.2, 27, 1.6, 2.5);
  }
}

/* Mappa -------------------------------------------------------------- */

export class CityMap {
  constructor(canvas, { onTap, onCamera } = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.onTap = onTap;
    this.onCamera = onCamera;
    this.city = null;
    this.opts = { mode: 'browse', meId: null, friends: new Set(), online: new Set(), night: false, selected: null };
    this.cam = { x: 41.5 * T, y: 30 * T, z: 1 };
    this.born = new Map();   // lotto → istante in cui è comparsa (animazione di costruzione)
    this.terrain = null;
    this.terrainOpen = 0;
    this.dirty = true;
    this.pointers = new Map();
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    const loop = (t) => {
      this.now = t;
      if (this.dirty || this.animating(t)) { this.dirty = false; this.render(t); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setCity(city, { animateNew = true } = {}) {
    if (this.city && animateNew) {
      for (const slot of Object.keys(city.houses)) {
        const was = this.city.houses[slot];
        if (!was || was.status !== city.houses[slot].status) this.born.set(slot, performance.now());
      }
    }
    this.city = city;
    if (this.terrainOpen !== city.openDistricts) { this.terrain = drawTerrain(city.openDistricts); this.terrainOpen = city.openDistricts; }
    this.dirty = true;
  }
  set(opts) { Object.assign(this.opts, opts); this.dirty = true; }
  animating(t) {
    if (this.opts.mode === 'choose' || this.opts.selected) return true;
    for (const [slot, t0] of this.born) { if (t - t0 < 1400) return true; this.born.delete(slot); }
    return false;
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = Math.max(1, r.width);
    this.vh = Math.max(1, r.height);
    this.cv.width = Math.round(this.vw * dpr);
    this.cv.height = Math.round(this.vh * dpr);
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
    this.cam.z = Math.max(minZ, Math.min(3, this.cam.z));
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    this.cam.x = Math.max(hw, Math.min(W * T - hw, this.cam.x));
    this.cam.y = Math.max(hh, Math.min(H * T - hh, this.cam.y));
    this.onCamera?.(this.cam);
  }
  toWorld(sx, sy) {
    return [(sx - this.vw / 2) / this.cam.z + this.cam.x, (sy - this.vh / 2) / this.cam.z + this.cam.y];
  }
  zoomAt(sx, sy, factor) {
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
    if (h) return this.onTap?.({ kind: 'house', slot: k, house: h });
    if (inPiazza(x, y)) {
      const [ex, ey] = PIAZZA_SPOTS.edicola;
      if (x === ex && y === ey) return this.onTap?.({ kind: 'giornale' });
      if (PIAZZA_SPOTS.muro.some(([mx, my]) => mx === x && my === y)) return this.onTap?.({ kind: 'muro' });
      return this.onTap?.({ kind: 'piazza' });
    }
    const d = districtAt(x, y);
    if (PLAN.lots.has(k) && d && d <= this.city.openDistricts) return this.onTap?.({ kind: 'lot', slot: k });
    if (d && d > this.city.openDistricts) return this.onTap?.({ kind: 'locked', district: d });
    this.onTap?.({ kind: 'none' });
  }

  render(t) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = C.sea;
    g.fillRect(0, 0, this.vw, this.vh);
    if (!this.city) return;
    g.save();
    g.translate(this.vw / 2, this.vh / 2);
    g.scale(this.cam.z, this.cam.z);
    g.translate(-this.cam.x, -this.cam.y);
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    const view = {
      x0: Math.max(0, Math.floor((this.cam.x - hw) / T) - 1), y0: Math.max(0, Math.floor((this.cam.y - hh) / T) - 1),
      x1: Math.min(W - 1, Math.ceil((this.cam.x + hw) / T) + 1), y1: Math.min(H - 1, Math.ceil((this.cam.y + hh) / T) + 1),
    };
    drawWorld(g, this.city, this.terrain, view, { ...this.opts, t, born: this.born, z: this.cam.z });
    g.restore();
  }
}

// Disegna la porzione `view` del mondo (in caselle) sul contesto già trasformato in pixel del mondo.
export function drawWorld(g, city, terrain, view, o) {
  const { x0, y0, x1, y1 } = view;
  const night = !!o.night;
  g.imageSmoothingEnabled = true;
  g.drawImage(terrain, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
  drawFutureRoads(g, city.openDistricts, x0, y0, x1, y1);
  drawRoads(g, city.roads, x0, y0, x1, y1);
  if (PIAZZA.x1 >= x0 && PIAZZA.x0 <= x1 && PIAZZA.y1 >= y0 && PIAZZA.y0 <= y1) drawPiazza(g, builtCount(city), night);

  // Lotti liberi.
  const choose = o.mode === 'choose';
  const pulse = choose ? 0.5 + 0.5 * Math.sin((o.t || 0) / 300) : 0;
  g.save();
  g.setLineDash([4, 3]);
  g.lineWidth = choose ? 2 : 1.2;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = key(x, y);
      if (!PLAN.lots.has(k) || city.houses[k]) continue;
      const d = districtAt(x, y);
      if (d > city.openDistricts) continue;
      if (choose) { g.fillStyle = `rgba(255,247,214,${0.35 + pulse * 0.3})`; g.fillRect(x * T + 3, y * T + 3, T - 6, T - 6); }
      g.strokeStyle = choose ? '#7a5b14' : C.lot;
      g.strokeRect(x * T + 3.5, y * T + 3.5, T - 7, T - 7);
    }
  }
  g.restore();

  lamps(g, x0, x1, night);

  // Case, dall'alto verso il basso perché quelle davanti coprano quelle dietro.
  const houses = Object.values(city.houses).filter((h) => {
    const [x, y] = parseKey(h.slot);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1 + 1;
  }).sort((a, b) => parseKey(a.slot)[1] - parseKey(b.slot)[1]);
  const lights = [];
  for (const h of houses) {
    const [x, y] = parseKey(h.slot);
    const r = city.residents[h.residentId];
    const online = o.online?.has(h.residentId);
    const t0 = o.born?.get(h.slot);
    const age = t0 !== undefined ? (o.t || 0) - t0 : Infinity;
    const grow = age < 900 ? easeOutBack(Math.max(0, age) / 900) : 1;
    // Vialetto dalla porta alla corsia.
    const dir = city.doors?.[h.slot];
    if (dir) {
      g.fillStyle = C.lane;
      const cx = x * T + T / 2, cy = y * T + T / 2;
      if (dir === 'S') g.fillRect(cx - 2.5, cy + 10, 5, T / 2 - 10);
      else if (dir === 'N') g.fillRect(cx - 2.5, y * T, 5, 6);
      else if (dir === 'E') g.fillRect(cx + 8, cy + 9, T / 2 - 8, 4);
      else g.fillRect(x * T, cy + 9, T / 2 - 8, 4);
    }
    g.save();
    g.translate(x * T + T / 2, y * T + T);
    g.scale(grow, grow);
    g.translate(-T / 2, -T);
    const isFriend = o.friends?.has(h.residentId);
    drawHouse(g, h.style, {
      lit: night && online, night, founder: isFounder(r), cantiere: h.status === 'cantiere',
      flag: h.residentId === o.meId ? '#e0a92a' : isFriend ? '#3f6aa1' : null,
    });
    g.restore();
    if (night && online) lights.push([x * T + 16, y * T + 19]);
    if (age < 1400) sparkle(g, x * T + 16, y * T + 14, age);
  }

  if (night) {
    g.fillStyle = C.night;
    g.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of lights) glow(g, lx, ly, 22, 0.45);
    g.restore();
    lampGlow(g, x0, x1);
  }

  // Etichette dei nomi e selezione.
  const showNames = (o.z || 1) >= 2.2;
  for (const h of houses) {
    const [x, y] = parseKey(h.slot);
    const r = city.residents[h.residentId];
    const sel = o.selected === h.slot;
    if (sel) {
      g.save();
      g.strokeStyle = '#ffd34d'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(x * T + 16, y * T + 28, 16, 5, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    if (r && (showNames || sel || h.residentId === o.meId)) label(g, x * T + 16, y * T + T + 1, r.username, h.residentId === o.meId, o.z || 1);
  }
  if (o.selected && !city.houses[o.selected] && PLAN.lots.has(o.selected)) {
    const [x, y] = parseKey(o.selected);
    g.save();
    g.strokeStyle = '#d4462f'; g.lineWidth = 3;
    g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
    g.restore();
  }

  // Nomi dei quartieri ancora chiusi.
  g.save();
  g.textAlign = 'center';
  for (const d of DISTRICTS) {
    if (d.id <= city.openDistricts) continue;
    const [a, b, c, e] = d.rect;
    const cx = ((a + c + 1) / 2) * T, cy = ((b + e + 1) / 2) * T + (d.id === 4 ? -2 * T : d.id === 5 ? 2 * T : 0);
    if (cx < x0 * T - 200 || cx > x1 * T + 200 || cy < y0 * T - 100 || cy > y1 * T + 100) continue;
    g.font = '700 22px Fredoka, "Trebuchet MS", sans-serif';
    g.fillStyle = 'rgba(60,48,20,0.55)';
    g.fillText(d.name, cx, cy);
    g.font = '600 12px Nunito, "Trebuchet MS", sans-serif';
    g.fillText(d.id === city.openDistricts + 1 ? 'il prossimo quartiere ad aprire' : 'quartiere futuro', cx, cy + 18);
  }
  g.restore();
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
  g.fillStyle = mine ? '#ffd34d' : 'rgba(255,255,255,0.9)';
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
  g.fillStyle = '#fff3b0';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 6 + p * 22;
    g.fillRect(x + Math.cos(a) * r - 1.5, y + Math.sin(a) * r - 1.5, 3, 3);
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
  const s = canvas.width / 40;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.grass;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = C.lane;
  g.fillRect(0, canvas.height - 6 * s, canvas.width, 6 * s);
  g.setTransform(s, 0, 0, s, 4 * s, 2 * s);
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
  const z = 2.6;
  const terrain = drawTerrain(city.openDistricts);
  g.save();
  g.beginPath(); g.rect(mapX, mapY, mapW, mapH); g.clip();
  g.translate(mapX + mapW / 2, mapY + mapH / 2);
  g.scale(z, z);
  g.translate(-(fx + 0.5) * T, -(fy + 0.5) * T);
  const hw = mapW / 2 / z / T, hh = mapH / 2 / z / T;
  drawWorld(g, city, terrain, {
    x0: Math.max(0, Math.floor(fx - hw) - 1), y0: Math.max(0, Math.floor(fy - hh) - 1),
    x1: Math.min(W - 1, Math.ceil(fx + hw) + 1), y1: Math.min(H - 1, Math.ceil(fy + hh) + 1),
  }, { z: 2, selected: null, t: 0 });
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
