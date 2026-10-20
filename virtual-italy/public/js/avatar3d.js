// Abitanti in 3D, nello stesso stile low-poly della città ma con forme morbide e proporzioni da
// persona: testa ovale con la faccia ben leggibile (occhi con la luce, sopracciglia, sorriso,
// guance), capelli che avvolgono la testa, barba o rossetto, vestiti, scarpe e accessori. Il corpo
// è fatto di pezzi che si muovono (braccia, cosce, stinchi, testa) per camminare, salutare,
// ballare, saltare, sedersi e andare in bici, skate o monopattino.
// Lo stesso modello disegna gli omini in città, nelle stanze (come immagine) e nelle anteprime.
import { Mesher, canvas2d } from './town3d.js';
import { mix, shade } from './art.js';

const THR = () => globalThis.THREE;
let avMat = null;
const avatarMat = () => (avMat ||= new (THR().MeshLambertMaterial)({ vertexColors: true }));
let ghostMat = null, meMat = null;
// Il proprio omino si vede in trasparenza solo dove qualcosa gli sta davanti: la sagoma si disegna
// prima dell'omino (che passa per ultimo), e solo dove la scena è più vicina di lui.
function ghostMaterial() {
  const T = THR();
  return (ghostMat ||= new T.MeshBasicMaterial({ color: '#1d3557', transparent: true, opacity: 0.4, depthWrite: false, depthFunc: T.GreaterDepth }));
}
const meMaterial = () => (meMat ||= new (THR().MeshLambertMaterial)({ vertexColors: true, transparent: true, opacity: 1 }));

const LIPS = { naturale: null, rosa: '#e46b8f', rosso: '#c8283c' };
const EXTRA_COL = { cappellino: '#c0392b', coppola: '#6f6a60', basco: '#7a2c3a', cuffie: '#2b2b2b' };
const PI = Math.PI;

// Le misure del corpo (alto 1, prima della scala finale): bacino, spalle, collo
function bodyOf(L) {
  const donna = L.gender === 'donna';
  return { donna, sh: donna ? 0.094 : 0.112, waist: donna ? 0.074 : 0.088, hip: donna ? 0.098 : 0.092, armX: donna ? 0.112 : 0.13, hipY: 0.47, shoulderY: 0.725, neckY: 0.785 };
}

/* Forme morbide ------------------------------------------------------------------------ */

// Sfera (o uno spicchio) con raggi sx, sy, sz; prima si gira (rx, ry, rz), poi si allunga
function ovale(m, x, y, z, sx, sy, sz, col, o = {}) {
  const T = THR();
  const g = new T.SphereGeometry(1, o.w || 10, o.h || 7, o.phi0 ?? 0, o.phiL ?? PI * 2, o.th0 ?? 0, o.thL ?? PI);
  if (o.rx) g.rotateX(o.rx);
  if (o.rz) g.rotateZ(o.rz);
  if (o.ry) g.rotateY(o.ry);
  g.scale(sx, sy, sz); g.translate(x, y, z);
  m.geom(g, col);
}
// Tronco di cono a sezione ovale (d = profondità rispetto alla larghezza), dal basso in alto
function tube(m, x, y0, y1, z, r0, r1, col, d = 1, seg = 10) {
  const g = new (THR().CylinderGeometry)(r1, r0, y1 - y0, seg);
  g.scale(1, 1, d); g.translate(x, (y0 + y1) / 2, z);
  m.geom(g, col);
}
function torus(m, x, y, z, R, r, col, { arc = PI * 2, rx = 0, ry = 0, rz = 0, seg = 10 } = {}) {
  const g = new (THR().TorusGeometry)(R, r, 4, seg, arc);
  if (rz) g.rotateZ(rz);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  m.geom(g, col);
}

/* Testa: un ovale con la faccia disegnata sopra ------------------------------------------ */

const HC = 0.105, HX = 0.09, HY = 0.105, HZ = 0.095;
// Dove sta la superficie della faccia davanti, alla posizione (x, y) della testa
const faceZ = (x, y) => HZ * Math.sqrt(Math.max(0, 1 - (x / HX) ** 2 - ((y - HC) / HY) ** 2));

function buildHead(m, L) {
  const S = L.skin, H = L.hair;
  const donna = L.gender === 'donna';
  ovale(m, 0, HC, 0, HX, HY, HZ, S, { w: 14, h: 10 });
  if (L.mannequin) { buildHeadwear(m, L); return; }
  for (const s of [-1, 1]) ovale(m, s * 0.087, HC - 0.006, -0.004, 0.014, 0.024, 0.018, shade(S, -0.05), { w: 6, h: 5 });
  // Occhi: bianco, iride, pupilla e un punto di luce, un po' girati per seguire la faccia
  for (const s of [-1, 1]) {
    const ex = s * 0.036, ey = HC - 0.008, z = faceZ(ex, ey), ry = s * 0.36;
    ovale(m, ex, ey, z - 0.003, 0.019, 0.023, 0.009, '#ffffff', { w: 8, h: 6, ry });
    ovale(m, ex - s * 0.001, ey - 0.002, z + 0.002, 0.013, 0.016, 0.006, L.eyes || '#3b2a1e', { w: 8, h: 6, ry });
    ovale(m, ex - s * 0.001, ey - 0.002, z + 0.006, 0.0075, 0.0095, 0.004, '#141414', { w: 6, h: 5, ry });
    ovale(m, ex + 0.004, ey + 0.005, z + 0.009, 0.0045, 0.0045, 0.003, '#ffffff', { w: 5, h: 4 });
    // Sopracciglia, un po' inclinate; ciglia per lei
    const by = HC + 0.025;
    m.prim('box', ex, by, faceZ(ex, by) - 0.002, 0.036, 0.008, 0.012, shade(H, -0.12), ry, s * 0.12);
    if (donna) m.prim('box', ex + s * 0.02, ey + 0.016, z + 0.002, 0.012, 0.005, 0.008, '#141414', ry, s * 0.5);
    // Guance rosate
    const cx = s * 0.055, cy = HC - 0.04;
    ovale(m, cx, cy, faceZ(cx, cy) - 0.002, 0.016, 0.01, 0.006, mix(S, '#ff7f8a', 0.4), { w: 6, h: 4, ry: s * 0.6 });
  }
  // Naso e sorriso (col rossetto se scelto)
  ovale(m, 0, HC - 0.03, faceZ(0, HC - 0.03) + 0.002, 0.011, 0.016, 0.013, shade(S, -0.05), { w: 6, h: 5 });
  const my = HC - 0.062, mz = faceZ(0, my) + 0.001;
  const lip = LIPS[L.lips] || null;
  if (lip) { ovale(m, 0, my - 0.003, mz - 0.002, 0.022, 0.009, 0.008, lip, { w: 8, h: 5 }); torus(m, 0, my + 0.006, mz + 0.004, 0.014, 0.0028, shade(lip, -0.3), { arc: PI, rz: PI, seg: 8 }); }
  else torus(m, 0, my + 0.008, mz, 0.017, 0.0038, '#8a3b33', { arc: PI, rz: PI, seg: 8 });
  buildBeard(m, L);
  buildHair(m, L);
  buildHeadwear(m, L);
}

function buildBeard(m, L) {
  const B = L.beard;
  if (!B || B === 'nessuno') return;
  const H = L.hair;
  // La parte bassa della faccia, lasciando libera la bocca
  const jaw = (k, col) => ovale(m, 0, HC, 0, HX * k, HY * k, HZ * k, col, { w: 14, h: 10, th0: PI * 0.6, thL: PI * 0.36, phi0: PI / 2 - 1.9, phiL: 3.8 });
  if (B === 'barbetta') jaw(1.01, mix(H, L.skin, 0.62));
  if (B === 'barba') { jaw(1.05, H); ovale(m, 0, HC - 0.095, 0.035, 0.042, 0.025, 0.04, H, { w: 8, h: 6 }); }
  const my = HC - 0.05, mz = faceZ(0, my);
  if (B === 'baffi' || B === 'pizzetto' || B === 'barba') for (const s of [-1, 1]) ovale(m, s * 0.016, my, mz + 0.002, 0.02, 0.007, 0.009, H, { w: 6, h: 4, rz: s * 0.25 });
  if (B === 'pizzetto') ovale(m, 0, HC - 0.092, faceZ(0, HC - 0.088) - 0.004, 0.018, 0.016, 0.014, H, { w: 6, h: 5 });
}

function buildHair(m, L) {
  const H = L.hair, st = L.style, hi = shade(H, 0.12);
  const R = [0.098, 0.113, 0.103];
  // Calotta inclinata: alta sulla fronte, bassa sulla nuca
  const cap = (k = 1, thL = 0.55, col = H, tilt = -0.6) => ovale(m, 0, HC, 0, R[0] * k, R[1] * k, R[2] * k, col, { w: 14, h: 9, thL: PI * thL, rx: tilt });
  if (st === 'pelato') { ovale(m, 0, HC, 0, R[0], R[1], R[2], H, { w: 14, h: 9, th0: PI * 0.42, thL: PI * 0.16, phi0: PI / 2 + 1.2, phiL: 2 * PI - 2.4 }); return; }
  if (st === 'rasati') { cap(0.985, 0.54, shade(H, 0.06)); return; }
  if (st === 'ricci') {
    cap(1, 0.52);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2, ring = i % 2;
      const r = ring ? 0.085 : 0.07, y = HC + (ring ? 0.05 : 0.085);
      const z = Math.sin(a) * r - 0.01;
      if (z > 0.045 && y < HC + 0.07) continue;
      m.prim('ico1', Math.cos(a) * r, y, z, 0.04, 0.038, 0.04, i % 3 ? H : hi, a);
    }
    m.prim('ico1', 0, HC + 0.105, -0.01, 0.05, 0.035, 0.05, H);
    if (L.gender === 'donna') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) m.prim('ico1', s * 0.085, HC - 0.02 - i * 0.04, -0.03, 0.035, 0.032, 0.035, i % 2 ? hi : H, i);
    return;
  }
  cap(1, st === 'caschetto' || st === 'lunghi' ? 0.58 : 0.55);
  if (st === 'corti') ovale(m, -0.02, HC + 0.075, 0.06, 0.06, 0.025, 0.035, H, { w: 8, h: 5, rz: 0.2 });
  else if (st === 'ciuffo') { ovale(m, 0.01, HC + 0.085, 0.06, 0.07, 0.035, 0.045, hi, { w: 8, h: 6, rx: 0.5, rz: -0.15 }); }
  else if (st === 'spettinati') {
    for (const [x, z, a] of [[-0.05, 0.05, 0.4], [0.02, 0.07, -0.2], [0.06, 0.0, -0.6], [-0.03, -0.05, 0.3], [0.05, -0.06, -0.3], [-0.07, -0.01, 0.7]]) m.prim('cone6', x, HC + 0.07, z, 0.03, 0.065, 0.03, H, a, a * 0.6);
  } else {
    // Frangia morbida sulla fronte (lunghi, coda, caschetto, chignon, trecce)
    ovale(m, 0.015, HC + 0.062, 0.06, 0.075, 0.03, 0.04, H, { w: 8, h: 5, rz: -0.12 });
  }
  if (st === 'lunghi') {
    ovale(m, 0, HC - 0.1, -0.05, 0.1, 0.16, 0.06, H, { w: 10, h: 7 });
    for (const s of [-1, 1]) ovale(m, s * 0.088, HC - 0.07, -0.005, 0.024, 0.13, 0.045, H, { w: 6, h: 6 });
  } else if (st === 'caschetto') {
    ovale(m, 0, HC - 0.012, 0, R[0] * 1.1, R[1] * 1.04, R[2] * 1.08, H, { w: 14, h: 9, th0: PI * 0.2, thL: PI * 0.52, phi0: PI / 2 + 0.95, phiL: 2 * PI - 1.9 });
  } else if (st === 'coda') {
    ovale(m, 0, HC + 0.03, -0.1, 0.03, 0.03, 0.03, '#e85d75', { w: 6, h: 5 });
    for (let i = 0; i < 4; i++) ovale(m, 0, HC + 0.01 - i * 0.05, -0.12 - (i === 0 ? 0 : 0.01), 0.04 - i * 0.004, 0.035, 0.035 - i * 0.003, i % 2 ? hi : H, { w: 7, h: 6 });
  } else if (st === 'chignon') {
    ovale(m, 0, HC + 0.1, -0.06, 0.055, 0.05, 0.055, H, { w: 9, h: 7 });
    m.prim('cyl6', -0.04, HC + 0.1, -0.06, 0.004, 0.08, 0.004, '#e2bf4f', 0, -1.2);
  } else if (st === 'trecce') {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) ovale(m, s * (0.084 + i * 0.004), HC - 0.03 - i * 0.034, -0.02 + i * 0.012, 0.02, 0.022, 0.02, i % 2 ? hi : H, { w: 6, h: 5 });
      ovale(m, s * 0.106, HC - 0.235, 0.05, 0.013, 0.01, 0.013, '#e85d75', { w: 6, h: 4 });
    }
  }
}

function buildHeadwear(m, L) {
  const x = L.extra;
  const top = HC + (L.style === 'chignon' ? 0.15 : L.style === 'ricci' || L.style === 'ciuffo' ? 0.13 : 0.115);
  if (x === 'cappellino') {
    const c = EXTRA_COL.cappellino;
    ovale(m, 0, HC + 0.008, 0, 0.104, 0.12, 0.108, c, { w: 14, h: 8, thL: PI * 0.47, rx: -0.3 });
    const g = new (THR().CylinderGeometry)(0.09, 0.09, 0.008, 12, 1, false, -PI / 2, PI);
    g.scale(1, 1, 0.85); g.rotateX(0.18); g.translate(0, HC + 0.055, 0.06);
    m.geom(g, shade(c, -0.15));
    ovale(m, 0, HC + 0.125, 0, 0.012, 0.008, 0.012, '#f1ede4', { w: 6, h: 4 });
  } else if (x === 'occhiali' || x === 'sole') {
    for (const s of [-1, 1]) {
      const ex = s * 0.036, ey = HC - 0.008, z = faceZ(ex, ey) + 0.014;
      torus(m, ex, ey, z, 0.022, 0.0035, '#1f1f1f', { seg: 10, ry: s * 0.3 });
      if (x === 'sole') ovale(m, ex, ey, z - 0.002, 0.021, 0.019, 0.004, '#1d2b36', { w: 8, h: 6, ry: s * 0.3 });
      m.prim('box', s * 0.08, ey + 0.012, -0.03, 0.006, 0.006, 0.11, '#1f1f1f');
    }
    m.prim('box', 0, HC - 0.0, faceZ(0, HC) + 0.012, 0.03, 0.005, 0.006, '#1f1f1f');
  } else if (x === 'fiore') {
    const fx = 0.08, fy = HC + 0.07, fz = 0.03;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * PI * 2; ovale(m, fx + 0.008, fy + Math.sin(a) * 0.02, fz + Math.cos(a) * 0.02, 0.008, 0.016, 0.016, '#f28cbf', { w: 6, h: 4 }); }
    ovale(m, fx + 0.016, fy, fz, 0.01, 0.01, 0.01, '#f6d84a', { w: 6, h: 4 });
  } else if (x === 'paglia') {
    tube(m, 0, top - 0.035, top - 0.025, 0, 0.19, 0.19, '#e6c97a', 1, 14);
    tube(m, 0, top - 0.03, top + 0.045, 0, 0.1, 0.09, '#e9d08a', 1, 12);
    tube(m, 0, top - 0.025, top + 0.0, 0, 0.102, 0.1, '#c0392b', 1, 12);
  } else if (x === 'coppola') {
    const c = EXTRA_COL.coppola;
    ovale(m, 0, top - 0.04, 0.005, 0.108, 0.045, 0.115, c, { w: 12, h: 7, thL: PI * 0.6 });
    const g = new (THR().CylinderGeometry)(0.075, 0.075, 0.008, 10, 1, false, -PI / 2, PI);
    g.scale(1, 1, 0.6); g.rotateX(0.2); g.translate(0, top - 0.045, 0.09);
    m.geom(g, shade(c, -0.12));
  } else if (x === 'basco') {
    ovale(m, 0.015, top - 0.02, 0, 0.115, 0.035, 0.11, EXTRA_COL.basco, { w: 12, h: 7, rz: -0.2 });
    m.prim('cyl6', 0.02, top + 0.005, 0, 0.006, 0.02, 0.006, EXTRA_COL.basco);
  } else if (x === 'cuffie') {
    torus(m, 0, HC + 0.005, 0, 0.104, 0.009, EXTRA_COL.cuffie, { arc: PI, seg: 12 });
    for (const s of [-1, 1]) ovale(m, s * 0.098, HC, 0, 0.022, 0.034, 0.034, '#e85d4a', { w: 8, h: 6 });
  } else if (x === 'corona') {
    tube(m, 0, top - 0.03, top + 0.02, 0, 0.085, 0.09, '#e2bf4f', 1, 10);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2; m.prim('cone6', Math.cos(a) * 0.082, top + 0.02, Math.sin(a) * 0.082, 0.016, 0.04, 0.016, '#e2bf4f'); }
    ovale(m, 0, top - 0.005, 0.09, 0.013, 0.013, 0.008, '#c0392b', { w: 6, h: 4 });
  }
}

/* Corpo -------------------------------------------------------------------------------- */

const SLEEVE = { giacca: 'lunga', camicia: 'lunga', felpa: 'lunga', righe: 'lunga', canotta: 'niente' };

function buildBody(m, L, B) {
  const top = L.top || 'maglietta', bottom = L.bottom || 'pantaloni';
  const S = L.skin, C = L.shirt, P = L.pants;
  const dress = top === 'vestito';
  const body = top === 'giacca' ? C : C;
  const d = 0.62;
  // Bacino
  tube(m, 0, B.hipY - 0.05, B.hipY + 0.05, 0, B.hip, B.hip * 0.97, dress ? C : P, 0.72);
  ovale(m, 0, B.hipY - 0.045, 0, B.hip, 0.03, B.hip * 0.72, dress ? C : P, { w: 10, h: 5, th0: PI / 2, thL: PI / 2 });
  // Busto: vita e petto (a righe se serve), spalle arrotondate
  const y0 = B.hipY + 0.03, ym = 0.6, y1 = B.shoulderY;
  const band = (ya, yb, ra, rb, col) => tube(m, 0, ya, yb, 0, ra, rb, col, d);
  if (top === 'righe') {
    const n = 7, r = (y) => (y < ym ? B.waist * 1.05 + ((y - y0) / (ym - y0)) * (B.waist - B.waist * 1.05) : B.waist + ((y - ym) / (y1 - ym)) * (B.sh - B.waist));
    for (let k = 0; k < n; k++) { const ya = y0 + ((y1 - y0) * k) / n, yb = y0 + ((y1 - y0) * (k + 1)) / n; band(ya, yb, r(ya), r(yb), k % 2 ? '#f4efe3' : C); }
  } else {
    band(y0, ym, B.waist * 1.05, B.waist, body);
    band(ym, y1, B.waist, B.sh, body);
  }
  ovale(m, 0, y1, 0, B.sh, 0.035, B.sh * d, top === 'righe' ? C : body, { w: 10, h: 5, thL: PI / 2 });
  const shoulderCol = top === 'canotta' ? S : body;
  for (const s of [-1, 1]) ovale(m, s * (B.armX - 0.008), y1 - 0.016, 0, 0.034, 0.032, 0.036, shoulderCol, { w: 8, h: 6 });
  if (top === 'canotta') for (const s of [-1, 1]) m.prim('box', s * 0.055, y1 - 0.01, 0, 0.022, 0.03, B.sh * d * 2 + 0.006, C);
  const fz = (y) => (y < ym ? B.waist : B.waist + ((y - ym) / (y1 - ym)) * (B.sh - B.waist)) * d + 0.002;
  if (top === 'camicia') {
    torus(m, 0, y1 + 0.012, 0, 0.036, 0.009, '#f4efe3', { rx: PI / 2, seg: 10 });
    for (const s of [-1, 1]) { const z = fz(y1) + 0.002; m.tri([s * 0.004, y1 + 0.006, z + 0.012], [s * 0.04, y1 + 0.004, z], [s * 0.012, y1 - 0.035, z + 0.008], [0, 0], [0, 0], [0, 0], '#f4efe3'); m.tri([s * 0.004, y1 + 0.006, z + 0.012], [s * 0.012, y1 - 0.035, z + 0.008], [s * 0.04, y1 + 0.004, z], [0, 0], [0, 0], [0, 0], '#f4efe3'); }
    for (let k = 0; k < 4; k++) ovale(m, 0, 0.53 + k * 0.045, fz(0.53 + k * 0.045), 0.005, 0.005, 0.003, '#f4efe3', { w: 5, h: 4 });
  }
  if (top === 'felpa') {
    torus(m, 0, y1 + 0.005, -0.015, 0.05, 0.022, shade(C, -0.08), { rx: PI / 2, seg: 10 });
    m.prim('box', 0, 0.52, fz(0.55) - 0.004, 0.11, 0.06, 0.01, shade(C, -0.1));
    for (const s of [-1, 1]) m.prim('box', s * 0.018, 0.63, fz(0.67), 0.004, 0.06, 0.004, '#f4efe3');
  }
  if (top === 'giacca') {
    // Camicia bianca e cravatta nello scollo a V, risvolti
    const yv = 0.6, zz = fz(0.68);
    m.tri([-0.045, y1 - 0.005, zz + 0.001], [0, yv, zz + 0.005], [0.045, y1 - 0.005, zz + 0.001], [0, 0], [0, 0], [0, 0], '#f4efe3');
    m.prim('box', 0, yv + 0.01, zz + 0.004, 0.016, y1 - yv - 0.02, 0.006, '#c0392b');
    for (const s of [-1, 1]) m.prim('box', s * 0.03, 0.64, zz + 0.002, 0.014, 0.08, 0.006, shade(C, -0.18), 0, -s * 0.45);
    ovale(m, 0, 0.515, fz(0.515) - 0.001, 0.006, 0.006, 0.004, '#2b2b2b', { w: 5, h: 4 });
  }
  // Gonna o vestito: si allargano verso le ginocchia
  if (dress) tube(m, 0, 0.27, B.hipY + 0.06, 0, 0.16, B.hip * 0.98, C, 0.82, 12);
  else if (bottom === 'gonna') tube(m, 0, 0.32, B.hipY + 0.06, 0, 0.145, B.hip * 1.02, P, 0.82, 12);
  // Collo
  tube(m, 0, y1 - 0.01, B.neckY + 0.02, 0, 0.032, 0.03, shade(S, -0.04), 1, 8);
  if (L.extra === 'sciarpa') {
    torus(m, 0, y1 + 0.02, 0, 0.05, 0.022, '#c0392b', { rx: PI / 2, seg: 12 });
    m.prim('box', 0.03, 0.56, fz(0.6) + 0.004, 0.032, 0.14, 0.012, '#c0392b', 0, 0.08);
    for (let k = 0; k < 3; k++) m.prim('box', 0.03, 0.58 + k * 0.035, fz(0.6) + 0.01, 0.033, 0.01, 0.004, '#f1ede4', 0, 0.08);
  }
}
// Braccio dalla spalla in giù: manica (corta, lunga o niente), avambraccio e mano
function buildArm(m, L) {
  const top = L.top || 'maglietta', S = L.skin, C = L.shirt;
  const sleeve = SLEEVE[top] || (top === 'vestito' ? 'corta' : 'corta');
  tube(m, 0, -0.16, 0, 0, 0.029, 0.033, sleeve === 'lunga' ? C : S, 1, 8);
  tube(m, 0, -0.29, -0.155, 0, 0.024, 0.029, sleeve === 'lunga' ? C : S, 1, 8);
  if (sleeve === 'corta') tube(m, 0, -0.085, 0.01, 0, 0.037, 0.04, C, 1, 8);
  if (top === 'righe') for (let k = 0; k < 4; k++) tube(m, 0, -0.04 - k * 0.065, -0.015 - k * 0.065, 0, 0.034 - k * 0.002, 0.035 - k * 0.002, '#f4efe3', 1, 8);
  if (sleeve === 'lunga') tube(m, 0, -0.29, -0.27, 0, 0.027, 0.027, top === 'giacca' ? '#f4efe3' : shade(C, -0.1), 1, 8);
  ovale(m, 0, -0.31, 0.004, 0.025, 0.032, 0.022, S, { w: 8, h: 6 });
}
// Gamba: coscia dall'anca al ginocchio; stinco e scarpa partono dal ginocchio
const THIGH = 0.22;
function buildThigh(m, L) {
  const b = L.bottom || 'pantaloni', P = L.pants;
  const bare = L.top === 'vestito' || b === 'gonna';
  tube(m, 0, -THIGH, 0.02, 0, 0.038, 0.05, bare ? L.skin : P, 1, 9);
  if (b === 'pantaloncini' && !bare) { tube(m, 0, -THIGH, -0.14, 0, 0.037, 0.04, L.skin, 1, 9); tube(m, 0, -0.15, -0.13, 0, 0.044, 0.045, shade(P, -0.1), 1, 9); }
  ovale(m, 0, -THIGH, 0, 0.038, 0.03, 0.038, bare || b === 'pantaloncini' ? L.skin : P, { w: 8, h: 6 });
}
function buildShin(m, L) {
  const b = L.bottom || 'pantaloni', P = L.pants;
  const bare = L.top === 'vestito' || b === 'gonna' || b === 'pantaloncini';
  tube(m, 0, -0.205, 0, 0, 0.028, 0.037, bare ? L.skin : P, 1, 9);
  if (!bare) tube(m, 0, -0.205, -0.19, 0, 0.032, 0.032, shade(P, -0.12), 1, 9);
  const sh = L.shoes || '#2b2b2b';
  ovale(m, 0, -0.232, 0.022, 0.036, 0.03, 0.064, sh, { w: 9, h: 6, thL: PI / 2 });
  m.box(-0.036, -0.245, -0.04, 0.036, -0.231, 0.086, shade(sh, sh === '#f1ede4' ? -0.25 : 0.25));
}

/* Mezzi --------------------------------------------------------------------------------- */

function buildRide(m, kind) {
  if (kind === 'bici') {
    const col = '#2f6b9f';
    for (const z of [-0.33, 0.33]) {
      m.prim('cyl10', 0.0175, 0.18, z, 0.18, 0.035, 0.18, '#1f1f1f', 0, Math.PI / 2);
      m.prim('cyl10', 0.02, 0.18, z, 0.12, 0.04, 0.12, '#cfd3d6', 0, Math.PI / 2);
    }
    m.prim('box', 0, 0.3, 0, 0.035, 0.035, 0.62, col);
    m.prim('box', 0, 0.3, -0.12, 0.035, 0.3, 0.035, col, 0, 0);
    m.prim('box', 0, 0.22, 0.27, 0.03, 0.4, 0.03, '#9aa0a6');
    m.box(-0.05, 0.5, -0.2, 0.05, 0.53, -0.08, '#2b2b2b');
    m.box(-0.18, 0.6, 0.24, 0.18, 0.625, 0.27, '#2b2b2b');
    m.box(-0.03, 0.42, 0.25, 0.03, 0.62, 0.28, '#9aa0a6');
  } else if (kind === 'skate') {
    m.box(-0.1, 0.05, -0.32, 0.1, 0.08, 0.32, '#2b2b2b');
    m.box(-0.1, 0.045, -0.32, 0.1, 0.055, 0.32, '#c0392b');
    for (const z of [-0.22, 0.22]) for (const x of [-0.08, 0.08]) m.prim('cyl10', x, 0.03, z, 0.03, 0.025, 0.03, '#e6dcc6', 0, Math.PI / 2);
  } else if (kind === 'monopattino') {
    m.box(-0.07, 0.05, -0.3, 0.07, 0.08, 0.26, '#3b3f45');
    for (const z of [-0.27, 0.27]) m.prim('cyl10', 0.02, 0.05, z, 0.05, 0.04, 0.05, '#1f1f1f', 0, Math.PI / 2);
    m.prim('box', 0, 0.06, 0.3, 0.035, 0.72, 0.035, '#3b3f45', 0, 0);
    m.box(-0.17, 0.76, 0.28, 0.17, 0.79, 0.32, '#2b2b2b');
    m.box(-0.025, 0.6, 0.315, 0.025, 0.66, 0.33, '#4fb3c8');
  }
}

/* L'omino ---------------------------------------------------------------------------------- */

const lookKey = (L, ride) => JSON.stringify([L.mannequin, L.gender, L.skin, L.eyes, L.hair, L.style, L.beard, L.lips, L.shirt, L.pants, L.shoes, L.top, L.bottom, L.extra, ride || null]);

export class Avatar3D {
  constructor(look, { ride = null, scale = 0.8 } = {}) {
    const T = THR();
    this.group = new T.Group();
    this.root = new T.Group();
    this.group.add(this.root);
    this.scale = scale;
    this.group.scale.setScalar(scale);
    this.wantGhost = false;
    this.set(look, ride);
  }
  set(look, ride = null) {
    const key = lookKey(look, ride);
    if (key === this.key) return false;
    this.key = key;
    this.look = look; this.ride = ride;
    const T = THR();
    for (const c of [...this.root.children]) { this.root.remove(c); c.traverse((o) => o.geometry?.dispose()); }
    const B = bodyOf(look);
    const mesh = (m) => { const me = new T.Mesh(m.build(), avatarMat()); me.castShadow = true; return me; };
    const part = (fill, x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); const m = new Mesher(); fill(m); g.add(mesh(m)); this.root.add(g); return g; };
    this.body = part((m) => buildBody(m, look, B), 0, 0, 0);
    this.head = part((m) => buildHead(m, look), 0, B.neckY, 0);
    this.head.scale.setScalar(1.1);               // testa un po' grande: la faccia si legge anche da lontano
    this.armL = part((m) => buildArm(m, look), -B.armX, B.shoulderY - 0.01, 0);
    this.armR = part((m) => buildArm(m, look), B.armX, B.shoulderY - 0.01, 0);
    this.legL = part((m) => buildThigh(m, look), -0.05, B.hipY, 0);
    this.legR = part((m) => buildThigh(m, look), 0.05, B.hipY, 0);
    // Gli stinchi stanno appesi al ginocchio, così le gambe si piegano
    const knee = (leg) => { const g = new T.Group(); g.position.y = -THIGH; const m = new Mesher(); buildShin(m, look); g.add(mesh(m)); leg.add(g); return g; };
    this.kneeL = knee(this.legL); this.kneeR = knee(this.legR);
    this.hipY = B.hipY;
    this.rideMesh = null;
    if (ride) { const m = new Mesher(); buildRide(m, ride); this.rideMesh = mesh(m); this.group.add(this.rideMesh); }
    if (this.wantGhost) this.makeGhost();
    return true;
  }
  // Una copia scura, visibile solo dietro le case (per il proprio omino)
  makeGhost() {
    const T = THR();
    this.wantGhost = true;
    const meshes = [];
    this.root.traverse((o) => { if (o.isMesh && !o.userData.ghost) meshes.push(o); });
    for (const o of meshes) {
      o.material = meMaterial(); o.renderOrder = 6;
      const g = new T.Mesh(o.geometry, ghostMaterial()); g.renderOrder = 5; g.userData.ghost = true;
      o.parent.add(g);
    }
  }
  // Posa del momento. s: { moving, phase, act, at, sit, facing }
  pose(s) {
    const r = this.root, t = s.at || 0;
    const parts = [this.armL, this.armR, this.legL, this.legR, this.kneeL, this.kneeR, this.head, this.body];
    for (const p of parts) p.rotation.set(0, 0, 0);
    r.position.set(0, 0, 0); r.rotation.set(0, 0, 0);
    this.body.position.y = 0;
    const ride = this.ride && !s.sit ? this.ride : null;
    if (this.rideMesh) this.rideMesh.visible = !!ride;
    if (s.sit) {
      // Seduti: cosce in avanti, gambe giù dal bordo della seduta
      this.legL.rotation.x = this.legR.rotation.x = -1.5;
      this.kneeL.rotation.x = this.kneeR.rotation.x = 1.5;
      this.armL.rotation.x = this.armR.rotation.x = -0.4;
      r.position.y = (s.seatH ?? 0.26) - this.hipY + 0.02;
      r.position.z = -0.06;
    } else if (ride === 'bici') {
      r.position.y = 0.06; r.position.z = -0.12;
      const p = s.moving ? s.phase * 1.6 : 0;
      this.legL.rotation.x = -0.95 + Math.sin(p) * 0.4; this.legR.rotation.x = -0.95 - Math.sin(p) * 0.4;
      this.kneeL.rotation.x = 1.2 - Math.sin(p) * 0.45; this.kneeR.rotation.x = 1.2 + Math.sin(p) * 0.45;
      this.armL.rotation.x = this.armR.rotation.x = -1.0;
      r.rotation.x = 0.18;
    } else if (ride) {
      r.position.y = 0.07;
      this.armL.rotation.x = this.armR.rotation.x = ride === 'monopattino' ? -1.05 : -0.2;
      if (ride === 'skate') { this.armL.rotation.z = -0.5; this.armR.rotation.z = 0.5; r.rotation.y = 0.5; }
      this.legL.rotation.x = 0.1; this.legR.rotation.x = -0.1;
    } else if (s.moving) {
      const a = Math.sin(s.phase), c = Math.cos(s.phase);
      this.legL.rotation.x = a * 0.55; this.legR.rotation.x = -a * 0.55;
      // il ginocchio si piega quando la gamba torna avanti
      this.kneeL.rotation.x = 0.08 + Math.max(0, -c) * 0.75; this.kneeR.rotation.x = 0.08 + Math.max(0, c) * 0.75;
      this.armL.rotation.x = -a * 0.5; this.armR.rotation.x = a * 0.5;
      this.armL.rotation.z = -0.06; this.armR.rotation.z = 0.06;
      r.position.y = Math.abs(c) * 0.02;
      this.head.rotation.y = a * 0.05;
    } else {
      // Fermo: respira e ogni tanto si guarda intorno
      const b = Math.sin(t / 700);
      this.body.position.y = b * 0.004;
      this.armL.rotation.z = -0.07 - b * 0.015; this.armR.rotation.z = 0.07 + b * 0.015;
      this.head.rotation.y = Math.sin(t / 2300) * 0.18;
    }
    // In città la telecamera sta in alto: la testa si alza un po' perché la faccia si veda
    if (s.lookUp) this.head.rotation.x -= s.lookUp;
    if (s.act === 'saluta') {
      this.armR.rotation.z = 2.6 + Math.sin(t / 110) * 0.35; this.armR.rotation.x = 0;
      this.head.rotation.z = -0.08;
    } else if (s.act === 'balla') {
      const k = Math.sin(t / 160);
      this.armL.rotation.z = -2.4 + k * 0.4; this.armR.rotation.z = 2.4 + k * 0.4;
      r.rotation.z = k * 0.12; r.position.y = Math.abs(k) * 0.06;
      this.legL.rotation.z = Math.max(0, k) * 0.25; this.legR.rotation.z = Math.min(0, k) * 0.25;
      this.kneeL.rotation.x = Math.max(0, k) * 0.5; this.kneeR.rotation.x = Math.max(0, -k) * 0.5;
      this.head.rotation.z = -k * 0.15;
    } else if (s.act === 'salta') {
      const p = Math.abs(Math.sin((t / 800) * Math.PI));
      r.position.y = p * 0.38;
      this.armL.rotation.z = -2.5 * p; this.armR.rotation.z = 2.5 * p;
      this.legL.rotation.x = this.legR.rotation.x = -0.45 * p;
      this.kneeL.rotation.x = this.kneeR.rotation.x = 0.8 * p;
    }
  }
  dispose() {
    this.group.traverse((o) => { if (o.geometry && !o.userData.ghost) o.geometry.dispose(); });
  }
}

/* Immagini: omini nelle stanze e nelle anteprime ---------------------------------------- */

let shot = null;
function shotRenderer() {
  const T = THR();
  if (shot) return shot;
  const cv = canvas2d(64, 80);
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true });
  r.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight('#fff6e8', '#7d8a6a', 0.62));
  const sun = new T.DirectionalLight('#ffe9cc', 0.6); sun.position.set(-2, 4, 3); scene.add(sun);
  shot = { cv, r, scene, cams: new Map() };
  return shot;
}
// Telecamera ortografica: `iso` come nelle stanze (dall'alto, di sbieco), `front` di tre quarti
function shotCamera(kind, w, h) {
  const T = THR();
  const k = `${kind}:${w}x${h}`;
  let c = shot.cams.get(k);
  if (c) return c;
  // 50 pixel per unità come gli omini piatti di prima; piedi a 8 pixel dal fondo; vista a 2:1
  const hh = h / 100, hw = w / 100;
  c = new T.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 20);
  const ty = (h / 2 - 8) / 50 / Math.cos(Math.atan(0.5));
  c.position.set(4, ty + 5.657 * 0.5, 4); c.lookAt(0, ty, 0);
  c.updateMatrixWorld();
  shot.cams.set(k, c);
  return c;
}
const ROOM_YAW = { SE: Math.PI / 2, SW: 0, NE: Math.PI, NW: -Math.PI / 2 };
const shotCache = new Map();
// L'omino come immagine 64×80 con i piedi in (32, 72): per le stanze isometriche.
export function avatarSprite(look, { dir = 'SE', moving = false, phase = 0, act = null, at = 0, sit = false, seatH = 0, ride = null } = {}) {
  const frame = moving ? Math.floor(((phase / (Math.PI * 2)) % 1) * 8) : 0;
  const af = act ? Math.floor(at / 90) : sit ? 0 : Math.floor(at / 1200) % 4;
  const key = lookKey(look, ride) + dir + frame + (act || '') + af + (sit ? 's' + seatH.toFixed(2) : '');
  let cv = shotCache.get(key);
  if (cv) return cv;
  const s = shotRenderer();
  const av = new Avatar3D(look, { ride, scale: 1 });
  av.group.rotation.y = ROOM_YAW[dir] ?? 0;
  av.pose({ moving, phase: (frame / 8) * Math.PI * 2, act, at: act ? af * 90 : af * 1200, sit, seatH });
  s.scene.add(av.group);
  const cam = shotCamera('iso', 64, 80);
  s.r.setSize(64, 80, false);
  s.r.render(s.scene, cam);
  s.scene.remove(av.group);
  av.dispose();
  cv = canvas2d(64, 80);
  cv.getContext('2d').drawImage(s.cv, 0, 0);
  shotCache.set(key, cv);
  if (shotCache.size > 500) shotCache.delete(shotCache.keys().next().value);
  return cv;
}
// Ritratto (mezzo busto o intero) di tre quarti, per icone e carta d'identità.
export function avatarPortrait(target, look, { full = false, bg = null } = {}) {
  const s = shotRenderer();
  const T = THR();
  const w = target.width, h = target.height;
  const av = new Avatar3D(look, { scale: 1 });
  av.group.rotation.y = 0.35;
  av.pose({ at: 0 });
  s.scene.add(av.group);
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  const hh = full ? 0.6 : 0.24, hw = hh * (w / h);
  Object.assign(cam, { left: -hw, right: hw, top: hh, bottom: -hh });
  cam.position.set(0.6, full ? 1.4 : 1.3, 4); cam.lookAt(0, full ? 0.52 : 0.84, 0);
  cam.updateProjectionMatrix();
  s.r.setSize(w, h, false);
  s.r.render(s.scene, cam);
  s.scene.remove(av.group); av.dispose();
  const g = target.getContext('2d');
  g.clearRect(0, 0, w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.drawImage(s.cv, 0, 0);
}

/* Palco dell'editor: l'omino gira su un piedistallo e si può ruotare col dito ------------- */

export class AvatarStage {
  constructor(canvas, look, { ride = null } = {}) {
    const T = THR();
    this.cv = canvas;
    this.r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.r.shadowMap.enabled = true;
    this.scene = new T.Scene();
    this.scene.add(new T.HemisphereLight('#fff6e8', '#8a9a6a', 0.62));
    const sun = new T.DirectionalLight('#ffe9cc', 0.62); sun.position.set(-2, 5, 4); sun.castShadow = true; sun.shadow.mapSize.set(512, 512);
    Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.5 });
    this.scene.add(sun);
    // Piedistallo di pietra con il prato
    const m = new Mesher();
    m.prim('disc', 0, -0.12, 0, 0.62, 0.12, 0.62, '#d8c9a6');
    m.prim('disc', 0, -0.02, 0, 0.56, 0.02, 0.56, '#7cb65a');
    for (let k = 0; k < 14; k++) { const a = k * 2.4, rr = 0.2 + (k % 4) * 0.08; m.prim('ico0', Math.cos(a) * rr, 0.0, Math.sin(a) * rr, 0.025, 0.03, 0.025, ['#e85d75', '#f6d84a', '#ffffff', '#5f9a3c'][k % 4]); }
    const base = new T.Mesh(m.build(), avatarMat()); base.receiveShadow = true; this.scene.add(base);
    this.cam = new T.PerspectiveCamera(28, 1, 0.1, 50);
    this.av = new Avatar3D(look, { ride, scale: 1 });
    this.scene.add(this.av.group);
    this.yaw = 0.35; this.spin = 0; this.t0 = performance.now(); this.act = null;
    this.drag = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => { this.drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (this.drag === null) return; this.yaw += (e.clientX - this.drag) * 0.012; this.drag = e.clientX; this.lastDrag = performance.now(); });
    canvas.addEventListener('pointerup', () => { this.drag = null; });
    const loop = (t) => {
      if (!canvas.isConnected) return this.dispose();
      this.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  set(look, ride = null) { if (this.av.set(look, ride)) this.wave(); }
  wave() { this.act = { kind: 'saluta', t0: performance.now() }; }
  frame(t) {
    const w = this.cv.clientWidth || this.cv.width, h = this.cv.clientHeight || this.cv.height;
    if (this.w !== w || this.h !== h) { this.w = w; this.h = h; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    if (this.drag === null && t - (this.lastDrag || 0) > 2500) this.yaw += 0.006;
    const at = this.act ? t - this.act.t0 : t - this.t0;
    if (this.act && at > 1800) this.act = null;
    const walking = !this.act && Math.floor((t - this.t0) / 4000) % 3 === 2;
    this.av.group.rotation.y = this.yaw;
    this.av.pose({ moving: walking && !this.av.ride, phase: t / 160, act: this.act?.kind || null, at });
    this.cam.position.set(0, 0.9, 2.7); this.cam.lookAt(0, 0.52, 0);
    this.r.render(this.scene, this.cam);
  }
  dispose() { this.av.dispose(); this.r.dispose(); this.r.forceContextLoss(); }
}
