// La città in 3D (three.js, caricato a parte come THREE). Il terreno è una superficie a gradoni con
// sopra la stessa pixel art della vista piatta (sampietrini, piazza, campi, acqua); case e negozi
// sono solidi con le facciate dipinte in pixel, il resto (alberi, lampioni, panchine) è low-poly.
// Una casella è un'unità; 32 pixel d'arte fanno un'unità, come nella vista piatta.
// La telecamera guarda dall'alto inclinata e gira attorno al punto che si sta guardando.
import {
  W, H, SEA_Y, PIAZZA, PLAN, FOUNTAIN_AT, key, districtAt, inPiazza, builtCount, isFounder, hash,
  shopAt, BENCHES, PIAZZA_DECOR, STREET, isStreet, isCanal, CANAL, SHOPS, lotFacing,
} from './core.js';
import { rgb, mix, shade, ih } from './art.js';
import {
  townGround, townRamps, townSurface, tileTop, plaster, window3, door3, tiledRoof, ivy, bougainvillea, vitrine3, SHOP_LOOK,
  traffic, carAt, CAR_MODELS, roofOf, doorOf,
} from './town.js';

const PX = 32;
const T3 = () => globalThis.THREE;
export const has3D = () => {
  if (!T3()) return false;
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
};

/* Piccoli attrezzi ------------------------------------------------------------ */

const colCache = new Map();
function col3(hex) {
  let c = colCache.get(hex);
  if (!c) { const v = rgb(hex.startsWith('rgb') ? '#888888' : hex); c = [v[0] / 255, v[1] / 255, v[2] / 255]; colCache.set(hex, c); }
  return c;
}
function canvas2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function pixTex(cv, { repeat = false, smooth = false } = {}) {
  const T = T3();
  const t = new T.CanvasTexture(cv);
  t.magFilter = smooth ? T.LinearFilter : T.NearestFilter;
  t.minFilter = T.LinearMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}

// Primitive di base, senza indici, con le normali per faccia (aspetto low-poly).
let PRIM = null;
function prims() {
  if (PRIM) return PRIM;
  const T = T3();
  const prep = (g) => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return { p: n.attributes.position.array, n: n.attributes.normal.array }; };
  PRIM = {
    box: prep(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
    cyl6: prep(new T.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0)),
    cyl10: prep(new T.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0)),
    cone6: prep(new T.ConeGeometry(1, 1, 6).translate(0, 0.5, 0)),
    cone8: prep(new T.ConeGeometry(1, 1, 8).translate(0, 0.5, 0)),
    pyr: prep(new T.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0)),
    ico0: prep(new T.IcosahedronGeometry(1, 0)),
    ico1: prep(new T.IcosahedronGeometry(1, 1)),
    ball: prep(new T.SphereGeometry(1, 8, 6)),
    disc: prep(new T.CylinderGeometry(1, 1, 1, 16).translate(0, 0.5, 0)),
  };
  return PRIM;
}

// Raccoglie triangoli (posizione, normale, uv, colore) e li trasforma in una sola geometria.
class Mesher {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  get empty() { return this.p.length === 0; }
  tri(a, b, c, ua, ub, uc, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const k = typeof col === 'string' ? col3(col) : col;
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) { this.p.push(p[0], p[1], p[2]); this.n.push(nx, ny, nz); this.uv.push(u[0], u[1]); this.c.push(k[0], k[1], k[2]); }
  }
  // a, b, c, d in senso antiorario visti da fuori; uv: [u0, v0, u1, v1] (da a a c)
  quad(a, b, c, d, col = '#ffffff', uv = [0, 0, 1, 1]) {
    const [u0, v0, u1, v1] = uv;
    this.tri(a, b, c, [u0, v0], [u1, v0], [u1, v1], col);
    this.tri(a, c, d, [u0, v0], [u1, v1], [u0, v1], col);
  }
  // Una primitiva spostata, scalata e ruotata attorno all'asse verticale
  prim(name, x, y, z, sx, sy, sz, col, ry = 0, rz = 0) {
    const P = prims()[name];
    const k = typeof col === 'string' ? col3(col) : col;
    const cy = Math.cos(ry), sy_ = Math.sin(ry), cz = Math.cos(rz), sz_ = Math.sin(rz);
    // Con una scala negativa (coppa rovesciata) i triangoli vanno girati per restare visibili da fuori
    const flip = sx * sy * sz < 0;
    const pt = (i) => {
      // scala, poi inclinazione (z), poi rotazione (y), poi spostamento
      let px = P.p[i] * sx, py = P.p[i + 1] * sy;
      const pz = P.p[i + 2] * sz;
      const qx = px * cz - py * sz_, qy = px * sz_ + py * cz;
      px = qx; py = qy;
      let nx = P.n[i] / sx, ny = P.n[i + 1] / sy;
      const nz = P.n[i + 2] / sz;
      const mx = nx * cz - ny * sz_, my = nx * sz_ + ny * cz;
      nx = mx; ny = my;
      const ox = nx * cy + nz * sy_, oz = -nx * sy_ + nz * cy;
      const l = Math.hypot(ox, ny, oz) || 1;
      return [px * cy + pz * sy_ + x, py + y, -px * sy_ + pz * cy + z, ox / l, ny / l, oz / l];
    };
    for (let i = 0; i < P.p.length; i += 9) {
      const tri = [pt(i), pt(i + 3), pt(i + 6)];
      if (flip) tri.reverse();
      for (const v of tri) { this.p.push(v[0], v[1], v[2]); this.n.push(v[3], v[4], v[5]); this.uv.push(0, 0); this.c.push(k[0], k[1], k[2]); }
    }
  }
  box(x0, y0, z0, x1, y1, z1, col) { this.prim('box', (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col); }
  build() {
    const T = T3();
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
}
}

/* Texture dipinte -------------------------------------------------------------- */

const roofTexCache = new Map();
function roofTex(color) {
  let t = roofTexCache.get(color);
  if (!t) { const cv = canvas2d(64, 64); tiledRoof(cv.getContext('2d'), 0, 64, 64, 0, color, true); t = pixTex(cv, { repeat: true }); roofTexCache.set(color, t); }
  return t;
}
let stoneTexC = null;
function stoneTex() {
  if (stoneTexC) return stoneTexC;
  const cv = canvas2d(32, 32), g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 32);
  for (let r = 0; r < 4; r++) {
    g.fillStyle = 'rgba(70,55,35,0.35)'; g.fillRect(0, r * 8 + 7, 32, 1);
    for (let c = 0; c < 3; c++) g.fillRect(((c * 12 + (r % 2) * 6) % 32), r * 8, 1, 7);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(90,70,40,0.12)'; g.fillRect(Math.floor(ih(r, k, 3) * 30), r * 8 + Math.floor(ih(k, r, 4) * 6), 2, 1); }
  }
  stoneTexC = pixTex(cv, { repeat: true });
  return stoneTexC;
}
let brickTexC = null;
function brickTex() {
  if (brickTexC) return brickTexC;
  const cv = canvas2d(32, 32), g = cv.getContext('2d');
  g.fillStyle = '#c98a5e'; g.fillRect(0, 0, 32, 32);
  for (let r = 0; r < 8; r++) {
    g.fillStyle = 'rgba(90,40,20,0.35)'; g.fillRect(0, r * 4 + 3, 32, 1);
    for (let c = 0; c < 4; c++) g.fillRect((c * 8 + (r % 2) * 4) % 32, r * 4, 1, 3);
    for (let c = 0; c < 4; c++) { g.fillStyle = ih(r, c, 9) > 0.5 ? 'rgba(255,220,190,0.18)' : 'rgba(120,50,25,0.15)'; g.fillRect((c * 8 + (r % 2) * 4 + 1) % 32, r * 4, 6, 3); }
  }
  brickTexC = pixTex(cv, { repeat: true });
  return brickTexC;
}
let waveTexC = null;
function waveTex() {
  if (waveTexC) return waveTexC;
  const cv = canvas2d(128, 128), g = cv.getContext('2d');
  g.fillStyle = '#d8e8ee'; g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 70; k++) {
    g.fillStyle = k % 3 ? 'rgba(255,255,255,0.85)' : 'rgba(120,160,180,0.35)';
    g.fillRect(Math.floor(ih(k, 1, 5) * 128), Math.floor(ih(k, 2, 5) * 128), 4 + Math.floor(ih(k, 3, 5) * 8), 1);
  }
  waveTexC = pixTex(cv, { repeat: true, smooth: true });
  waveTexC.repeat.set(24, 24);
  return waveTexC;
}
let signTexC = null;
function signTex() {
  if (signTexC) return signTexC;
  const cv = canvas2d(64, 32), g = cv.getContext('2d');
  g.fillStyle = '#7a5434'; g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#f3e3c0'; g.fillRect(2, 2, 60, 28);
  g.fillStyle = 'rgba(120,80,40,0.25)'; for (let y = 8; y < 30; y += 7) g.fillRect(2, y, 60, 1);
  g.fillStyle = '#2f6b4f'; g.font = '800 15px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LIBERO', 32, 17);
  signTexC = pixTex(cv, { smooth: true });
  return signTexC;
}
let glowTexC = null;
function glowTex() {
  if (glowTexC) return glowTexC;
  const cv = canvas2d(64, 64), g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,236,180,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,0.55)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTexC = pixTex(cv, { smooth: true });
  return glowTexC;
}
function stripeTex(a, b, n = 8, scallop = true) {
  const cv = canvas2d(64, 20), g = cv.getContext('2d');
  const sw = 64 / n;
  for (let k = 0; k < n; k++) {
    g.fillStyle = k % 2 ? b : a; g.fillRect(k * sw, 0, sw, 14);
    if (scallop) { g.beginPath(); g.arc(k * sw + sw / 2, 14, sw / 2, 0, Math.PI); g.fill(); }
  }
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 1, 64, 1);
  return pixTex(cv);
}

// Il terreno di tutta la mappa in un'unica immagine (32 pixel per casella), come la vista piatta.
function paintGround(city, G) {
  const cv = canvas2d(W * PX, H * PX), g = cv.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tileTop(g, city, G, x, y, x * PX, y * PX, true, false);
  // Cerchi di pietra attorno alla fontana (qui visti dall'alto: tondi)
  const [fx, fy] = PIAZZA_DECOR.fountain, cx = (fx + 0.5) * PX, cy = (fy + 0.5) * PX;
  const rings = [[78, '#d8c19c'], [70, '#e7d5b6'], [62, '#cfb48d'], [56, '#ead9bc'], [48, '#dcc5a1']];
  for (const [r, c] of rings) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(110,80,45,0.28)'; g.lineWidth = 1; g.stroke(); }
  g.beginPath();
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    for (const [r0, r1] of [[48, 56], [56, 62], [62, 70], [70, 78]]) {
      if ((k + r0) % 2) continue;
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
  }
  g.strokeStyle = 'rgba(110,80,45,0.22)'; g.stroke();
  return cv;
}

/* Facciate in pixel: stesse finestre, porte e fiori della vista piatta ---------- */

function houseLook(style) {
  const hs = hash(style.wall + style.roof + style.door + style.shape);
  const flowers = hs % 3 !== 2 ? [['#e85d75', '#f6d84a'], ['#b46ad6', '#f28cbf'], ['#e8423a', '#ffffff']][hs % 3] : null;
  return { hs, flowers, wall: style.wall, roof: roofOf(style.roof), door: doorOf(style.door) };
}
// Facciata davanti, in (ox, oy) dell'atlante, larga w e alta Hh pixel. Restituisce le finestre.
function paintFront(g, ox, oy, w, Hh, style, look, { tower = false, founder = false } = {}) {
  const o = { lit: false, night: false, door: look.door, detail: true, wins: [], flowers: look.flowers };
  g.save(); g.translate(ox, oy);
  const x0 = 0, x1 = w, mx = Math.round(w / 2), by = Hh, y0 = 0;
  plaster(g, x0, y0, w, Hh, look.wall, look.hs, true);
  g.fillStyle = 'rgba(30,15,5,0.28)'; g.fillRect(x0, 0, w, 3);
  g.fillStyle = '#b3a487'; g.fillRect(x0, by - 6, w, 6);
  g.fillStyle = '#9c8c6e'; for (let k = 0; k < w; k += 8) g.fillRect(x0 + k, by - 6, 1, 6); g.fillRect(x0, by - 3, w, 1); g.fillStyle = '#cbbd9f'; g.fillRect(x0, by - 6, w, 1);
  const floors = Hh > 50 ? 2 : 1;
  if (floors === 2) { g.fillStyle = shade(look.wall, 0.14); g.fillRect(x0, by - 36, w, 2); g.fillStyle = 'rgba(30,15,5,0.2)'; g.fillRect(x0, by - 34, w, 1); }
  const dw = 12, dh = 24, dx = tower ? x0 + 6 : Math.round(mx - dw / 2);
  door3(g, dx, by - dh - 3, dw, dh, look.door);
  const ww = 8, wh = 13;
  if (tower) window3(g, x1 - 6 - ww - 5, by - 29, ww + 4, wh, o);
  else { window3(g, x0 + 6, by - 29, ww, wh, o); window3(g, x1 - 6 - ww, by - 29, ww, wh, o); }
  const lx = dx + dw / 2;
  g.fillStyle = '#1f2a26'; g.fillRect(lx - 0.5, by - dh - 14, 1, 2); g.fillRect(lx - 2, by - dh - 12, 4, 3);
  g.fillStyle = '#f6e7c1'; g.fillRect(lx - 1, by - dh - 11, 2, 1);
  o.wins.push([[lx - 2, by - dh - 12], [lx + 2, by - dh - 12], [lx + 2, by - dh - 9], [lx - 2, by - dh - 9]]);
  if (floors === 2) {
    if (tower) { window3(g, x0 + 7, y0 + 9, ww, wh, o); window3(g, x1 - 6 - ww - 5, y0 + 9, ww + 4, wh, o); }
    else {
      window3(g, x0 + 6, y0 + 9, ww, wh, o); window3(g, x1 - 6 - ww, y0 + 9, ww, wh, o);
      window3(g, mx - 5, y0 + 7, 10, 20, o, { box: false, shut: false });
      const bx = mx - 10, bw = 20, ry = y0 + 19;
      g.fillStyle = '#1f2a26'; g.fillRect(bx, ry, bw, 1);
      for (let k = 0; k <= 6; k++) g.fillRect(Math.min(bx + k * 3, bx + bw - 1), ry, 1, 8);
      if (o.flowers) for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#3f8634' : o.flowers[0]; g.fillRect(bx + 1 + k * 3, ry + 6, 2, 2); if (k % 3 === 0) { g.fillStyle = '#56a043'; g.fillRect(bx + 1 + k * 3, ry + 10, 1, 3 + (k % 2) * 2); } }
    }
  }
  if (founder) { g.fillStyle = '#7a5a1a'; g.fillRect(dx + dw + 3, by - 20, 6, 5); g.fillStyle = '#e2bf4f'; g.fillRect(dx + dw + 4, by - 19, 4, 3); }
  if (look.hs % 4 === 0) ivy(g, x1 - 12, x1 - 1, y0 + 4, by - 6, look.hs);
  if (look.hs % 3 === 0) { bougainvillea(g, x0, y0 + 4, x0 + 8, by - 8, look.hs, 26); bougainvillea(g, dx - 7, by - dh - 10, dx + dw + 7, by - dh - 3, look.hs + 7, 14); }
  g.restore();
  return o.wins.map((q) => q.map(([x, y]) => [x + ox, y + oy]));
}
// Fianco o retro: intonaco, zoccolo, finestre in fila per piano.
function paintSide(g, ox, oy, w, Hh, look, seed) {
  const o = { lit: false, night: false, door: look.door, detail: true, wins: [], flowers: seed % 2 ? look.flowers : null };
  g.save(); g.translate(ox, oy);
  plaster(g, 0, 0, w, Hh, shade(look.wall, -0.03), look.hs + seed, true);
  g.fillStyle = 'rgba(30,15,5,0.28)'; g.fillRect(0, 0, w, 3);
  g.fillStyle = '#b3a487'; g.fillRect(0, Hh - 6, w, 6); g.fillStyle = '#cbbd9f'; g.fillRect(0, Hh - 6, w, 1);
  const floors = Hh > 50 ? 2 : 1;
  if (floors === 2) { g.fillStyle = shade(look.wall, 0.14); g.fillRect(0, Hh - 36, w, 2); }
  const n = Math.max(1, Math.floor(w / 26));
  for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) window3(g, Math.round((i + 0.5) * w / n - 4), f === 0 ? Hh - 29 : 9, 8, 13, o);
  if (seed === 2 && look.hs % 5 === 1) ivy(g, 2, 14, 6, Hh - 6, look.hs + 3);
  g.restore();
  return o.wins.map((q) => q.map(([x, y]) => [x + ox, y + oy]));
}
function paintShopFront(g, ox, oy, w, Hh, shop) {
  const st = SHOP_LOOK[shop.id];
  const wins = [];
  g.save(); g.translate(ox, oy);
  const x0 = 0, x1 = w, cx = w / 2, by = Hh, y0 = 0;
  plaster(g, x0, y0, w, Hh, st.wall, shop.x0, true);
  g.fillStyle = 'rgba(30,15,5,0.2)'; g.fillRect(x0, 0, w, 3);
  const o = { lit: false, night: false, door: st.trim, detail: true, wins, flowers: ['#e85d75', '#f6d84a'] };
  for (const wx of [x0 + 7, Math.round(cx - 4), x1 - 15]) window3(g, wx, y0 + 9, 8, 13, o, { shut: false });
  const sy = by - 52;
  g.fillStyle = shade(st.sign, -0.35); g.fillRect(x0 + 4, sy, w - 8, 13);
  g.fillStyle = st.sign; g.fillRect(x0 + 5, sy + 1, w - 10, 11);
  g.fillStyle = st.ink; g.font = '800 8px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(shop.sign, cx, sy + 7); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = st.trim; g.fillRect(x0, by - 5, w, 5);
  vitrine3(g, x0 + 4, by - 30, 17, 25, shop.kind, false, 0, wins);
  vitrine3(g, x1 - 21, by - 30, 17, 25, shop.kind, false, 3, wins);
  g.fillStyle = shade(st.trim, -0.3); g.fillRect(cx - 8, by - 33, 16, 28);
  g.fillStyle = st.trim; g.fillRect(cx - 7, by - 32, 14, 27);
  g.fillStyle = '#a9d3e4'; g.fillRect(cx - 5, by - 30, 10, 25);
  g.fillStyle = st.trim; g.fillRect(cx - 0.5, by - 30, 1, 25);
  wins.push([[cx - 5, by - 30], [cx + 5, by - 30], [cx + 5, by - 5], [cx - 5, by - 5]]);
  if (shop.kind === 'wear') { bougainvillea(g, x0, y0, x0 + 6, by - 8, 3, 28); bougainvillea(g, x1 - 6, y0, x1, by - 8, 9, 28); }
  if (shop.kind === 'furni') ivy(g, x0 + 1, x0 + 8, y0 + 4, by - 8, 21);
  g.restore();
  return wins.map((q) => q.map(([x, y]) => [x + ox, y + oy]));
}
// Le finestre accese, su uno sfondo nero grande quanto l'atlante (luce propria di notte).
function paintLights(w, h, wins) {
  const cv = canvas2d(w, h), g = cv.getContext('2d');
  g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffc861';
  for (const q of wins) { g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fill(); }
  return pixTex(cv);
}

/* Case --------------------------------------------------------------------------- */

const HW = 58;                        // larghezza della casa in pixel (sta nel suo mezzo isolato)
let MAT = null;
function mats() {
  if (MAT) return MAT;
  const T = T3();
  MAT = {
    vc: new T.MeshLambertMaterial({ vertexColors: true }),
    vcFlat: new T.MeshLambertMaterial({ vertexColors: true }),
    stone: new T.MeshLambertMaterial({ vertexColors: true, map: stoneTex() }),
    brick: new T.MeshLambertMaterial({ map: brickTex() }),
    lantern: new T.MeshLambertMaterial({ color: '#fff1c2', emissive: '#ffcf6a', emissiveIntensity: 0 }),
    tarp: new T.MeshLambertMaterial({ color: '#4f8fc8', transparent: true, opacity: 0.7, side: T.DoubleSide }),
    shadow: new T.MeshBasicMaterial({ color: '#10200c', transparent: true, opacity: 0.25, depthWrite: false }),
  };
  return MAT;
}
const roofMats = new Map();
function roofMat(color) {
  let m = roofMats.get(color);
  if (!m) { m = new (T3().MeshLambertMaterial)({ map: roofTex(color) }); roofMats.set(color, m); }
  return m;
}

// Casa con la facciata verso +z, centrata in x=0, z=0 sul fronte, base a y=0.
// Restituisce il gruppo e il materiale dei muri (per accendere le finestre di notte).
export function buildHouse(style, { cantiere = false, founder = false, flag = null } = {}) {
  const T = T3();
  const M = mats();
  const look = houseLook(style);
  const grp = new T.Group();
  const shape = style.shape;
  const u = (px) => px / PX;
  if (cantiere) {
    const m = new Mesher();
    const w = u(HW), d = u(64);
    m.box(-w / 2, 0, -d, w / 2, u(8), 0, '#b9aa8c');
    m.box(-w / 2 + 0.12, u(8), -d + 0.12, w / 2 - 0.12, u(34), -0.12, mix(look.wall, '#c9bba4', 0.5));
    for (const px of [-w / 2, -w / 6, w / 6, w / 2]) for (const pz of [0.05, -d - 0.05]) m.box(px - 0.03, 0, pz - 0.03, px + 0.03, u(60), pz + 0.03, '#b8873c');
    for (const py of [u(20), u(38), u(56)]) { m.box(-w / 2 - 0.05, py, 0.02, w / 2 + 0.05, py + 0.05, 0.1, '#b8873c'); m.box(-w / 2 - 0.05, py, -d - 0.1, w / 2 + 0.05, py + 0.05, -d - 0.02, '#b8873c'); }
    m.box(w / 2 - 0.35, 0, -d / 2 - 0.1, w / 2 - 0.2, u(96), -d / 2 + 0.05, '#e0a92a');
    m.box(-w / 2 - 0.4, u(92), -d / 2 - 0.08, w / 2 - 0.2, u(98), -d / 2 + 0.03, '#e0a92a');
    for (let k = 0; k < 5; k++) m.box(-w / 2 + k * 0.38, 0, 0.12, -w / 2 + k * 0.38 + 0.22, 0.12, 0.18, k % 2 ? '#f1ede4' : '#c0392b');
    const mesh = new T.Mesh(m.build(), M.vcFlat); mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh);
    const tarp = new T.Mesh(new T.PlaneGeometry(w * 0.5, u(30)), M.tarp); tarp.position.set(-w / 4, u(40), 0.08); grp.add(tarp);
    return { group: grp, wallMat: null, top: u(98) };
  }
  const tw = shape === 'torretta' ? 18 : 0;
  const bodyW = HW - (tw ? tw - 2 : 0);
  const Hh = shape === 'villetta' ? 40 : 66;
  const D = shape === 'villetta' ? 56 : 60;            // due case schiena contro schiena nell'isolato
  const th = Hh + 20;
  // Atlante: davanti | fianco | retro | (torretta: davanti | fianco), con 2 pixel di margine
  const regions = [];
  let ax = 2;
  const reg = (w, h) => { const r = { x: ax, y: 2, w, h }; ax += w + 4; regions.push(r); return r; };
  const rF = reg(bodyW, Hh), rS = reg(D, Hh), rB = reg(bodyW, Hh);
  const rTF = tw ? reg(tw, th) : null, rTS = tw ? reg(tw, th) : null;
  const AW = ax, AH = Math.max(Hh, tw ? th : 0) + 4;
  const atlas = canvas2d(AW, AH), ag = atlas.getContext('2d');
  ag.fillStyle = look.wall; ag.fillRect(0, 0, AW, AH);
  const wins = [];
  wins.push(...paintFront(ag, rF.x, rF.y, bodyW, Hh, style, look, { tower: !!tw, founder }));
  wins.push(...paintSide(ag, rS.x, rS.y, D, Hh, look, 1));
  wins.push(...paintSide(ag, rB.x, rB.y, bodyW, Hh, look, 2));
  if (tw) {
    const o = { lit: false, night: false, door: look.door, detail: true, wins, flowers: look.flowers };
    for (const r of [rTF, rTS]) {
      plaster(ag, r.x, r.y, tw, th, shade(look.wall, 0.04), look.hs + 1, true);
      ag.fillStyle = '#b3a487'; ag.fillRect(r.x, r.y + th - 6, tw, 6);
      window3(ag, r.x + 6, r.y + 9, 6, 11, o, { box: false, shut: false });
      window3(ag, r.x + 6, r.y + th - Hh + 9, 6, 13, o, { shut: false });
      window3(ag, r.x + 6, r.y + th - 29, 6, 13, o, { shut: false });
    }
  }
  const tex = pixTex(atlas);
  const wallMat = new T.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveIntensity: 0 });
  wallMat.userData.lights = () => (wallMat.userData.lt ||= paintLights(AW, AH, wins));
  const uvOf = (r) => [r.x / AW, 1 - (r.y + r.h) / AH, (r.x + r.w) / AW, 1 - r.y / AH];
  // Muri
  const x0 = u(-HW / 2 + (tw ? tw - 2 : 0)), x1 = u(HW / 2), z1 = 0, z0 = -u(D), y1 = u(Hh);
  const wm = new Mesher();
  wm.quad([x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1], '#ffffff', uvOf(rF));
  wm.quad([x1, 0, z1], [x1, 0, z0], [x1, y1, z0], [x1, y1, z1], '#ffffff', uvOf(rS));
  wm.quad([x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0], '#ffffff', uvOf(rS));
  wm.quad([x1, 0, z0], [x0, 0, z0], [x0, y1, z0], [x1, y1, z0], '#ffffff', uvOf(rB));
  let tx0, tx1, tz0, ty1;
  if (tw) {
    tx0 = u(-HW / 2); tx1 = tx0 + u(tw); tz0 = -u(tw) - 0.02; ty1 = u(th);
    const zf = 0.04;
    wm.quad([tx0, 0, zf], [tx1, 0, zf], [tx1, ty1, zf], [tx0, ty1, zf], '#ffffff', uvOf(rTF));
    wm.quad([tx0, 0, tz0], [tx0, 0, zf], [tx0, ty1, zf], [tx0, ty1, tz0], '#ffffff', uvOf(rTS));
    wm.quad([tx1, 0, zf], [tx1, 0, tz0], [tx1, ty1, tz0], [tx1, ty1, zf], '#ffffff', uvOf(rTS));
    wm.quad([tx1, 0, tz0], [tx0, 0, tz0], [tx0, ty1, tz0], [tx1, ty1, tz0], '#ffffff', uvOf(rTS));
  }
  const walls = new T.Mesh(wm.build(), wallMat);
  walls.castShadow = walls.receiveShadow = true;
  grp.add(walls);
  // Tetto
  const rm = new Mesher();
  const ex = new Mesher();
  const o = 0.12, zm = (z0 + z1) / 2, d = z1 - z0;
  const gableCol = shade(look.wall, -0.06);
  let top;
  if (shape === 'villetta') {
    const rh = u(26), hx = d / 2 * 0.85, yt = y1 + rh;
    const sl = Math.hypot(d / 2 + o, rh) * 0.5;
    rm.quad([x0 - o, y1, z1 + o], [x1 + o, y1, z1 + o], [x1 - hx, yt, zm], [x0 + hx, yt, zm], '#ffffff', [0, 0, (x1 - x0 + 2 * o) * 0.5, sl]);
    rm.quad([x1 + o, y1, z0 - o], [x0 - o, y1, z0 - o], [x0 + hx, yt, zm], [x1 - hx, yt, zm], '#ffffff', [0, 0, (x1 - x0 + 2 * o) * 0.5, sl]);
    rm.tri([x0 - o, y1, z0 - o], [x0 - o, y1, z1 + o], [x0 + hx, yt, zm], [0, 0], [d * 0.5, 0], [d * 0.25, sl], '#ffffff');
    rm.tri([x1 + o, y1, z1 + o], [x1 + o, y1, z0 - o], [x1 - hx, yt, zm], [0, 0], [d * 0.5, 0], [d * 0.25, sl], '#ffffff');
    // Abbaino sulla falda davanti
    const ax0 = -0.2, ax1 = 0.2, az = z1 - 0.25, ay = y1 + rh * 0.3;
    ex.box(ax0, ay - 0.1, az - 0.35, ax1, ay + 0.32, az, look.wall);
    ex.quad([ax0 + 0.08, ay, az + 0.005], [ax1 - 0.08, ay, az + 0.005], [ax1 - 0.08, ay + 0.22, az + 0.005], [ax0 + 0.08, ay + 0.22, az + 0.005], '#5f97b8');
    ex.prim('pyr', 0, ay + 0.32, az - 0.17, 0.32, 0.2, 0.3, look.roof);
    top = yt;
  } else {
    const rh = u(26), yt = y1 + rh;
    const sl = Math.hypot(d / 2 + o, rh) * 0.5;
    rm.quad([x0 - o, y1 - 0.04, z1 + o], [x1 + o, y1 - 0.04, z1 + o], [x1 + o, yt, zm], [x0 - o, yt, zm], '#ffffff', [0, 0, (x1 - x0 + 2 * o) * 0.5, sl]);
    rm.quad([x1 + o, y1 - 0.04, z0 - o], [x0 - o, y1 - 0.04, z0 - o], [x0 - o, yt, zm], [x1 + o, yt, zm], '#ffffff', [0, 0, (x1 - x0 + 2 * o) * 0.5, sl]);
    ex.tri([x0, y1, z0], [x0, y1, z1], [x0, yt, zm], [0, 0], [1, 0], [0, 1], gableCol);
    ex.tri([x1, y1, z1], [x1, y1, z0], [x1, yt, zm], [0, 0], [1, 0], [0, 1], gableCol);
    // Colmo e comignolo
    ex.box(x0 - o, yt - 0.03, zm - 0.05, x1 + o, yt + 0.04, zm + 0.05, shade(look.roof, -0.25));
    const kx = x1 - 0.5;
    ex.box(kx, y1 + rh * 0.4, zm - 0.55, kx + 0.26, yt + 0.32, zm - 0.3, shade(look.wall, -0.3));
    ex.box(kx - 0.03, yt + 0.32, zm - 0.58, kx + 0.29, yt + 0.38, zm - 0.27, '#7a3f22');
    top = yt + 0.38;
    // Balcone: soletta sotto la portafinestra
    if (!tw) ex.box(-0.33, y1 - u(29), 0, 0.33, y1 - u(27), 0.22, '#d6cbb3');
  }
  if (tw) {
    rm.prim('pyr', (tx0 + tx1) / 2, ty1, (tz0 + 0.04) / 2, (tx1 - tx0) * 0.78, u(24), (0.04 - tz0) * 0.78, '#ffffff');
    ex.box((tx0 + tx1) / 2 - 0.015, ty1 + u(24), (tz0 + 0.04) / 2 - 0.015, (tx0 + tx1) / 2 + 0.015, ty1 + u(30), (tz0 + 0.04) / 2 + 0.015, '#3b3f45');
    top = Math.max(top, ty1 + u(30));
  }
  const roof = new T.Mesh(rm.build(), roofMat(look.roof));
  roof.castShadow = roof.receiveShadow = true;
  grp.add(roof);
  // Gradino, vasi alla porta, giardino, oggetto davanti
  const doorX = tw ? x0 + u(12) : 0;
  ex.box(doorX - u(10), 0, 0, doorX + u(10), 0.05, 0.12, '#cfc3a8');
  for (const [px, i] of [[doorX - 0.32, 0], [doorX + 0.32, 1]]) potIn(ex, px, 0, 0.2, look.hs + i);
  gardenIn(ex, style.garden, x0, x1, z0, look.hs);
  decoIn(ex, style.deco, x1 - 0.3, 0.32);
  if (flag) {
    const fx = x0 + 0.15, fz = z1 - 0.2;
    ex.box(fx - 0.015, y1, fz - 0.015, fx + 0.015, top + 0.5, fz + 0.015, '#3b3f45');
    ex.tri([fx, top + 0.48, fz], [fx + 0.36, top + 0.38, fz], [fx, top + 0.28, fz], [0, 0], [1, 0], [0, 1], flag);
    ex.tri([fx, top + 0.48, fz], [fx, top + 0.28, fz], [fx + 0.36, top + 0.38, fz], [0, 0], [1, 0], [0, 1], flag);
    top += 0.5;
  }
  const extra = new T.Mesh(ex.build(), M.vcFlat);
  extra.castShadow = extra.receiveShadow = true;
  grp.add(extra);
  return { group: grp, wallMat, top };
}
// Vaso di coccio con una pianta fiorita
function potIn(m, x, y, z, seed) {
  const fl = ['#e85d75', '#b46ad6', '#f08a3c', '#ffffff'][seed % 4];
  m.prim('cyl6', x, y, z, 0.09, 0.16, 0.09, '#c66a3c');
  m.prim('ico0', x, y + 0.26, z, 0.13, 0.12, 0.13, '#4c8a3a', seed);
  m.prim('ico0', x + 0.04, y + 0.32, z + 0.03, 0.05, 0.05, 0.05, fl);
  m.prim('ico0', x - 0.05, y + 0.29, z + 0.05, 0.04, 0.04, 0.04, fl);
}
function bushIn(m, x, y, z, s, col, flower) {
  m.prim('ico1', x, y + 0.16 * s, z, 0.26 * s, 0.2 * s, 0.26 * s, col);
  if (flower) for (let k = 0; k < 5; k++) { const a = k * 1.3; m.prim('ico0', x + Math.cos(a) * 0.17 * s, y + (0.24 + (k % 2) * 0.08) * s, z + Math.sin(a) * 0.17 * s, 0.05, 0.05, 0.05, flower); }
}
// Il giardino sta davanti all'angolo sinistro della casa (dietro c'è la casa dell'altra via)
function gardenIn(m, garden, x0, x1, z0, seed) {
  const gx = x0 + 0.22, gz = 0.24;
  if (garden === 'fiori') {
    m.box(gx - 0.2, 0, gz - 0.12, gx + 0.2, 0.12, gz + 0.12, '#8e3f2b');
    bushIn(m, gx - 0.08, 0.1, gz, 0.55, '#4c973d', '#e85d75'); bushIn(m, gx + 0.1, 0.1, gz, 0.5, '#4c973d', '#f6d84a');
  } else if (garden === 'orto') {
    m.box(gx - 0.2, 0, gz - 0.13, gx + 0.2, 0.12, gz + 0.13, '#6e4a2c');
    for (let c = 0; c < 3; c++) m.prim('ico0', gx - 0.12 + c * 0.12, 0.16, gz, 0.06, 0.07, 0.06, c === 1 ? '#e8423a' : '#5f9a3c');
  } else if (garden === 'ulivo') { m.prim('cyl6', gx, 0, gz, 0.15, 0.22, 0.15, '#c66a3c'); treeIn(m, 'ulivo', gx, 0.2, gz, 0.55, seed); }
  else if (garden === 'nessuno') m.box(gx - 0.2, 0, gz - 0.12, gx + 0.2, 0.03, gz + 0.12, '#d8cfbd');
  else bushIn(m, gx, 0, gz, 0.6, '#5f9a3c', null);
  void x1; void z0;
}
function decoIn(m, deco, x, z) {
  if (deco === 'vespa') {
    m.prim('cyl10', x - 0.14, 0.06, z, 0.06, 0.03, 0.06, '#1f1f1f', 0, Math.PI / 2); m.prim('cyl10', x + 0.14, 0.06, z, 0.06, 0.03, 0.06, '#1f1f1f', 0, Math.PI / 2);
    m.box(x - 0.18, 0.08, z - 0.07, x + 0.1, 0.2, z + 0.07, '#7fc8b8'); m.box(x + 0.08, 0.08, z - 0.05, x + 0.15, 0.36, z + 0.05, '#7fc8b8');
    m.box(x - 0.16, 0.2, z - 0.05, x - 0.02, 0.24, z + 0.05, '#5b4a3a'); m.box(x + 0.1, 0.36, z - 0.1, x + 0.14, 0.38, z + 0.1, '#c9c9c9');
  } else if (deco === 'bici') {
    for (const dx of [-0.15, 0.15]) m.prim('cyl10', x + dx, 0.11, z, 0.11, 0.02, 0.11, '#1f1f1f', Math.PI / 2, Math.PI / 2);
    m.box(x - 0.15, 0.12, z - 0.01, x + 0.15, 0.15, z + 0.01, '#c0392b'); m.box(x - 0.02, 0.12, z - 0.01, x + 0.01, 0.28, z + 0.01, '#c0392b');
  } else if (deco === 'panchina') benchIn(m, x - 0.1, z, 0);
  else if (deco === 'limoni') { m.prim('cyl6', x, 0, z, 0.12, 0.2, 0.12, '#c66a3c'); m.prim('ico1', x, 0.42, z, 0.2, 0.22, 0.2, '#3f7d34'); for (const [dx, dy] of [[0.12, 0.42], [-0.1, 0.5], [0.04, 0.6]]) m.prim('ico0', x + dx, dy, z + 0.12, 0.04, 0.04, 0.04, '#f6d84a'); }
  else if (deco === 'cane') { m.box(x - 0.18, 0, z - 0.2, x + 0.18, 0.26, z + 0.15, '#a0522d'); m.prim('pyr', x, 0.26, z - 0.02, 0.3, 0.16, 0.27, '#7a3f22'); m.box(x - 0.06, 0, z + 0.15, x + 0.06, 0.16, z + 0.151, '#2b2118'); }
}
function benchIn(m, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  for (const dx of [-0.32, 0.32]) { const [px, pz] = P(dx, 0); m.prim('box', px, 0, pz, 0.06, 0.2, 0.24, '#8f8a80', ry); }
  for (let k = 0; k < 3; k++) { const [px, pz] = P(0, -0.08 + k * 0.08); m.prim('box', px, 0.2, pz, 0.8, 0.03, 0.06, '#9a6a43', ry); }
  for (let k = 0; k < 2; k++) { const [px, pz] = P(0, -0.13); m.prim('box', px, 0.27 + k * 0.08, pz, 0.8, 0.05, 0.03, '#8a5a36', ry); }
}

/* Negozi ----------------------------------------------------------------------------- */

export function buildShop(shop) {
  const T = T3();
  const M = mats();
  const st = SHOP_LOOK[shop.id];
  const u = (px) => px / PX;
  const Wp = 60, Hh = 80, D = 54;
  const grp = new T.Group();
  const AW = Wp + D + 8, AH = Hh + 4;
  const atlas = canvas2d(AW, AH), g = atlas.getContext('2d');
  g.fillStyle = st.wall; g.fillRect(0, 0, AW, AH);
  const wins = paintShopFront(g, 2, 2, Wp, Hh, shop);
  const look = { wall: st.wall, door: st.trim, flowers: ['#e85d75', '#f6d84a'], hs: shop.x0 };
  wins.push(...paintSide(g, Wp + 6, 2, D, Hh, look, 1));
  const tex = pixTex(atlas);
  const wallMat = new T.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveIntensity: 0 });
  wallMat.userData.lights = () => (wallMat.userData.lt ||= paintLights(AW, AH, wins));
  const x0 = -u(Wp / 2), x1 = u(Wp / 2), z1 = 0, z0 = -u(D), y1 = u(Hh);
  const uvF = [2 / AW, 1 - (2 + Hh) / AH, (2 + Wp) / AW, 1 - 2 / AH], uvS = [(Wp + 6) / AW, 1 - (2 + Hh) / AH, (Wp + 6 + D) / AW, 1 - 2 / AH];
  const wm = new Mesher();
  wm.quad([x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1], '#ffffff', uvF);
  wm.quad([x1, 0, z1], [x1, 0, z0], [x1, y1, z0], [x1, y1, z1], '#ffffff', uvS);
  wm.quad([x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0], '#ffffff', uvS);
  wm.quad([x1, 0, z0], [x0, 0, z0], [x0, y1, z0], [x1, y1, z0], '#ffffff', uvS);
  const walls = new T.Mesh(wm.build(), wallMat); walls.castShadow = walls.receiveShadow = true; grp.add(walls);
  // Tetto piano con parapetto e condizionatore, gradino, vasi
  const ex = new Mesher();
  ex.box(x0, y1 - 0.01, z0, x1, y1 + 0.02, z1, '#9d978b');
  for (const [a, b, c, d] of [[x0 - 0.03, z1 - 0.08, x1 + 0.03, z1 + 0.03], [x0 - 0.03, z0 - 0.03, x1 + 0.03, z0 + 0.08], [x0 - 0.03, z0, x0 + 0.08, z1], [x1 - 0.08, z0, x1 + 0.03, z1]]) ex.box(a, y1, b, c, y1 + 0.18, d, shade(st.wall, -0.15));
  ex.box(x1 - 0.65, y1, z0 + 0.35, x1 - 0.25, y1 + 0.32, z0 + 0.75, '#c9c3b5');
  ex.box(x0 + 0.3, 0, 0, x1 - 0.3, 0.05, 0.14, '#cfc3a8');
  potIn(ex, -0.38, 0, 0.22, shop.id.length); potIn(ex, 0.38, 0, 0.22, shop.id.length + 2);
  if (shop.kind === 'ride') { decoIn(ex, 'bici', x0 + 0.1, 0.45); decoIn(ex, 'bici', x1 - 0.2, 0.45); }
  const extra = new T.Mesh(ex.build(), M.vcFlat); extra.castShadow = extra.receiveShadow = true; grp.add(extra);
  // Tenda a strisce che sporge sul marciapiede
  const aw = new T.Mesh(new T.PlaneGeometry(x1 - x0 + 0.04, 0.5), new T.MeshLambertMaterial({ map: stripeTex(st.awning[0], st.awning[1]), side: T.DoubleSide, transparent: true, alphaTest: 0.5 }));
  aw.rotation.x = -0.75; aw.position.set(0, u(38) - 0.08, 0.17); aw.castShadow = true;
  grp.add(aw);
  return { group: grp, wallMat, top: y1 + 0.3 };
}

/* Alberi, lampioni, piazza: tutto in una geometria sola ----------------------------- */

function treeIn(m, kind, x, y, z, s, seed) {
  const j = (k) => (ih(seed, k, 71) - 0.5);
  const green = (base) => mix(base, j(1) > 0 ? '#9ccf6e' : '#2f5e2c', Math.abs(j(2)) * 0.5);
  const trunk = '#6b4a2f';
  if (kind === 'cipresso') {
    m.prim('cyl6', x, y, z, 0.05 * s, 0.3 * s, 0.05 * s, trunk);
    m.prim('cone6', x, y + 0.2 * s, z, 0.24 * s, 1.75 * s, 0.24 * s, green('#2f5e2c'), seed);
    m.prim('ico0', x, y + 0.55 * s, z, 0.25 * s, 0.4 * s, 0.25 * s, green('#336a2f'), seed);
  } else if (kind === 'pino') {
    m.prim('cyl6', x, y, z, 0.06 * s, 1.5 * s, 0.06 * s, '#7a5536', 0, j(3) * 0.2);
    m.prim('ball', x + j(3) * -0.25 * s, y + 1.5 * s, z, 0.7 * s, 0.26 * s, 0.62 * s, green('#3f6e30'), seed);
    m.prim('ball', x + j(3) * -0.25 * s + 0.12, y + 1.62 * s, z - 0.08, 0.45 * s, 0.18 * s, 0.4 * s, green('#4b7d38'), seed);
  } else if (kind === 'ulivo') {
    m.prim('cyl6', x, y, z, 0.07 * s, 0.45 * s, 0.07 * s, '#8a7a62', 0, j(4) * 0.3);
    m.prim('ico1', x, y + 0.62 * s, z, 0.42 * s, 0.3 * s, 0.4 * s, green('#8aa36a'), seed);
    m.prim('ico0', x + 0.18 * s, y + 0.74 * s, z + 0.1 * s, 0.22 * s, 0.17 * s, 0.22 * s, '#9db37c', seed);
  } else if (kind === 'cespuglio') {
    bushIn(m, x, y, z, s * 1.1, green('#4c8a3a'), null);
  } else {
    const leaf = kind === 'fiorito' ? mix('#f2a3c3', '#e47aa8', Math.abs(j(2))) : green('#4f9a3c');
    m.prim('cyl6', x, y, z, 0.07 * s, 0.6 * s, 0.07 * s, trunk);
    m.prim('ico1', x, y + 0.92 * s, z, 0.5 * s, 0.46 * s, 0.5 * s, leaf, seed);
    m.prim('ico1', x + 0.2 * s, y + 1.18 * s, z - 0.08 * s, 0.28 * s, 0.26 * s, 0.28 * s, kind === 'fiorito' ? '#f6c1d6' : shade(leaf, 0.08), seed + 1);
    m.prim('ico0', x - 0.24 * s, y + 0.8 * s, z + 0.12 * s, 0.24 * s, 0.22 * s, 0.24 * s, shade(leaf, -0.08), seed + 2);
  }
}
function lampIn(m, glass, x, y, z, banner = false) {
  m.prim('cyl6', x, y, z, 0.07, 0.12, 0.07, '#1f2a26');
  m.prim('cyl6', x, y, z, 0.03, 1.5, 0.03, '#1f2a26');
  m.prim('box', x, y + 1.48, z, 0.16, 0.03, 0.16, '#1f2a26');
  glass.prim('box', x, y + 1.51, z, 0.12, 0.17, 0.12, '#ffffff');
  m.prim('pyr', x, y + 1.68, z, 0.13, 0.1, 0.13, '#1f2a26');
  if (banner) m.box(x + 0.03, y + 0.95, z - 0.005, x + 0.22, y + 1.3, z + 0.005, '#2f6b4f');
}
function fountainIn(m, x, y, z, built) {
  const S = '#e4d9c0', SD = '#cdbd98';
  // Aiuola ad anello con cespugli fioriti
  m.prim('disc', x, y, z, 1.46, 0.05, 1.46, '#d8c9a6');
  m.prim('disc', x, y, z, 1.38, 0.1, 1.38, '#3f7d34');
  const fc = ['#e85d75', '#ffffff', '#f6d84a', '#b46ad6', '#f28cbf', '#e8423a', '#ff9a3c'];
  for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; bushIn(m, x + Math.cos(a) * 1.22, y + 0.05, z + Math.sin(a) * 1.22, 0.55, '#5c9f3f', fc[k % fc.length]); }
  m.prim('disc', x, y, z, 1.06, 0.3, 1.06, SD);
  m.prim('disc', x, y + 0.3, z, 1.09, 0.05, 1.09, S);
  m.prim('disc', x, y + 0.3, z, 0.92, 0.02, 0.92, built ? '#3f8fbf' : '#b6a785');
  m.prim('cyl10', x, y, z, 0.13, 1.0, 0.13, S);
  m.prim('cone8', x, y + 0.72, z, 0.45, -0.18, 0.45, SD);
  m.prim('disc', x, y + 0.72, z, 0.46, 0.06, 0.46, S);
  if (built) m.prim('disc', x, y + 0.75, z, 0.38, 0.02, 0.38, '#5aaed3');
  m.prim('cyl10', x, y + 0.78, z, 0.07, 0.4, 0.07, S);
  m.prim('cone8', x, y + 1.14, z, 0.26, -0.1, 0.26, SD);
  m.prim('disc', x, y + 1.14, z, 0.27, 0.05, 0.27, S);
  m.prim('ball', x, y + 1.27, z, 0.08, 0.12, 0.08, S);
}
function campanileIn(m, brick, x, y, z) {
  const w = 0.82, h = 3.6;
  brick.box(x - w / 2, y, z - w / 2, x + w / 2, y + h, z + w / 2, '#ffffff');
  m.box(x - w / 2 - 0.06, y + h, z - w / 2 - 0.06, x + w / 2 + 0.06, y + h + 0.08, z + w / 2 + 0.06, '#e6d6b3');
  m.box(x - w / 2 - 0.05, y + 0.9, z - w / 2 - 0.05, x + w / 2 + 0.05, y + 0.98, z + w / 2 + 0.05, '#e6d6b3');
  // Cella campanaria: quattro pilastri, la campana, la cuspide
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(x + dx * w / 2 - (dx > 0 ? 0.14 : 0), y + h + 0.08, z + dz * w / 2 - (dz > 0 ? 0.14 : 0), x + dx * w / 2 + (dx < 0 ? 0.14 : 0), y + h + 0.75, z + dz * w / 2 + (dz < 0 ? 0.14 : 0), '#c98a5e');
  m.prim('cone8', x, y + h + 0.25, z, 0.17, 0.32, 0.17, '#c99a2e');
  m.box(x - w / 2 - 0.06, y + h + 0.75, z - w / 2 - 0.06, x + w / 2 + 0.06, y + h + 0.83, z + w / 2 + 0.06, '#e6d6b3');
  m.prim('pyr', x, y + h + 0.83, z, w * 0.8, 1.0, w * 0.8, '#b5523b');
  m.box(x - 0.012, y + h + 1.8, z - 0.012, x + 0.012, y + h + 2.05, z + 0.012, '#3b3f45');
  m.box(x - 0.08, y + h + 1.95, z - 0.012, x + 0.08, y + h + 1.975, z + 0.012, '#3b3f45');
  // Orologio sui quattro lati
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const cx = x + nx * (w / 2 + 0.01), cz = z + nz * (w / 2 + 0.01);
    m.prim('cyl10', cx, y + h - 0.6, cz, 0.2, 0.02, 0.2, '#f4efe3', nx ? 0 : Math.PI / 2, Math.PI / 2);
  }
}

/* La scena -------------------------------------------------------------------------- */

const growBack = (p) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

export class Town3D {
  constructor(canvas, { preserve = false } = {}) {
    const T = T3();
    this.cv = canvas;
    this.r = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = T.PCFSoftShadowMap;
    this.r.shadowMap.autoUpdate = false;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(30, 1, 0.5, 600);
    this.view = { x: 40.5, y: 27.5, dist: 34, az: 0, pitch: 0.92 };
    this.aniso = this.r.capabilities.getMaxAnisotropy();
    // Luci: cielo e terra, sole caldo del pomeriggio da sud-ovest con le ombre
    this.hemi = new T.HemisphereLight('#fff4e0', '#8a9a6a', 0.52);
    this.sun = new T.DirectionalLight('#ffe7c4', 0.62);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new T.Fog('#bfe3f0', 60, 160);
    // Il mare (e il canale) sono un unico specchio d'acqua appena sotto la terraferma
    const wt = waveTex();
    this.water = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshPhongMaterial({ color: '#57b2d6', specular: '#ffffff', shininess: 90, map: wt, transparent: true, opacity: 0.86 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(W / 2, -0.13, H / 2);
    this.water.receiveShadow = true;
    this.scene.add(this.water);
    this.world = new T.Group(); this.scene.add(this.world);
    this.houses = new Map();         // slot -> { sig, group, wallMat, top }
    this.shops = new Map();
    this.cars = [];
    this.boats = [];
    this.sprites = new Map();        // omini
    this.born = new Map();
    this.sig = {};
    this.night = false;
    this.shadowDirty = true;
    this.lastShadow = null;
    // Luci di notte: un alone per ogni lampione e per i fari (punti con una texture morbida)
    this.glowMat = new T.PointsMaterial({ map: glowTex(), size: 3.2, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: '#ffd27a' });
    this.carGlow = new T.Points(new T.BufferGeometry(), this.glowMat.clone()); this.carGlow.material.size = 1.4; this.carGlow.frustumCulled = false; this.scene.add(this.carGlow);
    // Evidenziazioni: lotti liberi (scelta), casella selezionata
    this.chooseMat = new T.MeshBasicMaterial({ color: '#ffe68a', transparent: true, opacity: 0.4, depthWrite: false });
    this.selMat = new T.LineBasicMaterial({ color: '#ffd34d' });
    this.sel = null; this.chooseMesh = null;
    // Gocce della fontana
    this.drops = null;
  }

  resize(w, h, dpr) {
    this.vw = w; this.vh = h;
    this.r.setPixelRatio(dpr);
    this.r.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /* Telecamera */
  clampView() {
    const v = this.view;
    v.dist = Math.max(6, Math.min(120, v.dist));
    v.x = Math.max(0, Math.min(W, v.x));
    v.y = Math.max(0, Math.min(H + 2, v.y));
  }
  groundAt(x, y) { return this.G ? townSurface(this.G, this.ramps, Math.max(0, Math.min(W - 0.01, x)), Math.max(0, Math.min(H - 0.01, y))) / PX : 0; }
  updateCamera() {
    const v = this.view;
    const gy = this.groundAt(v.x, v.y);
    const c = Math.cos(v.pitch), s = Math.sin(v.pitch);
    this.camera.position.set(v.x + Math.sin(v.az) * c * v.dist, gy + s * v.dist, v.y + Math.cos(v.az) * c * v.dist);
    this.camera.lookAt(v.x, gy, v.y);
    this.camera.updateMatrixWorld();
    // Ombre: il sole segue il punto guardato; la mappa delle ombre si rifà solo quando serve
    const half = Math.max(10, Math.min(46, v.dist * 0.95));
    const key_ = `${Math.round(v.x / 3)},${Math.round(v.y / 3)},${Math.round(half / 4)}`;
    if (key_ !== this.lastShadow) {
      this.lastShadow = key_;
      const cx = Math.round(v.x / 3) * 3, cy = Math.round(v.y / 3) * 3, hh = Math.round(half / 4) * 4 + 4;
      this.sun.position.set(cx - 14, 22, cy + 10);
      this.sun.target.position.set(cx, 0, cy);
      this.sun.target.updateMatrixWorld();
      const sc = this.sun.shadow.camera;
      sc.left = -hh; sc.right = hh; sc.top = hh; sc.bottom = -hh; sc.near = 1; sc.far = 80;
      sc.updateProjectionMatrix();
      this.shadowDirty = true;
    }
    this.scene.fog.near = v.dist * 2.2; this.scene.fog.far = v.dist * 4.5 + 30;
  }
  // Distanza della telecamera per vedere `w` caselle da un bordo all'altro dello schermo
  distForWidth(w) { return w / (2 * Math.tan((this.camera.fov * Math.PI) / 360) * (this.vw / Math.max(1, this.vh))); }
  // Spostamento in pixel dello schermo -> spostamento sul terreno
  pan(dx, dy) {
    const v = this.view;
    const k = (2 * v.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, this.vh);
    const rx = Math.cos(v.az), rz = -Math.sin(v.az), fx = Math.sin(v.az), fz = Math.cos(v.az);
    v.x -= (dx * rx + (dy / Math.sin(v.pitch)) * fx) * k;
    v.y -= (dx * rz + (dy / Math.sin(v.pitch)) * fz) * k;
    this.clampView();
  }
  project(x, y, h) {
    const T = T3();
    const p = new T.Vector3(x, h, y).project(this.camera);
    return [(p.x + 1) / 2 * this.vw, (1 - p.y) / 2 * this.vh, p.z];
  }
  // Dal punto dello schermo al terreno (o a una casa)
  pick(sx, sy) {
    const T = T3();
    const rc = new T.Raycaster();
    rc.setFromCamera(new T.Vector2((sx / this.vw) * 2 - 1, -(sy / this.vh) * 2 + 1), this.camera);
    const targets = [this.groundMesh, ...[...this.houses.values()].map((h) => h.group), ...[...this.shops.values()].map((s) => s.group), ...(this.props || [])].filter(Boolean);
    const hits = rc.intersectObjects(targets, true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) return { ...o.userData.pick, point: hit.point };
      if (hit.object === this.groundMesh) return { kind: 'ground', x: Math.floor(hit.point.x), y: Math.floor(hit.point.z), point: hit.point };
    }
    return null;
  }

  /* Costruzione della città */
  setCity(city, opts = {}) {
    const T = T3();
    this.city = city;
    const G = townGround(city.openDistricts);
    const ramps = townRamps(city, G);
    this.G = G; this.ramps = ramps;
    const nRoads = Object.keys(city.roads).length, nHouses = Object.keys(city.houses).length;
    const groundSig = `${city.openDistricts}|${nRoads}|${nHouses}`;
    if (this.sig.ground !== groundSig) { this.sig.ground = groundSig; this.buildGround(city, G, ramps); this.shadowDirty = true; }
    const built = builtCount(city), founders = Object.values(city.residents).filter(isFounder).length;
    const decoSig = `${groundSig}|${built >= FOUNTAIN_AT}|${founders}`;
    if (this.sig.deco !== decoSig) { this.sig.deco = decoSig; this.buildDecor(city, G, ramps, built >= FOUNTAIN_AT, founders); this.shadowDirty = true; }
    // Case: si rifà solo quella che cambia
    const seen = new Set();
    for (const [slot, h] of Object.entries(city.houses)) {
      seen.add(slot);
      const r = city.residents[h.residentId];
      const flag = h.residentId === opts.meId ? '#e0a92a' : opts.friends?.has(h.residentId) ? '#3f6aa1' : null;
      const sig = JSON.stringify([h.style, h.status, isFounder(r), flag]);
      const cur = this.houses.get(slot);
      if (cur && cur.sig === sig) continue;
      if (cur) { this.world.remove(cur.group); disposeTree(cur.group); }
      const [x, y] = slot.split(',').map(Number);
      const b = buildHouse(h.style, { cantiere: h.status === 'cantiere', founder: isFounder(r), flag });
      const bx = x % STREET;
      const cx = x + 0.5 + (bx === 1 ? 0.5 : bx === STREET - 1 ? -0.5 : 0);
      // La facciata guarda la sua via: a sud (bordo basso del lotto) o a nord (casa girata)
      const north = lotFacing(slot) === 'N';
      b.group.position.set(cx, G.level[y * W + x] < 0 ? 0 : townSurface(G, ramps, x + 0.5, y + 0.5) / PX, north ? y + 0.03 : y + 0.97);
      if (north) b.group.rotation.y = Math.PI;
      b.north = north;
      b.group.userData.pick = { kind: 'house', slot, x, y };
      b.residentId = h.residentId;
      this.world.add(b.group);
      this.houses.set(slot, { ...b, sig, x, y, residentId: h.residentId, north: b.north });
      if (cur || opts.animateNew) this.born.set(slot, performance.now());
      this.shadowDirty = true;
    }
    for (const [slot, cur] of this.houses) if (!seen.has(slot)) { this.world.remove(cur.group); disposeTree(cur.group); this.houses.delete(slot); this.shadowDirty = true; }
    if (!this.shops.size) {
      for (const shop of SHOPS) {
        const b = buildShop(shop);
        const x = shop.x0 + 1, y = shop.y0 + 1;
        b.group.position.set(x, townSurface(G, ramps, x, y + 0.5) / PX, shop.y0 + 1.96);
        b.group.userData.pick = { kind: 'shop', shop: shop.id };
        this.world.add(b.group);
        this.shops.set(shop.id, b);
      }
    }
    // Traffico
    const list = traffic(city);
    if (list !== this.trafficList) { this.trafficList = list; this.buildCars(list); }
    this.applyLights();
  }

  buildGround(city, G, ramps) {
    const T = T3();
    if (this.groundMesh) { this.world.remove(this.groundMesh, this.wallMesh); this.groundMesh.geometry.dispose(); this.wallMesh.geometry.dispose(); this.groundMesh.material.map.dispose(); }
    const tex = pixTex(paintGround(city, G));
    tex.anisotropy = this.aniso;
    const top = new Mesher(), walls = new Mesher();
    const corner = (x, y, u, v) => townSurface(G, ramps, x + Math.min(u, 0.999), y + Math.min(v, 0.999)) / PX;
    const edge = (x, y, side) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      // le due altezze del bordo `side` della casella, da sinistra a destra viste da fuori
      if (side === 'S') return [corner(x, y, 0, 1), corner(x, y, 1, 1)];
      if (side === 'N') return [corner(x, y, 1, 0), corner(x, y, 0, 0)];
      if (side === 'E') return [corner(x, y, 1, 1), corner(x, y, 1, 0)];
      return [corner(x, y, 0, 0), corner(x, y, 0, 1)];
    };
    const opp = { S: 'N', N: 'S', E: 'W', W: 'E' };
    const step = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h00 = corner(x, y, 0, 0), h10 = corner(x, y, 1, 0), h01 = corner(x, y, 0, 1), h11 = corner(x, y, 1, 1);
      top.quad([x, h01, y + 1], [x + 1, h11, y + 1], [x + 1, h10, y], [x, h00, y], '#ffffff', [x / W, 1 - (y + 1) / H, (x + 1) / W, 1 - y / H]);
      const L = G.level[y * W + x];
      const road = city.roads[key(x, y)];
      for (const side of ['S', 'N', 'E', 'W']) {
        const [a, b] = edge(x, y, side);
        const [dx, dy] = step[side];
        const nb = edge(x + dx, y + dy, opp[side]);
        // l'altro bordo visto da fuori va al contrario
        const na = nb ? nb[1] : -1.6, nbb = nb ? nb[0] : -1.6;
        if (a - na < 0.01 && b - nbb < 0.01) continue;
        const lo0 = Math.min(a, na), lo1 = Math.min(b, nbb);
        let p0, p1;
        if (side === 'S') { p0 = [x, y + 1]; p1 = [x + 1, y + 1]; }
        else if (side === 'N') { p0 = [x + 1, y]; p1 = [x, y]; }
        else if (side === 'E') { p0 = [x + 1, y + 1]; p1 = [x + 1, y]; }
        else { p0 = [x, y]; p1 = [x, y + 1]; }
        const canal = isCanal(x + dx, y + dy) && G.level[(y + dy) * W + x + dx] < 0;
        const town = L >= 1 || road;
        const c = !nb ? '#a98a5e' : canal ? '#d6c4a0' : town ? '#e2d2ad' : L >= 2 ? '#b98b5c' : '#d9c08a';
        const len = 1, hgt = Math.max(a, b) - Math.min(lo0, lo1);
        walls.quad([p0[0], lo0, p0[1]], [p1[0], lo1, p1[1]], [p1[0], b, p1[1]], [p0[0], a, p0[1]], c, [0, 0, len, hgt * 2]);
      }
    }
    this.groundMesh = new T.Mesh(top.build(), new T.MeshLambertMaterial({ map: tex }));
    this.groundMesh.receiveShadow = true;
    this.wallMesh = new T.Mesh(walls.build(), mats().stone);
    this.wallMesh.receiveShadow = true; this.wallMesh.castShadow = true;
    this.world.add(this.groundMesh, this.wallMesh);
  }

  buildDecor(city, G, ramps, fountainOn, founders) {
    const T = T3();
    if (this.decor) { for (const m of this.decor) { this.world.remove(m); m.geometry.dispose(); } }
    if (this.lampGlow) { this.scene.remove(this.lampGlow); this.lampGlow.geometry.dispose(); }
    const m = new Mesher(), glass = new Mesher(), brick = new Mesher(), sign = new Mesher();
    const gH = (x, y) => townSurface(G, ramps, Math.max(0, Math.min(W - 0.01, x)), Math.max(0, Math.min(H - 0.01, y))) / PX;
    const lamps = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (city.houses[k] || shopAt(x, y) || inPiazza(x, y)) continue;
      const road = city.roads[k];
      const tree = G.trees.get(k);
      const dd = districtAt(x, y);
      const inner = !tree && !road && dd && dd <= city.openDistricts && !isStreet(x, y) && !PLAN.lots.has(k) && !isCanal(x, y);
      const bx = x % STREET, by = y % STREET;
      // Nei quartieri aperti: un albero o un cespuglio nella fila di cortili dietro le case
      let t = tree && !road ? tree : null;
      // Dentro gli isolati: dove la casa non c'è ancora, prato con qualche cespuglio
      if (!t && inner) {
        const lot = key(x - bx + (bx <= 2 ? 1 : 4), y - by + (by <= 2 ? 1 : 4));
        if (!city.houses[lot] && ih(x, y, 30) < 0.25) t = { kind: 'cespuglio', s: 0.9, flowers: ih(x, y, 33) < 0.6 ? ['#e85d75', '#f28cbf', '#ffffff', '#b46ad6'][Math.floor(ih(x, y, 34) * 4)] : null };
      }
      // Lotto libero: un cartello di legno con la scritta "Libero"
      if (PLAN.lots.has(k) && !city.houses[k] && dd && dd <= city.openDistricts) {
        const north = lotFacing(k) === 'N';
        const px = x + 0.5 + (bx === 1 ? 0.5 : -0.5), pz = north ? y + 0.25 : y + 0.75, h0 = gH(x + 0.5, y + 0.5);
        m.box(px - 0.025, h0, pz - 0.025, px + 0.025, h0 + 0.62, pz + 0.025, '#6b4a2f');
        const zf = north ? -1 : 1;
        sign.quad([px - 0.3 * zf, h0 + 0.4, pz + 0.03 * zf], [px + 0.3 * zf, h0 + 0.4, pz + 0.03 * zf], [px + 0.3 * zf, h0 + 0.7, pz + 0.03 * zf], [px - 0.3 * zf, h0 + 0.7, pz + 0.03 * zf]);
        sign.quad([px + 0.3 * zf, h0 + 0.4, pz], [px - 0.3 * zf, h0 + 0.4, pz], [px - 0.3 * zf, h0 + 0.7, pz], [px + 0.3 * zf, h0 + 0.7, pz], '#ffffff', [0, 0, 0.02, 0.02]);
      }
      if (t) {
        const px = x + 0.5 + (ih(x, y, 81) - 0.5) * 0.3, pz = y + 0.5 + (ih(x, y, 82) - 0.5) * 0.3;
        if (t.kind === 'cespuglio') bushIn(m, px, gH(px, pz), pz, 1, mix('#4c8a3a', '#6aa84f', ih(x, y, 35)), t.flowers);
        else treeIn(m, t.kind, px, gH(px, pz), pz, t.s, x * 31 + y);
      }
      if (road === 'main' && x % STREET === 3 && !(x >= PIAZZA.x0 && x <= PIAZZA.x1)) {
        const lx = x + 0.5, lz = y + 0.12;
        lampIn(m, glass, lx, gH(lx, lz), lz); lamps.push([lx, gH(lx, lz) + 1.52, lz]);
      }
      // Ringhiera sulle rive del canale
      const bank = !road && !isCanal(x, y) && (isCanal(x + 1, y) || isCanal(x - 1, y)) && y < SEA_Y && G.level[y * W + x] >= 0;
      if (bank) {
        const ex = isCanal(x + 1, y) ? x + 0.94 : x + 0.06, h0 = gH(x + 0.5, y + 0.5);
        m.box(ex - 0.015, h0 + 0.42, y, ex + 0.015, h0 + 0.46, y + 1, '#1f2a26');
        for (let k2 = 0; k2 < 4; k2++) m.box(ex - 0.015, h0, y + 0.12 + k2 * 0.25, ex + 0.015, h0 + 0.44, y + 0.15 + k2 * 0.25, '#1f2a26');
      }
      // Ponti: parapetti di pietra ai lati della strada
      if (isCanal(x, y) && road && G.level[y * W + x] >= 0) {
        const h0 = gH(x + 0.5, y + 0.5);
        const alongX = !!city.roads[key(x - 1, y)] || !!city.roads[key(x + 1, y)];
        if (alongX) { m.box(x, h0, y + 0.02, x + 1, h0 + 0.32, y + 0.12, '#e2d4b4'); m.box(x, h0, y + 0.88, x + 1, h0 + 0.32, y + 0.98, '#e2d4b4'); }
        else { m.box(x + 0.02, h0, y, x + 0.12, h0 + 0.32, y + 1, '#e2d4b4'); m.box(x + 0.88, h0, y, x + 0.98, h0 + 0.32, y + 1, '#e2d4b4'); }
      }
      // Ombrelloni sulla spiaggia
      if (y === SEA_Y && x % 3 === 1 && x > 12 && x < 72) {
        const c = [['#e85d4a', '#fff'], ['#2f6b9f', '#fff'], ['#f2b632', '#fff'], ['#4f8a72', '#f6efe0']][x % 4];
        m.prim('cyl6', x + 0.5, 0, y + 0.5, 0.02, 0.9, 0.02, '#6b4a2f');
        m.prim('cone8', x + 0.5, 0.78, y + 0.5, 0.48, 0.22, 0.48, c[0]);
        m.box(x + 0.05, 0, y + 0.62, x + 0.35, 0.05, y + 0.95, '#f6efe0');
      }
    }
    // Piazza
    const D = PIAZZA_DECOR;
    const pH = (x, y) => gH(x + 0.5, y + 0.5);
    fountainIn(m, D.fountain[0] + 0.5, pH(...D.fountain), D.fountain[1] + 0.5, fountainOn);
    this.fountainAt = fountainOn ? [D.fountain[0] + 0.5, pH(...D.fountain), D.fountain[1] + 0.5] : null;
    campanileIn(m, brick, D.campanile[0] + 0.5, pH(...D.campanile), D.campanile[1] + 0.5);
    for (const [x, y] of BENCHES) {
      const dx = x - D.fountain[0], dy = y - D.fountain[1];
      benchIn(m, x + 0.5, y + 0.5, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : (dy > 0 ? 0 : Math.PI));
    }
    for (const [x, y] of D.planters) { m.box(x + 0.15, pH(x, y), y + 0.15, x + 0.85, pH(x, y) + 0.32, y + 0.85, '#c9b48f'); bushIn(m, x + 0.5, pH(x, y) + 0.3, y + 0.5, 1.1, '#4c8a3a', '#f28cbf'); }
    for (const [x, y] of D.lamps) { lampIn(m, glass, x + 0.5, pH(x, y), y + 0.5, true); lamps.push([x + 0.5, pH(x, y) + 1.52, y + 0.5]); }
    for (const [x, y] of D.trees) treeIn(m, 'tondo', x + 0.5, pH(x, y), y + 0.5, 0.9, x * 7 + y);
    for (const [x, y] of D.cafe) {
      const cx = x + 0.5, cz = y + 0.5, h0 = pH(x, y);
      m.prim('cyl6', cx, h0, cz, 0.03, 0.36, 0.03, '#3b3f45'); m.prim('disc', cx, h0 + 0.36, cz, 0.24, 0.03, 0.24, '#f2ead6');
      for (const dx of [-0.36, 0.36]) { m.box(cx + dx - 0.1, h0 + 0.22, cz - 0.1, cx + dx + 0.1, h0 + 0.26, cz + 0.1, '#c0392b'); m.box(cx + dx + (dx > 0 ? 0.06 : -0.1), h0 + 0.26, cz - 0.1, cx + dx + (dx > 0 ? 0.1 : -0.06), h0 + 0.5, cz + 0.1, '#c0392b'); for (const ez of [-0.08, 0.08]) m.box(cx + dx - 0.01, h0, cz + ez - 0.01, cx + dx + 0.01, h0 + 0.22, cz + ez + 0.01, '#3b3f45'); }
      m.prim('cyl6', cx, h0, cz, 0.018, 1.25, 0.018, '#6b4a2f');
      m.prim('cone8', cx, h0 + 1.05, cz, 0.62, 0.3, 0.62, '#f6ecd4');
    }
    for (const [x, y, i] of [[36, 21, 0], [38, 21, 1], [42, 21, 2], [36, 28, 3], [44, 23, 0], [44, 27, 1], [38, 29, 2], [42, 29, 3], [39, 23, 1], [41, 27, 2]]) potIn(m, x + 0.5, pH(x, y), y + 0.5, i);
    // Edicola e Muro dei Fondatori: si possono toccare
    this.props = [];
    const pm = new Mesher();
    {
      const [x, y] = D.edicola, cx = x + 0.5, cz = y + 0.55, h0 = pH(x, y);
      pm.box(cx - 0.4, h0, cz - 0.35, cx + 0.4, h0 + 0.85, cz + 0.35, '#2f6b5c');
      pm.box(cx - 0.3, h0 + 0.18, cz + 0.35, cx + 0.3, h0 + 0.62, cz + 0.36, '#f4ecd8');
      const cols = ['#e85d4a', '#3f6aa1', '#f2c14e', '#7a4a6b', '#4f8a72'];
      for (let k = 0; k < 5; k++) pm.box(cx - 0.27 + k * 0.11, h0 + 0.25, cz + 0.36, cx - 0.18 + k * 0.11, h0 + 0.55, cz + 0.37, cols[k]);
      pm.box(cx - 0.48, h0 + 0.85, cz - 0.43, cx + 0.48, h0 + 0.92, cz + 0.43, '#c0392b');
      for (let k = 0; k < 7; k++) pm.box(cx - 0.48 + k * 0.137, h0 + 0.7, cz + 0.42, cx - 0.48 + (k + 1) * 0.137, h0 + 0.85, cz + 0.5, k % 2 ? '#f6efe0' : '#c0392b');
      const ed = new T.Mesh(pm.build(), mats().vcFlat); ed.castShadow = ed.receiveShadow = true;
      ed.userData.pick = { kind: 'giornale', x, y };
      this.props.push(ed);
    }
    {
      const mm = new Mesher();
      const [m0] = D.muro, mL = D.muro[D.muro.length - 1], h0 = pH(...m0), z = m0[1] + 0.5;
      mm.box(m0[0] + 0.05, h0, z - 0.14, mL[0] + 0.95, h0 + 0.62, z + 0.14, '#c9b48f');
      mm.box(m0[0], h0 + 0.62, z - 0.18, mL[0] + 1, h0 + 0.7, z + 0.18, '#e6d6b3');
      const n = Math.min(founders, 18);
      for (let k = 0; k < n; k++) { const px = m0[0] + 0.2 + (k % 9) * 0.29, py = h0 + 0.42 - Math.floor(k / 9) * 0.22; mm.box(px, py, z + 0.14, px + 0.2, py + 0.13, z + 0.16, '#e2bf4f'); }
      const mu = new T.Mesh(mm.build(), mats().vcFlat); mu.castShadow = mu.receiveShadow = true;
      mu.userData.pick = { kind: 'muro', x: m0[0] + 1, y: m0[1] };
      this.props.push(mu);
    }
    // Pozze di luce sotto i lampioni (si vedono solo di notte)
    if (this.pools) { this.scene.remove(this.pools); this.pools.geometry.dispose(); }
    const pg = new T.BufferGeometry();
    const pp = [], pu = [];
    for (const [lx, ly, lz] of lamps) {
      const y0 = ly - 1.5, r = 2.2;
      const q = [[-r, r], [r, r], [r, -r], [-r, r], [r, -r], [-r, -r]];
      for (const [dx, dz] of q) { pp.push(lx + dx, y0 + 0.04, lz + dz); pu.push(dx > 0 ? 1 : 0, dz > 0 ? 0 : 1); }
    }
    pg.setAttribute('position', new T.Float32BufferAttribute(pp, 3));
    pg.setAttribute('uv', new T.Float32BufferAttribute(pu, 2));
    this.pools = new T.Mesh(pg, new T.MeshBasicMaterial({ map: glowTex(), transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    this.pools.visible = this.night;
    this.scene.add(this.pools);
    const meshes = [new T.Mesh(m.build(), mats().vcFlat), new T.Mesh(glass.build(), mats().lantern), ...this.props];
    if (!brick.empty) { const b = brick.build(); const bm = new T.Mesh(b, mats().brick); fixBrickUV(b); meshes.push(bm); }
    if (!sign.empty) meshes.push(new T.Mesh(sign.build(), new T.MeshLambertMaterial({ map: signTex() })));
    for (const me of meshes) { me.castShadow = true; me.receiveShadow = true; this.world.add(me); }
    meshes[1].castShadow = false;
    this.decor = meshes;
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.Float32BufferAttribute(lamps.flat(), 3));
    this.lampGlow = new T.Points(gg, this.glowMat);
    this.lampGlow.visible = this.night;
    this.scene.add(this.lampGlow);
    // Gocce della fontana
    if (this.drops) { this.scene.remove(this.drops); this.drops.geometry.dispose(); this.drops = null; }
    if (this.fountainAt) {
      const dg = new T.BufferGeometry();
      dg.setAttribute('position', new T.Float32BufferAttribute(new Array(48 * 3).fill(0), 3));
      this.drops = new T.Points(dg, new T.PointsMaterial({ color: '#e8f8ff', size: 0.07, transparent: true, opacity: 0.9 }));
      this.drops.frustumCulled = false;
      this.scene.add(this.drops);
    }
  }

  buildCars(list) {
    const T = T3();
    for (const c of this.cars) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    this.cars = list.map((v) => {
      const M = CAR_MODELS[v.kind];
      const L = M.len / PX, Wd = M.wid / PX * 0.95, Hc = M.hgt / PX;
      const m = new Mesher();
      const col = v.color, glass = '#3e5a72', dark = shade(col, -0.3);
      // Il muso è verso +x
      for (const wx of [-L / 2 + 0.18, L / 2 - 0.18]) for (const wz of [-Wd / 2, Wd / 2]) m.prim('cyl10', wx, 0.11, wz - (wz > 0 ? 0.04 : -0.04), 0.11, 0.08, 0.11, '#1f1f1f', 0, Math.PI / 2);
      if (v.kind === 'autobus') {
        m.box(-L / 2, 0.1, -Wd / 2, L / 2, Hc + 0.12, Wd / 2, col);
        m.box(-L / 2 + 0.1, Hc * 0.5, -Wd / 2 - 0.005, L / 2 - 0.1, Hc * 0.95, Wd / 2 + 0.005, glass);
        m.box(L / 2 - 0.02, Hc * 0.45, -Wd / 2 + 0.06, L / 2 + 0.005, Hc, Wd / 2 - 0.06, glass);
        m.box(-L / 2, Hc + 0.12, -Wd / 2, L / 2, Hc + 0.16, Wd / 2, shade(col, 0.15));
      } else if (v.kind === 'furgone') {
        m.box(-L / 2, 0.1, -Wd / 2, L / 2 - 0.32, Hc + 0.1, Wd / 2, col);
        m.box(L / 2 - 0.34, 0.1, -Wd / 2, L / 2, Hc * 0.65, Wd / 2, col);
        m.box(L / 2 - 0.3, Hc * 0.4, -Wd / 2 + 0.05, L / 2 + 0.005, Hc * 0.62, Wd / 2 - 0.05, glass);
      } else if (v.kind === 'ape') {
        m.box(-L / 2, 0.12, -Wd / 2, 0, 0.32, Wd / 2, '#9a6a43');
        m.box(0, 0.1, -Wd / 2 + 0.03, L / 2, Hc + 0.12, Wd / 2 - 0.03, col);
        m.box(L / 2 - 0.02, Hc * 0.55, -Wd / 2 + 0.07, L / 2 + 0.005, Hc + 0.05, Wd / 2 - 0.07, glass);
      } else {
        m.box(-L / 2, 0.1, -Wd / 2, L / 2, 0.36, Wd / 2, col);
        const c0 = -L * 0.3, c1 = L * (v.kind === 'berlina' ? 0.18 : 0.14);
        m.box(c0, 0.36, -Wd / 2 + 0.05, c1, 0.58, Wd / 2 - 0.05, glass);
        m.box(c0 + 0.02, 0.58, -Wd / 2 + 0.06, c1 - 0.02, 0.62, Wd / 2 - 0.06, shade(col, 0.15));
        m.box(-L / 2 - 0.005, 0.14, -Wd / 2 + 0.02, L / 2 + 0.005, 0.18, Wd / 2 - 0.02, dark);
      }
      m.box(L / 2 - 0.01, 0.22, -Wd / 2 + 0.04, L / 2 + 0.01, 0.28, -Wd / 2 + 0.14, '#ffe39a');
      m.box(L / 2 - 0.01, 0.22, Wd / 2 - 0.14, L / 2 + 0.01, 0.28, Wd / 2 - 0.04, '#ffe39a');
      m.box(-L / 2 - 0.01, 0.22, -Wd / 2 + 0.04, -L / 2 + 0.01, 0.28, -Wd / 2 + 0.12, '#c0392b');
      m.box(-L / 2 - 0.01, 0.22, Wd / 2 - 0.12, -L / 2 + 0.01, 0.28, Wd / 2 - 0.04, '#c0392b');
      const mesh = new T.Mesh(m.build(), mats().vcFlat);
      mesh.receiveShadow = true;
      const blob = new T.Mesh(new T.PlaneGeometry(L + 0.2, Wd + 0.2), mats().shadow);
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
      mesh.add(blob);
      this.scene.add(mesh);
      return { v, mesh, L };
    });
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.Float32BufferAttribute(new Array(list.length * 3).fill(0), 3));
    this.carGlow.geometry.dispose(); this.carGlow.geometry = gg;
    // Barche a vela al largo e un cigno nel canale
    if (!this.boats.length) {
      for (let i = 0; i < 3; i++) {
        const m = new Mesher();
        m.prim('box', 0, -0.05, 0, 0.9, 0.18, 0.32, i % 2 ? '#fbf7ee' : '#f1e2c4');
        m.prim('pyr', 0.45, -0.05, 0, 0.2, 0.18, 0.32, '#fbf7ee');
        m.box(-0.02, 0.1, -0.02, 0.02, 1.2, 0.02, '#8b5e3c');
        m.tri([0.04, 1.15, 0], [0.04, 0.2, 0], [0.55, 0.2, 0], [0, 0], [1, 0], [0, 1], i % 2 ? '#e85d4a' : '#f6efe0');
        m.tri([0.04, 1.15, 0], [0.55, 0.2, 0], [0.04, 0.2, 0], [0, 0], [1, 0], [0, 1], i % 2 ? '#e85d4a' : '#f6efe0');
        const b = new T.Mesh(m.build(), mats().vcFlat); this.scene.add(b); this.boats.push(b);
      }
      const sm = new Mesher();
      sm.prim('ball', 0, 0, 0, 0.18, 0.1, 0.11, '#ffffff');
      sm.prim('cyl6', 0.13, 0.05, 0, 0.022, 0.2, 0.022, '#ffffff', 0, -0.25);
      sm.prim('ball', 0.17, 0.25, 0, 0.04, 0.035, 0.035, '#ffffff');
      sm.prim('cone6', 0.21, 0.25, 0, 0.02, 0.05, 0.02, '#e8862a', 0, -Math.PI / 2);
      this.swan = new T.Mesh(sm.build(), mats().vcFlat); this.scene.add(this.swan);
    }
  }

  /* Omini: sprite disegnati in pixel, sempre rivolti alla telecamera */
  setAvatar(id, { x, y, h, cv, changed, me, night }) {
    const T = T3();
    let s = this.sprites.get(id);
    if (!s) {
      const tex = pixTex(cv); tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
      const mat = new T.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.4 });
      const sp = new T.Sprite(mat);
      sp.center.set(0.5, 16 / cv.height);
      sp.scale.set(cv.width / 66, cv.height / 66, 1);
      const blob = new T.Mesh(new T.CircleGeometry(0.2, 12), mats().shadow);
      blob.rotation.x = -Math.PI / 2;
      this.scene.add(sp, blob);
      s = { sp, blob, tex, ghost: null };
      if (me) {
        // Il proprio omino si intravede anche dietro le case
        const gm = new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.32, depthTest: false, color: '#203040' });
        s.ghost = new T.Sprite(gm); s.ghost.center.copy(sp.center); s.ghost.scale.copy(sp.scale); s.ghost.renderOrder = -1;
        this.scene.add(s.ghost);
      }
      this.sprites.set(id, s);
    }
    if (changed) s.tex.needsUpdate = true;
    s.sp.position.set(x, h, y);
    s.sp.material.color.set(night ? '#a9b1d6' : '#ffffff');
    s.blob.position.set(x, this.groundAt(x, y) + 0.02, y);
    if (s.ghost) s.ghost.position.copy(s.sp.position);
    s.seen = true;
  }
  sweepAvatars() {
    for (const [id, s] of this.sprites) {
      if (!s.seen) { this.scene.remove(s.sp, s.blob); if (s.ghost) this.scene.remove(s.ghost); s.tex.dispose(); s.sp.material.dispose(); this.sprites.delete(id); }
      else s.seen = false;
    }
  }

  setSelected(slot) {
    const T = T3();
    if (this.sel) { this.scene.remove(this.sel); this.sel.geometry.dispose(); this.sel = null; }
    if (!slot || !this.G) return;
    const [x, y] = slot.split(',').map(Number);
    const h = this.groundAt(x + 0.5, y + 0.5) + 0.03;
    const g = new T.BufferGeometry().setFromPoints([[x + 0.05, y + 0.05], [x + 0.95, y + 0.05], [x + 0.95, y + 0.95], [x + 0.05, y + 0.95], [x + 0.05, y + 0.05]].map(([a, b]) => new T.Vector3(a, h, b)));
    this.selMat.color.set(this.city?.houses[slot] ? '#ffd34d' : '#d4462f');
    this.sel = new T.Line(g, this.selMat);
    this.scene.add(this.sel);
  }
  setChoose(on) {
    const T = T3();
    if (this.chooseMesh) { this.scene.remove(this.chooseMesh); this.chooseMesh.geometry.dispose(); this.chooseMesh = null; }
    if (!on || !this.city) return;
    const m = new Mesher();
    for (const k of PLAN.lots) {
      if (this.city.houses[k]) continue;
      const [x, y] = k.split(',').map(Number);
      if (districtAt(x, y) > this.city.openDistricts) continue;
      const h = this.groundAt(x + 0.5, y + 0.5) + 0.03;
      m.quad([x + 0.1, h, y + 0.9], [x + 0.9, h, y + 0.9], [x + 0.9, h, y + 0.1], [x + 0.1, h, y + 0.1]);
    }
    if (m.empty) return;
    this.chooseMesh = new T.Mesh(m.build(), this.chooseMat);
    this.scene.add(this.chooseMesh);
  }

  setNight(night, online) {
    this.night = !!night;
    this.online = online;
    this.applyLights();
  }
  applyLights() {
    const n = this.night;
    const T = T3();
    this.scene.background = new T.Color(n ? '#1b2340' : '#bfe3f0');
    this.scene.fog.color.set(n ? '#1b2340' : '#bfe3f0');
    this.hemi.color.set(n ? '#6a7cc0' : '#fff4e0'); this.hemi.groundColor.set(n ? '#262a40' : '#8a9a6a'); this.hemi.intensity = n ? 0.5 : 0.52;
    this.sun.color.set(n ? '#9fb3ff' : '#ffe7c4'); this.sun.intensity = n ? 0.22 : 0.62;
    this.water.material.color.set(n ? '#2a4f7a' : '#57b2d6');
    mats().lantern.emissiveIntensity = n ? 1 : 0;
    if (this.lampGlow) this.lampGlow.visible = n;
    if (this.pools) this.pools.visible = n;
    this.carGlow.visible = n;
    const lit = (b, on) => {
      if (!b.wallMat) return;
      if (on && !b.wallMat.emissiveMap) { b.wallMat.emissiveMap = b.wallMat.userData.lights(); b.wallMat.needsUpdate = true; }
      b.wallMat.emissiveIntensity = on ? 1 : 0;
    };
    for (const b of this.houses.values()) lit(b, n && this.online?.has(b.residentId));
    for (const b of this.shops.values()) lit(b, n);
    this.shadowDirty = true;
  }

  render(t, { choosePulse = false } = {}) {
    const s = t / 1000;
    this.updateCamera();
    this.water.material.map.offset.set((s * 0.01) % 1, (s * 0.006) % 1);
    // Case appena nate: crescono con un piccolo rimbalzo
    for (const [slot, t0] of this.born) {
      const b = this.houses.get(slot);
      const p = (t - t0) / 900;
      if (!b || p >= 1) { if (b) b.group.scale.set(1, 1, 1); this.born.delete(slot); this.shadowDirty = true; continue; }
      const k = Math.max(0.01, growBack(Math.max(0, p)));
      b.group.scale.set(k, k, k);
    }
    // Traffico
    const pos = this.carGlow.geometry.attributes.position;
    this.cars.forEach((c, i) => {
      const [gx, gy] = carAt(c.v, s);
      const hgt = this.groundAt(gx, gy);
      c.mesh.position.set(gx, hgt, gy);
      const ang = c.v.axis === 'x' ? (c.v.dir > 0 ? 0 : Math.PI) : (c.v.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      c.mesh.rotation.y = ang;
      // in salita la macchina si inclina seguendo la rampa
      const ahead = this.groundAt(gx + Math.cos(ang) * 0.3, gy - Math.sin(ang) * 0.3);
      c.mesh.rotation.z = Math.atan2(ahead - hgt, 0.3);
      if (pos) pos.setXYZ(i, gx + Math.cos(ang) * (c.L / 2 + 0.35), hgt + 0.25, gy - Math.sin(ang) * (c.L / 2 + 0.35));
    });
    if (pos) pos.needsUpdate = true;
    this.boats.forEach((b, i) => {
      const gx = ((s * (0.25 + i * 0.08) + ih(i, 9, 60) * W) % (W + 4)) - 2;
      b.position.set(gx, -0.1 + Math.sin(s * 1.3 + i) * 0.03, SEA_Y + 2.5 + i * 2);
      b.rotation.z = Math.sin(s * 1.1 + i) * 0.04;
    });
    if (this.swan) {
      const gy = 34 + (Math.sin(s * 0.035) + 1) * 7, gx = CANAL.x0 + 1.5 + Math.sin(s * 0.11) * 0.5;
      this.swan.position.set(gx, -0.12, gy);
      this.swan.rotation.y = Math.cos(s * 0.035) > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    if (this.drops && this.fountainAt) {
      const [fx, fy, fz] = this.fountainAt;
      const dp = this.drops.geometry.attributes.position;
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2 * 3, p = (s * 0.9 + k * 0.137) % 1;
        const r = k % 3 === 0 ? 0.12 + p * 0.25 : 0.3 + p * 0.6;
        const h0 = k % 3 === 0 ? 1.32 : 0.78;
        dp.setXYZ(k, fx + Math.cos(a) * r, fy + h0 + Math.sin(p * Math.PI) * 0.18 - p * (k % 3 === 0 ? 0.4 : 0.45), fz + Math.sin(a) * r);
      }
      dp.needsUpdate = true;
    }
    if (this.chooseMesh) this.chooseMat.opacity = choosePulse ? 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(t / 300)) : 0.4;
    if (this.shadowDirty) { this.r.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    this.r.render(this.scene, this.camera);
  }

  dispose() {
    disposeTree(this.scene);
    this.r.dispose();
    this.r.forceContextLoss();
  }
}

function fixBrickUV(geo) {
  // Mattoni: le coordinate della texture seguono le pareti (in unità del mondo)
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const a = ny > 0.5 ? p.getX(i) : nx > 0.5 ? p.getZ(i) : p.getX(i);
    const b = ny > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, a * 1.5, b * 1.5);
  }
  uv.needsUpdate = true;
}
function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      if (Object.values(MAT || {}).includes(m) || [...roofMats.values()].includes(m)) continue;
      if (m.map && ![...roofTexCache.values()].includes(m.map) && ![stoneTexC, brickTexC, waveTexC, glowTexC, signTexC].includes(m.map)) m.map.dispose();
      if (m.emissiveMap) m.emissiveMap.dispose();
      m.dispose();
    }
  });
}

/* Immagini fisse: anteprima della casa e cartoline ---------------------------------- */

let still = null;
function stillRenderer(w, h) {
  const T = T3();
  if (!still) {
    const cv = canvas2d(w, h);
    const r = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    still = { cv, r };
  }
  if (still.cv.width !== w || still.cv.height !== h) still.r.setSize(w, h, false);
  return still;
}
// La casa da sola su un pezzo di giardino, vista di tre quarti dall'alto.
export function renderHouseStill(target, style, { cantiere = false } = {}) {
  const T = T3();
  const w = target.width, h = target.height;
  const { r, cv } = stillRenderer(w, h);
  const scene = new T.Scene();
  scene.background = new T.Color('#cfeaf4');
  scene.add(new T.HemisphereLight('#fff4e0', '#8a9a6a', 0.72));
  const sun = new T.DirectionalLight('#ffe7c4', 0.8); sun.position.set(-4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(sun);
  const m = new Mesher();
  m.box(-1.6, -0.12, -3.0, 1.6, 0, 0.4, '#86c457');
  m.box(-1.6, -0.12, 0.4, 1.6, 0.02, 1.1, '#ddd4c2');
  for (let k = 0; k < 30; k++) m.prim('ico0', -1.5 + ih(k, 1, 7) * 3, 0, -2.9 + ih(k, 2, 7) * 3.2, 0.04, 0.05, 0.04, k % 2 ? '#5f9a3c' : '#9ccf6e');
  const ground = new T.Mesh(m.build(), mats().vcFlat); ground.receiveShadow = true; scene.add(ground);
  const b = buildHouse(style, { cantiere });
  b.group.position.set(0, 0, 0.35);
  scene.add(b.group);
  const cam = new T.PerspectiveCamera(30, w / h, 0.1, 100);
  cam.position.set(4.2, 4.6, 7.6); cam.lookAt(0, 1.0, -0.9);
  r.render(scene, cam);
  const g = target.getContext('2d');
  g.drawImage(cv, 0, 0);
  disposeTree(b.group); ground.geometry.dispose();
}
// Una veduta della città per le cartoline (canvas di dimensioni date), centrata su una casella.
export function renderTownStill(city, x, y, w, h) {
  const cv = canvas2d(w, h);
  const t3 = new Town3D(cv, { preserve: true });
  t3.resize(w, h, 1);
  t3.setCity(city, {});
  t3.view = { x: x + 0.5, y: y + 0.5, dist: 17, az: -0.35, pitch: 0.82 };
  t3.render(4200);
  const out = canvas2d(w, h);
  out.getContext('2d').drawImage(cv, 0, 0);
  t3.dispose();
  return out;
}
