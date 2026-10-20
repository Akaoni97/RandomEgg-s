// Mappa della città e interni delle case. La città si disegna con town.js, vista dall'alto di tre
// quarti; le stanze restano isometriche come in Habbo. Tutto si disegna in un buffer a bassa
// risoluzione e si ingrandisce a pixel interi, così resta nitido e leggero sui telefoni.
// Uno strato fisso si ridisegna solo quando cambia qualcosa; sopra si muovono omini, acqua, auto.
import {
  W, H, PLAN, FOUNTAIN_AT, key, parseKey, districtAt, inPiazza, formatNews, CITY, PAPER, levelAt, walkPath, LOOK, cleanLook,
  ROOM, ROOM_DOOR, FURNI_COLORS, furniById, footprint, roomOf, roomPath, shopAt, seatAt, PIAZZA_DECOR, WALK_SPEED, rideById,
} from './core.js';
import { shade, ih, clamp01, poly, add, lerp, blob, glow } from './art.js';
import {
  TILE, townCenter, TOWN_WORLD, townElev, surfaceOf, drawTown, drawTownLights, drawTownAmbient, townTileAt, drawHouse3, townVisible, warmLight,
} from './town.js';
import { Town3D, has3D, renderHouseStill, renderTownStill } from './town3d.js';
import { avatarSprite, avatarPortrait, AvatarStage } from './avatar3d.js';


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
// Centro di una casella (anche frazionaria) di una stanza, sullo schermo.
function roomCenter(x, y) { return [isoX(x + 0.5, y + 0.5), isoY(x + 0.5, y + 0.5)]; }

// Un muro visto in isometria: face(u, h) è il punto a frazione u lungo la base, all'altezza h.
function wallFace(a, b) { return (u, hh) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - hh]; }
function quadOn(f, u0, u1, h0, h1) { return [f(u0, h0), f(u1, h0), f(u1, h1), f(u0, h1)]; }
// Il colore della notte su tutto il contesto (in pixel del contesto, senza trasformazioni).
function nightTint(g, w, h) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Un solo passaggio: blu notte scurito
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#424d76'; g.fillRect(0, 0, w, h);
  g.restore();
}

/* Abitanti a passeggio (omini squadrati alla Habbo) ------------------------ */

export function avatarLook(name, chosen) {
  const l = cleanLook(chosen, name);
  return {
    gender: l.gender, skin: LOOK.skin[l.skin], eyes: LOOK.eyes[l.eyes], hair: LOOK.hair[l.hair], shirt: LOOK.shirt[l.shirt], pants: LOOK.pants[l.pants],
    shoes: LOOK.shoes[l.shoes], style: l.style, beard: l.beard, lips: l.lips, extra: l.extra, top: l.top, bottom: l.bottom,
  };
}
function rectO(g, x, y, w, h, fill, line) {
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  if (line) { g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
}
// Mezzi della Ciclofficina, disegnati attorno ai piedi dell'omino (0, 0) senza specchiatura.
// part: 'rear' (dietro all'omino), 'front' (davanti) o 'all'; back: l'omino è girato di spalle.
const RIDE_COLOR = { skate: '#c0392b', bici: '#2f6b9f', monopattino: '#2b2b2b' };
// flat: in città (vista di tre quarti) il mezzo sta in orizzontale; nelle stanze segue il rombo.
export function drawRide(g, kind, part = 'all', back = false, flat = false) {
  // Lungo la marcia si sale o scende di mezzo pixel per pixel; di traverso si va nell'altro verso.
  const sl = flat ? 0 : back ? -0.5 : 0.5;
  const A = flat ? (t, w = 0, z = 0) => [t, w * 0.4 - z] : (t, w = 0, z = 0) => [t + (back ? w : -w), t * sl + w * 0.5 - z];
  // Il davanti (+t) è verso chi guarda se l'omino è di fronte, lontano se è di spalle
  const isFront = (t) => (t > 0) !== back;
  const want = (t) => part === 'all' || (part === 'front') === isFront(t);
  const col = RIDE_COLOR[kind];
  const line = (pts, color, w = 1.5) => { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts.slice(1)) g.lineTo(...q); g.stroke(); };
  if (kind === 'skate' || kind === 'monopattino') {
    const [t0, t1] = kind === 'skate' ? [-11, 11] : [-9, 8];
    if (part !== 'front') {
      // La tavola sta sotto i piedi: si disegna insieme alle parti di dietro
      poly(g, [A(t0, -3, 2), A(t1, -3, 2), A(t1, 3, 2), A(t0, 3, 2)]); g.fillStyle = kind === 'skate' ? '#2b2b2b' : '#3b3f45'; g.fill();
      poly(g, [A(t0, 3, 2), A(t1, 3, 2), A(t1, 3, 0.5), A(t0, 3, 0.5)]); g.fillStyle = col; g.fill();
      for (const t of [t0 + 2.5, t1 - 2.5]) { g.fillStyle = '#e6dcc6'; const p = A(t, 3, 0); g.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 2, 2); }
    }
    if (kind === 'monopattino' && want(t1)) {
      line([A(t1, 0, 2), A(t1 + 1, 0, 28)], '#3b3f45', 2);
      line([A(t1 + 1, -5, 28), A(t1 + 1, 5, 28)], '#2b2b2b', 2);
      g.fillStyle = '#4fb3c8'; const p = A(t1 + 1, 0, 22); g.fillRect(Math.round(p[0]) - 1, Math.round(p[1]), 2, 3);
      g.fillStyle = '#1f1f1f'; const w = A(t1, 0, 2); g.beginPath(); g.arc(w[0], w[1], 2.5, 0, 7); g.fill();
    }
    return;
  }
  // Bicicletta: due ruote, telaio, sella e manubrio
  const wheel = (t) => {
    const c = A(t, 0, 7);
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(c[0], c[1], 7, 6.4, Math.atan(sl), 0, 7); g.stroke();
    g.strokeStyle = 'rgba(180,180,180,0.8)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(c[0] - 4, c[1] - 4 * sl); g.lineTo(c[0] + 4, c[1] + 4 * sl); g.stroke();
  };
  if (want(-11)) {
    wheel(-11);
    line([A(-11, 0, 7), A(0, 0, 6), A(-3, 0, 17), A(-11, 0, 7)], col);
    g.fillStyle = '#2b2b2b'; const p = A(-3, 0, 18); g.fillRect(Math.round(p[0]) - 3, Math.round(p[1]) - 1, 6, 2);
  }
  if (want(11)) {
    wheel(11);
    line([A(0, 0, 6), A(8, 0, 17), A(-3, 0, 17)], col);
    line([A(8, 0, 17), A(11, 0, 7)], '#9aa0a6');
    line([A(8, 0, 17), A(8, 0, 21)], '#3b3f45');
    line([A(8, -4, 21), A(8, 4, 21)], '#2b2b2b', 2);
  }
}

// Direzioni isometriche: SE e SW verso chi guarda (si vede il viso), NE e NW di spalle.
// (x, y) sono i piedi; step 0 fermo, 1 e 2 le due pose della camminata.
// pose: 'sit' seduto, 'wave' saluta con la mano, 'dance' balla; t = millisecondi dall'inizio del gesto.
// ride: il mezzo su cui sta (skate, bici, monopattino).
export function drawAvatar(g, x, y, dir, step, look, { night = false, pose = null, t = 0, ride = null, flatRide = false } = {}) {
  const back = dir === 'NE' || dir === 'NW';
  const mirror = dir === 'SW' || dir === 'NW';
  const ol = 'rgba(30,22,16,0.85)';
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.fillStyle = 'rgba(20,30,15,0.3)'; g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, 7); g.fill();
  if (mirror) g.scale(-1, 1);
  if (ride) {
    // In sella o in piedi sulla tavola: prima il mezzo dietro, poi l'omino un po' più su, poi il davanti.
    drawRide(g, ride, 'rear', back, flatRide);
    if (ride === 'bici') pose = 'sit';
    step = 0;
    g.translate(0, ride === 'bici' ? -4 : -3);
  }
  const beat = Math.floor(t / 260) % 2;
  const a = pose === 'dance' ? beat : step === 1 ? 1 : 0, b = pose === 'dance' ? 1 - beat : step === 2 ? 1 : 0;
  // Gambe e scarpe (con pantaloncini e gonna si vede la pelle sotto il ginocchio)
  const top = look.top || 'maglietta', bottom = look.bottom || 'pantaloni';
  const legCol = bottom === 'pantaloni' ? look.pants : look.skin;
  if (pose === 'sit') {
    // Seduti: cosce in avanti, stinchi giù verso il pavimento (davanti, se si guarda verso di noi)
    const thigh = bottom === 'pantaloni' || bottom === 'pantaloncini' ? look.pants : look.skin;
    for (const [dx, c] of [[0, shade(thigh, -0.1)], [-3, thigh]]) {
      rectO(g, -5 + dx, -15, 10, 4, c, ol);
      rectO(g, 2 + dx, -12, 4, 9, dx ? legCol : shade(legCol, -0.1), ol);
      rectO(g, 2 + dx, -4, 6, 3, '#2b2b2b');
    }
  } else {
    rectO(g, -5, -14 + a, 4, 12 - a, legCol, ol);
    rectO(g, 1, -14 + b, 4, 12 - b, shade(legCol, -0.1), ol);
    if (bottom === 'pantaloncini') { rectO(g, -5, -14 + a, 4, 6, look.pants, ol); rectO(g, 1, -14 + b, 4, 6, shade(look.pants, -0.1), ol); }
    rectO(g, -6 + a, -3, 6, 3, '#2b2b2b');
    rectO(g, 1 - b, -3 - b, 6, 3, '#1f1f1f');
  }
  if (bottom === 'gonna' && pose !== 'sit') {
    g.fillStyle = look.pants; poly(g, [[-7, -15], [7, -15], [9, -6], [-9, -6]]); g.fill(); g.strokeStyle = ol; g.lineWidth = 1; g.stroke();
    g.fillStyle = shade(look.pants, -0.15); g.fillRect(1, -14, 6, 7);
  }
  // Braccio dietro, busto, braccio davanti
  const armCol = top === 'canotta' ? look.skin : null;
  const backArmUp = pose === 'dance' && beat === 1;
  if (backArmUp) rectO(g, 6, -38, 3, 11, armCol ? shade(armCol, -0.12) : shade(look.shirt, -0.22), ol);
  else rectO(g, 6, -27 + b, 3, 11, armCol ? shade(armCol, -0.12) : shade(look.shirt, -0.22), ol);
  rectO(g, -7, -28, 14, 15, look.shirt, ol);
  g.fillStyle = shade(look.shirt, back ? 0.08 : -0.14); g.fillRect(back ? -6 : 1, -27, 5, 13);
  if (!back && top !== 'giacca') { g.fillStyle = shade(look.shirt, 0.18); g.fillRect(-3, -27, 6, 2); }
  const light = rgb(look.shirt).reduce((x, y) => x + y) > 600;
  if (top === 'righe') {
    g.fillStyle = light ? '#2f4f7f' : '#f4f1ea';
    for (const yy of [-25, -21, -17]) g.fillRect(-6, yy, 12, 2);
  } else if (top === 'camicia' && !back) {
    g.fillStyle = light ? '#d9d3c4' : '#f4f1ea'; g.fillRect(-4, -28, 3, 3); g.fillRect(1, -28, 3, 3);
    g.fillStyle = shade(look.shirt, -0.35); for (const yy of [-24, -20, -16]) g.fillRect(0, yy, 1, 1);
  } else if (top === 'felpa') {
    g.fillStyle = shade(look.shirt, -0.2);
    if (back) g.fillRect(-6, -29, 12, 6); else { g.fillRect(-5, -19, 10, 4); g.fillStyle = '#f4f1ea'; g.fillRect(-2, -27, 1, 5); g.fillRect(2, -27, 1, 5); }
  } else if (top === 'giacca') {
    if (back) { g.fillStyle = shade(look.shirt, -0.2); g.fillRect(0, -27, 1, 13); }
    else {
      g.fillStyle = '#f4f1ea'; poly(g, [[-3, -28], [3, -28], [0, -19]]); g.fill();
      g.fillStyle = '#c0392b'; g.fillRect(-0.5, -26, 1, 5);
      g.fillStyle = shade(look.shirt, 0.15); poly(g, [[-4, -28], [-1, -21], [-3, -21]]); g.fill();
      g.fillStyle = '#e2bf4f'; g.fillRect(-1, -17, 1, 1);
    }
  } else if (top === 'canotta') {
    g.fillStyle = look.skin; g.fillRect(-7, -28, 3, 4); g.fillRect(4, -28, 3, 4);
  }
  if (pose === 'wave' || (pose === 'dance' && beat === 0)) {
    // Braccio alzato: la mano oscilla avanti e indietro
    const sway = pose === 'wave' ? (Math.floor(t / 180) % 2 ? -2 : 0) : 0;
    rectO(g, -10 + sway, -38, 3, 11, armCol || shade(look.shirt, -0.05), ol);
    rectO(g, -10 + sway, -41, 3, 3, look.skin);
  } else {
    rectO(g, -9, -27 + a, 3, 11, armCol || shade(look.shirt, -0.05), ol);
    rectO(g, -9, -17 + a, 3, 3, look.skin);
  }
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
  } else if (look.extra === 'paglia') {
    g.fillStyle = '#c9a94a'; g.beginPath(); g.ellipse(0, -44, 13, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#e8cf7a'; g.beginPath(); g.ellipse(0, -45, 12, 3.5, 0, 0, 7); g.fill();
    g.beginPath(); g.roundRect(-6.5, -52, 13, 8, 3); g.fill();
    g.fillStyle = '#c0392b'; g.fillRect(-6.5, -47, 13, 2);
  } else if (look.extra === 'coppola') {
    g.fillStyle = '#6b6156'; g.beginPath(); g.roundRect(-8, -48, 16, 5, 2.5); g.fill();
    g.fillStyle = '#7d7266'; g.fillRect(-6, -47, 3, 1); g.fillRect(1, -47, 3, 1);
    if (!back) { g.fillStyle = '#574e44'; g.fillRect(3, -44, 8, 2); }
  } else if (look.extra === 'basco') {
    g.fillStyle = '#2d2d2d'; g.beginPath(); g.ellipse(-1, -46, 9, 3.6, -0.15, 0, 7); g.fill();
    g.fillRect(-1, -51, 2, 2);
  } else if (look.extra === 'cuffie') {
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 2; g.beginPath(); g.arc(0, -40, 8.5, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    rectO(g, back ? 5 : -10, -41, 4, 6, '#e85d4a', ol);
  } else if (look.extra === 'sciarpa') {
    g.fillStyle = '#c0392b'; g.fillRect(-7, -31, 14, 4);
    g.fillStyle = '#e85d4a'; g.fillRect(-7, -31, 14, 1);
    if (!back) { g.fillStyle = '#c0392b'; g.fillRect(-5, -28, 3, 9); g.fillStyle = '#f4f1ea'; g.fillRect(-5, -21, 3, 1); }
  } else if (look.extra === 'corona') {
    g.fillStyle = '#e2bf4f'; g.fillRect(-6, -49, 12, 4);
    for (const dx of [-6, -1, 4]) { poly(g, [[dx, -49], [dx + 1, -54], [dx + 2, -49]]); g.fill(); }
    g.fillStyle = '#c0392b'; g.fillRect(-1, -48, 2, 2);
  }
  if (ride) { g.translate(0, ride === 'bici' ? 4 : 3); drawRide(g, ride, 'front', back, flatRide); }
  g.restore();
}
// Figurina di un mezzo per il catalogo della Ciclofficina.
export function drawRideIcon(canvas, kind) {
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 40;
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height * 0.72);
  drawRide(g, kind, 'all', false);
}
// Anteprima per l'editor del personaggio: cammina sul posto e si gira nelle quattro direzioni.
// Con il 3D l'anteprima è un palco vivo (si gira col dito); la si aggiorna a ogni chiamata.
const stages = new WeakMap();
export function drawAvatarPreview(canvas, look, t, ride = null) {
  if (has3D()) {
    try {
      const st = stages.get(canvas);
      if (st) st.set(look, ride); else stages.set(canvas, new AvatarStage(canvas, look, { ride }));
      return;
    } catch { /* si ripiega sul disegno piatto */ }
  }
  const g = canvas.getContext('2d');
  const dirs = ['SE', 'SW', 'NW', 'NE'];
  const k = t / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingEnabled = false;
  const s = Math.max(1, Math.floor(canvas.width / 70));
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height * 0.86);
  diamond(g, 0, -16); g.fillStyle = '#9fcf6c'; g.fill(); g.strokeStyle = '#6f9f4a'; g.lineWidth = 1; g.stroke();
  drawAvatar(g, 0, 0, dirs[Math.floor(k / 1.4) % 4], (Math.floor(k * 4.5) % 2) + 1, look, { ride });
}

// Primo piano per la carta d'identità (testa e spalle).
export function drawAvatarBust(canvas, look) {
  if (has3D()) { try { return avatarPortrait(canvas, look, { full: false }); } catch { /* disegno piatto */ } }
  return drawAvatarIcon(canvas, look);
}
// Figurina ferma per i cataloghi (vestiti dei negozi).
export function drawAvatarIcon(canvas, look) {
  if (has3D()) { try { return avatarPortrait(canvas, look, { full: true }); } catch { /* disegno piatto */ } }
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.height / 62;
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height - 5 * s);
  drawAvatar(g, 0, 0, 'SE', 0, look);
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
const WORLD = TOWN_WORLD;
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

/* Dentro casa: la stanza isometrica e i mobili ----------------------------- */

const WALL_H = 104;
const gp = (x, y) => [isoX(x, y), isoY(x, y)];
// Parallelepipedo tra gli angoli di griglia (x0, y0)–(x1, y1), dall'altezza z0 a z1.
function box3(g, x0, y0, x1, y1, z0, z1, color, { top, side } = {}) {
  const A = gp(x0, y1), B = gp(x1, y1), C = gp(x1, y0), D = gp(x0, y0);
  const up = (p, z) => [p[0], p[1] - z];
  const ol = shade(color, -0.4);
  g.lineWidth = 1; g.strokeStyle = ol;
  poly(g, [up(A, z0), up(B, z0), up(B, z1), up(A, z1)]); g.fillStyle = color; g.fill(); g.stroke();
  poly(g, [up(B, z0), up(C, z0), up(C, z1), up(B, z1)]); g.fillStyle = side || shade(color, -0.15); g.fill(); g.stroke();
  poly(g, [up(A, z1), up(B, z1), up(C, z1), up(D, z1)]); g.fillStyle = top || shade(color, 0.12); g.fill(); g.stroke();
}
// Faccia frontale di un mobile (verso chi guarda): lungo +y se r=0, lungo +x se r=1.
function frontFace(x0, y0, x1, y1, r) {
  return r ? wallFace(gp(x1, y1), gp(x1, y0)) : wallFace(gp(x0, y1), gp(x1, y1));
}
const WOOD = '#9a6a43', WOOD_D = '#6b4a2f', WHITE = '#f2efe8';
function legs(g, x0, y0, x1, y1, h, color = WOOD_D) {
  const k = 0.08;
  for (const [a, b] of [[x0, y0], [x1 - k, y0], [x0, y1 - k], [x1 - k, y1 - k]]) box3(g, a, b, a + k, b + k, 0, h, color);
}

// Disegna un mobile in coordinate di griglia della stanza.
export function drawFurni(g, it, { night = false } = {}) {
  const f = furniById(it.t);
  if (!f) return;
  const { x0, y0, x1: xe, y1: ye } = footprint(it);
  const x1 = xe + 1, y1 = ye + 1, r = it.r, col = FURNI_COLORS[it.c] || FURNI_COLORS[0];
  const ins = (a, b, k) => [a + k, b - k];
  switch (it.t) {
    case 'sedia': {
      const [a, b] = ins(x0, x1, 0.22), [c, d] = ins(y0, y1, 0.22);
      legs(g, a, c, b, d, 12);
      box3(g, a, c, b, d, 12, 15, col);
      if (r) box3(g, a, c, a + 0.1, d, 15, 32, col); else box3(g, a, c, b, c + 0.1, 15, 32, col);
      break;
    }
    case 'poltrona': {
      const [a, b] = ins(x0, x1, 0.14), [c, d] = ins(y0, y1, 0.14);
      box3(g, a, c, b, d, 0, 12, col);
      if (r) { box3(g, a, c, a + 0.16, d, 12, 30, shade(col, -0.05)); box3(g, a, c, b, c + 0.14, 12, 20, col); box3(g, a, d - 0.14, b, d, 12, 20, col); }
      else { box3(g, a, c, b, c + 0.16, 12, 30, shade(col, -0.05)); box3(g, a, c, a + 0.14, d, 12, 20, col); box3(g, b - 0.14, c, b, d, 12, 20, col); }
      break;
    }
    case 'divano': {
      const [a, b] = ins(x0, x1, 0.06), [c, d] = ins(y0, y1, 0.12);
      box3(g, a, c, b, d, 0, 11, col);
      if (r) { box3(g, a, c, a + 0.18, d, 11, 28, shade(col, -0.05)); box3(g, a, c, b, c + 0.14, 11, 19, col); box3(g, a, d - 0.14, b, d, 11, 19, col); }
      else { box3(g, a, c, b, c + 0.18, 11, 28, shade(col, -0.05)); box3(g, a, c, a + 0.14, d, 11, 19, col); box3(g, b - 0.14, c, b, d, 11, 19, col); }
      break;
    }
    case 'tavolino': {
      const [a, b] = ins(x0, x1, 0.18), [c, d] = ins(y0, y1, 0.18);
      legs(g, a, c, b, d, 13);
      box3(g, a - 0.04, c - 0.04, b + 0.04, d + 0.04, 13, 16, WOOD);
      break;
    }
    case 'tavolo': {
      const [a, b] = ins(x0, x1, 0.1), [c, d] = ins(y0, y1, 0.12);
      legs(g, a, c, b, d, 20);
      box3(g, a, c, b, d, 20, 23, WOOD);
      const m = [(a + b) / 2, (c + d) / 2];
      box3(g, m[0] - 0.08, m[1] - 0.08, m[0] + 0.08, m[1] + 0.08, 23, 31, '#3f6aa1');
      blob(g, ...gp(m[0], m[1]).map((v, i) => (i ? v - 35 : v)), 4, '#e85d75');
      break;
    }
    case 'letto': {
      const [a, b] = ins(x0, x1, 0.06), [c, d] = ins(y0, y1, 0.06);
      box3(g, a, c, b, d, 0, 8, WOOD);
      box3(g, a + 0.04, c + 0.04, b - 0.04, d - 0.04, 8, 13, WHITE);
      if (r) { box3(g, a + 0.6, c + 0.04, b - 0.04, d - 0.04, 13, 14, col); box3(g, a + 0.12, c + 0.15, a + 0.42, d - 0.15, 13, 17, '#ffffff'); box3(g, a, c, a + 0.12, d, 0, 26, WOOD_D); }
      else { box3(g, a + 0.04, c + 0.6, b - 0.04, d - 0.04, 13, 14, col); box3(g, a + 0.15, c + 0.12, b - 0.15, c + 0.42, 13, 17, '#ffffff'); box3(g, a, c, b, c + 0.12, 0, 26, WOOD_D); }
      break;
    }
    case 'tappeto': {
      const k = 0.06;
      poly(g, [gp(x0 + k, y0 + k), gp(x1 - k, y0 + k), gp(x1 - k, y1 - k), gp(x0 + k, y1 - k)]); g.fillStyle = col; g.fill();
      g.strokeStyle = shade(col, 0.3); g.lineWidth = 2; poly(g, [gp(x0 + 0.2, y0 + 0.2), gp(x1 - 0.2, y0 + 0.2), gp(x1 - 0.2, y1 - 0.2), gp(x0 + 0.2, y1 - 0.2)]); g.stroke();
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      poly(g, [gp(cx, cy - 0.35), gp(cx + 0.35, cy), gp(cx, cy + 0.35), gp(cx - 0.35, cy)]); g.fillStyle = shade(col, 0.25); g.fill();
      break;
    }
    case 'lampada': {
      const c = gp(x0 + 0.5, y0 + 0.5);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(c[0], c[1], 9, 4.5, 0, 0, 7); g.fill();
      box3(g, x0 + 0.38, y0 + 0.38, x0 + 0.62, y0 + 0.62, 0, 2, '#3b3f45');
      g.fillStyle = '#3b3f45'; g.fillRect(c[0] - 1, c[1] - 40, 2, 39);
      poly(g, [[c[0] - 7, c[1] - 38], [c[0] + 7, c[1] - 38], [c[0] + 4, c[1] - 50], [c[0] - 4, c[1] - 50]]); g.fillStyle = night ? '#ffe39a' : '#f3e2b8'; g.fill(); g.strokeStyle = '#a78b52'; g.lineWidth = 1; g.stroke();
      if (night) { g.save(); g.globalCompositeOperation = 'lighter'; glow(g, c[0], c[1] - 40, 40, 0.35); g.restore(); }
      break;
    }
    case 'pianta': {
      box3(g, x0 + 0.3, y0 + 0.3, x0 + 0.7, y0 + 0.7, 0, 13, '#b8643d');
      const c = gp(x0 + 0.5, y0 + 0.5);
      for (const [dx, dy, rr, cc] of [[-6, -20, 7, '#3f7d34'], [6, -22, 7, '#3f7d34'], [0, -28, 8, '#4f9a3c'], [-3, -33, 5, '#62ad4c'], [4, -36, 4, '#7fc25e']]) blob(g, c[0] + dx, c[1] + dy, rr, cc, '#285422');
      break;
    }
    case 'libreria': {
      const [a, b, c, d] = r ? [x0 + 0.08, x0 + 0.45, y0 + 0.08, y1 - 0.08] : [x0 + 0.08, x1 - 0.08, y0 + 0.08, y0 + 0.45];
      box3(g, a, c, b, d, 0, 52, WOOD);
      const f = frontFace(a, c, b, d, r);
      const books = ['#c0392b', '#2f6b9f', '#e0a92a', '#2f7d4f', '#7a4a6b', '#e88a3a'];
      for (let s = 0; s < 4; s++) {
        poly(g, quadOn(f, 0.06, 0.94, 4 + s * 12, 5 + s * 12)); g.fillStyle = WOOD_D; g.fill();
        for (let k = 0; k < 6; k++) { poly(g, quadOn(f, 0.1 + k * 0.13, 0.2 + k * 0.13, 5 + s * 12, 13 + s * 12 - (k % 3))); g.fillStyle = books[(k + s) % 6]; g.fill(); }
      }
      break;
    }
    case 'tv': {
      const [a, b, c, d] = r ? [x0 + 0.3, x0 + 0.7, y0 + 0.12, y1 - 0.12] : [x0 + 0.12, x1 - 0.12, y0 + 0.3, y0 + 0.7];
      box3(g, a, c, b, d, 0, 14, WOOD_D);
      const [e, f2, h, k] = r ? [x0 + 0.44, x0 + 0.54, y0 + 0.16, y1 - 0.16] : [x0 + 0.16, x1 - 0.16, y0 + 0.44, y0 + 0.54];
      box3(g, e, h, f2, k, 14, 36, '#1f2328');
      const ff = frontFace(e, h, f2, k, r);
      poly(g, quadOn(ff, 0.08, 0.92, 2, 20)); g.fillStyle = night ? '#6fb3ff' : '#2d4a6b'; g.fill();
      break;
    }
    case 'frigo': {
      box3(g, x0 + 0.15, y0 + 0.18, x1 - 0.15, y1 - 0.18, 0, 54, '#e9edf0', { side: '#c9cfd4' });
      const ff = frontFace(x0 + 0.15, y0 + 0.18, x1 - 0.15, y1 - 0.18, r);
      poly(g, quadOn(ff, 0, 1, 36, 37)); g.fillStyle = '#9aa3aa'; g.fill();
      poly(g, quadOn(ff, 0.8, 0.86, 40, 50)); g.fillStyle = '#9aa3aa'; g.fill();
      poly(g, quadOn(ff, 0.8, 0.86, 18, 32)); g.fill();
      break;
    }
    case 'cucina': {
      const [a, b, c, d] = r ? [x0 + 0.1, x1 - 0.1, y0 + 0.05, y1 - 0.05] : [x0 + 0.05, x1 - 0.05, y0 + 0.1, y1 - 0.1];
      box3(g, a, c, b, d, 0, 24, WHITE, { top: '#8c9399' });
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.08, 0.45, 4, 18)); g.fillStyle = '#2b2f33'; g.fill();
      poly(g, quadOn(ff, 0.55, 0.95, 4, 18)); g.fillStyle = '#e1ddd3'; g.fill(); g.strokeStyle = '#b5b0a5'; g.stroke();
      for (const [u, v] of [[0.25, 0.3], [0.25, 0.7], [0.75, 0.3], [0.75, 0.7]]) {
        const p = gp(a + (b - a) * (r ? v : u * 0.5), c + (d - c) * (r ? u * 0.5 : v));
        g.strokeStyle = '#2b2f33'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p[0], p[1] - 24, 5, 2.5, 0, 0, 7); g.stroke();
      }
      break;
    }
    case 'armadio': {
      const [a, b, c, d] = r ? [x0 + 0.1, x0 + 0.62, y0 + 0.08, y1 - 0.08] : [x0 + 0.08, x1 - 0.08, y0 + 0.1, y0 + 0.62];
      box3(g, a, c, b, d, 0, 58, WOOD);
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.495, 0.505, 4, 54)); g.fillStyle = WOOD_D; g.fill();
      for (const u of [0.42, 0.55]) { poly(g, quadOn(ff, u, u + 0.03, 26, 34)); g.fillStyle = '#e2bf4f'; g.fill(); }
      break;
    }
    case 'scrivania': {
      const [a, b] = ins(x0, x1, 0.08), [c, d] = ins(y0, y1, 0.14);
      legs(g, a, c, b, d, 20);
      box3(g, a, c, b, d, 20, 23, '#f2efe8');
      const m = r ? [a + 0.25, (c + d) / 2] : [(a + b) / 2, c + 0.25];
      box3(g, m[0] - 0.05, m[1] - 0.05, m[0] + 0.05, m[1] + 0.05, 23, 27, '#3b3f45');
      if (r) box3(g, m[0] - 0.04, m[1] - 0.35, m[0] + 0.04, m[1] + 0.35, 27, 40, '#1f2328'); else box3(g, m[0] - 0.35, m[1] - 0.04, m[0] + 0.35, m[1] + 0.04, 27, 40, '#1f2328');
      break;
    }
    case 'camino': {
      const [a, b, c, d] = r ? [x0 + 0.05, x0 + 0.55, y0 + 0.05, y1 - 0.05] : [x0 + 0.05, x1 - 0.05, y0 + 0.05, y0 + 0.55];
      box3(g, a, c, b, d, 0, 38, '#c9b48f');
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.25, 0.75, 0, 20)); g.fillStyle = '#2b2118'; g.fill();
      poly(g, quadOn(ff, 0.32, 0.68, 0, 7)); g.fillStyle = '#e88a3a'; g.fill();
      poly(g, quadOn(ff, 0.4, 0.6, 3, 12)); g.fillStyle = '#f6d84a'; g.fill();
      poly(g, quadOn(ff, -0.02, 1.02, 34, 38)); g.fillStyle = '#e6d6b3'; g.fill();
      break;
    }
    case 'acquario': {
      box3(g, x0 + 0.12, y0 + 0.2, x1 - 0.12, y1 - 0.2, 0, 14, WOOD_D);
      g.globalAlpha = 0.75; box3(g, x0 + 0.12, y0 + 0.2, x1 - 0.12, y1 - 0.2, 14, 36, '#7cc6df', { top: '#a8e0f0' }); g.globalAlpha = 1;
      const c = gp(x0 + 0.5, y0 + 0.5);
      g.fillStyle = '#f2a33a'; g.fillRect(c[0] - 6, c[1] - 26, 4, 2); g.fillStyle = '#e85d75'; g.fillRect(c[0] + 2, c[1] - 21, 4, 2);
      break;
    }
    case 'pouf': {
      const c = gp(x0 + 0.5, y0 + 0.5);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(c[0], c[1], 13, 6.5, 0, 0, 7); g.fill();
      g.fillStyle = shade(col, -0.12); g.beginPath(); g.ellipse(c[0], c[1] - 3, 12, 6, 0, 0, Math.PI); g.lineTo(c[0] - 12, c[1] - 13); g.ellipse(c[0], c[1] - 13, 12, 6, 0, Math.PI, 0, true); g.closePath(); g.fill();
      g.strokeStyle = shade(col, -0.4); g.lineWidth = 1; g.stroke();
      g.fillStyle = shade(col, 0.1); g.beginPath(); g.ellipse(c[0], c[1] - 13, 12, 6, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = shade(col, -0.25); g.fillRect(c[0] - 1, c[1] - 14, 2, 2);
      break;
    }
    case 'bancone': {
      const [a, b] = ins(x0, x1, 0.04), [c, d] = ins(y0, y1, 0.16);
      box3(g, a, c, b, d, 0, 28, WOOD, { top: '#e9e1cf' });
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0, 1, 20, 24)); g.fillStyle = col; g.fill();
      for (const u of [0.25, 0.5, 0.75]) { poly(g, quadOn(ff, u - 0.005, u + 0.005, 2, 20)); g.fillStyle = WOOD_D; g.fill(); }
      // Registratore di cassa
      const m = r ? [(a + b) / 2, c + 0.3] : [a + 0.3, (c + d) / 2];
      box3(g, m[0] - 0.14, m[1] - 0.12, m[0] + 0.14, m[1] + 0.12, 28, 36, '#4b4f56');
      box3(g, m[0] - 0.1, m[1] - 0.08, m[0] + 0.02, m[1] + 0.08, 36, 41, '#2f3338', { top: '#7cc6a0' });
      break;
    }
    case 'vaso': {
      const c = gp(x0 + 0.5, y0 + 0.5);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(c[0], c[1], 8, 4, 0, 0, 7); g.fill();
      poly(g, [[c[0] - 5, c[1]], [c[0] + 5, c[1]], [c[0] + 7, c[1] - 12], [c[0] + 3, c[1] - 16], [c[0] - 3, c[1] - 16], [c[0] - 7, c[1] - 12]]);
      g.fillStyle = col; g.fill(); g.strokeStyle = shade(col, -0.4); g.lineWidth = 1; g.stroke();
      g.fillStyle = shade(col, 0.25); g.fillRect(c[0] - 5, c[1] - 11, 2, 6);
      g.strokeStyle = '#3f7d34'; g.beginPath();
      for (const dx of [-5, -1, 3, 6]) { g.moveTo(c[0] + dx / 3, c[1] - 16); g.lineTo(c[0] + dx, c[1] - 26 - Math.abs(dx)); }
      g.stroke();
      for (const [dx, dy, fc] of [[-5, -31, '#f6d84a'], [-1, -27, '#ffffff'], [3, -29, '#e85d75'], [6, -32, '#f6d84a']]) { g.fillStyle = fc; g.fillRect(c[0] + dx - 1.5, c[1] + dy - 1.5, 3, 3); }
      break;
    }
    case 'specchio': {
      const [a, b, c, d] = r ? [x0 + 0.2, x0 + 0.32, y0 + 0.15, y1 - 0.15] : [x0 + 0.15, x1 - 0.15, y0 + 0.2, y0 + 0.32];
      box3(g, a - 0.05, c - 0.05, b + 0.05, d + 0.05, 0, 3, WOOD_D);
      box3(g, a, c, b, d, 3, 58, '#e2bf4f');
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.1, 0.9, 7, 54)); g.fillStyle = night ? '#4a5a7a' : '#cfe6ef'; g.fill();
      poly(g, quadOn(ff, 0.2, 0.32, 30, 50)); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
      break;
    }
    case 'pendolo': {
      const [a, b, c, d] = r ? [x0 + 0.25, x0 + 0.65, y0 + 0.22, y1 - 0.22] : [x0 + 0.22, x1 - 0.22, y0 + 0.25, y0 + 0.65];
      box3(g, a, c, b, d, 0, 64, WOOD_D);
      box3(g, a - 0.03, c - 0.03, b + 0.03, d + 0.03, 64, 68, WOOD);
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.15, 0.85, 42, 58)); g.fillStyle = '#f4efe3'; g.fill();
      const ce = ff(0.5, 50);
      g.strokeStyle = '#2b2b2b'; g.lineWidth = 1; g.beginPath(); g.moveTo(ce[0], ce[1]); g.lineTo(ce[0], ce[1] - 5); g.moveTo(ce[0], ce[1]); g.lineTo(ce[0] + 3, ce[1] + 1); g.stroke();
      poly(g, quadOn(ff, 0.25, 0.75, 8, 36)); g.fillStyle = '#3a2a1c'; g.fill();
      const pe = ff(0.5, 14); g.fillStyle = '#e2bf4f'; g.beginPath(); g.arc(pe[0], pe[1], 3, 0, 7); g.fill();
      g.fillRect(Math.round(pe[0]) - 0.5, Math.round(pe[1]) - 20, 1, 20);
      break;
    }
    case 'jukebox': {
      const [a, b] = ins(x0, x1, 0.18), [c, d] = ins(y0, y1, 0.22);
      box3(g, a, c, b, d, 0, 44, '#c0392b', { top: '#e85d4a' });
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.12, 0.88, 26, 42)); g.fillStyle = night ? '#ffe39a' : '#f6d84a'; g.fill();
      const bands = ['#e85d75', '#4fb3c8', '#7fc25e'];
      for (let i = 0; i < 3; i++) { poly(g, quadOn(ff, 0.12, 0.88, 6 + i * 6, 9 + i * 6)); g.fillStyle = bands[i]; g.fill(); }
      poly(g, quadOn(ff, 0.3, 0.7, 30, 38)); g.fillStyle = '#2b2b2b'; g.fill();
      if (night) { g.save(); g.globalCompositeOperation = 'lighter'; const q = ff(0.5, 32); glow(g, q[0], q[1], 26, 0.3, '255,140,180'); g.restore(); }
      break;
    }
    case 'statua': {
      box3(g, x0 + 0.24, y0 + 0.24, x1 - 0.24, y1 - 0.24, 0, 30, '#e6e2da', { side: '#c9c3b5' });
      box3(g, x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, 30, 33, '#f4f2ee');
      const c = gp(x0 + 0.5, y0 + 0.5);
      g.fillStyle = '#ece8df'; g.strokeStyle = '#a9a396'; g.lineWidth = 1;
      poly(g, [[c[0] - 10, c[1] - 33], [c[0] + 10, c[1] - 33], [c[0] + 8, c[1] - 42], [c[0] - 8, c[1] - 42]]); g.fill(); g.stroke();
      g.fillRect(c[0] - 2, c[1] - 46, 4, 5);
      g.beginPath(); g.roundRect(c[0] - 5.5, c[1] - 57, 11, 12, 4); g.fill(); g.stroke();
      // Corona d'alloro
      g.fillStyle = '#9ab36a'; for (const dx of [-5, -3, -1, 1, 3, 5]) g.fillRect(c[0] + dx - 1, c[1] - 56 + Math.abs(dx) * 0.3, 2, 2);
      g.fillStyle = '#a9a396'; g.fillRect(c[0] + 1, c[1] - 52, 1.5, 1.5);
      break;
    }
    case 'espositore': {
      box3(g, x0 + 0.12, y0 + 0.12, x1 - 0.12, y1 - 0.12, 0, 5, '#e9e1cf', { top: '#f4efe3' });
      const c = gp(x0 + 0.5, y0 + 0.5);
      g.save(); g.translate(c[0], c[1] - 5); g.scale(1.3, 1.3);
      drawRide(g, ['skate', 'bici', 'monopattino'][it.c % 3], 'all', false);
      g.restore();
      break;
    }
    case 'targa': {
      const [a, b, c, d] = r ? [x0 + 0.38, x0 + 0.5, y0 + 0.2, y1 - 0.2] : [x0 + 0.2, x1 - 0.2, y0 + 0.38, y0 + 0.5];
      box3(g, a - 0.06, c - 0.06, b + 0.06, d + 0.06, 0, 4, WOOD_D);
      box3(g, a, c, b, d, 4, 34, '#e2bf4f', { top: '#f3d77a' });
      const ff = frontFace(a, c, b, d, r);
      poly(g, quadOn(ff, 0.1, 0.9, 8, 30)); g.fillStyle = '#c99a2e'; g.fill();
      poly(g, quadOn(ff, 0.2, 0.8, 22, 26)); g.fillStyle = '#7a5a1a'; g.fill();
      poly(g, quadOn(ff, 0.25, 0.75, 15, 17)); g.fill();
      poly(g, quadOn(ff, 0.3, 0.7, 11, 13)); g.fill();
      break;
    }
    case 'stender': {
      const [a, b] = ins(x0, x1, 0.1), [c, d] = ins(y0, y1, 0.35);
      for (const [p, q] of r ? [[a, c], [a, d - 0.06]] : [[a, c], [b - 0.06, c]]) box3(g, p, q, p + 0.06, q + 0.06, 0, 46, '#4b4f56');
      if (r) box3(g, a, c, a + 0.06, d, 44, 46, '#4b4f56'); else box3(g, a, c, b, c + 0.06, 44, 46, '#4b4f56');
      const cols = [col, '#f1ede4', shade(col, 0.3), '#2d2d2d', col];
      for (let i = 0; i < 5; i++) {
        const t = 0.12 + i * 0.19;
        const p = r ? gp(a + 0.03, c + (d - c) * t) : gp(a + (b - a) * t, c + 0.03);
        poly(g, [[p[0] - 6, p[1] - 40], [p[0] + 6, p[1] - 40], [p[0] + 5, p[1] - 18], [p[0] - 5, p[1] - 18]]);
        g.fillStyle = cols[i]; g.fill(); g.strokeStyle = shade(cols[i] === '#2d2d2d' ? '#666' : cols[i], -0.35); g.lineWidth = 1; g.stroke();
      }
      break;
    }
  }
}

// Icona di un mobile per il catalogo.
export function drawFurniIcon(canvas, t, c = 0) {
  const g = canvas.getContext('2d');
  const f = furniById(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const span = (f.w + f.d) * 32;
  const s = Math.min(canvas.width / (span + 12), canvas.height / (span / 2 + 64));
  const cx = canvas.width / 2 - ((f.w - f.d) * 32 * s) / 2;
  g.setTransform(s, 0, 0, s, cx, canvas.height - ((f.w + f.d) * 16 + 6) * s);
  drawFurni(g, { t, x: 0, y: 0, r: 0, c });
}

// La stanza: pavimento, due pareti con porta e finestra, mobili e omini in ordine di profondità.
export function drawRoom(g, room, o) {
  const N = ROOM;
  const wall = room.wall || '#efe6d2';
  // Bordo del pavimento (la stanza è una piastra sospesa, come in Habbo)
  const A = gp(0, N), B = gp(N, N), C = gp(N, 0);
  poly(g, [A, B, add(B, 0, 10), add(A, 0, 10)]); g.fillStyle = '#7b5a3a'; g.fill();
  poly(g, [B, C, add(C, 0, 10), add(B, 0, 10)]); g.fillStyle = '#5f4329'; g.fill();
  // Pavimento
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = isoX(x, y), sy = isoY(x, y);
    diamond(g, sx, sy);
    const odd = (x + y) % 2;
    if (room.floor === 'piastrelle') g.fillStyle = odd ? '#f2efe8' : '#c9d3da';
    else if (room.floor === 'cotto') g.fillStyle = odd ? '#c4673d' : '#b65d36';
    else if (room.floor === 'marmo') g.fillStyle = odd ? '#f4f2ee' : '#e6e2da';
    else if (room.floor === 'moquette') g.fillStyle = '#8b6aa8';
    else g.fillStyle = (x % 2) ? '#c8935c' : '#bd8954';
    g.fill();
    if (room.floor === 'parquet') {
      g.strokeStyle = 'rgba(90,55,25,0.35)'; g.lineWidth = 1; g.beginPath();
      for (let k = 1; k < 4; k++) { const a = P(sx, sy, 0, k / 4), b = P(sx, sy, 1, k / 4); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      g.stroke();
    } else if (room.floor === 'marmo') {
      g.strokeStyle = 'rgba(150,140,130,0.4)'; g.beginPath(); const a = P(sx, sy, 0.2, 0.7), b = P(sx, sy, 0.8, 0.3); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    } else if (room.floor !== 'moquette') { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; diamond(g, sx, sy); g.stroke(); }
    if (o.highlight && o.highlight[0] === x && o.highlight[1] === y) { diamond(g, sx, sy, 2); g.strokeStyle = '#ffd34d'; g.lineWidth = 2; g.stroke(); }
  }
  // Parete sinistra (lungo x = 0) con la porta, parete destra (lungo y = 0) con la finestra
  const up = (p, z) => [p[0], p[1] - z];
  for (let y = 0; y < N; y++) {
    const a = gp(0, y), b = gp(0, y + 1);
    poly(g, [b, a, up(a, WALL_H), up(b, WALL_H)]); g.fillStyle = shade(wall, 0.02); g.fill();
    g.strokeStyle = shade(wall, -0.12); g.lineWidth = 1; g.stroke();
  }
  for (let x = 0; x < N; x++) {
    const a = gp(x, 0), b = gp(x + 1, 0);
    poly(g, [a, b, up(b, WALL_H), up(a, WALL_H)]); g.fillStyle = shade(wall, -0.1); g.fill();
    g.strokeStyle = shade(wall, -0.22); g.lineWidth = 1; g.stroke();
  }
  // Zoccolino e cornice in cima
  poly(g, [gp(0, N), gp(0, 0), up(gp(0, 0), 5), up(gp(0, N), 5)]); g.fillStyle = shade(wall, -0.25); g.fill();
  poly(g, [gp(0, 0), gp(N, 0), up(gp(N, 0), 5), up(gp(0, 0), 5)]); g.fillStyle = shade(wall, -0.32); g.fill();
  g.strokeStyle = shade(wall, 0.2); g.lineWidth = 3;
  g.beginPath(); const t0 = up(gp(0, N), WALL_H), t1 = up(gp(0, 0), WALL_H), t2 = up(gp(N, 0), WALL_H); g.moveTo(t0[0], t0[1]); g.lineTo(t1[0], t1[1]); g.lineTo(t2[0], t2[1]); g.stroke();
  // Porta
  const fdoor = wallFace(gp(0, ROOM_DOOR[1] + 1), gp(0, ROOM_DOOR[1]));
  poly(g, quadOn(fdoor, 0.1, 0.9, 0, 66)); g.fillStyle = '#e6dcc6'; g.fill();
  poly(g, quadOn(fdoor, 0.16, 0.84, 0, 62)); g.fillStyle = '#2b2118'; g.fill();
  poly(g, quadOn(fdoor, 0.16, 0.84, 0, 3)); g.fillStyle = '#4a3a2a'; g.fill();
  // Finestre sulla parete destra
  for (const x of [2, 5]) {
    const fw = wallFace(gp(x, 0), gp(x + 1, 0));
    poly(g, quadOn(fw, 0.12, 0.88, 40, 84)); g.fillStyle = '#f4efe3'; g.fill();
    poly(g, quadOn(fw, 0.18, 0.82, 44, 80)); g.fillStyle = o.night ? '#1b2a4a' : '#b5dcef'; g.fill();
    poly(g, quadOn(fw, 0.48, 0.52, 44, 80)); g.fillStyle = '#f4efe3'; g.fill();
    poly(g, quadOn(fw, 0.18, 0.82, 61, 63)); g.fill();
  }
  // Mobili e omini dal fondo verso chi guarda (i tappeti stanno sotto a tutto)
  const items = [...room.items].sort((a, b) => {
    const ra = furniById(a.t)?.rug ? 0 : 1, rb = furniById(b.t)?.rug ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const fa = footprint(a), fb = footprint(b);
    return fa.x1 + fa.y1 - (fb.x1 + fb.y1);
  });
  const hits = [];
  const draws = [];
  for (const it of items) {
    const fp = footprint(it);
    const rug = furniById(it.t)?.rug;
    draws.push({ d: rug ? -1 : fp.x1 + fp.y1 + 0.5, draw: () => drawFurni(g, it, o) });
    const L = gp(fp.x0, fp.y1 + 1), Rr = gp(fp.x1 + 1, fp.y0), T0 = gp(fp.x0, fp.y0), B0 = gp(fp.x1 + 1, fp.y1 + 1);
    hits.push({ uid: it.uid, d: rug ? -1 : fp.x1 + fp.y1, box: [L[0], T0[1] - (rug ? 2 : 56), Rr[0], B0[1]] });
  }
  for (const a of o.avatars || []) draws.push({ d: a.d ?? a.x + a.y + 0.6, draw: () => a.draw(g) });
  draws.sort((p, q) => p.d - q.d);
  for (const d of draws) d.draw();
  if (o.selectedUid) {
    const it = room.items.find((x) => x.uid === o.selectedUid);
    if (it) {
      const fp = footprint(it);
      poly(g, [gp(fp.x0, fp.y0), gp(fp.x1 + 1, fp.y0), gp(fp.x1 + 1, fp.y1 + 1), gp(fp.x0, fp.y1 + 1)]);
      g.strokeStyle = '#ffd34d'; g.lineWidth = 2; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
    }
  }
  if (o.night) {
    g.save();
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#7a84b0';
    g.fillRect(-N * 32 - 100, -WALL_H - 100, N * 64 + 200, N * 32 + WALL_H + 200);
    g.restore();
  }
  return hits;
}

/* Mappa ------------------------------------------------------------------ */

const ACT_MS = { saluta: 2000, balla: 6000, salta: 1600 };
// Verso dell'omino: nelle stanze isometriche segue gli assi del rombo; in città (vista di tre
// quarti) di fronte quando scende o va di lato, di spalle quando sale.
const DIR_OF = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'SE' : 'NW') : (dy > 0 ? 'SW' : 'NE'));
// Verso (nel mondo) di chi guarda in una delle quattro direzioni
const DIR_VEC = { SE: [0.35, 1], SW: [-0.35, 1], NE: [0.35, -1], NW: [-0.35, -1] };
const DIR_TOWN = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'SE' : 'SW') : (dy > 0 ? 'SE' : 'NE'));

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
    this.scene = null;          // null = città, altrimenti l'id dell'abitante di cui si è in casa
    this.roomUI = {};           // { highlight, selectedUid } durante l'arredamento
    this.roomHits = [];
    this.objects = [];
    this.labels = [];
    this.dirty = true;
    this.lastAmbient = 0;
    this.interactUntil = 0;
    this.pointers = new Map();
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // La città in 3D sta in una tela sotto questa; qui sopra restano nomi, nuvolette e stanze.
    // Senza WebGL si resta alla vista piatta di sempre.
    this.t3 = null;
    if (has3D()) {
      const gl = document.createElement('canvas');
      gl.className = 'map3d'; gl.setAttribute('aria-hidden', 'true');
      canvas.parentNode.insertBefore(gl, canvas);
      try { this.t3 = new Town3D(gl); this.gl = gl; } catch { gl.remove(); this.t3 = null; }
    }
    this.cityDirty = true;
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    // Durante un gesto si sposta l'ultima immagine pronta; a gesto finito lo zoom si aggancia
    // a un multiplo intero dei pixel (immagine nitida) e la città si ridisegna.
    const loop = (t) => {
      this.now = t;
      const interacting = this.pointers.size > 0 || t < this.interactUntil;
      if (!interacting && this.needSnap) { this.needSnap = false; this.snapZoom(); }
      if (this.turning(t)) this.dirty = true;
      const growing = this.animating(t);
      const walking = this.tickAvatars(t);
      if ((this.dirty || growing) && interacting && this.layerCam && !this.stale()) this.fast();
      else if (this.dirty || growing) { this.dirty = false; this.render(t, true); this.lastAmbient = t; }
      else if ((walking || this.bubbling(t) || this.acting(t)) && t - this.lastAmbient > 33) { this.render(t, false); this.lastAmbient = t; }
      else if (this.avatarsDirty || (!this.still && t - this.lastAmbient > (this.is3d() ? 33 : 66))) { this.avatarsDirty = false; this.render(t, false); this.lastAmbient = t; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  is3d() { return !!this.t3 && !this.scene; }
  levelOf(x, y) { return this.city ? levelAt(Math.round(x), Math.round(y), this.city.openDistricts) : 0; }

  /* Omini */
  setAvatars(list) {
    const ids = new Set(list.map((a) => a.id));
    for (const id of this.avatars.keys()) if (!ids.has(id)) this.avatars.delete(id);
    for (const a of list) {
      const cur = this.avatars.get(a.id);
      const room = a.pos[2] ?? null;
      const look = a.colors || avatarLook(a.name, a.look);
      if (cur) {
        cur.name = a.name; cur.me = a.me; cur.look = look; cur.ride = a.ride || null;
        if (cur.room !== room) Object.assign(cur, { room, x: a.pos[0], y: a.pos[1], path: [] });
        continue;
      }
      this.avatars.set(a.id, { id: a.id, x: a.pos[0], y: a.pos[1], room, path: [], dir: a.dir || 'SE', look, name: a.name, me: a.me, walked: 0, bubble: null, ride: a.ride || null });
    }
    this.avatarsDirty = true;
  }
  walk(id, tx, ty, room = null) {
    const a = this.avatars.get(id);
    if (!a || !this.city) return false;
    // Entrare o uscire di casa: l'omino compare direttamente dall'altra parte della porta.
    if ((a.room ?? null) !== (room ?? null)) { Object.assign(a, { room, x: tx, y: ty, path: [], dir: room ? 'SE' : 'SW' }); this.avatarsDirty = true; return true; }
    const from = [Math.round(a.x), Math.round(a.y)];
    const path = room ? roomPath(roomOf(this.city, room), from, [tx, ty]) : walkPath(this.city, from, [tx, ty]);
    if (!path) return false;
    a.path = path;
    if (path.length) { a.sit = null; a.wantSit = false; a.act = null; }
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
    if (a.room) { const [cx, cy] = roomCenter(a.x, a.y); return [cx, cy + 2]; }
    // In città i piedi stanno al centro della casella; sulle rampe si sale e si scende piano
    return [(a.x + 0.5) * TILE, (a.y + 0.5) * TILE - surfaceOf(this.city, a.x + 0.5, a.y + 0.5) + 4];
  }
  // In città l'omino è in scala con le case; in casa è grande come in Habbo.
  avatarScale() { return this.scene ? 1 : 0.62; }
  visibleAvatars() { const here = this.scene || null; return [...this.avatars.values()].filter((a) => (a.room ?? null) === here); }

  /* Dentro casa */
  enterRoom(ownerId) {
    if (!this.scene) this.townCam = { ...this.cam };
    this.scene = ownerId;
    if (this.gl) this.gl.hidden = true;
    this.roomUI = {};
    // La stanza riempie la larghezza dello schermo e sta nella metà alta, sopra i comandi.
    this.cam.z = Math.max(1, Math.round((Math.min(this.vw, this.vh * 1.2) * this.dpr) / 450)) / this.dpr;
    [this.cam.x, this.cam.y] = roomCenter(ROOM / 2 - 0.5, ROOM / 2 - 0.5);
    this.cam.y += (0.5 - 0.36) * this.vh / this.cam.z - 40;
    this.clamp();
    this.dirty = true;
  }
  exitRoom() {
    this.scene = null;
    this.roomUI = {};
    if (this.townCam) this.cam = { ...this.townCam };
    this.clamp();
    this.dirty = true;
  }
  setRoomUI(ui) { this.roomUI = { ...this.roomUI, ...ui }; this.dirty = true; }
  tickAvatars(t) {
    const dt = Math.min(0.25, (t - (this.lastTick || t)) / 1000);
    this.lastTick = t;
    let moving = false;
    for (const a of this.avatars.values()) {
      if (!a.path.length) continue;
      moving = true;
      // A passo d'uomo; con bici, monopattino o skate (solo in città) più svelti.
      const speed = (!a.room && rideById(a.ride)?.speed) || WALK_SPEED;
      let left = dt * speed;
      while (left > 0 && a.path.length) {
        const [nx, ny] = a.path[0];
        const dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy);
        if (d > 0.001) { a.dir = a.room ? DIR_OF(dx, dy) : DIR_TOWN(dx, dy); if (!a.room) a.mv = [dx, dy]; }
        if (d <= left) { a.x = nx; a.y = ny; a.path.shift(); left -= d; } else { a.x += (dx / d) * left; a.y += (dy / d) * left; left = 0; }
      }
      if (!a.path.length) this.settle(a);
      a.walked += dt * speed;
      // La telecamera segue il proprio omino quando esce dal centro dello schermo.
      if (a.me && this.is3d() && !this.pointers.size) {
        const v = this.t3.view, h = surfaceOf(this.city, a.x + 0.5, a.y + 0.5) / TILE;
        const [sx, sy] = this.t3.project(a.x + 0.5, a.y + 0.5, h);
        if (Math.abs(sx - this.vw / 2) > this.vw * 0.26 || Math.abs(sy - this.vh / 2) > this.vh * 0.2) {
          v.x += (a.x + 0.5 - v.x) * 0.05; v.y += (a.y + 0.5 - v.y) * 0.05;
          this.interactUntil = t + 200;
          this.dirty = true;
        }
      } else if (a.me && !this.scene && !this.pointers.size) {
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
  drawOneAvatar(g, a, night) {
    const [x, y] = this.avatarScreen(a);
    const step = a.path.length ? (Math.floor(a.walked * 2.6) % 2) + 1 : 0;
    const k = this.avatarScale();
    const t = (this.now || 0) - (a.act?.t0 || 0);
    const kind = a.act && t < ACT_MS[a.act.kind] ? a.act.kind : null;
    let lift = 0, pose = null;
    if (a.sit && !a.path.length) { pose = 'sit'; lift = a.sit.h / k - 15; } // il sedere sulla seduta
    else if (kind === 'salta') { lift = Math.abs(Math.sin((t / 800) * Math.PI)) * 9; }
    else if (kind === 'balla') { pose = 'dance'; lift = Math.floor(t / 260) % 2 ? 1 : 0; }
    else if (kind === 'saluta') pose = 'wave';
    if (this.scene && this.t3) {
      // Nelle stanze l'omino 3D diventa un'immagine vista di sbieco, come i mobili
      const sit = pose === 'sit';
      const cv = avatarSprite(a.look, { dir: a.dir, moving: a.path.length > 0, phase: a.walked * Math.PI * 1.6, act: kind, at: t, sit, seatH: sit ? a.sit.h / 50 : 0 });
      g.drawImage(cv, Math.round(x) - 32, Math.round(y) - 72);
      return;
    }
    g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(k, k);
    if (lift) g.translate(0, -Math.round(lift));
    drawAvatar(g, 0, 0, a.dir, step, a.look, { night, pose, t, ride: a.room || a.sit ? null : a.ride, flatRide: !a.room });
    g.restore();
  }
  // Gesti: saluta, balla, salta. Sedersi aspetta che l'omino arrivi sulla seduta.
  act(id, kind) {
    const a = this.avatars.get(id);
    if (!a) return;
    if (kind === 'siedi') { a.wantSit = true; this.settle(a); }
    else { a.act = { kind, t0: this.now || performance.now() }; a.sit = null; }
    this.avatarsDirty = true;
  }
  settle(a) {
    if (!a.wantSit || a.path.length || !this.city) return;
    a.wantSit = false;
    const seat = seatAt(this.city, a.room, Math.round(a.x), Math.round(a.y));
    if (seat) { a.sit = seat; if (seat.dir) a.dir = seat.dir; }
  }
  acting(t) { for (const a of this.avatars.values()) if (a.act && t - a.act.t0 < ACT_MS[a.act.kind]) return true; return false; }
  drawAvatars(g, night, occlude) {
    const list = this.visibleAvatars().sort((a, b) => a.y - b.y || a.x - b.x);
    for (const a of list) {
      const [x, y] = this.avatarScreen(a);
      this.drawOneAvatar(g, a, night);
      if (!occlude) continue;
      // Ciò che sta davanti all'omino (più in basso sullo schermo: case, alberi, negozi) lo ricopre.
      const depth = a.y + 0.5;
      for (const ob of this.objects) {
        if (ob.depth <= depth + 0.05) continue;
        const [x0, y0, x1, y1] = ob.box;
        if (x + 6 < x0 || x - 6 > x1 || y < y0 || y - 26 > y1) continue;
        this.cover(g, ob, [x - 14, y - 56, x + 14, y + 4]);
      }
    }
  }

  setCity(city, { animateNew = true } = {}) {
    this.cityAnimate = !!this.city && animateNew;
    this.cityDirty = true;
    if (this.city && animateNew) {
      for (const slot of Object.keys(city.houses)) {
        const was = this.city.houses[slot];
        if (!was || was.status !== city.houses[slot].status) this.born.set(slot, performance.now());
      }
    }
    this.city = city;
    this.dirty = true;
  }
  set(opts) {
    if (('meId' in opts && opts.meId !== this.opts.meId) || ('friends' in opts && opts.friends !== this.opts.friends)) this.cityDirty = true;
    Object.assign(this.opts, opts); this.dirty = true;
  }
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
    this.t3?.resize(this.vw, this.vh, Math.min(this.dpr, 1.5));
    if (!this.fitted && this.vw > 50) { this.fitted = true; this.fitCentro(); }
    this.clamp();
    this.dirty = true;
  }
  fitCentro({ wide = false } = {}) {
    if (this.t3) Object.assign(this.t3.view, { x: wide ? 42.5 : 40.5, y: wide ? 28.5 : 27.5, dist: wide ? Math.max(40, this.t3.distForWidth(27)) : Math.max(26, Math.min(56, this.t3.distForWidth(12))) });
    // A grandezza naturale: due pixel dello schermo (o più) per pixel d'arte, centrati sulla piazza.
    // Per scegliere il lotto si guarda tutto il Centro dall'alto.
    this.cam.z = wide ? Math.max(1, Math.round((this.vw * this.dpr) / 700)) / this.dpr : Math.max(2, Math.round((this.vw * this.dpr) / 420)) / this.dpr;
    [this.cam.x, this.cam.y] = townCenter(40, 26, 1);
    this.clamp();
    this.dirty = true;
  }
  focus(slotOrXY) {
    const [x, y] = typeof slotOrXY === 'string' ? parseKey(slotOrXY) : slotOrXY;
    if (this.t3) { const v = this.t3.view; v.x = x + 0.5; v.y = y + 0.3; v.dist = Math.min(v.dist, 24); this.t3.clampView(); }
    [this.cam.x, this.cam.y] = townCenter(x, y, this.levelOf(x, y));
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
    if (this.is3d()) { this.t3.clampView(); this.onCamera?.(this.cam); return; }
    if (this.scene) {
      this.cam.z = Math.max(0.5 / this.dpr, Math.min(4 / this.dpr, this.cam.z));
      const [cx, cy] = roomCenter(ROOM / 2 - 0.5, ROOM / 2 - 0.5);
      this.cam.x = Math.max(cx - 260, Math.min(cx + 260, this.cam.x));
      this.cam.y = Math.max(cy - 200, Math.min(cy + 60 + 0.3 * this.vh / this.cam.z, this.cam.y));
      return;
    }
    const [minZ, maxZ] = this.zoomLimits();
    this.cam.z = Math.max(minZ, Math.min(maxZ, this.cam.z));
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    this.cam.x = Math.max(Math.min(WORLD.x0 + hw - 100, 0), Math.min(Math.max(WORLD.x1 - hw + 100, 0), this.cam.x));
    this.cam.y = Math.max(WORLD.y0 + hh - 100, Math.min(WORLD.y1 - hh + 100, this.cam.y));
    this.onCamera?.(this.cam);
  }
  // Lo zoom si ferma su multipli interi dei pixel dello schermo: pixel d'arte nitidi, come in Habbo.
  snapZoom() {
    if (this.is3d()) return;
    const n = this.cam.z * this.dpr;
    if (n >= 0.85) this.cam.z = Math.max(1, Math.round(n)) / this.dpr;
    else if (n >= 0.4) this.cam.z = 0.5 / this.dpr;
    this.clamp();
    this.dirty = true;
  }
  zoomStep(dir) {
    if (this.is3d()) { this.t3.view.dist *= dir > 0 ? 0.72 : 1.38; this.t3.clampView(); this.dirty = true; return; }
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
    if (this.is3d()) { this.t3.view.dist /= factor; this.t3.clampView(); this.dirty = true; return; }
    this.needSnap = true;
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.z *= factor;
    this.clamp();
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny;
    this.clamp();
    this.dirty = true;
  }

  // Gira la città di un quarto di giro (dir = +1 o -1), con un movimento morbido.
  rotate(dir) {
    if (!this.is3d()) return;
    const v = this.t3.view;
    this.turn = { from: v.az, to: Math.round((this.turn?.to ?? v.az) / (Math.PI / 2) + dir) * (Math.PI / 2), t0: performance.now() };
    this.dirty = true;
  }
  turning(t) {
    if (!this.turn || !this.t3) return false;
    const p = Math.min(1, (t - this.turn.t0) / 450), e = 1 - Math.pow(1 - p, 3);
    this.t3.view.az = this.turn.from + (this.turn.to - this.turn.from) * e;
    if (p >= 1) this.turn = null;
    return true;
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
        if (this.is3d()) {
          // Due dita: avvicina o allontana, sposta, e girando le dita gira la città
          this.t3.view.dist *= this.pinch.d / p.d;
          let da = p.a - this.pinch.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          this.t3.view.az -= da; this.turn = null;
          this.t3.pan(p.cx - this.pinch.cx, p.cy - this.pinch.cy);
          this.pinch = p; this.dirty = true; this.interactUntil = performance.now() + 160;
          return;
        }
        this.zoomAt(p.cx, p.cy, p.d / this.pinch.d);
        this.cam.x -= (p.cx - this.pinch.cx) / this.cam.z;
        this.cam.y -= (p.cy - this.pinch.cy) / this.cam.z;
        this.clamp();
        this.pinch = p;
      } else if (this.drag) {
        const dx = e.offsetX - this.drag.x, dy = e.offsetY - this.drag.y;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        if (this.is3d()) this.t3.pan(dx, dy);
        else { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; }
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
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, a: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  // Dal punto toccato alla cosa: prima gli omini, poi le case, poi il terreno più vicino a chi guarda.
  tap(sx, sy) {
    if (!this.city) return;
    if (this.is3d()) return this.tap3d(sx, sy);
    const [wx, wy] = this.toWorld(sx, sy);
    let best = null;
    const ks = this.avatarScale();
    for (const a of this.visibleAvatars()) {
      const [x, y] = this.avatarScreen(a);
      if (wx > x - 10 * ks && wx < x + 10 * ks && wy > y - 50 * ks && wy < y + 3 && (!best || a.x + a.y > best.d)) best = { d: a.x + a.y, id: a.id };
    }
    if (best) return this.onTap?.({ kind: 'avatar', id: best.id });
    if (this.scene) {
      let hit = null;
      for (const h of this.roomHits) { const [x0, y0, x1, y1] = h.box; if (wx >= x0 && wx <= x1 && wy >= y0 && wy <= y1 && (!hit || h.d > hit.d)) hit = h; }
      const tx = Math.floor((wy / 16 + wx / 32) / 2), ty = Math.floor((wy / 16 - wx / 32) / 2);
      const onFloor = tx >= 0 && ty >= 0 && tx < ROOM && ty < ROOM;
      if (hit && (!onFloor || hit.d >= 0)) return this.onTap?.({ kind: 'furni', uid: hit.uid, x: tx, y: ty });
      if (onFloor) return this.onTap?.({ kind: 'floor', x: tx, y: ty });
      // La porta, sulla parete di sinistra
      const dc = roomCenter(-0.5, ROOM_DOOR[1]);
      if (Math.abs(wx - dc[0]) < 26 && wy < dc[1] && wy > dc[1] - 80) return this.onTap?.({ kind: 'door' });
      return this.onTap?.({ kind: 'none' });
    }
    let house = null;
    for (const ob of this.objects) {
      if (ob.type !== 'house' && ob.type !== 'shop') continue;
      const [x0, y0, x1, y1] = ob.box;
      if (wx >= x0 && wx <= x1 && wy >= y0 && wy <= y1 && (!house || ob.depth > house.depth)) house = ob;
    }
    const tile = townTileAt(this.city, wx, wy);
    if (house && (!tile || house.depth >= tile[1])) {
      if (house.type === 'shop') return this.onTap?.({ kind: 'shop', shop: house.shop });
      const [x, y] = parseKey(house.slot);
      return this.onTap?.({ kind: 'house', slot: house.slot, house: this.city.houses[house.slot], x, y });
    }
    if (!tile) return this.onTap?.({ kind: 'none' });
    this.tapTile(...tile);
  }
  tap3d(sx, sy) {
    const t3 = this.t3;
    let best = null;
    for (const a of this.visibleAvatars()) {
      const h = surfaceOf(this.city, a.x + 0.5, a.y + 0.5) / TILE;
      const [fx, fy, fz] = t3.project(a.x + 0.5, a.y + 0.5, h);
      const [, hy] = t3.project(a.x + 0.5, a.y + 0.5, h + 1.05);
      const hw = Math.max(8, (fy - hy) * 0.35);
      if (sx > fx - hw && sx < fx + hw && sy > hy - 6 && sy < fy + 4 && (!best || fz < best.d)) best = { d: fz, id: a.id };
    }
    if (best) return this.onTap?.({ kind: 'avatar', id: best.id });
    const hit = t3.pick(sx, sy);
    if (!hit) return this.onTap?.({ kind: 'none' });
    if (hit.kind === 'house') return this.onTap?.({ kind: 'house', slot: hit.slot, house: this.city.houses[hit.slot], x: hit.x, y: hit.y });
    if (hit.kind === 'shop') return this.onTap?.({ kind: 'shop', shop: hit.shop });
    if (hit.kind === 'giornale' || hit.kind === 'muro') return this.onTap?.({ kind: hit.kind, x: hit.x, y: hit.y });
    if (hit.x < 0 || hit.y < 0 || hit.x >= W || hit.y >= H) return this.onTap?.({ kind: 'none' });
    this.tapTile(hit.x, hit.y);
  }
  tapTile(x, y) {
    const k = key(x, y);
    const at = { x, y };
    if (this.city.houses[k]) return this.onTap?.({ kind: 'house', slot: k, house: this.city.houses[k], ...at });
    if (shopAt(x, y)) return this.onTap?.({ kind: 'shop', shop: shopAt(x, y).id, ...at });
    if (inPiazza(x, y)) {
      const [ex, ey] = PIAZZA_DECOR.edicola;
      if (x === ex && y === ey) return this.onTap?.({ kind: 'giornale', ...at });
      if (PIAZZA_DECOR.muro.some(([mx, my]) => mx === x && my === y)) return this.onTap?.({ kind: 'muro', ...at });
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
    if (this.scene || this.t3) return this.render(this.now, true);
    const L = this.layerCam, c = this.cam, d = this.dpr;
    const s = c.z / L.z;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#a9d4e6'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.imageSmoothingEnabled = false;
    g.setTransform(s, 0, 0, s, d * ((this.vw / 2) * (1 - s) + (L.x - c.x) * c.z), d * ((this.vh / 2) * (1 - s) + (L.y - c.y) * c.z));
    g.drawImage(this.layer, 0, 0, this.layer.width * L.q, this.layer.height * L.q);
    const layerT = g.getTransform();
    this.worldTransform(g, c.z * d);
    this.drawAvatars(g, this.opts.night, false);
    if (this.opts.night && this.lit) {
      nightTint(g, this.cv.width, this.cv.height);
      g.save(); g.setTransform(layerT); g.globalCompositeOperation = 'lighter';
      g.drawImage(this.nightLayer, 0, 0, this.nightLayer.width * L.q, this.nightLayer.height * L.q);
      g.restore();
    }
    drawClouds(g, c, this.vw, this.vh, d, this.still ? 0 : this.now, this.opts.night);
  }
  // Ridisegna una casa (o un albero, un negozio) sopra ciò che le passa dietro. La prima volta la
  // disegna in un ritaglio grande quanto basta, poi incolla il ritaglio: molto più leggero.
  // Si ridisegna solo dentro il riquadro di chi passa dietro (clip), così il resto della scena resta com'è.
  cover(g, ob, clip) {
    if (g.canvas !== this.frame) return ob.draw(g);
    const { s } = this.pixelScale();
    const bw = this.frame.width, bh = this.frame.height;
    const ox = Math.round(bw / 2 - this.cam.x * s), oy = Math.round(bh / 2 - this.cam.y * s);
    if (!ob.sprite) {
      const [x0, y0, x1, y1] = ob.box;
      const px0 = Math.floor((x0 - 6) * s + ox), py0 = Math.floor((y0 - 6) * s + oy);
      const px1 = Math.ceil((x1 + 6) * s + ox), py1 = Math.ceil((y1 + 6) * s + oy);
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, px1 - px0); cv.height = Math.max(1, py1 - py0);
      const cg = cv.getContext('2d');
      cg.setTransform(s, 0, 0, s, ox - px0, oy - py0);
      ob.draw(cg);
      // Di giorno il ritaglio prende la stessa luce calda dello strato fisso (poi si rimettono i bordi trasparenti).
      if (!this.opts.night) {
        const shape = document.createElement('canvas'); shape.width = cv.width; shape.height = cv.height;
        shape.getContext('2d').drawImage(cv, 0, 0);
        warmLight(cg, bw, bh, -px0, -py0);
        cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(shape, 0, 0); cg.restore();
      }
      ob.sprite = { cv, px0, py0 };
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (clip) {
      const cx0 = Math.floor(clip[0] * s + ox), cy0 = Math.floor(clip[1] * s + oy);
      const cx1 = Math.ceil(clip[2] * s + ox), cy1 = Math.ceil(clip[3] * s + oy);
      g.beginPath(); g.rect(cx0, cy0, cx1 - cx0, cy1 - cy0); g.clip();
    }
    g.drawImage(ob.sprite.cv, ob.sprite.px0, ob.sprite.py0);
    g.restore();
  }
  // Lo spostamento si arrotonda ai pixel interi: niente righine tra una casella e l'altra.
  worldTransform(g, scale, w = this.cv.width, h = this.cv.height) {
    g.setTransform(scale, 0, 0, scale, Math.round(w / 2 - this.cam.x * scale), Math.round(h / 2 - this.cam.y * scale));
  }

  renderRoom(t) {
    const { q, s } = this.pixelScale();
    const bw = Math.ceil(this.cv.width / q), bh = Math.ceil(this.cv.height / q);
    const fr = this.frame;
    if (fr.width !== bw || fr.height !== bh) { fr.width = bw; fr.height = bh; }
    const fg = fr.getContext('2d');
    fg.setTransform(1, 0, 0, 1, 0, 0);
    const bg = fg.createLinearGradient(0, 0, 0, bh);
    bg.addColorStop(0, '#20263a'); bg.addColorStop(1, '#0f1320');
    fg.fillStyle = bg; fg.fillRect(0, 0, bw, bh);
    this.worldTransform(fg, s, bw, bh);
    const night = this.opts.night;
    const avatars = this.visibleAvatars().map((a) => ({ x: a.x, y: a.y, d: a.sit?.d, draw: () => this.drawOneAvatar(fg, a, night) }));
    this.roomHits = drawRoom(fg, roomOf(this.city, this.scene), { night, avatars, ...this.roomUI });
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(fr, 0, 0, bw * q, bh * q);
    this.overlay(g, t, { ...this.opts, selected: null });
  }

  render(t, full) {
    if (!this.city) return;
    if (this.scene) return this.renderRoom(t);
    if (this.t3) return this.render3d(t);
    const { q, s } = this.pixelScale();
    const bw = Math.ceil(this.cv.width / q), bh = Math.ceil(this.cv.height / q);
    for (const cv of [this.layer, this.frame]) if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; full = true; }
    const o = { ...this.opts, t, born: this.born, z: this.cam.z, detail: this.cam.z * this.dpr >= 0.75 };
    const view = this.view();
    if (full) {
      const lg = this.layer.getContext('2d');
      lg.setTransform(1, 0, 0, 1, 0, 0);
      const sky = lg.createLinearGradient(0, 0, 0, bh);
      sky.addColorStop(0, '#c7e7f2'); sky.addColorStop(1, '#9ccbe0'); // di notte lo scurisce il colore notturno
      lg.fillStyle = sky; lg.fillRect(0, 0, bw, bh);
      this.worldTransform(lg, s, bw, bh);
      const res = drawTown(lg, this.city, view, o);
      // La luce calda del giorno si stende una volta sola sullo strato fisso.
      if (!o.night) warmLight(lg, bw, bh);
      this.objects = res.objects;
      this.labels = res.labels;
      this.layerCam = { ...this.cam, q };
      // Di notte le luci fisse si preparano una volta sola, su uno strato trasparente.
      this.lit = !!o.night;
      if (o.night) {
        const nl = (this.nightLayer ||= document.createElement('canvas'));
        if (nl.width !== bw || nl.height !== bh) { nl.width = bw; nl.height = bh; }
        const ng = nl.getContext('2d');
        ng.setTransform(1, 0, 0, 1, 0, 0); ng.clearRect(0, 0, bw, bh);
        this.worldTransform(ng, s, bw, bh);
        ng.globalCompositeOperation = 'lighter';
        drawTownLights(ng, res.lights, res.lamps);
        ng.globalCompositeOperation = 'source-over';
      }
    }
    // Fotogramma: strato fisso, poi acqua, auto e omini nello stesso buffer (stessi pixel).
    const fg = this.frame.getContext('2d');
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.drawImage(this.layer, 0, 0);
    this.worldTransform(fg, s, bw, bh);
    // Quello che sta davanti a un veicolo (case, alberi, negozi) lo copre.
    o.occlude = (depth, [bx0, by0, bx1, by1]) => {
      for (const ob of this.objects) {
        if (ob.depth <= depth + 0.05) continue;
        const [x0, y0, x1, y1] = ob.box;
        if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
        this.cover(fg, ob, [bx0, by0, bx1, by1]);
      }
    };
    o.glows = o.night ? [] : null;
    drawTownAmbient(fg, this.city, view, o, this.still ? 0 : t);
    if (this.opts.mode === 'choose') {
      const pulse = 0.5 + 0.5 * Math.sin(t / 300);
      fg.fillStyle = `rgba(255,236,160,${0.25 + pulse * 0.3})`;
      const v = townVisible(view);
      for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) {
        const k = key(x, y);
        if (!PLAN.lots.has(k) || this.city.houses[k] || districtAt(x, y) > this.city.openDistricts) continue;
        fg.fillRect(x * TILE + 3, y * TILE - townElev(this.levelOf(x, y)) + 3, TILE - 6, TILE - 6);
      }
    }
    this.drawAvatars(fg, o.night, true);
    if (o.night && this.lit) {
      // Una sola passata di colore notturno su tutto, poi le luci fisse e i fari delle auto
      nightTint(fg, bw, bh);
      fg.save(); fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalCompositeOperation = 'lighter'; fg.drawImage(this.nightLayer, 0, 0); fg.restore();
      fg.save(); fg.globalCompositeOperation = 'lighter';
      for (const [x, y] of o.glows) glow(fg, x, y, 16, 0.4, '255,240,180');
      fg.restore();
    }
    // Sullo schermo: ingrandimento a pixel interi, poi scritte e nuvole a piena risoluzione.
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.frame, 0, 0, bw * q, bh * q);
    this.overlay(g, t, o);
    drawClouds(g, this.cam, this.vw, this.vh, this.dpr, this.still ? 0 : t, o.night);
  }

  /* Città in 3D */
  render3d(t) {
    const t3 = this.t3, o = this.opts;
    if (this.gl.hidden) this.gl.hidden = false;
    let rebuilt = false;
    if (this.cityDirty) { t3.setCity(this.city, { meId: o.meId, friends: o.friends, animateNew: this.cityAnimate }); this.cityDirty = false; rebuilt = true; }
    if (rebuilt || o.night !== this.lit3 || o.online !== this.online3) { t3.setNight(o.night, o.online); this.lit3 = o.night; this.online3 = o.online; }
    if (rebuilt || o.selected !== this.sel3) { t3.setSelected(o.selected); this.sel3 = o.selected; }
    const choose = o.mode === 'choose';
    if (rebuilt || choose !== this.choose3) { t3.setChoose(choose); this.choose3 = choose; }
    t3.updateCamera();
    this.syncAvatars3d(t);
    t3.render(this.still ? 0 : t, { choosePulse: choose });
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    this.overlay3d(g, t);
  }
  // Ogni omino è un modellino 3D: si gira verso dove va e prende la posa del momento.
  syncAvatars3d(t) {
    const t3 = this.t3;
    for (const a of this.visibleAvatars()) {
      const at = (this.now || 0) - (a.act?.t0 || 0);
      const act = a.act && at < ACT_MS[a.act.kind] ? a.act.kind : null;
      const sit = !!(a.sit && !a.path.length);
      const [mx, my] = a.mv || DIR_VEC[a.dir] || [0, 1];
      const ride = a.sit ? null : a.ride;
      const h = surfaceOf(this.city, a.x + 0.5, a.y + 0.5) / TILE;
      // Chi cammina guarda dove va; chi è fermo si gira piano verso chi guarda lo schermo
      const moving = a.path.length > 0;
      const want = moving || sit ? Math.atan2(mx, my) : t3.view.az;
      let f = a.face3 ?? want;
      let d = want - f; d = Math.atan2(Math.sin(d), Math.cos(d));
      f += moving ? d : d * 0.08;
      a.face3 = f;
      t3.setAvatar(a.id, {
        x: a.x + 0.5, y: a.y + 0.5, h, look: a.look, ride, me: a.me, facing: f,
        pose: { moving, phase: a.walked * Math.PI * 1.6, act, at: act ? at : t, sit, seatH: 0.3, lookUp: 0.28 },
      });
    }
    t3.sweepAvatars();
  }
  overlay3d(g, t) {
    const t3 = this.t3, o = this.opts;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const screen = { L: 0, R: this.vw, T: 0, B: this.vh };
    const near = t3.view.dist < 22;
    if (o.selected && this.city.houses[o.selected]) {
      const b = t3.houses.get(o.selected), r = this.city.residents[this.city.houses[o.selected].residentId];
      if (b && r) { const p = b.group.position; const [x, y, z] = t3.project(p.x, p.z + (b.north ? -0.35 : 0.35), p.y); if (z < 1) label(g, x, y + 10, r.username, this.city.houses[o.selected].residentId === o.meId, 1); }
    }
    for (const a of this.visibleAvatars()) {
      const h = surfaceOf(this.city, a.x + 0.5, a.y + 0.5) / TILE;
      const [x, y, z] = t3.project(a.x + 0.5, a.y + 0.5, h);
      if (z > 1 || x < -60 || x > this.vw + 60 || y < -60 || y > this.vh + 80) continue;
      const [, head] = t3.project(a.x + 0.5, a.y + 0.5, h + 1.12);
      if (a.me) {
        const bob = Math.sin(t / 300) * 1.5;
        g.fillStyle = '#ffd34d'; g.strokeStyle = 'rgba(60,40,0,0.6)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - 5, head - 12 + bob); g.lineTo(x + 5, head - 12 + bob); g.lineTo(x, head - 4 + bob); g.closePath(); g.fill(); g.stroke();
      }
      if (a.name && (a.me || near)) label(g, x, y + 10, a.name, a.me, 1);
      if (a.bubble) {
        const age = t - a.bubble.t0;
        if (age > 6500) { a.bubble = null; continue; }
        bubble(g, x, head - 16 - Math.min(age / 900, 1) * 4, a.name, a.bubble.text, 1, age > 5800 ? 1 - (age - 5800) / 700 : 1, screen);
      }
    }
    for (const [slot, t0] of this.born) {
      const b = t3.houses.get(slot);
      if (!b || t - t0 >= 1400) continue;
      const p = b.group.position, [x, y, z] = t3.project(p.x, p.z + (b.north ? 1 : -1), p.y + 1.5);
      if (z < 1) sparkle(g, x, y, t - t0);
    }
  }

  // Etichette, selezione, nuvolette e scintille: a piena risoluzione, sopra i pixel.
  overlay(g, t, o) {
    this.worldTransform(g, this.cam.z * this.dpr);
    g.imageSmoothingEnabled = true;
    const z = this.cam.z;
    if (o.selected) {
      const [x, y] = parseKey(o.selected);
      g.save(); g.lineWidth = 2.5 / z; g.strokeStyle = this.city.houses[o.selected] ? '#ffd34d' : '#d4462f';
      g.strokeRect(x * TILE + 1, y * TILE - townElev(this.levelOf(x, y)) + 1, TILE - 2, TILE - 2); g.restore();
    }
    // Come in Habbo i nomi stanno sugli omini; sulle case solo su quella selezionata.
    for (const l of this.labels) if (l.slot === o.selected) label(g, l.x, l.y + 4, l.text, l.me, z);
    const k = this.avatarScale();
    for (const a of this.visibleAvatars()) {
      const [x, y] = this.avatarScreen(a);
      const head = y - 52 * k;
      if (a.me) {
        const bob = Math.sin(t / 300) * 1.5;
        const s = Math.max(k, 0.7);
        g.fillStyle = '#ffd34d'; g.strokeStyle = 'rgba(60,40,0,0.6)'; g.lineWidth = 1 / z;
        g.beginPath(); g.moveTo(x - 4 * s, head - 8 * s + bob); g.lineTo(x + 4 * s, head - 8 * s + bob); g.lineTo(x, head - 2 * s + bob); g.closePath(); g.fill(); g.stroke();
      }
      if (a.name && (a.me || this.scene || z * this.dpr >= 3)) label(g, x, y + 8 * k, a.name, a.me, z);
      if (a.bubble) {
        const age = t - a.bubble.t0;
        if (age > 6500) { a.bubble = null; continue; }
        bubble(g, x, head - 12 * k - Math.min(age / 900, 1) * 4, a.name, a.bubble.text, z, age > 5800 ? 1 - (age - 5800) / 700 : 1, this.view());
      }
    }
    for (const [slot, t0] of this.born) {
      const [x, y] = parseKey(slot);
      if (t - t0 < 1400) { const [cx, cy] = townCenter(x, y, this.levelOf(x, y)); sparkle(g, cx, cy - 30, t - t0); }
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
function bubble(g, x, y, name, text, z, alpha, view) {
  g.save();
  g.globalAlpha = Math.max(0, alpha);
  const fs = 12 / z;
  g.font = `800 ${fs}px Nunito, sans-serif`;
  const nw = g.measureText(name + ': ').width;
  g.font = `600 ${fs}px Nunito, sans-serif`;
  let t = text;
  const maxW = Math.min(220 / z, view ? view.R - view.L - 16 / z : Infinity);
  if (nw + g.measureText(t).width > maxW) { while (t.length > 2 && nw + g.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; }
  const w = nw + g.measureText(t).width + fs * 1.4, hgt = fs * 2;
  // La nuvoletta resta dentro lo schermo; la punta continua a indicare chi parla.
  const bx = view ? Math.max(view.L + 8 / z, Math.min(view.R - 8 / z - w, x - w / 2)) : x - w / 2, by = y - hgt;
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
  if (has3D()) { try { return renderHouseStill(canvas, style, { cantiere }); } catch { /* si ripiega sul disegno piatto */ } }
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#d7eef7'); sky.addColorStop(1, '#b6dcea');
  g.fillStyle = sky; g.fillRect(0, 0, canvas.width, canvas.height);
  const s = Math.max(1, Math.floor(Math.min(canvas.width / 120, (canvas.height * 0.74) / 86))); // la casa intera, tetto compreso
  g.imageSmoothingEnabled = false;
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height * 0.78);
  // Il giardino, il marciapiede davanti e la casa vista di fronte
  g.fillStyle = '#86c457'; g.fillRect(-56, -52, 112, 52);
  for (let k = 0; k < 60; k++) { g.fillStyle = k % 2 ? 'rgba(40,90,25,0.35)' : 'rgba(255,255,210,0.3)'; g.fillRect(-54 + ih(k, 1, 7) * 106, -50 + ih(k, 2, 7) * 48, 1, 2); }
  g.fillStyle = '#ddd4c2'; g.fillRect(-56, 0, 112, 6);
  g.fillStyle = '#a39b8e'; g.fillRect(-56, 6, 112, 14);
  drawHouse3(g, style, 0, -1, { cantiere });
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
  const [fx, fy] = news.slot ? parseKey(news.slot) : PIAZZA_DECOR.fountain;
  if (has3D()) {
    try {
      g.drawImage(renderTownStill(city, fx, fy, mapW, mapH), mapX, mapY);
      return finishPoster(g, city, news, format, { Wp, Hp, ink, red, mapY, mapH });
    } catch { /* si ripiega sulla mappa piatta */ }
  }
  const z = 2;
  const [cx, cy] = townCenter(fx, fy, levelAt(fx, fy, city.openDistricts));
  g.save();
  g.beginPath(); g.rect(mapX, mapY, mapW, mapH); g.clip();
  const sky = g.createLinearGradient(0, mapY, 0, mapY + mapH);
  sky.addColorStop(0, '#c7e7f2'); sky.addColorStop(1, '#9ccbe0');
  g.fillStyle = sky; g.fillRect(mapX, mapY, mapW, mapH);
  g.setTransform(z, 0, 0, z, mapX + mapW / 2 - cx * z, mapY + mapH / 2 - (cy - 10) * z);
  const view = { L: cx - mapW / 2 / z, R: cx + mapW / 2 / z, T: cy - mapH / 2 / z, B: cy + mapH / 2 / z };
  const o = { selected: null, t: 0, detail: true };
  drawTown(g, city, view, o);
  drawTownAmbient(g, city, view, o, 4200);
  g.restore();
  return finishPoster(g, city, news, format, { Wp, Hp, ink, red, mapY, mapH });
}
function finishPoster(g, city, news, format, { Wp, Hp, ink, red, mapY, mapH }) {
  const mapX = 70, mapW = Wp - 140;
  g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(mapX, mapY, mapW, mapH);
  const f = formatNews(news, city);
  g.textAlign = 'left'; g.fillStyle = ink;
  g.font = '400 64px "Abril Fatface", Georgia, serif';
  let y = wrap(g, f.title, 70, mapY + mapH + 100, Wp - 140, 74);
  g.font = '600 36px Nunito, sans-serif'; g.fillStyle = '#3b4642';
  y = wrap(g, f.text, 70, y + 64, Wp - 140, 50);
  g.fillStyle = red; g.fillRect(0, Hp - (format === 'story' ? 210 : 110), Wp, format === 'story' ? 210 : 110);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '700 38px Fredoka, Nunito, sans-serif';
  g.fillText('Vieni ad abitare qui · link in bio', Wp / 2, Hp - (format === 'story' ? 130 : 45));
  return g.canvas;
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
