// Abitanti in 3D, nello stesso stile low-poly della città: testa grande e faccia ben leggibile
// (occhi con la luce, sopracciglia, bocca, guance), capelli, barba o rossetto, vestiti, scarpe e
// accessori. Il corpo è fatto di pezzi che si muovono (gambe, braccia, testa) per camminare,
// salutare, ballare, saltare, sedersi e andare in bici, skate o monopattino.
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

const HAIR_FRONT = 0.152;
const LIPS = { naturale: null, rosa: '#e46b8f', rosso: '#c8283c' };
const EXTRA_COL = { cappellino: '#c0392b', coppola: '#6f6a60', basco: '#7a2c3a', cuffie: '#2b2b2b' };

// Le misure del corpo (in unità della città prima della scala finale)
function bodyOf(L) {
  const donna = L.gender === 'donna';
  return { tw: donna ? 0.125 : 0.15, hipW: donna ? 0.135 : 0.13, armX: donna ? 0.17 : 0.195, hipY: 0.34, shoulderY: 0.645, neckY: 0.69 };
}

/* Testa ------------------------------------------------------------------------------- */

function buildHead(m, L) {
  const S = L.skin, H = L.hair, dark = shade(S, -0.12);
  const donna = L.gender === 'donna';
  // Testa, orecchie, collo nascosto sotto (i manichini non hanno faccia né capelli)
  m.box(-0.17, 0, -0.15, 0.17, 0.31, 0.15, S);
  if (L.mannequin) { buildHeadwear(m, L); return; }
  m.box(-0.19, 0.11, -0.03, -0.17, 0.18, 0.03, dark); m.box(0.17, 0.11, -0.03, 0.19, 0.18, 0.03, dark);
  // Occhi: bianco, iride, pupilla e un punto di luce
  const f = 0.151;
  for (const s of [-1, 1]) {
    const ex = s * 0.07;
    m.box(ex - 0.038, 0.11, f - 0.004, ex + 0.038, 0.19, f + 0.004, '#ffffff');
    m.box(ex - 0.028 - s * 0.006, 0.112, f + 0.004, ex + 0.024 - s * 0.006, 0.178, f + 0.008, L.eyes || '#3b2a1e');
    m.box(ex - 0.013 - s * 0.006, 0.124, f + 0.008, ex + 0.009 - s * 0.006, 0.164, f + 0.011, '#141414');
    m.box(ex + 0.002 - s * 0.006, 0.152, f + 0.011, ex + 0.014 - s * 0.006, 0.168, f + 0.013, '#ffffff');
    // Sopracciglia (un po' inclinate) e ciglia per lei
    m.box(ex - 0.042, 0.205, f - 0.002, ex + 0.042, 0.224, f + 0.012, shade(H, -0.1));
    if (donna) { m.box(s > 0 ? ex + 0.03 : ex - 0.05, 0.178, f, s > 0 ? ex + 0.05 : ex - 0.03, 0.196, f + 0.012, '#141414'); }
    // Guance rosate
    m.box(ex + s * 0.015 - 0.025, 0.07, f - 0.004, ex + s * 0.015 + 0.025, 0.095, f + 0.004, mix(S, '#ff7f8a', 0.45));
  }
  // Naso e bocca (col rossetto se scelto)
  m.box(-0.018, 0.085, f, 0.018, 0.12, f + 0.03, shade(S, -0.05));
  const lip = LIPS[L.lips] || null;
  if (lip) { m.box(-0.04, 0.035, f - 0.002, 0.04, 0.062, f + 0.01, lip); m.box(-0.025, 0.045, f + 0.01, 0.025, 0.05, f + 0.012, shade(lip, -0.25)); }
  else m.box(-0.032, 0.042, f - 0.002, 0.032, 0.058, f + 0.008, '#8a3b33');
  buildBeard(m, L);
  buildHair(m, L);
  buildHeadwear(m, L);
}

function buildBeard(m, L) {
  const B = L.beard;
  if (!B || B === 'nessuno') return;
  const H = L.hair, f = 0.151;
  if (B === 'barbetta') { m.box(-0.165, -0.005, 0.02, 0.165, 0.075, f + 0.006, mix(H, L.skin, 0.55)); return; }
  if (B === 'barba') {
    m.box(-0.172, -0.04, -0.02, 0.172, 0.08, f + 0.02, H);
    m.box(-0.172, 0.04, -0.05, -0.15, 0.15, 0.1, H); m.box(0.15, 0.04, -0.05, 0.172, 0.15, 0.1, H);
    m.box(-0.035, 0.03, f + 0.02, 0.035, 0.06, f + 0.024, '#7a3b33');
  }
  if (B === 'baffi' || B === 'pizzetto' || B === 'barba') m.box(-0.06, 0.06, f, 0.06, 0.085, f + 0.022, H);
  if (B === 'pizzetto') m.box(-0.03, -0.015, f - 0.02, 0.03, 0.03, f + 0.018, H);
}

function buildHair(m, L) {
  const H = L.hair, st = L.style, f = HAIR_FRONT;
  const hi = shade(H, 0.12);
  if (st === 'pelato') { m.box(-0.175, 0.08, -0.155, 0.175, 0.2, -0.1, H); return; }
  // Calotta e frangia
  const cap = (top = 0.35) => {
    m.box(-0.18, 0.24, -0.16, 0.18, top, 0.16, H);
    m.box(-0.18, 0.1, -0.165, 0.18, 0.26, -0.11, H);
    m.box(-0.185, 0.15, -0.16, -0.16, 0.27, 0.06, H); m.box(0.16, 0.15, -0.16, 0.185, 0.27, 0.06, H);
    m.box(-0.12, top - 0.015, -0.1, 0.06, top + 0.01, 0.06, hi);
  };
  if (st === 'rasati') { m.box(-0.175, 0.22, -0.155, 0.175, 0.33, 0.155, shade(H, 0.05)); m.box(-0.175, 0.1, -0.16, 0.175, 0.24, -0.12, shade(H, 0.05)); return; }
  if (st === 'ricci') {
    const balls = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; balls.push([Math.cos(a) * 0.15, 0.3 + (i % 2) * 0.03, Math.sin(a) * 0.14 - 0.01]); }
    for (let i = 0; i < 5; i++) balls.push([-0.1 + i * 0.05, 0.36, -0.03 + (i % 2) * 0.05]);
    for (let i = 0; i < 6; i++) balls.push([-0.15 + i * 0.06, 0.16 + (i % 2) * 0.05, -0.15]);
    if (L.gender === 'donna') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) balls.push([s * 0.17, 0.06 + i * 0.06, -0.06]);
    for (const [x, y, z] of balls) m.prim('ico0', x, y, z, 0.075, 0.07, 0.075, H);
    m.box(-0.17, 0.24, -0.14, 0.17, 0.34, 0.12, H);
    return;
  }
  cap(st === 'caschetto' || st === 'lunghi' ? 0.345 : 0.35);
  if (st === 'corti') m.box(-0.17, 0.235, f - 0.04, 0.12, 0.29, f + 0.012, H);
  else if (st === 'ciuffo') { m.box(-0.17, 0.25, f - 0.04, 0.17, 0.29, f + 0.01, H); m.prim('box', 0.02, 0.32, 0.06, 0.24, 0.1, 0.18, hi, -0.2, -0.25); }
  else if (st === 'spettinati') { m.box(-0.17, 0.235, f - 0.04, 0.17, 0.28, f + 0.012, H); for (const [x, z, r] of [[-0.1, 0.05, 0.3], [0.02, 0.08, -0.1], [0.12, 0, -0.4], [-0.04, -0.07, 0.2], [0.08, -0.1, -0.2]]) m.prim('pyr', x, 0.33, z, 0.07, 0.1, 0.07, H, r, r * 0.6); }
  else {
    // Frangia piena (lunghi, coda, caschetto, chignon, trecce)
    m.box(-0.175, 0.225, f - 0.04, 0.175, 0.29, f + 0.012, H);
    m.box(-0.05, 0.27, f - 0.03, 0.08, 0.3, f + 0.016, hi);
  }
  if (st === 'lunghi') {
    m.box(-0.19, -0.1, -0.17, 0.19, 0.26, -0.08, H);
    for (const s of [-1, 1]) m.box(s > 0 ? 0.155 : -0.195, -0.06, -0.12, s > 0 ? 0.195 : -0.155, 0.24, 0.1, H);
  } else if (st === 'caschetto') {
    m.box(-0.19, 0.0, -0.17, 0.19, 0.26, -0.08, H);
    for (const s of [-1, 1]) m.box(s > 0 ? 0.155 : -0.195, 0.02, -0.12, s > 0 ? 0.195 : -0.155, 0.24, 0.12, H);
  } else if (st === 'coda') {
    m.prim('ico1', 0, 0.26, -0.2, 0.07, 0.07, 0.07, H);
    m.prim('cyl6', 0, 0.02, -0.23, 0.055, 0.24, 0.05, H, 0, 0);
    m.box(-0.03, 0.22, -0.23, 0.03, 0.26, -0.2, '#e85d75');
  } else if (st === 'chignon') {
    m.prim('ball', 0, 0.36, -0.1, 0.1, 0.09, 0.1, H);
    m.box(-0.02, 0.4, -0.12, 0.02, 0.46, -0.08, '#e2bf4f');
  } else if (st === 'trecce') {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) m.prim('ico0', s * 0.15, 0.12 - i * 0.07, -0.08 + i * 0.02, 0.045, 0.045, 0.045, i % 2 ? hi : H);
      m.box(s * 0.15 - 0.02, -0.17, -0.05, s * 0.15 + 0.02, -0.14, -0.01, '#e85d75');
    }
  }
}

function buildHeadwear(m, L) {
  const x = L.extra;
  const top = L.style === 'chignon' ? 0.4 : 0.35;
  if (x === 'cappellino') {
    m.box(-0.185, 0.27, -0.165, 0.185, 0.38, 0.165, EXTRA_COL.cappellino);
    m.box(-0.15, 0.27, 0.15, 0.15, 0.29, 0.29, shade(EXTRA_COL.cappellino, -0.15));
    m.box(-0.03, 0.38, -0.03, 0.03, 0.4, 0.03, '#f1ede4');
  } else if (x === 'occhiali' || x === 'sole') {
    const f = 0.165;
    for (const s of [-1, 1]) {
      const ex = s * 0.07;
      m.box(ex - 0.05, 0.1, f, ex + 0.05, 0.112, f + 0.012, '#1f1f1f'); m.box(ex - 0.05, 0.198, f, ex + 0.05, 0.21, f + 0.012, '#1f1f1f');
      m.box(ex - 0.05, 0.1, f, ex - 0.038, 0.21, f + 0.012, '#1f1f1f'); m.box(ex + 0.038, 0.1, f, ex + 0.05, 0.21, f + 0.012, '#1f1f1f');
      m.box(s > 0 ? 0.17 : -0.18, 0.18, -0.08, s > 0 ? 0.18 : -0.17, 0.2, f, '#1f1f1f');
    }
    m.box(-0.02, 0.16, f, 0.02, 0.172, f + 0.012, '#1f1f1f');
  } else if (x === 'fiore') {
    const fx = 0.15, fy = 0.3, fz = 0.08;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; m.prim('ico0', fx + 0.01, fy + Math.sin(a) * 0.035, fz + Math.cos(a) * 0.035, 0.03, 0.03, 0.03, '#f28cbf'); }
    m.prim('ico0', fx + 0.025, fy, fz, 0.022, 0.022, 0.022, '#f6d84a');
  } else if (x === 'paglia') {
    m.prim('disc', 0, top - 0.02, 0, 0.34, 0.025, 0.34, '#e6c97a');
    m.prim('cyl10', 0, top, 0, 0.17, 0.11, 0.17, '#e9d08a');
    m.prim('cyl10', 0, top + 0.005, 0, 0.175, 0.035, 0.175, '#c0392b');
  } else if (x === 'coppola') {
    m.box(-0.19, 0.28, -0.17, 0.19, 0.37, 0.15, EXTRA_COL.coppola);
    m.box(-0.17, 0.28, 0.12, 0.17, 0.32, 0.26, shade(EXTRA_COL.coppola, -0.12));
  } else if (x === 'basco') {
    m.prim('ball', 0.03, 0.32, 0, 0.22, 0.07, 0.2, EXTRA_COL.basco, 0, -0.2);
    m.box(0.02, 0.38, -0.01, 0.04, 0.42, 0.01, EXTRA_COL.basco);
  } else if (x === 'cuffie') {
    m.box(-0.2, 0.33, -0.03, 0.2, 0.37, 0.03, EXTRA_COL.cuffie);
    for (const s of [-1, 1]) { m.box(s > 0 ? 0.17 : -0.205, 0.17, -0.02, s > 0 ? 0.205 : -0.17, 0.35, 0.02, EXTRA_COL.cuffie); m.box(s > 0 ? 0.18 : -0.23, 0.08, -0.06, s > 0 ? 0.23 : -0.18, 0.2, 0.06, '#e85d4a'); }
  } else if (x === 'corona') {
    m.prim('cyl10', 0, top - 0.02, 0, 0.16, 0.07, 0.16, '#e2bf4f');
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.prim('pyr', Math.cos(a) * 0.15, top + 0.05, Math.sin(a) * 0.15, 0.04, 0.07, 0.04, '#e2bf4f'); }
    m.prim('ico0', 0, top + 0.02, 0.16, 0.025, 0.025, 0.02, '#c0392b');
  }
}

/* Corpo -------------------------------------------------------------------------------- */

function buildBody(m, L, B) {
  const top = L.top || 'maglietta', bottom = L.bottom || 'pantaloni';
  const S = L.skin, C = L.shirt, P = L.pants;
  const dress = top === 'vestito';
  const tw = top === 'canotta' ? B.tw - 0.01 : B.tw;
  // Bacino
  m.box(-B.hipW, 0.3, -0.075, B.hipW, 0.41, 0.075, dress ? C : bottom === 'gonna' ? P : P);
  // Busto: per lei vita più stretta
  const body = top === 'giacca' ? '#f4efe3' : C;
  if (L.gender === 'donna') { m.box(-tw + 0.012, 0.4, -0.075, tw - 0.012, 0.5, 0.075, body); m.box(-tw, 0.5, -0.08, tw, 0.665, 0.08, body); }
  else m.box(-tw, 0.4, -0.08, tw, 0.665, 0.08, body);
  if (top === 'righe') for (let k = 0; k < 4; k++) m.box(-tw - 0.002, 0.43 + k * 0.06, -0.082, tw + 0.002, 0.455 + k * 0.06, 0.082, '#f4efe3');
  if (top === 'camicia') {
    m.box(-0.07, 0.62, 0.075, -0.005, 0.67, 0.088, '#f4efe3'); m.box(0.005, 0.62, 0.075, 0.07, 0.67, 0.088, '#f4efe3');
    for (let k = 0; k < 3; k++) m.box(-0.008, 0.45 + k * 0.06, 0.08, 0.008, 0.465 + k * 0.06, 0.088, '#f4efe3');
  }
  if (top === 'felpa') {
    m.box(-0.11, 0.6, -0.12, 0.11, 0.69, -0.06, shade(C, -0.08));
    m.box(-0.08, 0.43, 0.08, 0.08, 0.5, 0.088, shade(C, -0.12));
    m.box(-0.035, 0.55, 0.08, -0.025, 0.63, 0.09, '#f4efe3'); m.box(0.025, 0.55, 0.08, 0.035, 0.63, 0.09, '#f4efe3');
  }
  if (top === 'giacca') {
    for (const s of [-1, 1]) {
      m.box(s > 0 ? 0.035 : -tw - 0.006, 0.38, -0.086, s > 0 ? tw + 0.006 : -0.035, 0.67, 0.088, C);
      m.prim('box', s * 0.055, 0.56, 0.088, 0.04, 0.1, 0.01, shade(C, -0.15), 0, s * 0.3);
    }
    m.box(-tw - 0.006, 0.38, -0.086, tw + 0.006, 0.67, -0.07, C);
    m.box(-0.012, 0.47, 0.082, 0.012, 0.64, 0.09, '#c0392b');
  }
  if (top === 'canotta') { m.box(-tw - 0.002, 0.58, -0.06, -tw + 0.04, 0.665, 0.06, S); m.box(tw - 0.04, 0.58, -0.06, tw + 0.002, 0.665, 0.06, S); }
  // Gonna o vestito: un tronco di cono che si allarga verso le ginocchia
  if (dress) m.prim('cone8', 0, 0.15, 0, 0.21, 0.62, 0.17, C);
  else if (bottom === 'gonna') m.prim('cone8', 0, 0.2, 0, 0.19, 0.5, 0.155, P);
  // Collo
  m.box(-0.045, 0.66, -0.04, 0.045, 0.71, 0.04, shade(S, -0.06));
  if (L.extra === 'sciarpa') {
    m.box(-0.1, 0.64, -0.08, 0.1, 0.71, 0.08, '#c0392b');
    m.box(0.02, 0.48, 0.07, 0.07, 0.66, 0.09, '#c0392b');
    for (let k = 0; k < 3; k++) m.box(0.02, 0.5 + k * 0.05, 0.088, 0.07, 0.515 + k * 0.05, 0.092, '#f1ede4');
  }
}
function buildArm(m, L, side) {
  const top = L.top || 'maglietta', S = L.skin;
  const sleeve = top === 'giacca' || top === 'camicia' || top === 'felpa' || top === 'righe' ? 'lunga' : top === 'canotta' ? 'niente' : 'corta';
  const C = L.shirt;
  m.box(-0.042, -0.25, -0.045, 0.042, 0, 0.045, sleeve === 'niente' ? S : sleeve === 'corta' ? S : C);
  if (sleeve === 'corta') m.box(-0.047, -0.1, -0.05, 0.047, 0.005, 0.05, C);
  if (top === 'righe') for (let k = 0; k < 3; k++) m.box(-0.044, -0.06 - k * 0.07, -0.047, 0.044, -0.04 - k * 0.07, 0.047, '#f4efe3');
  if (sleeve === 'lunga') m.box(-0.046, -0.235, -0.049, 0.046, -0.21, 0.049, top === 'giacca' ? '#f4efe3' : shade(C, -0.1));
  m.box(-0.04, -0.31, -0.042, 0.04, -0.24, 0.042, S);
  void side;
}
function buildLeg(m, L) {
  const b = L.bottom || 'pantaloni', S = L.skin, P = L.pants;
  const bare = L.top === 'vestito' || b === 'gonna';
  m.box(-0.055, -0.3, -0.06, 0.055, 0, 0.06, bare ? S : P);
  if (b === 'pantaloncini' && !bare) m.box(-0.055, -0.3, -0.06, 0.055, -0.14, 0.06, S);
  if (b === 'pantaloncini' && !bare) m.box(-0.058, -0.16, -0.063, 0.058, -0.13, 0.063, shade(P, -0.1));
  const sh = L.shoes || '#2b2b2b';
  m.box(-0.062, -0.345, -0.07, 0.062, -0.285, 0.11, sh);
  m.box(-0.062, -0.35, -0.07, 0.062, -0.335, 0.11, shade(sh, sh === '#f1ede4' ? -0.25 : 0.25));
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
    this.armL = part((m) => buildArm(m, look, -1), -B.armX, B.shoulderY, 0);
    this.armR = part((m) => buildArm(m, look, 1), B.armX, B.shoulderY, 0);
    this.legL = part((m) => buildLeg(m, look), -0.07, B.hipY, 0);
    this.legR = part((m) => buildLeg(m, look), 0.07, B.hipY, 0);
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
    const parts = [this.armL, this.armR, this.legL, this.legR, this.head, this.body];
    for (const p of parts) p.rotation.set(0, 0, 0);
    r.position.set(0, 0, 0); r.rotation.set(0, 0, 0);
    this.body.position.y = 0;
    const ride = this.ride && !s.sit ? this.ride : null;
    if (this.rideMesh) this.rideMesh.visible = !!ride;
    if (s.sit) {
      // Seduti: cosce in avanti, gambe giù dal bordo della seduta
      this.legL.rotation.x = this.legR.rotation.x = -1.45;
      this.armL.rotation.x = this.armR.rotation.x = -0.35;
      r.position.y = (s.seatH ?? 0.26) - 0.32;
      r.position.z = -0.08;
    } else if (ride === 'bici') {
      r.position.y = 0.2; r.position.z = -0.12;
      const p = s.moving ? s.phase * 1.6 : 0;
      this.legL.rotation.x = -1.1 + Math.sin(p) * 0.45; this.legR.rotation.x = -1.1 - Math.sin(p) * 0.45;
      this.armL.rotation.x = this.armR.rotation.x = -1.15;
      r.rotation.x = 0.18;
    } else if (ride) {
      r.position.y = 0.07;
      this.armL.rotation.x = this.armR.rotation.x = ride === 'monopattino' ? -1.05 : -0.2;
      if (ride === 'skate') { this.armL.rotation.z = -0.5; this.armR.rotation.z = 0.5; r.rotation.y = 0.5; }
      this.legL.rotation.x = 0.1; this.legR.rotation.x = -0.1;
    } else if (s.moving) {
      const a = Math.sin(s.phase);
      this.legL.rotation.x = a * 0.6; this.legR.rotation.x = -a * 0.6;
      this.armL.rotation.x = -a * 0.55; this.armR.rotation.x = a * 0.55;
      r.position.y = Math.abs(Math.cos(s.phase)) * 0.035;
      this.head.rotation.y = a * 0.05;
    } else {
      // Fermo: respira e ogni tanto si guarda intorno
      const b = Math.sin(t / 700);
      this.body.position.y = b * 0.004;
      this.armL.rotation.z = -0.04 - b * 0.02; this.armR.rotation.z = 0.04 + b * 0.02;
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
      this.head.rotation.z = -k * 0.15;
    } else if (s.act === 'salta') {
      const p = Math.abs(Math.sin((t / 800) * Math.PI));
      r.position.y = p * 0.38;
      this.armL.rotation.z = -2.5 * p; this.armR.rotation.z = 2.5 * p;
      this.legL.rotation.x = this.legR.rotation.x = -0.3 * p;
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
  const hh = full ? 0.62 : 0.34, hw = hh * (w / h);
  Object.assign(cam, { left: -hw, right: hw, top: hh, bottom: -hh });
  cam.position.set(0.6, full ? 1.4 : 1.25, 4); cam.lookAt(0, full ? 0.55 : 0.82, 0);
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
    this.cam.position.set(0, 1.0, 3.3); this.cam.lookAt(0, 0.5, 0);
    this.r.render(this.scene, this.cam);
  }
  dispose() { this.av.dispose(); this.r.dispose(); this.r.forceContextLoss(); }
}
