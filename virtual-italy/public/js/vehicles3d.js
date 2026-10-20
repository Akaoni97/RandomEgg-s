// Veicoli in 3D con la sagoma vera: utilitaria, berlina, familiare, SUV, sportiva, taxi, furgone,
// Ape e autobus. La carrozzeria è il profilo di fianco estruso (con gli spigoli smussati), sopra c'è
// l'abitacolo con vetri e montanti; poi fari, griglia, paraurti, targhe, specchietti, porte e ruote
// nei passaruota. Le misure sono in metri e alla fine diventano caselle (un omino di 1,75 m è alto
// poco più di mezza casella). Il muso guarda verso +x, il lato destro è +z.
import { Mesher } from './town3d.js';
import { shade } from './art.js';

const VT = () => globalThis.THREE;
const MU = 0.315;                                   // caselle per metro
const GLASS = '#2c3e50', TYRE = '#1c1c1e', HUB = '#c9ccd0', TRIM = '#3a3d42', CHROME = '#d9dcdf';
const HEAD = '#fff4cf', TAIL = '#d0352b', PLATE = '#f4f4ee', EU = '#2f55a4';

// Le forme di fianco. body: carrozzeria fino alla linea dei finestrini; cab: abitacolo (parabrezza,
// tetto, lunotto); doors: dove stanno i montanti tra un finestrino e l'altro.
const SAGOME = {
  utilitaria: {
    L: 3.6, W: 1.62, H: 1.52, r: 0.29, wheels: [1.2, -1.2],
    body: [[-1.8, 0.3], [-1.7, 0.18], [1.68, 0.18], [1.8, 0.32], [1.8, 0.7], [1.55, 0.86], [0.75, 0.95], [-1.62, 0.95], [-1.8, 0.82]],
    cab: [[0.75, 0.95], [0.05, 1.5], [-1.38, 1.52], [-1.62, 0.95]], doors: [-0.62],
  },
  berlina: {
    L: 4.7, W: 1.8, H: 1.45, r: 0.32, wheels: [1.45, -1.4],
    body: [[-2.35, 0.32], [-2.25, 0.18], [2.2, 0.18], [2.35, 0.32], [2.35, 0.66], [2.05, 0.8], [0.7, 0.92], [-1.55, 0.95], [-2.28, 0.98], [-2.35, 0.8]],
    cab: [[0.7, 0.92], [-0.05, 1.44], [-1.05, 1.45], [-1.55, 0.95]], doors: [-0.42], trunk: true,
  },
  familiare: {
    L: 4.7, W: 1.8, H: 1.48, r: 0.32, wheels: [1.45, -1.4], rails: true,
    body: [[-2.35, 0.32], [-2.25, 0.18], [2.2, 0.18], [2.35, 0.32], [2.35, 0.66], [2.05, 0.8], [0.7, 0.92], [-2.25, 0.98], [-2.35, 0.85]],
    cab: [[0.7, 0.92], [-0.05, 1.47], [-2.08, 1.48], [-2.25, 0.98]], doors: [-0.42, -1.45],
  },
  suv: {
    L: 4.5, W: 1.86, H: 1.72, r: 0.37, wheels: [1.4, -1.4], rails: true, clad: true,
    body: [[-2.25, 0.42], [-2.15, 0.24], [2.1, 0.24], [2.25, 0.42], [2.25, 0.86], [2.0, 1.0], [0.8, 1.1], [-2.15, 1.12], [-2.25, 0.96]],
    cab: [[0.8, 1.1], [0.15, 1.7], [-1.92, 1.72], [-2.15, 1.12]], doors: [-0.45, -1.45],
  },
  sportiva: {
    L: 4.4, W: 1.86, H: 1.22, r: 0.33, wheels: [1.35, -1.32], spoiler: true,
    body: [[-2.2, 0.3], [-2.1, 0.14], [2.05, 0.14], [2.2, 0.26], [2.2, 0.5], [1.9, 0.64], [0.45, 0.8], [-1.6, 0.85], [-2.15, 0.88], [-2.2, 0.7]],
    cab: [[0.45, 0.8], [-0.3, 1.2], [-0.95, 1.22], [-1.6, 0.85]], doors: [],
  },
  furgone: {
    L: 5.2, W: 1.95, H: 2.3, r: 0.33, wheels: [1.75, -1.7], van: true,
    body: [[-2.6, 0.38], [-2.5, 0.22], [2.45, 0.22], [2.6, 0.38], [2.6, 0.86], [2.3, 1.05], [1.85, 1.2], [-2.6, 1.2]],
    cab: [[1.85, 1.2], [1.15, 2.22], [-2.55, 2.3], [-2.6, 1.2]], doors: [0.82],
  },
};
SAGOME.taxi = { ...SAGOME.berlina, taxi: true };

// Il profilo estruso per larghezza w, centrato su z = 0, con gli spigoli smussati di bev
function extrude(m, pts, w, col, bev = 0.05) {
  const T = VT();
  const sh = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
  const g = new T.ExtrudeGeometry(sh, { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 4 });
  m.geom(g, col, (x, y, z) => [x, y, z - (w / 2 - bev)]);
}
// Un pannello di quattro punti, girato in modo che guardi verso `out`
function panel(m, pts, out, col) {
  const [a, b, c] = pts;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const p = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? [...pts].reverse() : pts;
  m.quad(p[0], p[1], p[2], p[3], col);
}
// Ruota con il cerchione (asse lungo z) e passaruota scuro dietro, sul fianco
function wheel(m, x, r, zc, w, side, W) {
  const T = VT();
  m.prim('cyl10', x, r, zc - w / 2, r, w, r, TYRE, Math.PI / 2, Math.PI / 2);
  m.prim('cyl10', x, r, zc - w / 2 - 0.012, r * 0.58, w + 0.024, r * 0.58, HUB, Math.PI / 2, Math.PI / 2);
  m.prim('cyl6', x, r, zc - w / 2 - 0.02, r * 0.16, w + 0.04, r * 0.16, TRIM, Math.PI / 2, Math.PI / 2);
  if (side === 0) return;
  const sh = new T.Shape(); sh.moveTo(r * 1.18, 0); sh.absarc(0, 0, r * 1.18, 0, Math.PI, false); sh.lineTo(r * 1.18, 0);
  const g = new T.ShapeGeometry(sh, 6);
  const zz = side * (W / 2 + 0.004);
  m.geom(g, '#232427', (px, py) => (side > 0 ? [x + px, r + py, zz] : [x - px, r + py, zz]));
}
// Fari, griglia, paraurti e targhe davanti (f = +1) o dietro (f = -1)
function ends(m, S, col, f, x, top, bottom) {
  const W = S.W, d = f > 0 ? 0.02 : -0.02;
  const x0 = Math.min(x, x + d * 3), x1 = Math.max(x, x + d * 3);
  m.box(x0 - 0.05 * f, bottom + 0.02, -W / 2 + 0.03, x1 - 0.05 * f, bottom + 0.2, W / 2 - 0.03, TRIM);
  m.box(x0 + 0.01 * f, bottom + 0.07, -0.26, x1 + 0.01 * f, bottom + 0.18, 0.26, PLATE);
  for (const s of [-1, 1]) m.box(x0 + 0.012 * f, bottom + 0.07, s * 0.26 - (s > 0 ? 0.05 : 0), x1 + 0.012 * f, bottom + 0.18, s * 0.26 + (s > 0 ? 0 : 0.05), EU);
  const ly0 = top - 0.2, ly1 = top - 0.06;
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? W / 2 - 0.36 : -W / 2 + 0.08, z1 = s > 0 ? W / 2 - 0.08 : -W / 2 + 0.36;
    m.box(x0, ly0, z0, x1, ly1, z1, f > 0 ? HEAD : TAIL);
    if (f < 0) m.box(x0 - 0.004, ly0, s > 0 ? z0 - 0.1 : z1, x1 - 0.004, ly1, s > 0 ? z0 : z1 + 0.1, '#e8a33a');
  }
  if (f > 0) {
    m.box(x0 - 0.01, ly0 - 0.02, -W / 2 + 0.42, x1 - 0.01, ly1 - 0.01, W / 2 - 0.42, '#25272b');
    for (let k = 0; k < 3; k++) m.box(x0 - 0.008, ly0 + 0.01 + k * 0.04, -W / 2 + 0.44, x1 - 0.008, ly0 + 0.02 + k * 0.04, W / 2 - 0.44, CHROME);
  }
  void col;
}

function buildCar(S, col) {
  const m = new Mesher();
  const { L, W, H, r } = S;
  const [A0, A1, C1, C0] = S.cab;
  const belt = A0[1], cw = W * (S.van ? 0.98 : 0.84);
  const bottom = S.body[1][1];
  // Carrozzeria, abitacolo e una fascia scura in basso (sul SUV più alta, in plastica)
  extrude(m, S.body, W, col, 0.06);
  extrude(m, S.cab, cw, col, 0.05);
  m.box(-L / 2 + 0.25, bottom - 0.005, -W / 2 - 0.006, L / 2 - 0.25, bottom + (S.clad ? 0.22 : 0.07), W / 2 + 0.006, S.clad ? '#34363a' : shade(col, -0.35));
  // Parabrezza e lunotto: pannelli sul piano inclinato, un filo più in fuori
  const slope = (P0, P1, out, t0, t1) => {
    const dx = P1[0] - P0[0], dy = P1[1] - P0[1], l = Math.hypot(dx, dy);
    const nx = (out * dy) / l, ny = (-out * dx) / l;
    const at = (t, z) => [P0[0] + dx * t + nx * 0.012, P0[1] + dy * t + ny * 0.012, z];
    const zw = cw / 2 - 0.1;
    panel(m, [at(t0, -zw), at(t1, -zw), at(t1, zw), at(t0, zw)], [nx, ny, 0], GLASS);
  };
  slope(A0, A1, 1, 0.06, 0.92);
  if (!S.van) slope(C0, C1, -1, 0.1, 0.9);
  // Finestrini laterali tra i montanti
  const y0 = belt + 0.06, y1 = Math.max(belt + 0.2, (S.van ? A1[1] : H) - 0.08);
  const xa = (y) => A0[0] + ((A1[0] - A0[0]) * (y - A0[1])) / (A1[1] - A0[1]);
  const xc = (y) => C0[0] + ((C1[0] - C0[0]) * (y - C0[1])) / (C1[1] - C0[1]);
  const edges = [[xa(y0) - 0.1, xa(y1) - 0.1], ...S.doors.flatMap((d) => [[d + 0.05, d + 0.05], [d - 0.05, d - 0.05]]), [xc(y0) + 0.11, xc(y1) + 0.11]];
  const nWin = S.van ? 1 : edges.length / 2;
  for (let k = 0; k < nWin; k++) {
    const [f0, f1] = edges[k * 2], [r0, r1] = edges[k * 2 + 1];
    for (const s of [-1, 1]) {
      const z = s * (cw / 2 + 0.004);
      panel(m, [[r0, y0, z], [f0, y0, z], [f1, y1, z], [r1, y1, z]], [0, 0, s], GLASS);
    }
  }
  // Porte: le fessure, le maniglie e gli specchietti
  const doorX = [A0[0] + 0.02, ...S.doors, ...(S.doors.length && !S.van ? [C0[0] + 0.25] : S.van ? [] : [C0[0] + 0.15])];
  for (const s of [-1, 1]) {
    const z = s * (W / 2 + 0.004);
    for (const dx of doorX) m.box(dx - 0.008, bottom + 0.12, z - 0.004, dx + 0.008, belt - 0.02, z + 0.004, shade(col, -0.4));
    for (let k = 0; k + 1 < doorX.length; k++) m.box(doorX[k + 1] + 0.1, belt - 0.14, z - 0.01, doorX[k + 1] + 0.24, belt - 0.11, z + 0.01, CHROME);
    m.box(A0[0] - 0.14, belt + 0.02, s > 0 ? W / 2 - 0.02 : -W / 2 - 0.13, A0[0] + 0.02, belt + 0.14, s > 0 ? W / 2 + 0.13 : -W / 2 + 0.02, col);
    m.box(A0[0] - 0.13, belt + 0.03, s > 0 ? W / 2 + 0.05 : -W / 2 - 0.12, A0[0] - 0.12, belt + 0.13, s > 0 ? W / 2 + 0.12 : -W / 2 - 0.05, GLASS);
  }
  if (S.van) {
    // Il portellone scorrevole e le porte dietro
    for (const s of [-1, 1]) { const z = s * (W / 2 + 0.004); for (const dx of [-0.1, -1.4]) m.box(dx - 0.008, bottom + 0.12, z - 0.004, dx + 0.008, 2.05, z + 0.004, shade(col, -0.35)); }
    m.box(-L / 2 - 0.006, bottom + 0.15, -0.006, -L / 2 + 0.006, 2.1, 0.006, shade(col, -0.35));
  }
  ends(m, S, col, 1, L / 2, S.body[4][1], bottom);
  ends(m, S, col, -1, -L / 2, S.body[S.body.length - 1][1] + 0.05, bottom);
  // Ruote
  for (const wx of S.wheels) for (const s of [-1, 1]) wheel(m, wx, r, s * (W / 2 - 0.1 + 0.03), 0.2, s, W);
  // Barre sul tetto, alettone, insegna del taxi
  if (S.rails) for (const s of [-1, 1]) {
    m.box(A1[0] - 0.1, H, s * (cw / 2 - 0.12) - 0.02, C1[0] + 0.1, H + 0.06, s * (cw / 2 - 0.12) + 0.02, '#2a2c30');
    for (const px of [A1[0] - 0.15, C1[0] + 0.15]) m.box(px - 0.04, H - 0.01, s * (cw / 2 - 0.12) - 0.02, px + 0.04, H + 0.06, s * (cw / 2 - 0.12) + 0.02, '#2a2c30');
  }
  if (S.spoiler) {
    m.box(-L / 2 + 0.02, 0.98, -W / 2 + 0.12, -L / 2 + 0.38, 1.02, W / 2 - 0.12, shade(col, -0.25));
    for (const s of [-1, 1]) m.box(-L / 2 + 0.15, 0.86, s * 0.55 - 0.03, -L / 2 + 0.22, 0.98, s * 0.55 + 0.03, TRIM);
  }
  if (S.taxi) {
    m.box(-0.75, H, -0.3, -0.35, H + 0.16, 0.3, '#f6f2e6');
    m.box(-0.76, H + 0.05, -0.31, -0.34, H + 0.1, 0.31, '#e0a92a');
  }
  return { m, light: S.body[4][1] - 0.13 };
}

// L'Ape: cabina con una ruota sola davanti e il cassone di legno dietro
function buildApe(col) {
  const m = new Mesher();
  const W = 1.28;
  extrude(m, [[0.35, 0.32], [1.3, 0.32], [1.45, 0.5], [1.45, 1.0], [1.32, 1.56], [0.35, 1.58]], W, col, 0.06);
  panel(m, [[1.462, 1.06, -0.48], [1.462, 1.06, 0.48], [1.34, 1.48, 0.48], [1.34, 1.48, -0.48]], [1, 0.3, 0], GLASS);
  for (const s of [-1, 1]) {
    const z = s * (W / 2 + 0.004);
    panel(m, [[0.55, 1.0, z], [1.25, 1.0, z], [1.2, 1.45, z], [0.55, 1.45, z]], [0, 0, s], GLASS);
    m.box(0.45, 0.4, z - 0.004, 0.47, 1.45, z + 0.004, shade(col, -0.35));
  }
  m.box(1.46, 0.72, -0.12, 1.48, 0.86, 0.12, HEAD);
  m.box(1.38, 0.34, -W / 2 + 0.05, 1.5, 0.42, W / 2 - 0.05, TRIM);
  // Cassone
  const wood = '#a87a4c', wd = shade(wood, -0.2);
  m.box(-1.45, 0.5, -W / 2, 0.32, 0.58, W / 2, wd);
  for (const s of [-1, 1]) m.box(-1.45, 0.58, s > 0 ? W / 2 - 0.05 : -W / 2, 0.32, 0.92, s > 0 ? W / 2 : -W / 2 + 0.05, wood);
  m.box(-1.45, 0.58, -W / 2, -1.4, 0.92, W / 2, wood);
  m.box(0.27, 0.58, -W / 2, 0.32, 0.95, W / 2, wood);
  for (const s of [-1, 1]) for (const yy of [0.7, 0.82]) m.box(-1.45, yy, s * (W / 2 + 0.002) - 0.006, 0.32, yy + 0.015, s * (W / 2 + 0.002) + 0.006, wd);
  // Cassette di frutta nel cassone
  m.box(-1.2, 0.58, -0.4, -0.75, 0.82, 0.05, '#c9a36b'); m.prim('ico0', -0.97, 0.86, -0.17, 0.2, 0.08, 0.2, '#e8862a');
  m.box(-0.6, 0.58, -0.1, -0.15, 0.8, 0.4, '#c9a36b'); m.prim('ico0', -0.37, 0.84, 0.15, 0.2, 0.08, 0.2, '#d9442f');
  m.box(-1.47, 0.62, -0.5, -1.45, 0.72, -0.35, TAIL); m.box(-1.47, 0.62, 0.35, -1.45, 0.72, 0.5, TAIL);
  wheel(m, 1.05, 0.24, 0, 0.16, 0, W);
  for (const s of [-1, 1]) wheel(m, -0.85, 0.24, s * (W / 2 - 0.06), 0.16, s, W);
  return { m, light: 0.79, L: 2.9, W };
}

// L'autobus di città: lungo, finestrini a nastro, due porte sul lato destro
function buildBus(col) {
  const m = new Mesher();
  const L = 8.6, W = 2.2, H = 2.95, x0 = -L / 2, x1 = L / 2;
  extrude(m, [[x0, 0.42], [x0 + 0.12, 0.3], [x1 - 0.12, 0.3], [x1, 0.42], [x1, 2.75], [x1 - 0.18, H], [x0 + 0.15, H], [x0, 2.8]], W, col, 0.08);
  // Fascia bianca in alto e tetto chiaro con il climatizzatore
  m.box(x0 + 0.05, 2.45, -W / 2 - 0.004, x1 - 0.05, 2.62, W / 2 + 0.004, '#f2efe6');
  m.box(-1.6, H, -0.6, 0.6, H + 0.2, 0.6, '#dcdad3');
  for (const s of [-1, 1]) {
    const z = s * (W / 2 + 0.006);
    for (let k = 0; k < 7; k++) {
      const a = x1 - 1.55 - k * 1.0;
      if (s > 0 && k === 4) continue;          // al posto della porta di mezzo
      panel(m, [[a - 0.88, 1.28, z], [a, 1.28, z], [a, 2.36, z], [a - 0.88, 2.36, z]], [0, 0, s], GLASS);
    }
    if (s < 0) panel(m, [[x1 - 1.3, 1.28, z], [x1 - 0.25, 1.28, z], [x1 - 0.25, 2.36, z], [x1 - 1.3, 2.36, z]], [0, 0, s], GLASS);
  }
  // Porte a vetri (lato destro)
  for (const a of [x1 - 0.3, x1 - 5.55]) {
    const z = W / 2 + 0.008;
    panel(m, [[a - 0.92, 0.42, z], [a + 0.02, 0.42, z], [a + 0.02, 2.36, z], [a - 0.92, 2.36, z]], [0, 0, 1], '#3d5266');
    m.box(a - 0.46, 0.42, z - 0.004, a - 0.44, 2.36, z + 0.006, TRIM);
  }
  // Davanti: parabrezza grande, insegna della linea, fari; dietro: luci e lunotto
  panel(m, [[x1 + 0.012, 1.15, -W / 2 + 0.12], [x1 + 0.012, 1.15, W / 2 - 0.12], [x1 + 0.012, 2.4, W / 2 - 0.12], [x1 + 0.012, 2.4, -W / 2 + 0.12]], [1, 0, 0], GLASS);
  m.box(x1 - 0.02, 2.5, -0.75, x1 + 0.02, 2.7, 0.75, '#1f1f1f');
  m.box(x1 - 0.015, 2.54, -0.65, x1 + 0.025, 2.66, 0.4, '#f0a020');
  panel(m, [[x0 - 0.012, 1.6, -W / 2 + 0.25], [x0 - 0.012, 1.6, W / 2 - 0.25], [x0 - 0.012, 2.35, W / 2 - 0.25], [x0 - 0.012, 2.35, -W / 2 + 0.25]], [-1, 0, 0], GLASS);
  for (const s of [-1, 1]) {
    m.box(x1 - 0.01, 0.62, s > 0 ? W / 2 - 0.4 : -W / 2 + 0.12, x1 + 0.02, 0.78, s > 0 ? W / 2 - 0.12 : -W / 2 + 0.4, HEAD);
    m.box(x0 - 0.02, 0.7, s > 0 ? W / 2 - 0.3 : -W / 2 + 0.1, x0 + 0.01, 1.05, s > 0 ? W / 2 - 0.1 : -W / 2 + 0.3, TAIL);
  }
  m.box(x1 - 0.06, 0.32, -W / 2 + 0.04, x1 + 0.06, 0.5, W / 2 - 0.04, TRIM);
  m.box(x0 - 0.06, 0.32, -W / 2 + 0.04, x0 + 0.06, 0.5, W / 2 - 0.04, TRIM);
  for (const wx of [2.3, -2.4]) for (const s of [-1, 1]) wheel(m, wx, 0.46, s * (W / 2 - 0.12), 0.26, s, W);
  return { m, light: 0.7, L, W };
}

// Restituisce la geometria in caselle, con lunghezza, larghezza e altezza dei fari
export function vehicleGeometry(kind, color) {
  let out;
  if (kind === 'ape') out = buildApe(color);
  else if (kind === 'autobus') out = buildBus(color);
  else { const S = SAGOME[kind] || SAGOME.utilitaria; out = { ...buildCar(S, kind === 'taxi' ? '#f6f2e6' : color), L: S.L, W: S.W }; }
  const p = out.m.p;
  for (let i = 0; i < p.length; i++) p[i] *= MU;
  return { geo: out.m.build(), L: out.L * MU, W: out.W * MU, light: out.light * MU };
}
