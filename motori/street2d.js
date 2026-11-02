// ============================================================================
//  Street2D · strada notturna in pixel art cartoonesca, vista di lato
//  Stessa interfaccia della vista 3D: update(dt, stato, gioco), setPaint, resize.
//  Tela a 360 px di altezza ingrandita a pixel netti. La luce si SOMMA all'immagine
//  a bande morbide (pozze sull'asfalto, aloni piccoli), niente fasci che tagliano la scena.
//  Palazzi, asfalto e sprite si disegnano una volta e si riusano (cache).
// ============================================================================
const PX_FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111',
  3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110', ',': '000000000010100', '.': '000000000000010', '€': '011110100110011',
  '/': '001001010100100', '-': '000000111000000', '!': '010010010000010', ' ': '000000000000000',
};

// Supra in pixel art dall'illustrazione dell'utente: carrozzeria (200×58, 1 px = 1 unità di disegno, asse
// delle ruote a y 43) e ruota a parte (32×32) per farla girare. Incorporate come immagini per funzionare anche in locale.
const SUPRA2D_BODY = 'data:image/png;base64,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';
const SUPRA2D_WHEEL = 'data:image/png;base64,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';

class Street2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lo = document.createElement('canvas');
    this.g = this.lo.getContext('2d');
    this.LH = 360;
    this.paintHex = '#c81d11'; this.dual = false;
    this.st = { heave: 0, hv: 0, pitch: 0, pv: 0, spin: 0, front: 0, t: 0, flame: 0, lz: 3.5, head: 0, hdv: 0 };
    this.parts = [];
    this.comics = []; this.cool = {}; this.marks = []; this.sparkT = 0;
    this.spr = {};
    // sprite disegnato a mano: si usa appena le immagini sono pronte (prima resta la Supra vettoriale)
    this.sImg = new Image(); this.wImg = new Image();
    let n = 0; const ready = () => { if (++n === 2) { this.sReady = true; this.spr = {}; this.paintBase = {}; } };
    this.sImg.onload = ready; this.wImg.onload = ready; this.sImg.src = SUPRA2D_BODY; this.wImg.src = SUPRA2D_WHEEL;
    this.v40Img = new Image(); this.v40Img.onload = () => { this.v40Ready = true; this.spr = {}; }; this.v40Img.onerror = () => {}; this.v40Img.src = 'img/v40.png';
    this.paintBase = {};
    this.tiles = new Map();
    this.visible = true;
    this.C = {
      ink: '#0a0d18', road: '#22263a', road2: '#1b1f31', road3: '#2a2f46', line: '#e8e4d6', curb: '#3a3f58', walk: '#2b2f45',
      sky: ['#0a0922', '#100f30', '#16143c', '#1d1a48', '#252055', '#2e2662', '#382c6c', '#433274', '#4f387a'],
      mid: ['#123049', '#1b2a52', '#2a1f4f', '#163d4a', '#2b2a5c', '#3a2246'],
      win: ['#ffd36b', '#ffe6a3', '#7fe7ff', '#ffb35c', '#ff9ccf'], neon: ['#2ee6ff', '#ff2e88', '#b8ff3a', '#ffb000', '#b07bff'],
      moon: '#fff1c9', skin: '#e3a97a',
    };
    this.resize();
  }

  // ---------------------------------------------------------------- utilità
  static rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  static shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  static rgb(hex) { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }
  static bayer(x, y) { const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; return m[(x & 3) + (y & 3) * 4] / 16; }

  text(g, str, x, y, color, sc = 1) {
    let cx = Math.round(x);
    g.fillStyle = color;
    for (const ch of String(str).toUpperCase()) {
      const m = PX_FONT[ch] || PX_FONT[' '];
      for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(cx + (i % 3) * sc, Math.round(y) + Math.floor(i / 3) * sc, sc, sc);
      cx += 4 * sc;
    }
  }
  textW(str, sc = 1) { return (String(str).length * 4 - 1) * sc; }

  // ellisse piena a pixel netti (per righe)
  span(g, cx, cy, rx, ry) {
    if (rx < 1 || ry < 1) return;
    for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (hw > 0) g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
    }
  }
  // luce che si somma: ellissi concentriche a bande (posterizzate, niente rumore)
  light(g, cx, cy, rx, ry, hex, a, bands = 4) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(${Street2D.rgb(hex)},${a})`;
    for (let k = 0; k < bands; k++) { const f = 1 - k / bands * 0.75; this.span(g, cx, cy, rx * f, ry * f); }
    g.restore();
  }
  shadow(g, cx, cy, rx, ry, a = 0.55) { g.fillStyle = `rgba(4,5,12,${a})`; this.span(g, cx, cy, rx, ry); g.fillStyle = `rgba(4,5,12,${a * 0.6})`; this.span(g, cx, cy, rx * 1.12, ry * 1.3); }

  sprite(w, h, draw, outline = true) {
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
    const x = c.getContext('2d'); x.translate(1, 1); draw(x);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = c.height;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
    if (outline) {
      const a = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3];
      for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
        const i = y * W + x2; if (a[i]) continue;
        if ((x2 > 0 && a[i - 1]) || (x2 < W - 1 && a[i + 1]) || (y > 0 && a[i - W]) || (y < H - 1 && a[i + W])) { d[i * 4] = 10; d[i * 4 + 1] = 13; d[i * 4 + 2] = 24; d[i * 4 + 3] = 255; }
      }
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.putImageData(im, 0, 0);
    return c;
  }
  touch(c, fn) { const x = c.getContext('2d'); x.save(); x.translate(1, 1); fn(x); x.restore(); return c; }

  // ---------------------------------------------------------------- sprite delle auto
  // Coordinate di disegno a scala 1: ruote di raggio 15 con centro a y 42, terra a y 57.
  // Ogni sprite si genera già alla scala della corsia (pixel netti, niente ingrandimenti storti).
  static GEO = {
    supra: { w: 200, ax: [48, 158] },
    coupe: { w: 200, ax: [48, 158] },
    sedan: { w: 190, ax: [40, 152] },
  };

  carSprite(k) {
    if (this.carId === 'v40') return this.v40Sprite(k);
    return this.sReady ? this.supraSprite(this.paintHex, k) : this.vehicle('supra', this.paintHex, k);
  }
  // geometria dell'auto nello sprite (scala 1): ruote, pilota, luci, marmitta
  geo() {
    if (this.carId === 'v40') return this.v40Ready
      ? { h: 71, wy: 56, wr: 14.4, ax: [41, 156], hx: 112, hy: 3, tail: [2, 26, 6, 7], blinkF: [173, 46, 7, 2], blinkR: [19, 44, 6, 2], ex: [3, 54], low: this.v40Look && this.v40Look.low ? 3 : 0 }
      : { h: 71, wy: 56, wr: 14.4, ax: [41, 156], hx: 110, hy: 6, tail: [1, 28, 5, 10], blinkF: [188, 47, 6, 2], blinkR: [1, 47, 4, 2], ex: [6, 64], low: this.v40Look && this.v40Look.low ? 3 : 0 };
    return { h: 58, wy: 42, wr: 15, ax: [48, 158], hx: 92, hy: 0, tail: [7, 18, 5, 5], blinkF: [176, 37, 7, 3], blinkR: [19, 33, 4, 3], ex: [7, 46], low: 0 };
  }
  // Volvo V40 SW: cambia auto, vernice e potenziamenti visibili
  setCar(id, look, paint) {
    const key = id + JSON.stringify(look || {}) + (paint || '');
    if (key === this.carKey) return;
    this.carKey = key; this.carId = id; this.v40Look = look || {}; this.v40Paint = paint || '#2a4b57'; this.spr = {};
  }
  // disegno della V40: se c'è l'immagine (motori/img/v40.png) si usa quella, altrimenti il segnaposto in pixel art.
  // Gli strati dei potenziamenti (sporco, kit, spoiler, scarico, intercooler, scritte) vanno sopra in entrambi i casi.
  v40Base() {
    const L = this.v40Look || {}, hex = this.v40Paint || '#2a4b57', key = 'v40b' + JSON.stringify(L) + hex + (this.v40Ready ? 'img' : '');
    if (this.spr[key]) return this.spr[key];
    const W = 200, H = 71, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const px = (col, xx, yy, ww = 1, hh = 1) => { x.fillStyle = col; x.fillRect(Math.round(xx), Math.round(yy), ww, hh); };
    const sh = (k) => Street2D.shade(hex, k), ink = this.C.ink;
    if (this.v40Ready) {
      x.imageSmoothingEnabled = false; x.drawImage(this.v40Img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H), p = d.data;
      const isBody = (r, g, b) => b > r + 8 && g > r + 4 && b < 150 && (r + g + b) > 60;
      // lavaggio: lo sporco del disegno (pixel bruni sulle fiancate) prende il colore della carrozzeria sopra
      // sporco del disegno: grigio-oliva o bruno nella fascia bassa (la carrozzeria è sempre più blu che rossa)
      const dirty = (r, g, b) => (r + g + b) > 95 && b - r < 10 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
      if (L.clean) for (let yy = 40; yy < 66; yy++) for (let xx = 0; xx < W; xx++) {
        const i = (yy * W + xx) * 4;
        if (!p[i + 3] || !dirty(p[i], p[i + 1], p[i + 2])) continue;
        if (Math.hypot(xx - 41, yy - 56) < 15.5 || Math.hypot(xx - 156, yy - 56) < 15.5) continue;   // non nelle ruote
        let j = -1;
        for (let dd = 1; dd < 9 && j < 0; dd++) for (const [dx, dy] of [[-dd, 0], [dd, 0], [0, -dd], [-dd, -1], [dd, -1]]) {
          const x2 = xx + dx, y2 = yy + dy; if (x2 < 0 || x2 >= W || y2 < 0) continue;
          const q = (y2 * W + x2) * 4; if (p[q + 3] && isBody(p[q], p[q + 1], p[q + 2])) { j = q; break; }
        }
        if (j >= 0) { p[i] = p[j]; p[i + 1] = p[j + 1]; p[i + 2] = p[j + 2]; }
      }
      if (hex.toLowerCase() !== '#2a4b57') {       // ricolora la vernice (pixel blu-petrolio dell'illustrazione), non vetri e montanti
        const n = parseInt(hex.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
        for (let i = 0; i < p.length; i += 4) { const r = p[i], g = p[i + 1], b = p[i + 2]; if (p[i + 3] && isBody(r, g, b)) { const kk = (g + b) / 2 / 67 * 0.9; p[i] = Math.min(255, R * kk); p[i + 1] = Math.min(255, G * kk); p[i + 2] = Math.min(255, B * kk); } }
      }
      x.putImageData(d, 0, 0);
    } else {
      // segnaposto: station wagon con portellone verticale, tetto lungo con barre, tre luci laterali
      const body = [[2, 66], [1, 30], [3, 15], [9, 9], [118, 8], [150, 26], [190, 34], [198, 40], [199, 58], [196, 66]];
      x.fillStyle = ink; x.beginPath(); body.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill();
      x.fillStyle = hex; x.beginPath(); body.forEach(([a, b], i) => (i ? x.lineTo(a + (a < 100 ? 1 : -1), b + 1) : x.moveTo(a + 1, b))); x.closePath(); x.fill();
      px(sh(0.25), 10, 10, 106, 1); px(sh(0.15), 150, 27, 40, 1); px(sh(0.12), 3, 30, 190, 2);    // luci alte
      px(sh(-0.25), 3, 52, 194, 12);                                                         // fiancata bassa in ombra
      // vetri
      x.fillStyle = ink; x.beginPath(); x.moveTo(11, 12); x.lineTo(117, 11); x.lineTo(146, 28); x.lineTo(12, 28); x.closePath(); x.fill();
      x.fillStyle = '#6f8792'; x.beginPath(); x.moveTo(13, 13); x.lineTo(116, 12); x.lineTo(143, 27); x.lineTo(13, 27); x.closePath(); x.fill();
      for (let q = 0; q < 14; q++) px('#9db3bc', 20 + q * 2 + (q > 6 ? 40 : 0), 14 + (q % 7), 2, 1);   // riflessi
      for (const pxl of [[36, 3], [64, 3], [99, 3]]) px(sh(-0.45), pxl[0], 11, pxl[1], 17);       // montanti
      px('#1a2026', 4, 13, 9, 15);                                                          // lunotto scuro
      // barre sul tetto
      px(ink, 22, 5, 92, 2); px('#3a4048', 22, 5, 92, 1); px(ink, 26, 7, 3, 2); px(ink, 106, 7, 3, 2);
      // porte, maniglie, modanatura, specchietto
      for (const dx of [58, 99, 137]) px(sh(-0.5), dx, 29, 1, 31);
      px(ink, 64, 34, 7, 2); px(ink, 105, 34, 7, 2); px(sh(-0.55), 56, 50, 86, 2); px(ink, 136, 27, 5, 4);
      // luci: fanale alto dietro, faro, frecce, catarifrangenti
      px(ink, 0, 27, 7, 12); px('#c41a1a', 1, 28, 5, 10); px('#ff6a5a', 2, 29, 2, 3);
      px(ink, 185, 36, 14, 7); px('#cfd6dc', 186, 37, 12, 5); px('#fffbe8', 192, 38, 5, 3);
      px('#e2690f', 188, 47, 6, 2); px('#e2690f', 2, 47, 4, 2);
      // paraurti grigio scuro e passaruota
      px('#1a2026', 0, 54, 14, 12); px('#1a2026', 180, 52, 20, 14); px('#2a3038', 180, 58, 20, 1);
      for (const [cx2] of [[41], [156]]) { x.fillStyle = '#0b0d12'; x.beginPath(); x.arc(cx2, 56, 17, Math.PI, 0); x.fill(); x.fillRect(cx2 - 17, 56, 34, 15); }
      x.clearRect(0, 67, W, 4);
      for (const cx2 of [41, 156]) x.clearRect(cx2 - 17, 56, 34, 15);
      for (const cx2 of [41, 156]) { x.fillStyle = '#0b0d12'; x.beginPath(); x.arc(cx2, 56, 17, Math.PI, 0); x.fill(); }
    }
    // --- strati dei potenziamenti
    if (!L.clean && !this.v40Ready) for (let i = 0; i < 260; i++) {                                             // sporco su fiancate e passaruota
      const xx = 4 + Street2D.rnd(i) * 192, yy = 52 + Street2D.rnd(i + 7) * 13;
      if (Math.abs(xx - 41) < 17 && yy > 50 && Math.hypot(xx - 41, yy - 56) < 17) continue;
      if (Math.abs(xx - 156) < 17 && Math.hypot(xx - 156, yy - 56) < 17) continue;
      px(Street2D.rnd(i + 3) < 0.5 ? 'rgba(92,74,48,.75)' : 'rgba(60,52,40,.6)', xx, yy, 1, 1);
    } else { for (let q = 0; q < 3; q++) px('rgba(255,255,255,.35)', 60 + q * 40, 31 - q, 18, 1); }   // lucidatura
    if (L.kit) {
      px(ink, 58, 62, 82, 4); px(sh(-0.1), 59, 62, 80, 3);                                     // minigonne
      px(ink, 176, 64, 24, 3); px('#1a1d24', 177, 64, 22, 2);                                 // labbro anteriore
      px(ink, 0, 64, 18, 3); for (let q = 2; q < 16; q += 3) px('#3a4048', q, 64, 1, 2);       // diffusore
      px(sh(0.05), 180, 52, 20, 10); px(ink, 184, 57, 14, 4);                                  // paraurti in tinta con presa
    }
    if (L.spoiler) { const sy = this.v40Ready ? 2 : 6; px(ink, 0, sy, 20, 5); px(sh(0.05), 1, sy + 1, 18, 3); px(sh(0.35), 1, sy + 1, 18, 1); px(ink, 15, sy + 4, 3, 3); }
    if (L.turbo) {                                                                             // intercooler nel paraurti e sigla
      px(ink, 182, 57, 16, 6); px('#9aa3b2', 183, 58, 14, 4); for (let q = 183; q < 197; q += 2) px('#5a6070', q, 58, 1, 4);
      this.text(x, L.turbo2 ? 'T5' : 'T4', 6, 36, ink, 2); this.text(x, L.turbo2 ? 'T5' : 'T4', 5, 35, '#d8dde6', 2);
      if (L.turbo2) { this.text(x, 'TURBO', 61, 37, ink, 2); this.text(x, 'TURBO', 60, 36, '#e8ecf2', 2); px('#c41a1a', 60, 47, 38, 2); }
    }
    const ey = this.v40Ready ? 52 : 63;
    if (L.exhaust) { px(ink, 2, ey, 12, 5); px('#c9ced6', 3, ey + 1, 10, 3); px('#f4f1e6', 4, ey + 1, 7, 1); px('#2a2d34', 3, ey + 2, 2, 2); }
    else { px('#2a2d34', 5, ey + 1, 5, 2); }
    return (this.spr[key] = c);
  }
  v40Sprite(k) {
    const key = 'v40s' + k + (this.carKey || '') + (this.v40Ready ? 'i' : '');
    if (this.spr[key]) return this.spr[key];
    const b = this.v40Base(), c = document.createElement('canvas'); c.width = Math.ceil(200 * k); c.height = Math.ceil(71 * k);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(b, 0, 0, c.width, c.height);
    c.geo = { w: 200, ax: [41, 156] }; c.img = true;
    return (this.spr[key] = c);
  }
  // ruote della V40: copricerchi di serie (come nell'illustrazione) o cerchi in lega a cinque razze con freno dietro
  v40Wheel(g, cx, cy, k, ang, speed, rear) {
    const R = 14.4 * k, L = this.v40Look || {};
    g.save(); g.translate(Math.round(cx), Math.round(cy));
    g.fillStyle = '#0b0c10'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1c1e24'; g.beginPath(); g.arc(0, 0, R * 0.9, 0, Math.PI * 2); g.fill();
    if (L.alloys) {
      this.brake(g, 0, 0, k * (L.low ? 1.02 : 0.98), ang, rear); g.translate(0, 0);
      g.save(); const blur = speed > 9; g.rotate(blur ? ang : Math.round(ang / (Math.PI / 20)) * (Math.PI / 20));
      g.strokeStyle = '#c9ced6'; g.lineWidth = Math.max(1, 1.2 * k); g.beginPath(); g.arc(0, 0, R * 0.7, 0, Math.PI * 2); g.stroke();
      for (let q = 0; q < 5; q++) { g.save(); g.rotate(q * Math.PI * 2 / 5); g.globalAlpha = blur ? 0.55 : 1; g.fillStyle = '#c9ced6'; g.fillRect(-1.3 * k, -R * 0.68, 2.6 * k, R * 0.48); g.fillStyle = '#eef2f6'; g.fillRect(-1.3 * k, -R * 0.68, 0.9 * k, R * 0.48); g.restore(); }
      g.fillStyle = '#8a909c'; g.beginPath(); g.arc(0, 0, R * 0.2, 0, Math.PI * 2); g.fill(); g.restore();
    } else {
      g.rotate(speed > 9 ? ang : Math.round(ang / (Math.PI / 16)) * (Math.PI / 16));
      g.fillStyle = '#b8bec6'; g.beginPath(); g.arc(0, 0, R * 0.74, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d8dde3'; g.beginPath(); g.arc(-R * 0.08, -R * 0.08, R * 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = speed > 9 ? 'rgba(40,44,52,.4)' : '#2a2e36';
      for (let q = 0; q < 10; q++) { const a = q * Math.PI / 5; g.fillRect(Math.round(Math.cos(a) * R * 0.55 - k * 0.8), Math.round(Math.sin(a) * R * 0.55 - k * 0.8), Math.max(1, Math.round(1.7 * k)), Math.max(1, Math.round(1.7 * k))); }
      g.fillStyle = '#8a909c'; g.beginPath(); g.arc(0, 0, R * 0.18, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // carrozzeria ricolorata: i pixel rosso vernice prendono il colore scelto mantenendo luci e ombre
  supraBase(hex) {
    if (this.paintBase[hex]) return this.paintBase[hex];
    const c = document.createElement('canvas'); c.width = 200; c.height = 58; const x = c.getContext('2d');
    x.drawImage(this.sImg, 0, 0);
    const cos = this.cos || {}, stripe = cos.stripe && cos.stripe !== 'none' ? parseInt(cos.stripe.slice(1), 16) : null;
    {
      const d = x.getImageData(0, 0, 200, 58), p = d.data, P = parseInt(hex.slice(1), 16), R = P >> 16, G = (P >> 8) & 255, B = P & 255;
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], g = p[i + 1], b = p[i + 2], px = (i / 4) % 200, py = Math.floor(i / 800);
        if (p[i + 3] && r > 70 && r > g * 2.2 && r > b * 2.2) {
          const k = r / 205;
          // striscia lungo la fiancata, solo sulla vernice
          if (stripe !== null && ((py >= 30 && py <= 31) || (py >= 33 && py <= 33)) && px > 10 && px < 190) { p[i] = Math.min(255, (stripe >> 16) * k * 1.05); p[i + 1] = Math.min(255, ((stripe >> 8) & 255) * k * 1.05); p[i + 2] = Math.min(255, (stripe & 255) * k * 1.05); }
          else if (hex && hex.toLowerCase() !== '#c81d11') { p[i] = Math.min(255, R * k); p[i + 1] = Math.min(255, G * k); p[i + 2] = Math.min(255, B * k); }
          // lucidatura: due strisce diagonali di riflesso, filo di luce sulla spalla, ombra sotto le porte
          const diag = (px + py * 1.7) % 90, lift = py < 38 && diag < 10 ? 0.2 * (1 - Math.abs(diag - 5) / 5) : 0;
          const shoulder = (py === 27 || py === 28) && px > 62 && px < 168 ? 0.2 : 0, under = py > 45 ? -0.22 : py > 42 ? -0.1 : 0;
          const f = lift + shoulder + under;
          if (f) for (let q = 0; q < 3; q++) p[i + q] = f > 0 ? p[i + q] + (255 - p[i + q]) * f : p[i + q] * (1 + f);
        } else if (p[i + 3] && py < 20 && px > 56 && px < 132 && Math.abs(r - b) < 40 && r < 150 && g < 150 && cos.tint !== 'dark' && (px - py * 1.4) % 26 < 2.5) {
          for (let q = 0; q < 3; q++) p[i + q] = p[i + q] + (255 - p[i + q]) * 0.22;                 // riflesso sul vetro
        } else if (cos.tint === 'dark' && p[i + 3] && py < 20 && px > 56 && px < 132 && Math.abs(r - b) < 40 && r < 150 && g < 150) {
          const k = (r + g + b) / 3 > 110 ? 0.55 : 0.32; p[i] = r * k; p[i + 1] = g * k; p[i + 2] = b * k * 1.1;
        }
      }
      x.putImageData(d, 0, 0);
    }
    if (cos.decal && cos.decal !== 'none') {
      const w = this.textW(cos.decal), cx = 100 - Math.round(w / 2) + 4;
      this.text(x, cos.decal, cx + 1, 25, 'rgba(0,0,0,.45)'); this.text(x, cos.decal, cx, 24, hex === '#f2f2ee' ? '#14161c' : '#f4f1e6');
    }
    return (this.paintBase[hex] = c);
  }
  supraSprite(hex, k) {
    const key = 'img' + hex + k;
    if (this.spr[key]) return this.spr[key];
    const c = document.createElement('canvas'); c.width = Math.ceil(200 * k); c.height = Math.ceil(58 * k);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(this.supraBase(hex), 0, 0, c.width, c.height);
    c.geo = Street2D.GEO.supra; c.img = true;
    return (this.spr[key] = c);
  }
  // ruota dell'illustrazione che gira; la pinza rossa resta ferma sopra
  rims() {
    const col = this.cos && this.cos.rims && this.cos.rims !== 'none' ? this.cos.rims : null;
    if (this.rimImg && this.rimImg.col === col) return this.rimImg;
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d'); x.drawImage(this.wImg, 0, 0);
    const d = x.getImageData(0, 0, 32, 32), p = d.data, n = col ? parseInt(col.slice(1), 16) : 0, R = n >> 16, G = (n >> 8) & 255, B = n & 255;
    for (let i = 0; i < p.length; i += 4) {
      const px = (i / 4) % 32 - 15.5, py = Math.floor(i / 128) - 15.5, rr = Math.hypot(px, py), r = p[i], gg = p[i + 1], b = p[i + 2], l = (r + gg + b) / 3;
      if (!p[i + 3]) continue;
      if (rr < 10.2 && rr > 2.6 && (l < 52 || (l < 92 && rr > 3.6 && rr < 9.6))) { p[i + 3] = 0; continue; }                   // vuoto tra le razze: dietro c'è il freno
      if (col && rr < 11.5 && l > 70 && Math.max(r, gg, b) - Math.min(r, gg, b) < 45) { const k = Math.min(1.4, l / 150); p[i] = Math.min(255, R * k + 18); p[i + 1] = Math.min(255, G * k + 18); p[i + 2] = Math.min(255, B * k + 18); }
    }
    x.putImageData(d, 0, 0); c.col = col;
    return (this.rimImg = c);
  }
  // freno dietro il cerchio: disco forato che gira con la ruota (rovente se si frena forte) e pinza ferma
  brake(g, cx, cy, k, ang, rear) {
    const R = 9.6 * k, hot = this.brakeHot || 0;
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#3c4049'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5c616c'; g.beginPath(); g.arc(0, 0, R * 0.92, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7c828e'; g.beginPath(); g.arc(0, 0, R * 0.92, Math.PI * 1.1, Math.PI * 1.6); g.lineTo(0, 0); g.fill();
    g.fillStyle = '#2a2d34';
    for (let q = 0; q < 10; q++) { const a = ang + q * Math.PI / 5; g.fillRect(Math.round(Math.cos(a) * R * 0.68 - k * 0.6), Math.round(Math.sin(a) * R * 0.68 - k * 0.6), Math.max(1, Math.round(k * 1.2)), Math.max(1, Math.round(k * 1.2))); }
    if (hot > 0.02) { g.fillStyle = `rgba(255,${110 - hot * 50 | 0},30,${Math.min(0.75, hot)})`; g.beginPath(); g.arc(0, 0, R * 0.93, 0, Math.PI * 2); g.arc(0, 0, R * 0.42, 0, Math.PI * 2, true); g.fill(); }
    g.fillStyle = '#1a1c22'; g.beginPath(); g.arc(0, 0, R * 0.4, 0, Math.PI * 2); g.fill();
    // pinza: settore curvo fermo in alto, dalla parte interna della ruota
    const col = this.cos && this.cos.caliper && this.cos.caliper !== 'none' ? this.cos.caliper : this.carId === 'v40' ? '#d0141e' : '#d9a82e';
    const mid = rear ? -Math.PI * 0.72 : -Math.PI * 0.28, span = 0.95, r0 = R * 0.42, r1 = R * 1.02;
    const sector = (ra, rb, a0, a1) => { g.beginPath(); g.arc(0, 0, rb, a0, a1); g.arc(0, 0, ra, a1, a0, true); g.closePath(); };
    g.fillStyle = this.C.ink; sector(r0 - k * 0.8, r1 + k * 0.8, mid - span / 2 - 0.08, mid + span / 2 + 0.08); g.fill();
    g.fillStyle = Street2D.shade(col, -0.35); sector(r0, r1, mid - span / 2, mid + span / 2); g.fill();
    g.fillStyle = col; sector(r0 + k * 0.6, r1 - k * 0.8, mid - span / 2 + 0.05, mid + span / 2 - 0.05); g.fill();
    g.fillStyle = Street2D.shade(col, 0.55); sector(r1 - k * 1.8, r1 - k * 0.8, mid - span / 2 + 0.1, mid + span / 2 - 0.1); g.fill();
    g.fillStyle = Street2D.shade(col, -0.5); g.fillRect(Math.round(Math.cos(mid) * R * 0.8 - k), Math.round(Math.sin(mid) * R * 0.8 - k * 0.5), Math.max(1, Math.round(2 * k)), Math.max(1, Math.round(k)));
    g.restore();
  }
  supraWheel(g, cx, cy, k, ang, speed = 0, rear = false) {
    const s = 32 * k, wi = this.rims();
    this.brake(g, Math.round(cx), Math.round(cy), k, ang, rear);
    g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(cx), Math.round(cy));
    if (speed > 9) {                      // in velocità i raggi si sfocano in un disco (niente effetto ruota che gira all'indietro)
      const n = 4, a0 = ang;
      for (let i = 0; i < n; i++) { g.save(); g.globalAlpha = i ? 0.35 : 1; g.rotate(a0 + i * Math.PI / 10); g.drawImage(wi, -s / 2, -s / 2, s, s); g.restore(); }
    } else { g.rotate(Math.round(ang / (Math.PI / 20)) * (Math.PI / 20)); g.drawImage(wi, -s / 2, -s / 2, s, s); }
    g.restore();
  }

  otherSprite(kind, color, k) {
    const hex = kind === 'police' ? '#163a8c' : '#' + (color || 0x777777).toString(16).padStart(6, '0');
    return this.vehicle(kind === 'rival' ? 'coupe' : kind === 'police' ? 'police' : 'sedan', hex, k);
  }

  vehicle(type, P, k) {
    const key = type + P + k + (type === 'supra' && this.dual ? 'd' : '');
    if (this.spr[key]) return this.spr[key];
    const geo = Street2D.GEO[type === 'police' ? 'sedan' : type];
    const D = Street2D.shade(P, -0.38), DD = Street2D.shade(P, -0.62), L = Street2D.shade(P, 0.3), LL = Street2D.shade(P, 0.6);
    const ink = this.C.ink;
    const c = this.sprite(Math.ceil(geo.w * k), Math.ceil(57 * k), (x) => {
      const px = (col, xx, yy, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(Math.round(xx * k), Math.round(yy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
      const fillPath = (d, col) => { x.save(); x.scale(k, k); x.fillStyle = col; x.fill(new Path2D(d)); x.restore(); };
      const shadeBody = (d) => {
        x.save(); x.scale(k, k); const b = new Path2D(d); x.fillStyle = P; x.fill(b); x.clip(b);
        const gr = x.createLinearGradient(0, 20, 0, 54); gr.addColorStop(0, P); gr.addColorStop(0.55, P); gr.addColorStop(0.56, D); gr.addColorStop(1, DD);
        x.fillStyle = gr; x.fillRect(0, 20, 210, 36); x.restore();
      };
      const arches = () => { x.save(); x.scale(k, k); x.fillStyle = ink; for (const ax of geo.ax) { x.beginPath(); x.arc(ax, 42, 18, Math.PI * 1.02, -0.02); x.lineTo(ax + 18, 46); x.lineTo(ax - 18, 46); x.fill(); } x.restore(); };
      if (type === 'supra' || type === 'coupe') {
        // JZA80: muso basso e lungo, abitacolo arretrato, lunotto inclinato, coda tonda
        const body = 'M8 53 L3 45 Q1 36 4 31 Q7 27 16 26 L46 24 Q68 11 96 9 L114 9 Q126 11 140 23 L172 28 Q190 31 196 37 L197 46 Q196 52 188 53 Z';
        shadeBody(body);
        fillPath('M56 23 Q74 13 96 12 L112 12 Q121 14 132 23 Z', '#0d1a33');
        fillPath('M58 34 L74 31.5 L74 37.5 L60 38.5 Z', '#0e1220');                                     // presa d'aria laterale
        if (type === 'supra') {
          fillPath('M-1 12.5 L37 11.5 L37 16 L-1 17 Z', D);                                              // alettone ad arco
          fillPath('M6 16 L10 16 L12 27 L8 27 Z', D); fillPath('M26 15.5 L30 15.5 L31 25 L27 25 Z', D);
        } else fillPath('M2 26 L16 24.5 L16 27 L2 28 Z', D);                                             // piccolo labbro
        arches();
        // riflessi: tetto, lunotto, cofano, linea di cintura
        px(LL, 96, 9, 18, 1); px(L, 90, 10, 6, 1); for (let n = 0; n < 26; n++) px(LL, 142 + n, 23 + Math.floor(n / 5), 1, 1);
        px(L, 18, 26, 26, 1); px(L, 12, 31, 168, 1); px(DD, 12, 32, 168, 1); px(LL, 120, 31, 30, 1);
        px('#1b2b4a', 100, 12, 3, 11);
        for (let n = 0; n < 11; n++) px('#6fd8ff', 64 + n, 21 - Math.floor(n * 0.7), 1, 1);
        for (let n = 0; n < 7; n++) px('#3c7fb0', 120 + n, 15 + Math.floor(n * 0.9), 1, 1);
        px('#14161e', 56, 23, 76, 1);
        // portiera, maniglia, presa, specchietto
        px(DD, 82, 24, 1, 23); px(DD, 134, 24, 1, 22); px(DD, 82, 46, 52, 1);
        px(LL, 90, 34, 7, 1); px(DD, 90, 35, 7, 1);
        px('#2a2f40', 61, 34, 12, 1); px('#2a2f40', 61, 36, 12, 1);
        px(D, 133, 19, 7, 4); px(DD, 135, 23, 2, 2); px(L, 134, 19, 4, 1);
        px(DD, 20, 30, 5, 5); px(D, 21, 31, 3, 3);                                                       // sportello benzina
        // luci
        px('#3a0805', 1, 31, 5, 7); px('#a3150c', 2, 32, 3, 5); px('#ff5a45', 2, 32, 1, 2);
        px('#ff9a00', 176, 38, 5, 2); px('#c9b98a', 182, 31, 11, 3); px('#fff7d6', 184, 31, 7, 2); px('#ffffff', 186, 31, 2, 1);
        // paraurti, presa, labbro, minigonna, diffusore, scarico
        px('#14161e', 188, 41, 9, 4); px('#2a2d38', 189, 42, 7, 1); px('#14161e', 172, 52, 24, 2);
        px('#14161e', 66, 51, 74, 2); px(DD, 66, 50, 74, 1);
        px('#14161e', 4, 49, 18, 4); for (let n = 0; n < 4; n++) px('#4a5070', 7 + n * 4, 50, 1, 3);
        if (type === 'supra') {
          px('#d6dbe4', 0, 46, 6, 5); px('#8a93a6', 0, 49, 6, 2); px('#14161e', 1, 47, 3, 3);
          if (this.dual) { px('#d6dbe4', 14, 47, 5, 4); px('#14161e', 15, 48, 3, 2); }
          px(L, 0, 12, 36, 1); px(DD, 0, 16, 36, 1);
          if (k > 0.6) { this.text(x, '2JZ', Math.round(100 * k), Math.round(38 * k), LL); this.text(x, 'TURBO', Math.round(146 * k), Math.round(35 * k), Street2D.shade(P, 0.15)); }
        }
      } else {
        // berlina generica a tre volumi
        const body = 'M6 53 L3 40 Q4 31 14 30 L46 29 L62 12 L128 12 L146 29 L178 31 Q188 33 189 41 L188 50 Q187 53 182 53 Z';
        shadeBody(body);
        fillPath('M66 28 L77 15 L104 15 L104 28 Z M108 28 L108 15 L126 15 L140 28 Z', '#0d1a33');
        if (type === 'police') {
          fillPath('M44 31 L148 31 L148 44 L44 44 Z', '#eef2ff');
          fillPath('M82 6 L110 6 L110 12 L82 12 Z', '#2a2f45');
        }
        arches();
        px(LL, 64, 12, 64, 1); px(L, 16, 30, 28, 1); px(L, 148, 30, 28, 1);
        px(L, 12, 33, 170, 1); px(DD, 12, 34, 170, 1);
        for (let n = 0; n < 8; n++) px('#6fd8ff', 70 + n, 25 - n, 1, 1);
        px(DD, 106, 15, 1, 32); px(LL, 88, 37, 7, 1); px(LL, 120, 37, 7, 1);
        px('#3a0805', 2, 32, 5, 7); px('#a3150c', 3, 33, 3, 5);
        px('#c9b98a', 180, 34, 8, 4); px('#fff7d6', 181, 34, 6, 2); px('#ff9a00', 172, 42, 4, 2);
        px('#14161e', 4, 49, 14, 4); px('#14161e', 176, 49, 12, 4); px('#14161e', 60, 51, 72, 2);
        if (type === 'police') { if (k > 0.55) this.text(x, 'POLIZIA', Math.round(68 * k), Math.round(34 * k), '#163a8c', Math.max(1, Math.round(k * 1.4))); px('#c42a1a', 44, 30, 104, 1); px('#163a8c', 44, 44, 104, 1); }
      }
    });
    c.geo = geo; c.k = k;
    this.spr[key] = c;
    return c;
  }

  setPaint(hex) { if (hex && hex !== 'model') this.paintHex = hex; }
  // ricambi estetici: neon, cerchi, strisce, vetri, adesivo (si rigenerano gli sprite)
  setCosmetics(c) {
    const k = JSON.stringify(c || {}); if (k === this.cosKey) return;
    this.cosKey = k; this.cos = Object.assign({}, c); this.spr = {}; this.paintBase = {}; this.rimImg = null;
  }
  setTips(n) { this.dual = n > 1; }
  setRain(on) { this.rainOn = on; }
  setDaylight(d, ss) { this.day = d; this.sunset = ss; }
  resetCamera() {}
  raceCam() {}

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.LW = Math.round(this.LH * w / h);
    this.lo.width = this.LW; this.lo.height = this.LH;
    this.skyCache = null;
  }

  laneY(z) { return z > 5 ? 226 : 320 - (3.5 - z) / 3.5 * 40; }
  laneS(y) { return 0.72 + (y - 226) / 94 * 0.28; }

  // ---------------------------------------------------------------- ruote (cerchi a doppia razza, disco forato, pinza)
  wheel(g, cx, cy, r, ang, speed) {
    cx = Math.round(cx); cy = Math.round(cy);
    const blur = speed > 14, rim = r - 6;
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const q = x * x + y * y;
      if (q > (r + 1.2) * (r + 1.2)) continue;
      let col;
      if (q > r * r) col = this.C.ink;
      else if (q > (r - 1.5) ** 2) col = '#2a2d38';
      else if (q > (rim + 1) ** 2) col = (y < 0 && x < 0 && q > (r - 3) ** 2) ? '#363a47' : '#15171e';
      else if (q > rim * rim) col = '#eef3fa';
      else if (q > (rim - 1.5) ** 2) col = '#9aa3b2';
      else if (q > (rim * 0.62) ** 2) col = blur ? '#7d8698' : '#3a404e';                   // disco
      else col = blur ? '#8a93a6' : '#4b5262';
      g.fillStyle = col; g.fillRect(cx + x, cy + y, 1, 1);
    }
    if (!blur) for (let k = 0; k < 10; k++) {                                                // fori del disco
      const a = k * Math.PI / 5 + ang * 0.0; g.fillStyle = '#20242e';
      g.fillRect(Math.round(cx + Math.cos(a + ang) * rim * 0.78), Math.round(cy + Math.sin(a + ang) * rim * 0.78), 1, 1);
    }
    g.fillStyle = '#c42a1a'; g.fillRect(cx - Math.round(rim * 0.85), cy - Math.round(rim * 0.55), 4, 7);          // pinza
    g.fillStyle = '#ff6a50'; g.fillRect(cx - Math.round(rim * 0.85), cy - Math.round(rim * 0.55), 1, 6);
    if (blur) {
      g.fillStyle = 'rgba(220,228,240,.55)';
      for (let a = 0; a < Math.PI * 2; a += 0.18) g.fillRect(Math.round(cx + Math.cos(a) * (rim - 2)), Math.round(cy + Math.sin(a) * (rim - 2)), 1, 1);
    } else for (let k = 0; k < 5; k++) {
      for (const off of [-0.13, 0.13]) {
        const a = ang + k * Math.PI * 2 / 5 + off;
        for (let t = 3; t < rim - 0.5; t += 0.5) {
          g.fillStyle = off < 0 ? '#e1e7f0' : '#9aa3b2';
          g.fillRect(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), 1, 1);
        }
      }
    }
    g.fillStyle = this.C.ink; g.fillRect(cx - 3, cy - 3, 7, 7);
    g.fillStyle = '#c9d0dc'; g.fillRect(cx - 2, cy - 2, 5, 5); g.fillStyle = '#c42a1a'; g.fillRect(cx - 1, cy - 1, 3, 3);
    if (!blur) for (let k = 0; k < 5; k++) { const a = ang + k * Math.PI * 2 / 5 + Math.PI / 5; g.fillStyle = '#f4f7fb'; g.fillRect(Math.round(cx + Math.cos(a) * 4.5), Math.round(cy + Math.sin(a) * 4.5), 1, 1); }
  }

  // ---------------------------------------------------------------- cielo (in cache), nuvole, aereo
  drawSky(g, t, dist) {
    const W = this.LW, b = this.C.sky;
    if (!this.skyCache || this.skyCache.width !== W) {
      const c = document.createElement('canvas'); c.width = W; c.height = 224; const x = c.getContext('2d');
      const bh = 224 / b.length;
      for (let i = 0; i < b.length; i++) { x.fillStyle = b[i]; x.fillRect(0, Math.floor(i * bh), W, Math.ceil(bh)); }
      for (let i = 0; i < b.length - 1; i++) for (let y = 0; y < 6; y++) for (let xx = 0; xx < W; xx++) if (Street2D.bayer(xx, y) < (y + 1) / 7) { x.fillStyle = b[i + 1]; x.fillRect(xx, Math.floor((i + 1) * bh) - 6 + y, 1, 1); }
      const mx = W - 90, my = 48;
      x.save(); x.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(90,70,140,.12)'; this.span(x, mx, my, 44 - k * 6, 44 - k * 6); }
      x.restore();
      for (let y = -23; y <= 23; y++) for (let xx = -23; xx <= 23; xx++) {
        const q = xx * xx + y * y; if (q > 530) continue;
        const crater = (xx + 8) ** 2 + (y + 6) ** 2 < 36 || (xx - 8) ** 2 + (y - 10) ** 2 < 18 || (xx - 10) ** 2 + (y + 11) ** 2 < 10 || (xx + 3) ** 2 + (y - 14) ** 2 < 8;
        x.fillStyle = q > 480 ? this.C.ink : crater ? '#e2cf9e' : xx + y > 16 ? '#ecdab0' : xx + y < -20 ? '#fffaf0' : this.C.moon;
        x.fillRect(mx + xx, my + y, 1, 1);
      }
      this.skyCache = c;
    }
    g.drawImage(this.skyCache, 0, 0);
    // pioggia: nuvole basse e cupe coprono luna e stelle
    if (this.rainOn) {
      g.fillStyle = '#1a1c2c'; g.fillRect(0, 0, W, 224);
      for (let i = 0; i < 18; i++) { const cx = ((i * 97 + t * 4) % (W + 160)) - 80, cy = 30 + (i % 5) * 26; g.fillStyle = i % 2 ? '#22253a' : '#262a40'; this.span(g, cx, cy, 70 + (i % 3) * 20, 16 + (i % 4) * 4); }
    }
    for (let i = 0; i < (this.rainOn ? 0 : 150); i++) {
      const x = Math.floor(Street2D.rnd(i) * W), y = Math.floor(Street2D.rnd(i + 50) * 160);
      const tw = Math.sin(t * (2 + Street2D.rnd(i + 9) * 3) + i) > 0.55;
      g.fillStyle = tw ? '#ffffff' : '#7f88d8'; g.fillRect(x, y, 1, 1);
      if (tw && i % 11 === 0) { g.fillStyle = '#c9d0ff'; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); }
    }
    if (!this.spr.clouds) {
      this.spr.clouds = [0, 1, 2].map((k) => this.sprite(96 + k * 22, 26, (x) => {
        x.fillStyle = '#332e6a';
        for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(12 + i * (13 + k * 3), 15 - Math.sin(i * 1.7 + k) * 5, 9 + Street2D.rnd(i + k * 7) * 4, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = '#4c4590'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(14 + i * (13 + k * 3), 9 - Math.sin(i * 1.7 + k) * 4, 5, Math.PI, 0); x.fill(); }
      }, false));
    }
    this.spr.clouds.forEach((c, k) => {
      const span = W + 240, x = ((-(t * (3 + k * 2)) - dist * 0.04 + k * 311) % span + span) % span - 120;
      g.drawImage(c, Math.round(x), 30 + k * 26);
    });
    const ax = ((t * 12) % (W + 80)) - 40, ay = 22 + Math.sin(t * 0.2) * 3;
    g.fillStyle = '#2a2850'; g.fillRect(Math.round(ax), Math.round(ay), 8, 2); g.fillRect(Math.round(ax) + 3, Math.round(ay) - 2, 2, 6);
    if (Math.floor(t * 2) % 2) { g.fillStyle = '#ff3b3b'; g.fillRect(Math.round(ax) + 3, Math.round(ay) - 2, 1, 1); } else { g.fillStyle = '#ffffff'; g.fillRect(Math.round(ax) + 7, Math.round(ay), 1, 1); }
    const night = 1 - (this.day || 0);
    if (night < 0.2) return;
    // fari pubblicitari della città che spazzano il cielo (due coni lenti, viola e ciano)
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 2; q++) {
      const bx = ((q ? W * 0.72 : W * 0.18) - dist * 0.03 % W + W) % W, a = -Math.PI / 2 + Math.sin(t * (0.23 + q * 0.07) + q * 2) * 0.55;
      const len = 260, wdt = 0.06, col = q ? '120,230,255' : '190,130,255';
      const gr = g.createLinearGradient(bx, 200, bx + Math.cos(a) * len, 200 + Math.sin(a) * len);
      gr.addColorStop(0, `rgba(${col},${0.12 * night})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx, 200);
      g.lineTo(bx + Math.cos(a - wdt) * len, 200 + Math.sin(a - wdt) * len); g.lineTo(bx + Math.cos(a + wdt) * len, 200 + Math.sin(a + wdt) * len); g.closePath(); g.fill();
    }
    g.restore();
    // elicottero col faro di ricerca, ogni tanto
    const hp = (t % 46) / 46;
    if (hp < 0.55) {
      const hx = W + 40 - hp / 0.55 * (W + 80), hy = 62 + Math.sin(t * 0.7) * 6, rot = Math.floor(t * 30) % 2;
      g.save(); g.globalCompositeOperation = 'lighter';
      const sa = Math.PI / 2 + Math.sin(t * 0.9) * 0.35, gr = g.createLinearGradient(hx, hy, hx + Math.cos(sa) * 170, hy + Math.sin(sa) * 170);
      gr.addColorStop(0, `rgba(255,250,220,${0.16 * night})`); gr.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(hx, hy + 2); g.lineTo(hx + Math.cos(sa - 0.09) * 170, hy + Math.sin(sa - 0.09) * 170); g.lineTo(hx + Math.cos(sa + 0.09) * 170, hy + Math.sin(sa + 0.09) * 170); g.closePath(); g.fill();
      g.restore();
      g.fillStyle = '#14122a'; g.fillRect(Math.round(hx) - 5, Math.round(hy) - 2, 10, 5); g.fillRect(Math.round(hx) + 4, Math.round(hy) - 1, 9, 2); g.fillRect(Math.round(hx) + 12, Math.round(hy) - 3, 1, 4);
      g.fillRect(Math.round(hx) - (rot ? 9 : 6), Math.round(hy) - 4, rot ? 18 : 12, 1);
      g.fillStyle = Math.floor(t * 3) % 2 ? '#ff3b3b' : '#3bff7a'; g.fillRect(Math.round(hx) + 12, Math.round(hy) - 3, 1, 1);
    }
    // stella cadente rara
    const sp = (t % 13) / 13;
    if (!this.rainOn && sp < 0.06) {
      const k = sp / 0.06, sx = W * (0.2 + Street2D.rnd(Math.floor(t / 13)) * 0.6), sy = 20 + Street2D.rnd(Math.floor(t / 13) + 3) * 50;
      for (let q = 0; q < 14; q++) { g.fillStyle = `rgba(255,255,255,${(1 - q / 14) * (1 - k)})`; g.fillRect(Math.round(sx + k * 90 - q * 2), Math.round(sy + k * 30 - q * 0.66), 2, 1); }
    }
  }

  // treno sopraelevato sullo sfondo: viadotto con piloni e un convoglio illuminato che passa ogni tanto
  drawTrain(g, dist, t) {
    const W = this.LW, C = this.C, y = 150, off = dist * 0.12;
    g.fillStyle = '#141236'; g.fillRect(0, y, W, 5); g.fillStyle = '#2a2560'; g.fillRect(0, y, W, 1);
    for (let x = -((off % 64) + 64) % 64; x < W; x += 64) { g.fillStyle = '#141236'; g.fillRect(Math.round(x), y + 5, 5, 66); g.fillStyle = '#1c1946'; g.fillRect(Math.round(x), y + 5, 1, 66); }
    for (let x = -((off % 32) + 32) % 32; x < W; x += 32) { g.fillStyle = '#1c1946'; g.fillRect(Math.round(x), y - 12, 1, 12); g.fillRect(Math.round(x) - 3, y - 12, 7, 1); }   // pali della linea aerea
    g.fillStyle = '#221f50'; g.fillRect(0, y - 11, W, 1);
    const per = 34, ph = (t % per) / per;
    if (ph > 0.45) return;
    const dir = Math.floor(t / per) % 2 ? 1 : -1, n = 6, cw = 44, len = n * (cw + 2), k = ph / 0.45;
    const x0 = dir > 0 ? -len + k * (W + len * 2) - len * 0.5 : W + len * 0.5 - k * (W + len * 2);
    for (let c = 0; c < n; c++) {
      const cx = Math.round(x0 + c * (cw + 2));
      if (cx > W || cx + cw < 0) continue;
      g.fillStyle = C.ink; g.fillRect(cx - 1, y - 11, cw + 2, 11);
      g.fillStyle = '#b8c0d0'; g.fillRect(cx, y - 10, cw, 9); g.fillStyle = '#2b8a4e'; g.fillRect(cx, y - 4, cw, 2);
      for (let w2 = 3; w2 < cw - 4; w2 += 6) { g.fillStyle = Street2D.rnd(c * 9 + w2) < 0.85 ? '#ffe6a3' : '#4a4f66'; g.fillRect(cx + w2, y - 9, 4, 3); }
      if ((c === 0 && dir < 0) || (c === n - 1 && dir > 0)) { g.fillStyle = '#fff6d0'; g.fillRect(dir < 0 ? cx : cx + cw - 2, y - 6, 2, 2); }
      this.light(g, cx + cw / 2, y - 6, cw * 0.7, 8, '#ffe6a3', 0.05, 2);
    }
    if (Math.floor(t * 9) % 7 === 0) { const sx = Math.round(x0 + len * 0.3); g.fillStyle = '#bfe8ff'; g.fillRect(sx, y - 13, 2, 2); this.light(g, sx, y - 12, 10, 8, '#7fe7ff', 0.2, 2); }   // scintilla del pantografo
  }

  // ---------------------------------------------------------------- palazzi (cache per tessera)
  building(layer, i) {
    const key = layer + ':' + i;
    let t = this.tiles.get(key);
    if (t) return t;
    const far = layer !== 'mid', haze = layer === 'haze';
    const r = (k) => Street2D.rnd(i * 13.7 + (haze ? 5 : far ? 1 : 77) + k);
    const w = haze ? 30 + Math.floor(r(1) * 40) : far ? 40 + Math.floor(r(1) * 36) : 50 + Math.floor(r(1) * 38);
    const h = haze ? 70 + Math.floor(r(2) * 80) : far ? 46 + Math.floor(r(2) * 70) : 64 + Math.floor(r(2) * 92);
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 26;
    const x = c.getContext('2d'), top = 25;
    const px = (col, xx, yy, ww = 1, hh = 1) => { x.fillStyle = col; x.fillRect(xx, yy, ww, hh); };
    const meta = { w: w + 2, h: h + 26, signs: [], beacons: [], shop: null };
    if (haze) {
      px('#2a2560', 0, top, w + 2, h);
      for (let yy = top + 6; yy < top + h; yy += 7) for (let xx = 4; xx < w - 2; xx += 6) if (r(xx + yy * 0.7) > 0.8) px('#4a4590', xx, yy, 2, 2);
      if (r(12) < 0.5) { px('#2a2560', Math.floor(w / 2), top - 14, 2, 14); meta.beacons.push({ x: Math.floor(w / 2), y: top - 15 }); }
      t = { c, ...meta }; this.tiles.set(key, t); return t;
    }
    if (!far) {
      // quartiere vario: condomini, case con tetto a falde, konbini, uffici di vetro, santuari, giardinetti,
      // magazzini, banchi di ramen, parcheggi a piani
      const q = r(20), kind = q < 0.3 ? 'apt' : q < 0.42 ? 'house' : q < 0.52 ? 'konbini' : q < 0.62 ? 'office' : q < 0.68 ? 'shrine' : q < 0.76 ? 'park' : q < 0.84 ? 'warehouse' : q < 0.92 ? 'ramen' : 'parking';
      if (kind !== 'apt') { t = this.buildingKind(kind, r); this.tiles.set(key, t); if (this.tiles.size > 260) this.tiles.delete(this.tiles.keys().next().value); return t; }
    }
    const base = far ? ['#171640', '#1c1a4a', '#141338', '#1e1844'][Math.floor(r(4) * 4)] : this.C.mid[Math.floor(r(4) * this.C.mid.length)];
    px(this.C.ink, 0, top - 1, w + 2, h + 1);
    if (far && r(30) < 0.35) {                                                                       // sagome lontane più varie: gradoni e guglie
      const sw2 = Math.floor(w * 0.5), sx2 = Math.floor((w - sw2) / 2);
      px(this.C.ink, sx2, top - 13, sw2 + 2, 13); px(base, sx2 + 1, top - 12, sw2, 12);
      if (r(31) < 0.5) { px(this.C.ink, Math.floor(w / 2), top - 30, 2, 18); meta.beacons.push({ x: Math.floor(w / 2), y: top - 31 }); }
    }
    px(base, 1, top, w, h);
    if (!far) {
      px(Street2D.shade(base, 0.16), 1, top, 4, h); px(Street2D.shade(base, 0.08), 5, top, 2, h); px(Street2D.shade(base, -0.3), w - 1, top, 2, h);
      for (let yy = top + 24; yy < top + h - 20; yy += 24) { px(Street2D.shade(base, 0.2), 1, yy, w, 2); px(Street2D.shade(base, -0.25), 1, yy + 2, w, 1); }
      px(Street2D.shade(base, 0.3), 1, top, w, 2);
      if (r(15) < 0.5) for (let yy = top + 6; yy < top + h - 20; yy++) if (yy % 3) px('#0e1220', w - 6, yy, 2, 1);   // tubo di scarico
    }
    // finestre
    const ww = far ? 4 : 6, wh = far ? 4 : 7, stepX = far ? 7 : 10, stepY = far ? 9 : 12, yEnd = top + h - (far ? 6 : 22);
    for (let yy = top + 6; yy < yEnd; yy += stepY) for (let xx = 6; xx < w - ww - 3; xx += stepX) {
      const q = r(xx * 0.31 + yy * 1.7);
      if (far) { if (q < 0.62) continue; px(q > 0.92 ? '#8a86d0' : q > 0.8 ? '#e0b86a' : '#4b468f', xx, yy, ww, wh - 1); continue; }
      px('#0b0f1c', xx - 1, yy - 1, ww + 2, wh + 2);
      if (q < 0.3) { px('#0d1426', xx, yy, ww, wh); px('#1a2440', xx, yy, 1, wh); continue; }
      const col = this.C.win[Math.floor(r(xx + yy) * this.C.win.length)];
      px(col, xx, yy, ww, wh);
      px(Street2D.shade(col, 0.4), xx, yy, ww, 1);
      const v = r(xx * 2.1 + yy);
      if (v < 0.2) { px(Street2D.shade(col, -0.45), xx, yy + 1, ww, 3); px(Street2D.shade(col, -0.25), xx, yy + 4, ww, 1); }   // tende
      else if (v < 0.3) { px('#1a1530', xx + 2, yy + 2, 2, 5); px('#1a1530', xx + 2, yy + 1, 2, 1); }                       // sagoma
      else if (v < 0.36) { px('#5d8cff', xx, yy, ww, wh); px('#a8c4ff', xx + 1, yy + 1, 2, 2); }                             // TV
      else if (v < 0.42) { px('#2b8a4e', xx + 1, yy + wh - 3, 2, 3); px('#3fb36a', xx + 3, yy + wh - 4, 2, 4); }              // piante
      px('#0b0f1c', xx + ww / 2, yy, 1, wh);
      if (r(xx + yy * 3.3) < 0.1) { px('#5a6070', xx, yy + wh + 1, 5, 3); px('#8a90a6', xx, yy + wh + 1, 5, 1); }           // condizionatore
      if (r(xx * 7 + yy) < 0.08) { px('#0b0f1c', xx - 2, yy + wh + 1, ww + 4, 1); for (let k = 0; k < ww + 4; k += 2) px('#0b0f1c', xx - 2 + k, yy + wh - 2, 1, 3); }   // balconcino
    }
    if (!far && r(11) < 0.3) for (let yy = top + 20; yy < top + h - 24; yy += 24) {               // scala antincendio
      px('#0b0f1c', w - 20, yy, 18, 2);
      for (let k = 0; k < 18; k += 3) px('#0b0f1c', w - 20 + k, yy - 5, 1, 5);
      for (let k = 0; k < 12; k++) px('#0b0f1c', w - 4 - k, yy + 2 + k * 2, 1, 2);
    }
    // tetto
    const roof = r(12);
    if (roof < 0.25 && !far) {                                                                     // cisterna
      px(this.C.ink, 8, top - 18, 18, 18); px('#6b4a2e', 9, top - 17, 16, 12); px('#8a6440', 9, top - 17, 16, 2);
      for (let k = 0; k < 16; k += 4) px('#5a3c26', 9 + k, top - 15, 1, 10);
      px(this.C.ink, 7, top - 20, 20, 3); px('#4a3020', 8, top - 19, 18, 1);
      px(this.C.ink, 10, top - 5, 2, 5); px(this.C.ink, 22, top - 5, 2, 5);
    } else if (roof < 0.5) { px(this.C.ink, 10, top - 22, 2, 22); px(this.C.ink, 5, top - 15, 12, 1); px(this.C.ink, 7, top - 10, 8, 1); meta.beacons.push({ x: 10, y: top - 24 }); }
    else if (roof < 0.62 && !far && w > 60) {                                                    // cartellone
      px(this.C.ink, 6, top - 23, w - 10, 20); px('#f2e9d0', 8, top - 21, w - 14, 16);
      px('#ff2e88', 12, top - 18, 16, 10); px('#ffd23f', 14, top - 16, 6, 6);
      px('#163a8c', 32, top - 18, w - 44, 2); px('#163a8c', 32, top - 14, w - 50, 2); px('#2ee6ff', 32, top - 10, w - 56, 2);
      px(this.C.ink, 12, top - 3, 2, 3); px(this.C.ink, w - 10, top - 3, 2, 3);
    } else if (far && roof < 0.7) meta.beacons.push({ x: Math.floor(w / 2), y: top - 1 });
    else if (!far) { px(this.C.ink, w - 24, top - 8, 16, 8); px('#5a6070', w - 23, top - 7, 14, 6); px('#8a90a6', w - 23, top - 7, 14, 1); }   // condizionatore grande
    // piano terra: negozio con vetrina, tenda a righe, graffiti o manifesti
    if (!far) {
      const gy = top + h - 18;
      px('#0b0f1c', 1, gy, w, 18);
      const lit = r(13) < 0.72, glass = lit ? ['#ffe6a3', '#cfefff', '#ffd0e8'][Math.floor(r(16) * 3)] : '#1b2a44';
      px(glass, 5, gy + 6, w - 18, 10);
      if (lit) {
        px(Street2D.shade(glass, -0.25), 5, gy + 12, w - 18, 4);
        for (let k = 8; k < w - 16; k += 7) { px(['#6b4a2e', '#2b8a6e', '#c42a1a', '#163a8c'][Math.floor(r(k) * 4)], k, gy + 9, 3, 3); }
        if (r(17) < 0.5) { px('#1a1530', 20, gy + 8, 3, 8); px('#1a1530', 20, gy + 7, 3, 1); px(this.C.skin, 20, gy + 6, 3, 2); }
        meta.shop = { x: 5 + (w - 18) / 2, w: w - 18, col: glass };
      }
      px('#2a1d12', w - 11, gy + 6, 7, 12); px('#4a3420', w - 10, gy + 7, 5, 10); px('#d9c08a', w - 6, gy + 12, 1, 1);
      const aw = [['#ff2e88', '#f2e9d0'], ['#2ee6ff', '#123049'], ['#b8ff3a', '#1b2a52'], ['#ffb000', '#2a1f4f'], ['#c42a1a', '#f2e9d0']][Math.floor(r(14) * 5)];
      for (let k = 1; k < w + 1; k++) px(Math.floor(k / 4) % 2 ? aw[0] : aw[1], k, gy, 1, 4);
      for (let k = 1; k < w + 1; k += 4) px(aw[0], k, gy + 4, 2, 2);
      px('rgba(0,0,0,.35)', 1, gy + 4, w, 1);
      if (!lit && r(18) < 0.6) {                                                                 // graffiti sulla saracinesca
        for (let k = 0; k < 3; k++) px(this.C.neon[Math.floor(r(19 + k) * 5)], 8 + k * 9, gy + 9 + (k % 2) * 2, 7, 3);
      }
    }
    if (!far && r(6) < 0.6) {                                                                     // insegna al neon
      const words = ['RAMEN', 'BAR', '24H', 'HOTEL', 'GARAGE', 'SUSHI', 'MOTEL', 'AUTO', 'DISCO', 'GOMME', 'PIZZA', 'CAFE', 'KARAOKE', 'TATTOO'];
      let word = words[Math.floor(r(7) * words.length)];
      const sc = this.textW(word, 2) <= w - 14 ? 2 : 1;
      while (this.textW(word, sc) > w - 10) word = word.slice(0, -1);
      meta.signs.push({ word, sc, x: Math.round((w + 2 - this.textW(word, sc)) / 2), y: top + 10 + Math.floor(r(8) * 18), col: this.C.neon[Math.floor(r(9) * this.C.neon.length)], flick: r(10) < 0.2 });
    }
    t = { c, ...meta };
    this.tiles.set(key, t);
    if (this.tiles.size > 260) this.tiles.delete(this.tiles.keys().next().value);
    return t;
  }

  // edifici del piano vicino, uno per tipo; la tessera ha il piano strada sul bordo basso
  buildingKind(kind, r) {
    const C = this.C, ink = C.ink;
    const dims = { house: [62, 50], konbini: [70, 50], office: [60, 128], shrine: [72, 62], park: [66, 40], warehouse: [68, 54], ramen: [56, 48], parking: [70, 74] }[kind];
    const w = dims[0] + Math.floor(r(1) * 6), h = dims[1] + Math.floor(r(2) * (kind === 'office' ? 30 : 10)), top = 30;
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + top + 1;
    const x = c.getContext('2d'), gy = top + h;                              // gy: livello del marciapiede
    const px = (col, xx, yy, ww = 1, hh = 1) => { x.fillStyle = col; x.fillRect(Math.round(xx), Math.round(yy), ww, hh); };
    const meta = { w: w + 2, h: h + top + 1, signs: [], beacons: [], shop: null, glows: [] };
    const win = (xx, yy, ww, hh, lit, col) => { px(ink, xx - 1, yy - 1, ww + 2, hh + 2); px(lit ? col : '#0d1426', xx, yy, ww, hh); if (lit) px(Street2D.shade(col, 0.35), xx, yy, ww, 1); };
    const tree = (cx, cy, rr, hue) => {
      px('#2a1d12', cx - 1, cy, 3, gy - cy);
      for (let dy = -rr; dy <= rr; dy++) { const ww = Math.round(Math.sqrt(rr * rr - dy * dy) * 2); px(dy < -rr / 3 ? Street2D.shade(hue, 0.25) : dy > rr / 3 ? Street2D.shade(hue, -0.3) : hue, cx - ww / 2, cy - rr + dy, ww, 1); }
      for (let k = 0; k < 6; k++) px(Street2D.shade(hue, 0.45), cx - rr / 2 + r(40 + k + cx) * rr, cy - rr * 1.6 + r(50 + k + cx) * rr, 2, 1);
    };
    const vending = (vx, col) => {
      px(ink, vx - 1, gy - 26, 13, 26); px('#d8dde6', vx, gy - 25, 11, 25); px(col, vx + 1, gy - 23, 9, 12);
      for (let k = 0; k < 3; k++) for (let q = 0; q < 3; q++) px(['#c42a1a', '#2b8a6e', '#ffd23f', '#163a8c'][(k + q) % 4], vx + 2 + q * 3, gy - 22 + k * 4, 2, 3);
      px('#1a1d2a', vx + 2, gy - 8, 7, 3);
      meta.glows.push({ x: vx + 5, y: gy - 16, r: 14, col, a: 0.12 });
    };
    if (kind === 'house') {
      const wall = ['#4a3f55', '#3d4a52', '#56473a', '#3f3550'][Math.floor(r(4) * 4)];
      px(ink, 0, top + 10, w + 2, h - 9); px(wall, 1, top + 11, w, h - 10);
      for (let yy = top + 13; yy < gy; yy += 4) px(Street2D.shade(wall, -0.12), 1, yy, w, 1);    // perlinato
      // tetto a falde di tegole scure
      for (let j = 0; j < 14; j++) { const ext = 4 - Math.round(j * 0.3), ww = w + 2 + ext * 2 - j * 2; px(j % 3 === 0 ? '#2a3352' : '#1b2236', Math.round((w + 2 - ww) / 2), top - 3 + j, ww, 1); }
      px(ink, -2, top + 10, w + 6, 2); px('#3a4468', 0, top - 4, w + 2, 1);
      // finestre di carta (shoji) al piano alto, porta scorrevole e finestra al piano terra
      const warm = r(5) < 0.75;
      for (const wx of [8, w - 26]) { win(wx, top + 16, 18, 11, warm, '#ffe6a3'); if (warm) { for (let k = 4; k < 18; k += 5) px('#c89a50', wx + k, top + 16, 1, 11); px('#c89a50', wx, top + 21, 18, 1); meta.glows.push({ x: wx + 9, y: top + 22, r: 12, col: '#ffcf7a', a: 0.06 }); } }
      px(ink, 7, gy - 22, 22, 22); px('#6b4a2e', 8, gy - 21, 20, 21); px('#ffe6a3', 10, gy - 19, 7, 12); px('#ffe6a3', 19, gy - 19, 7, 12);
      for (const k of [10, 19]) { px('#c89a50', k + 3, gy - 19, 1, 12); px('#c89a50', k, gy - 13, 7, 1); }
      win(w - 26, gy - 20, 16, 9, r(6) < 0.5, '#cfefff');
      px('#5a6070', w - 10, gy - 30, 8, 6); px('#8a90a6', w - 10, gy - 30, 8, 1);                // condizionatore
      // lanterna all'ingresso, cassetta della posta, siepe
      px(ink, 32, gy - 22, 5, 8); px('#ff5a3a', 33, gy - 21, 3, 6); meta.glows.push({ x: 34, y: gy - 18, r: 10, col: '#ff5a3a', a: 0.12 });
      px('#c42a1a', w - 32, gy - 12, 5, 4); px(ink, w - 31, gy - 8, 1, 8);
      for (let k = 1; k < w; k += 3) { px('#1f4a2e', k, gy - 6, 3, 6); px('#2f6a3e', k, gy - 6, 2, 2); }
      if (r(7) < 0.5) { px(ink, w - 20, gy - 9, 1, 9); px(ink, w - 14, gy - 9, 1, 9); x.strokeStyle = '#6a7090'; x.beginPath(); x.arc(w - 20, gy - 3, 3, 0, 7); x.arc(w - 12, gy - 3, 3, 0, 7); x.stroke(); }   // bicicletta
      meta.shop = { x: 18, w: 22, col: '#ffcf7a' };
    } else if (kind === 'konbini') {
      const brand = [['#2b8a4e', '#ffb000', 'MART'], ['#163a8c', '#2ee6ff', 'MINI'], ['#e2690f', '#c42a1a', '24 ORE']][Math.floor(r(4) * 3)];
      px(ink, 0, top + 6, w + 2, h - 5); px('#d8dde6', 1, top + 7, w, h - 6);
      px(brand[0], 1, top + 9, w, 4); px(brand[1], 1, top + 13, w, 2); px(brand[0], 1, top + 15, w, 4);
      const tw = this.textW(brand[2], 2); px(ink, (w - tw) / 2 - 3, top - 4, tw + 6, 15); px('#f4f1e6', (w - tw) / 2 - 2, top - 3, tw + 4, 13);
      this.text(x, brand[2], (w + 2 - tw) / 2, top, brand[0], 2);
      meta.glows.push({ x: w / 2, y: top + 3, r: 30, col: '#fff6e0', a: 0.07 });
      // vetrata illuminata con scaffali e un cliente
      px(ink, 4, gy - 24, w - 22, 24); px('#eaf6ff', 5, gy - 23, w - 24, 23);
      for (let s2 = 0; s2 < 3; s2++) { px('#9aa3b2', 7, gy - 20 + s2 * 7, w - 28, 1); for (let k = 8; k < w - 22; k += 4) px(['#c42a1a', '#2b8a6e', '#ffd23f', '#163a8c', '#ff2e88'][Math.floor(r(k + s2 * 9) * 5)], k, gy - 23 + s2 * 7, 2, 3); }
      px('#1a1530', 20 + r(8) * 20, gy - 15, 4, 15); px(C.skin, 20 + r(8) * 20, gy - 18, 4, 3);
      for (let k = 4; k < w - 18; k += 16) px('#b8c0d0', k, gy - 23, 1, 23);
      vending(w - 13, '#7fe7ff');
      meta.shop = { x: (w - 18) / 2, w: w - 22, col: '#eaf6ff' }; meta.glows.push({ x: (w - 18) / 2, y: gy - 10, r: 34, col: '#eaf6ff', a: 0.1 });
    } else if (kind === 'office') {
      const glass = ['#123049', '#163a4a', '#1b2a52'][Math.floor(r(4) * 3)];
      px(ink, 0, top - 1, w + 2, h + 1); px(glass, 1, top, w, h);
      for (let yy = top + 3; yy < gy - 14; yy += 6) {
        const litFloor = r(yy) < 0.35;
        for (let xx = 3; xx < w - 3; xx += 6) {
          const on = litFloor ? r(xx + yy * 1.3) < 0.8 : r(xx + yy * 1.3) < 0.12;
          px(on ? (litFloor ? '#bfe9ff' : '#ffe6a3') : Street2D.shade(glass, 0.18), xx, yy, 5, 4);
        }
        px(Street2D.shade(glass, -0.3), 1, yy + 4, w, 2);
      }
      for (let k = 0; k < h; k += 3) px('rgba(160,220,255,.12)', 1 + ((k * 3) % w), top + k, 6, 1);   // riflessi sul vetro
      px(ink, 0, top - 6, w + 2, 6); px(Street2D.shade(glass, 0.3), 1, top - 5, w, 4);
      const logo = ['NEO', 'KAI', 'ZEN', 'ORION'][Math.floor(r(9) * 4)];
      meta.signs.push({ word: logo, sc: 2, x: Math.round((w + 2 - this.textW(logo, 2)) / 2), y: top + 4, col: C.neon[Math.floor(r(10) * 5)], flick: false });
      px(ink, w / 2, top - 22, 2, 16); meta.beacons.push({ x: Math.floor(w / 2), y: top - 23 });
      px('#0b0f1c', 1, gy - 14, w, 14); px('#cfefff', 6, gy - 12, w - 12, 12); for (let k = 6; k < w - 6; k += 8) px('#7a86a0', k, gy - 12, 1, 12);
      meta.shop = { x: w / 2, w: w - 12, col: '#cfefff' };
    } else if (kind === 'shrine') {
      // alberi scuri dietro, santuario col tetto curvo, torii rosso, lanterne di pietra e di carta
      tree(10, gy - 30, 14, '#16351f'); tree(w - 10, gy - 34, 16, '#1a3d24'); tree(w / 2, gy - 44, 18, '#143020');
      const sx = w / 2 - 22;
      px(ink, sx, gy - 24, 44, 24); px('#5a2a1a', sx + 1, gy - 23, 42, 23); px('#ffcf7a', sx + 14, gy - 18, 16, 14);
      for (let k = 0; k < 9; k++) px(k < 2 ? '#2a3352' : '#1b2236', sx - 6 + k * 0.5, gy - 32 + k, 56 - k, 1);
      px(ink, sx - 8, gy - 33, 60, 2); px(ink, sx - 9, gy - 35, 3, 3); px(ink, sx + 50, gy - 35, 3, 3);
      meta.glows.push({ x: sx + 22, y: gy - 12, r: 16, col: '#ffcf7a', a: 0.1 });
      const tx = 6, tw2 = w - 10;
      px('#c42a1a', tx + 6, gy - 40, 4, 40); px('#c42a1a', tx + tw2 - 10, gy - 40, 4, 40);
      px(ink, tx, gy - 44, tw2, 4); px('#e0402a', tx + 1, gy - 43, tw2 - 2, 2); px('#c42a1a', tx + 4, gy - 36, tw2 - 8, 3);
      px(ink, tx + tw2 / 2 - 3, gy - 40, 6, 5); px('#d9c08a', tx + tw2 / 2 - 2, gy - 39, 4, 3);
      for (const lx of [16, w - 22]) { px('#7a7e8a', lx, gy - 12, 6, 12); px('#9aa0ae', lx - 2, gy - 14, 10, 2); px('#ffcf7a', lx + 2, gy - 10, 2, 3); }
      for (let k = 0; k < 4; k++) { const lx = sx + 4 + k * 11; px(ink, lx, gy - 22, 6, 7); px('#ff3a2a', lx + 1, gy - 21, 4, 5); meta.glows.push({ x: lx + 3, y: gy - 18, r: 8, col: '#ff3a2a', a: 0.12 }); }
    } else if (kind === 'park') {
      tree(14, gy - 26, 13, '#1f4a2e'); tree(w - 16, gy - 30, 15, '#235532'); if (w > 84) tree(w / 2, gy - 22, 10, '#1a4028');
      px('#3a3f58', 0, gy - 4, w + 2, 4); px('#5a6080', 0, gy - 4, w + 2, 1);                     // muretto
      px(ink, w / 2 - 9, gy - 9, 18, 2); px('#6b4a2e', w / 2 - 8, gy - 9, 16, 1); px(ink, w / 2 - 7, gy - 7, 1, 3); px(ink, w / 2 + 6, gy - 7, 1, 3);   // panchina
      px(ink, w / 2 + 22, gy - 34, 2, 34); px('#ffe2a8', w / 2 + 20, gy - 36, 6, 2); meta.glows.push({ x: w / 2 + 23, y: gy - 34, r: 18, col: '#ffcf7a', a: 0.1 }); meta.glows.push({ x: w / 2 + 23, y: gy - 2, r: 20, col: '#ffcf7a', a: 0.05, ry: 0.25 });
      vending(4, '#ff9ccf');
      if (r(11) < 0.5) { px('#c42a1a', w - 30, gy - 10, 6, 6); px('#d9c08a', w - 29, gy - 9, 4, 1); }   // altalena / gioco
    } else if (kind === 'warehouse') {
      const tin = ['#3a4258', '#4a3f38', '#33473f'][Math.floor(r(4) * 3)];
      px(ink, 0, top + 2, w + 2, h - 1); px(tin, 1, top + 3, w, h - 2);
      for (let k = 2; k < w; k += 3) px(Street2D.shade(tin, -0.2), k, top + 3, 1, h - 2);           // lamiera ondulata
      for (let j = 0; j < 6; j++) px(Street2D.shade(tin, 0.15), 1 + j * 2, top + 2 - j, w - j * 4, 1);
      const dw = Math.floor(w * 0.55), dx = 6;
      px(ink, dx - 1, gy - 32, dw + 2, 32); px('#5a6070', dx, gy - 31, dw, 31);
      for (let yy = gy - 28; yy < gy; yy += 4) px('#454b5a', dx, yy, dw, 1);
      for (let k = 0; k < dw; k += 6) { px('#ffd23f', dx + k, gy - 35, 3, 3); px(ink, dx + k + 3, gy - 35, 3, 3); }
      const n = String(Math.floor(r(12) * 40) + 1).padStart(2, '0'); this.text(x, n, dx + dw / 2 - 8, gy - 26, '#f4f1e6', 2);
      win(w - 22, top + 14, 14, 9, r(13) < 0.5, '#ffd36b');
      px(ink, w - 18, gy - 34, 8, 3); px('#fff6d8', w - 17, gy - 32, 6, 1); meta.glows.push({ x: w - 14, y: gy - 30, r: 22, col: '#fff2c4', a: 0.08 });
      if (r(14) < 0.6) for (let k = 0; k < 3; k++) px(C.neon[Math.floor(r(15 + k) * 5)], dx + 6 + k * 14, gy - 16 + (k % 2) * 3, 12, 3);   // graffiti
    } else if (kind === 'ramen') {
      px(ink, 0, top + 4, w + 2, h - 3); px('#5a3a22', 1, top + 5, w, h - 4);
      for (let yy = top + 7; yy < gy; yy += 5) px('#4a2e1a', 1, yy, w, 1);
      for (let j = 0; j < 8; j++) px(j % 2 ? '#2a3352' : '#1b2236', -2 + j * 0.5, top - 4 + j, w + 6 - j, 1);   // tettoia
      px(ink, 6, top + 9, w - 10, 12); px('#e8d8b0', 7, top + 10, w - 12, 10);
      const word = w > 60 ? 'RAMEN' : 'SOBA'; this.text(x, word, (w + 2 - this.textW(word, 2)) / 2, top + 11, '#c42a1a', 2);
      // tende noren davanti alla porta, luce calda dietro
      px('#ffcf7a', 6, gy - 26, w - 10, 26);
      for (let k = 0; k < 4; k++) { const nx = 6 + k * ((w - 10) / 4); px(ink, nx, gy - 26, (w - 10) / 4 - 1, 15); px('#1a2a52', nx + 1, gy - 26, (w - 10) / 4 - 3, 14); px('#f4f1e6', nx + (w - 10) / 8 - 2, gy - 22, 3, 3); }
      meta.glows.push({ x: w / 2, y: gy - 8, r: 26, col: '#ffcf7a', a: 0.12 });
      for (const lx of [2, w - 6]) { px(ink, lx, top + 22, 7, 11); px('#ff3a2a', lx + 1, top + 23, 5, 9); px('#ffd0a0', lx + 2, top + 26, 3, 1); meta.glows.push({ x: lx + 3, y: top + 27, r: 11, col: '#ff3a2a', a: 0.14 }); }
      meta.shop = { x: w / 2, w: w - 10, col: '#ffcf7a' }; meta.steam = true;
    } else {                                                                                   // parcheggio a piani
      px(ink, 0, top - 1, w + 2, h + 1); px('#4a4e5c', 1, top, w, h);
      for (let lv = 0; lv < 4; lv++) {
        const yy = top + 4 + lv * 17; if (yy + 12 > gy) break;
        px('#151826', 3, yy, w - 4, 11); px('#ffd23f', 3, yy + 10, w - 4, 1);
        for (let k = 0; k < 4; k++) if (r(lv * 7 + k) < 0.6) { const cx2 = 6 + k * ((w - 10) / 4); px(['#c42a1a', '#e8e6df', '#2b4c7e', '#8a8f96', '#1d1f22'][Math.floor(r(lv + k * 3) * 5)], cx2, yy + 5, 14, 4); px('#0b0f1c', cx2 + 2, yy + 9, 3, 2); px('#0b0f1c', cx2 + 10, yy + 9, 3, 2); }
        meta.glows.push({ x: w / 2, y: yy + 2, r: 30, col: '#dfeaff', a: 0.04, ry: 0.15 });
      }
      px(ink, w - 16, top - 14, 14, 14); px('#163a8c', w - 15, top - 13, 12, 12); this.text(x, 'P', w - 12, top - 11, '#f4f1e6', 2);
      meta.glows.push({ x: w - 9, y: top - 7, r: 12, col: '#4f7bff', a: 0.12 });
    }
    return { c, ...meta };
  }

  drawCity(g, dist, t, layer, speed, baseY, tileW) {
    const off = dist * speed;
    const i0 = Math.floor(off / tileW) - 2, i1 = i0 + Math.ceil(this.LW / tileW) + 4;
    const shops = [];
    for (let i = i0; i < i1; i++) {
      const b = this.building(layer, i), x = Math.round(i * tileW - off + Street2D.rnd(i * 3.1 + speed) * 10), y = baseY - b.h + 1;
      if (x > this.LW || x + b.w < 0) continue;
      g.drawImage(b.c, x, y);
      for (const s of b.signs) {
        const on = !s.flick || Math.sin(t * 13 + i) > -0.6 || Math.sin(t * 2.3 + i) > 0.3;
        const w = this.textW(s.word, s.sc), hh = 5 * s.sc;
        if (on) this.light(g, x + s.x + w / 2, y + s.y + hh / 2, w / 2 + 10, hh / 2 + 8, s.col, 0.06, 3);
        g.fillStyle = this.C.ink; g.fillRect(x + s.x - 4, y + s.y - 4, w + 8, hh + 8);
        g.fillStyle = on ? Street2D.shade(s.col, -0.75) : '#141826'; g.fillRect(x + s.x - 3, y + s.y - 3, w + 6, hh + 6);
        g.fillStyle = on ? Street2D.shade(s.col, -0.4) : '#1c2232'; g.fillRect(x + s.x - 3, y + s.y - 3, w + 6, 1);
        this.text(g, s.word, x + s.x, y + s.y, on ? s.col : '#3a3f58', s.sc);
        if (on) this.text(g, s.word, x + s.x, y + s.y, 'rgba(255,255,255,.35)', s.sc);
      }
      for (const bc of b.beacons) if (Math.floor(t * 1.5 + i) % 2) { g.fillStyle = '#ff3b3b'; g.fillRect(x + bc.x, y + bc.y, 2, 2); this.light(g, x + bc.x + 1, y + bc.y + 1, 5, 5, '#ff3b3b', 0.12, 2); }
      if (b.glows) for (const gl of b.glows) this.light(g, x + gl.x, y + gl.y, gl.r, gl.r * (gl.ry || 0.7), gl.col, gl.a || 0.09, 3);
      if (b.shop) shops.push({ x: x + b.shop.x, w: b.shop.w, col: b.shop.col });
    }
    return shops;
  }

  // ---------------------------------------------------------------- asfalto (tessera in cache)
  roadTile() {
    if (this.spr.road) return this.spr.road;
    const c = document.createElement('canvas'); c.width = 256; c.height = 104; const x = c.getContext('2d');
    x.fillStyle = this.C.road; x.fillRect(0, 0, 256, 104);
    for (let i = 0; i < 1600; i++) { x.fillStyle = Street2D.rnd(i) > 0.5 ? this.C.road2 : this.C.road3; x.fillRect(Math.floor(Street2D.rnd(i + 1) * 256), Math.floor(Street2D.rnd(i + 2) * 104), 1, 1); }
    x.fillStyle = '#1e2234'; x.fillRect(140, 60, 52, 18); x.fillStyle = this.C.road2; x.fillRect(140, 60, 52, 1); x.fillRect(140, 60, 1, 18);
    x.fillStyle = '#141727';
    const crack = (cx, cy, n, s0) => { for (let k = 0; k < n; k++) { x.fillRect(cx, cy, 1, 1); cx += 1; cy += Street2D.rnd(k + s0) > 0.55 ? 1 : Street2D.rnd(k + s0 + 9) > 0.7 ? -1 : 0; if (Street2D.rnd(k + s0 + 3) > 0.9) x.fillRect(cx, cy + 1, 1, 2); } };
    crack(30, 16, 34, 40); crack(200, 88, 26, 60); crack(90, 70, 18, 80);
    x.fillStyle = 'rgba(80,100,160,.08)'; x.fillRect(0, 0, 256, 4);
    this.spr.road = c;
    return c;
  }

  // ---------------------------------------------------------------- oggetti del marciapiede vicino (base y)
  prop(g, kind, x, base, t) {
    const px = (col, xx, yy, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x + xx), Math.round(base + yy), w, h); };
    const ink = this.C.ink;
    if (kind === 0) {                                                       // idrante
      px(ink, -6, -22, 13, 22); px('#c42a1a', -5, -21, 11, 21); px('#ff5a45', -5, -21, 2, 19); px('#8a1a10', 4, -21, 2, 21);
      px(ink, -9, -15, 19, 4); px('#c42a1a', -8, -14, 17, 2); px('#e8e4d6', -3, -25, 7, 3); px(ink, -3, -26, 7, 1); px('#ffd23f', -1, -11, 3, 3);
    } else if (kind === 1) {                                                // paletto
      px(ink, -4, -24, 9, 24); px('#8a90a6', -3, -23, 7, 23); px('#c9ced6', -3, -23, 2, 23); px('#ffb000', -3, -18, 7, 4); px(ink, -3, -18, 7, 1);
    } else if (kind === 2) {                                                // cestino con sacchi
      px(ink, -8, -24, 17, 24); px('#1f6b4a', -7, -23, 15, 23); px('#2b8a6e', -7, -23, 3, 23); px(ink, -9, -25, 19, 2);
      for (let k = -18; k < 0; k += 6) px('#0f3d2a', -7, k, 15, 1);
      px(ink, 9, -10, 12, 10); px('#14161e', 10, -9, 10, 9); px('#2a2d38', 11, -8, 3, 2);
    } else if (kind === 3) {                                                // parchimetro
      px(ink, -1, -28, 3, 28); px(ink, -5, -38, 11, 12); px('#c9ced6', -4, -37, 9, 10); px('#2ee6ff', -3, -35, 7, 3); px('#14161e', -2, -30, 5, 2);
    } else if (kind === 4) {                                                // distributore di giornali
      px(ink, -9, -24, 19, 24); px('#1d4fa8', -8, -23, 17, 23); px('#e8e4d6', -6, -18, 13, 7); this.text(g, 'NEWS', Math.round(x - 6), Math.round(base - 17), '#163a8c'); px('#5d8cff', -8, -23, 2, 23);
    } else if (kind === 5) {                                                // cartello di divieto
      px(ink, -1, -46, 3, 46); px(ink, -8, -54, 17, 17); px('#c42a1a', -7, -53, 15, 15); px('#1d4fa8', -5, -51, 11, 11); px('#c42a1a', -5, -46, 11, 2);
    } else {                                                                // gatto seduto (scodinzola)
      const tail = Math.sin(t * 4 + x) > 0 ? 1 : 0;
      px(ink, -5, -14, 11, 14); px('#2a2433', -4, -13, 9, 13); px(ink, -4, -18, 9, 6); px('#2a2433', -3, -17, 7, 4);
      px(ink, -4, -20, 2, 2); px(ink, 3, -20, 2, 2); px('#b8ff3a', -2, -15, 1, 1); px('#b8ff3a', 2, -15, 1, 1);
      px(ink, 5 + tail, -6, 2, 6); px(ink, 6 + tail, -9, 2, 4);
    }
  }

  // ---------------------------------------------------------------- scritte da fumetto
  comic(text, x, y, col, size = 3, burst = null) {
    if (this.comics.length > 6) this.comics.shift();
    this.comics.push({ text, x, y, col, size, burst, t: 0, life: 1.0, j: Math.random() * 6 });
  }
  drawComics(g, dt) {
    const ink = this.C.ink;
    for (const c of this.comics) {
      c.t += dt;
      const pop = c.t < 0.1 ? 0.5 + c.t / 0.1 * 0.8 : Math.max(1, 1.3 - (c.t - 0.1) * 1.5);
      const sz = Math.max(1, Math.round(c.size * pop)), w = this.textW(c.text, sz), hh = 5 * sz;
      const cx = Math.round(c.x + Math.sin(c.t * 30 + c.j) * (c.t < 0.3 ? 2 : 0.5)), cy = Math.round(c.y - c.t * 18);
      g.save(); g.globalAlpha = c.t > c.life - 0.2 ? Math.max(0, (c.life - c.t) / 0.2) : 1;
      if (c.burst) {                                                         // stella dello scoppio
        const R1 = w * 0.62 + 8, R2 = R1 * 0.62, n = 12;
        const star = (r1, r2, col) => {
          g.fillStyle = col; g.beginPath();
          for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n + c.j, r = i % 2 ? r2 : r1; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62); }
          g.closePath(); g.fill();
        };
        star(R1 + 3, R2 + 3, ink); star(R1, R2, c.burst); star(R1 * 0.6, R2 * 0.6, '#fff6c2');
      }
      const x0 = cx - Math.round(w / 2), y0 = cy - Math.round(hh / 2);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [2, 2]]) this.text(g, c.text, x0 + ox * Math.max(1, sz >> 1), y0 + oy * Math.max(1, sz >> 1), ink, sz);
      this.text(g, c.text, x0, y0, c.col, sz);
      this.text(g, c.text, x0, y0, 'rgba(255,255,255,.35)', sz);
      g.restore();
    }
    this.comics = this.comics.filter((c) => c.t < c.life);
  }

  // ---------------------------------------------------------------- aggiornamento
  drawStation(g, x) {
    const C = this.C;
    this.light(g, x, 232, 130, 16, '#e8f0ff', 0.08, 4);
    g.fillStyle = C.ink; g.fillRect(x - 120, 150, 244, 16); g.fillStyle = '#e8ecf5'; g.fillRect(x - 119, 151, 242, 13);
    g.fillStyle = '#2ee6ff'; g.fillRect(x - 119, 162, 242, 2); g.fillStyle = '#b8c0d0'; g.fillRect(x - 119, 151, 242, 2);
    this.text(g, 'BENZINA 24H', x - 43, 153, '#163a8c', 2);
    for (let k = -110; k < 110; k += 22) { g.fillStyle = '#fff6e0'; g.fillRect(x + k, 165, 10, 2); }
    for (const p of [-104, 96]) { g.fillStyle = C.ink; g.fillRect(x + p - 2, 166, 8, 50); g.fillStyle = '#9aa3b2'; g.fillRect(x + p, 166, 4, 50); g.fillStyle = '#c9ced6'; g.fillRect(x + p, 166, 1, 50); }
    for (const p of [-44, 24]) {
      g.fillStyle = C.ink; g.fillRect(x + p - 2, 184, 20, 32); g.fillStyle = '#b8ff3a'; g.fillRect(x + p, 186, 16, 28); g.fillStyle = '#7ab82a'; g.fillRect(x + p + 12, 186, 4, 28);
      g.fillStyle = '#0b0f16'; g.fillRect(x + p + 2, 190, 10, 6); this.text(g, '88', x + p + 3, 191, '#b8ff3a');
      g.fillStyle = C.ink; g.fillRect(x + p + 16, 196, 4, 2); g.fillRect(x + p + 18, 198, 2, 12); g.fillRect(x + p + 14, 208, 6, 3);
    }
    g.fillStyle = C.ink; g.fillRect(x - 170, 108, 44, 62); g.fillStyle = '#0b0f16'; g.fillRect(x - 168, 110, 40, 58);
    this.text(g, 'BENZ', x - 164, 114, '#2ee6ff', 2); this.text(g, '1,95', x - 164, 132, '#b8ff3a', 2); this.text(g, 'GPL', x - 164, 150, '#ffb000', 2);
    this.light(g, x - 148, 139, 30, 36, '#2ee6ff', 0.04, 2);
    g.fillStyle = C.ink; g.fillRect(x - 151, 170, 6, 46);
  }

  // ---------------------------------------------------------------- luoghi in cui entrare
  // facciate sul lato dei negozi (dietro il marciapiede lontano); la porta si apre quando la Supra è vicina
  drawPlace(g, e, x, st, game, dist) {
    const C = this.C, I = game && game.inside, mine = I && Math.abs(I.x - e.x) < 1;
    const near = Math.abs(e.x - dist) < 45;
    st.doors = st.doors || {}; const key = e.id + Math.round(e.x);
    const want = mine || (near && game && game.nearPlace() && Math.abs(game.sim.v) < 9) ? 1 : 0;
    st.doors[key] = (st.doors[key] || 0) + (want - (st.doors[key] || 0)) * 0.08;
    const open = st.doors[key];
    if (e.id === 'fuel') { this.drawStation(g, x); this.placeTag(g, x, 96, 'BENZINA', '#2ee6ff', near); return; }
    const L = x - 132, R = x + 132, top = 104;
    // passo carrabile sul marciapiede
    g.fillStyle = '#23263a'; g.fillRect(x - 56, 216, 112, 16); g.fillStyle = '#4a5070'; g.fillRect(x - 56, 216, 112, 1);
    for (let k = -50; k < 50; k += 10) { g.fillStyle = '#2f3450'; g.fillRect(x + k, 224, 6, 1); }
    if (e.id === 'shop') {
      g.fillStyle = C.ink; g.fillRect(L - 2, top - 2, R - L + 4, 216 - top + 2);
      g.fillStyle = '#2b2f3e'; g.fillRect(L, top, R - L, 216 - top);
      for (let yy = top + 6; yy < 216; yy += 6) { g.fillStyle = '#252836'; g.fillRect(L, yy, R - L, 1); for (let xx = L + ((yy / 6) % 2 ? 0 : 6); xx < R; xx += 12) g.fillRect(xx, yy - 6, 1, 6); }   // mattoni
      // insegna sul tetto
      g.fillStyle = C.ink; g.fillRect(x - 78, top - 26, 156, 22); g.fillStyle = '#16120a'; g.fillRect(x - 76, top - 24, 152, 18);
      this.text(g, 'OFFICINA 2JZ', x - 47, top - 20, '#ffb000', 2);
      this.light(g, x, top - 15, 90, 16, '#ffb000', 0.07, 3);
      // portone sezionale
      const dL = x - 50, dW = 100, dT = 140, dH = 216 - dT, oh = Math.round(dH * open);
      g.fillStyle = C.ink; g.fillRect(dL - 3, dT - 3, dW + 6, dH + 3);
      const gr = g.createLinearGradient(0, dT, 0, 216); gr.addColorStop(0, '#d8e4f0'); gr.addColorStop(1, '#7c8696');
      g.fillStyle = gr; g.fillRect(dL, dT, dW, dH);                                                            // interno illuminato
      g.fillStyle = '#ffd23f'; g.fillRect(dL + 14, dT + 20, 4, dH - 20); g.fillRect(dL + dW - 18, dT + 20, 4, dH - 20);   // colonne del ponte
      g.fillStyle = '#596273'; g.fillRect(dL + 30, dT + 12, 40, 4);
      g.fillStyle = '#5a6070'; g.fillRect(dL, dT, dW, dH - oh);
      for (let yy = dT + 5; yy < dT + dH - oh; yy += 6) { g.fillStyle = '#454b5a'; g.fillRect(dL, yy, dW, 1); }
      if (oh > 2) this.light(g, x, 214, 90, 10, '#e8f0ff', 0.12 * open, 3);
      // vetrina laterale: gomme e cartello
      g.fillStyle = C.ink; g.fillRect(L + 10, 150, 54, 44); g.fillStyle = '#0d1018'; g.fillRect(L + 12, 152, 50, 40);
      for (let q = 0; q < 3; q++) { g.fillStyle = '#121216'; this.span(g, L + 37, 186 - q * 10, 18, 5); g.fillStyle = '#2a2a30'; this.span(g, L + 37, 186 - q * 10, 9, 2); }
      this.text(g, 'GOMME', L + 18, 155, '#ffb000');
      g.fillStyle = C.ink; g.fillRect(R - 62, 150, 52, 44); g.fillStyle = '#0d1018'; g.fillRect(R - 60, 152, 48, 40);
      this.text(g, 'TUNING', R - 56, 156, '#2ee6ff'); this.text(g, 'MOTORI', R - 56, 166, '#2ee6ff'); this.text(g, 'FRENI', R - 56, 176, '#2ee6ff');
      this.light(g, R - 36, 172, 30, 22, '#2ee6ff', 0.05, 2);
      // pila di gomme fuori
      for (let q = 0; q < 4; q++) { g.fillStyle = C.ink; g.fillRect(R + 4, 204 - q * 7, 22, 7); g.fillStyle = '#1b1b20'; g.fillRect(R + 5, 205 - q * 7, 20, 5); }
      this.placeTag(g, x, top - 40, 'OFFICINA', '#ffb000', near);
    } else {
      g.fillStyle = C.ink; g.fillRect(L - 2, top - 2, R - L + 4, 216 - top + 2);
      g.fillStyle = '#1d1530'; g.fillRect(L, top, R - L, 216 - top);
      const ph = Math.floor(st.t * 2) % 2;
      // insegna al neon
      this.light(g, x, top + 12, 120, 22, '#ff2e88', 0.09, 3);
      g.fillStyle = C.ink; g.fillRect(x - 70, top + 2, 140, 22);
      this.text(g, 'NEON', x - 64, top + 6, '#ff2e88', 3); this.text(g, 'KUSTOM', x - 8, top + 6, ph ? '#2ee6ff' : '#9af6ff', 2);
      this.text(g, 'CERCHI - VERNICI - NEON', x - 46, top + 18, '#f4f1e6');
      // vetrina con i cerchi
      const vL = L + 8, vT = 136;
      g.fillStyle = '#ff2e88'; g.fillRect(vL - 2, vT - 2, 104, 64); g.fillStyle = '#0a0612'; g.fillRect(vL, vT, 100, 60);
      const rimCols = ['#d9a82e', '#1c1d22', '#c9ced6', '#ff2e88'];
      for (let q = 0; q < 4; q++) { const cx = vL + 14 + q * 24, cy = vT + 22 + (q % 2) * 16; g.fillStyle = '#08080a'; this.span(g, cx, cy, 10, 10); g.fillStyle = rimCols[q]; this.span(g, cx, cy, 6, 6); g.fillStyle = '#08080a'; this.span(g, cx, cy, 2, 2); }
      this.light(g, vL + 50, vT + 30, 60, 30, '#ff2e88', 0.06, 2);
      // ingresso con cornice al neon
      const dL = x + 4, dW = 104, dT = 132, dH = 216 - dT, oh = Math.round(dH * open);
      g.fillStyle = ph ? '#2ee6ff' : '#1aa8c0'; g.fillRect(dL - 3, dT - 3, dW + 6, dH + 3);
      g.fillStyle = '#120b20'; g.fillRect(dL, dT, dW, dH);
      for (let q = 0; q < 8; q++) { g.fillStyle = q % 2 ? '#2a1d44' : '#0e0a18'; g.fillRect(dL + q * 13, 200, 13, 16); }    // pavimento a scacchi
      this.light(g, dL + dW / 2, 190, 50, 22, '#b07bff', 0.12, 3);
      g.fillStyle = '#2a2140'; g.fillRect(dL, dT, dW, dH - oh);
      for (let yy = dT + 5; yy < dT + dH - oh; yy += 6) { g.fillStyle = '#1d1630'; g.fillRect(dL, yy, dW, 1); }
      this.light(g, dL + dW / 2, 214, 80, 9, '#2ee6ff', 0.1, 3);
      this.placeTag(g, x, top - 16, 'ESTETICA', '#ff2e88', near);
    }
  }
  // cartello che pulsa quando il luogo è a portata
  placeTag(g, x, y, label, col, near) {
    if (!near) return;
    const w = this.textW(label, 1) + 10, b = Math.floor(this.st.t * 3) % 2 ? 0 : 2;
    g.fillStyle = this.C.ink; g.fillRect(Math.round(x - w / 2) - 1, y - 1 - b, w + 2, 11);
    g.fillStyle = col; g.fillRect(Math.round(x - w / 2), y - b, w, 9);
    this.text(g, label, Math.round(x - w / 2) + 5, y + 2 - b, this.C.ink);
    g.fillStyle = col; g.fillRect(Math.round(x) - 2, y + 9 - b, 5, 2); g.fillRect(Math.round(x) - 1, y + 11 - b, 3, 2);
  }

  // interni: officina, distributore, carrozzeria estetica; la Supra al centro con vernice e ricambi montati
  drawInterior(g, game, s, dt) {
    const W = this.LW, C = this.C, I = game.inside, st = this.st, t = st.t;
    const K = 1.3, cx = Math.round(W * (this.inFrac || 0.4)), gy = 300;
    let lift = 0;
    if (I.id === 'shop') {
      g.fillStyle = '#1e212c'; g.fillRect(0, 0, W, 360);
      for (let xx = 0; xx < W; xx += 48) { g.fillStyle = '#252937'; g.fillRect(xx, 40, 46, 200); g.fillStyle = '#181a24'; g.fillRect(xx + 46, 40, 2, 200); }
      // neon e tubi fluorescenti
      for (let xx = 30; xx < W; xx += 110) { g.fillStyle = C.ink; g.fillRect(xx, 18, 70, 6); g.fillStyle = '#eef6ff'; g.fillRect(xx + 2, 19, 66, 3); this.light(g, xx + 35, 24, 90, 40, '#dfeaff', 0.06, 3); }
      g.fillStyle = C.ink; g.fillRect(W - 230, 54, 200, 30); this.text(g, 'OFFICINA 2JZ', W - 218, 60, '#ffb000', 3); this.light(g, W - 130, 70, 120, 30, '#ffb000', 0.07, 3);
      // pannello forato con attrezzi
      g.fillStyle = '#3b3326'; g.fillRect(24, 70, 150, 90);
      for (let yy = 76; yy < 156; yy += 8) for (let xx = 30; xx < 170; xx += 8) { g.fillStyle = '#2a2419'; g.fillRect(xx, yy, 1, 1); }
      const tools = [[40, 82, 4, 30, '#c9ced6'], [52, 80, 6, 24, '#d0141e'], [66, 84, 3, 34, '#c9ced6'], [80, 80, 18, 6, '#ffb000'], [104, 86, 4, 28, '#c9ced6'], [116, 82, 10, 10, '#2e6bff'], [136, 80, 4, 36, '#c9ced6'], [148, 86, 14, 6, '#d0141e']];
      for (const [x1, y1, w1, h1, c1] of tools) { g.fillStyle = C.ink; g.fillRect(x1 - 1, y1 - 1, w1 + 2, h1 + 2); g.fillStyle = c1; g.fillRect(x1, y1, w1, h1); }
      // pavimento
      g.fillStyle = '#3a3f4a'; g.fillRect(0, 240, W, 120); g.fillStyle = '#444a57'; for (let xx = 0; xx < W; xx += 64) g.fillRect(xx, 240, 1, 120);
      g.fillStyle = '#ffd23f'; g.fillRect(0, 300, W, 2);
      g.fillStyle = 'rgba(10,10,14,.35)'; this.span(g, cx + 140, 330, 26, 4); this.span(g, cx - 160, 320, 18, 3);   // macchie d'olio
      // ponte sollevatore
      lift = 8 + Math.round(Math.sin(Math.min(1, I.t / 1.2) * Math.PI / 2) * 10);
      for (const px of [cx - 146, cx + 138]) { g.fillStyle = C.ink; g.fillRect(px - 1, 150, 10, gy - 150 + 2); g.fillStyle = '#ffd23f'; g.fillRect(px, 151, 8, gy - 151); g.fillStyle = '#d9a800'; g.fillRect(px + 6, 151, 2, gy - 151); }
      g.fillStyle = '#596273'; g.fillRect(cx - 138, gy - lift - 2, 276, 3);
      // carrello rosso e gomme
      g.fillStyle = C.ink; g.fillRect(W - 120, 236, 64, 66); g.fillStyle = '#c0141c'; g.fillRect(W - 118, 238, 60, 62);
      for (let q = 0; q < 5; q++) { g.fillStyle = '#8a0e14'; g.fillRect(W - 116, 244 + q * 11, 56, 2); g.fillStyle = '#c9ced6'; g.fillRect(W - 92, 248 + q * 11, 10, 2); }
      for (let q = 0; q < 4; q++) { g.fillStyle = C.ink; g.fillRect(W - 44, 278 - q * 8, 30, 8); g.fillStyle = '#1b1b20'; g.fillRect(W - 43, 279 - q * 8, 28, 6); }
    } else if (I.id === 'style') {
      g.fillStyle = '#0d0818'; g.fillRect(0, 0, W, 360);
      const ph = Math.floor(t * 2) % 2;
      for (let yy = 30; yy < 230; yy += 50) { g.fillStyle = yy % 100 ? '#ff2e88' : '#2ee6ff'; g.fillRect(0, yy, W, 2); this.light(g, W / 2, yy, W * 0.6, 8, yy % 100 ? '#ff2e88' : '#2ee6ff', 0.05, 2); }
      g.fillStyle = C.ink; g.fillRect(W - 250, 46, 220, 36); this.text(g, 'NEON', W - 238, 54, '#ff2e88', 4); this.text(g, 'KUSTOM', W - 166, 58, ph ? '#2ee6ff' : '#9af6ff', 3);
      // espositore di cerchi
      const rc = ['#d9a82e', '#1c1d22', '#9a6a3a', '#ff2e88', '#c9ced6'];
      for (let q = 0; q < 5; q++) { const rx = 40 + q * 44, ry = 120 + (q % 2) * 26; g.fillStyle = '#050407'; this.span(g, rx, ry, 18, 18); g.fillStyle = rc[q]; this.span(g, rx, ry, 11, 11); g.fillStyle = '#050407'; this.span(g, rx, ry, 3, 3); for (let a = 0; a < 5; a++) { g.fillStyle = '#050407'; g.fillRect(Math.round(rx + Math.cos(a * 1.257 + t * 0.4) * 7), Math.round(ry + Math.sin(a * 1.257 + t * 0.4) * 7), 2, 2); } }
      // pavimento a scacchi lucido
      for (let r = 0; r < 6; r++) { const yy = 240 + r * 20, sz = 20 + r * 4; for (let xx = -((r * 7) % sz); xx < W; xx += sz) { g.fillStyle = ((xx / sz + r) | 0) % 2 ? '#1a1030' : '#08060f'; g.fillRect(Math.round(xx), yy, Math.ceil(sz), 20); } }
      this.light(g, cx, 120, 140, 150, '#fff2e0', 0.05, 4);                                        // faro sulla macchina
      this.light(g, cx, gy, 170, 16, '#b07bff', 0.12, 4);
    } else {
      // distributore: pensilina di notte, colonnina accanto alla Supra
      const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#0a0922'); gr.addColorStop(1, '#2e2662'); g.fillStyle = gr; g.fillRect(0, 0, W, 240);
      g.fillStyle = C.ink; g.fillRect(0, 20, W, 34); g.fillStyle = '#e8ecf5'; g.fillRect(0, 22, W, 28); g.fillStyle = '#2ee6ff'; g.fillRect(0, 46, W, 4);
      this.text(g, 'BENZINA 24H', 24, 28, '#163a8c', 3);
      for (let xx = 20; xx < W; xx += 60) { g.fillStyle = '#fff6e0'; g.fillRect(xx, 54, 30, 3); this.light(g, xx + 15, 60, 50, 40, '#fff6e0', 0.05, 3); }
      g.fillStyle = C.ink; g.fillRect(20, 120, 120, 120); g.fillStyle = '#1a2a3a'; g.fillRect(22, 122, 116, 80); this.text(g, 'MARKET', 46, 128, '#b8ff3a', 2);
      g.fillStyle = '#ffd36b'; for (let q = 0; q < 6; q++) g.fillRect(30 + q * 18, 150, 10, 30);
      g.fillStyle = '#2a2f40'; g.fillRect(0, 240, W, 120); g.fillStyle = '#e8e4d6'; g.fillRect(0, 316, W, 2);
      // colonnina con display
      const px = cx + 160, F = I.fill, lt = F ? F.got : I.filled ? (I.lastL || 0) : 0, eu = F ? F.cost : 0;
      g.fillStyle = C.ink; g.fillRect(px - 2, 160, 50, gy - 160 + 2); g.fillStyle = '#b8ff3a'; g.fillRect(px, 162, 46, gy - 162); g.fillStyle = '#7ab82a'; g.fillRect(px + 38, 162, 8, gy - 162);
      g.fillStyle = '#0b0f16'; g.fillRect(px + 4, 170, 32, 36);
      this.text(g, (F ? lt : 0).toFixed(1).replace('.', ','), px + 6, 174, '#b8ff3a'); this.text(g, 'LT', px + 26, 174, '#7ab82a');
      this.text(g, eu.toFixed(2).replace('.', ','), px + 6, 186, '#ffb000'); this.text(g, '€', px + 30, 186, '#ffb000');
      this.text(g, '1,95', px + 6, 198, '#2ee6ff');
      // tubo della pistola fino al tappo (dietro, lato guida)
      g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(px, 220);
      const tx = cx - 100 * K + 30 * K, ty = gy - 58 * K + 22 * K;
      if (F) { g.quadraticCurveTo(px - 60, gy - 10, tx, ty); } else { g.lineTo(px - 4, 240); }
      g.stroke(); g.lineWidth = 1;
    }
    // la Supra (vernice, cerchi, neon, strisce)
    const GI = this.geo(), spr = this.carSprite(K), left = Math.round(cx - 100 * K), top = Math.round(gy - (GI.wy + GI.wr) * K - lift + GI.low * K);
    const glow = this.cos && this.cos.glow && this.cos.glow !== 'none' ? this.cos.glow : null;
    this.shadow(g, cx, gy, 120, 6);
    if (glow) { this.light(g, cx, gy - 1, 170, 14, glow, 0.35, 4); g.fillStyle = glow; g.fillRect(cx - 84, gy - 5 - lift, 168, 1); }
    g.imageSmoothingEnabled = false; g.drawImage(spr, left, top);
    if (spr.img) { const wf = this.carId === 'v40' ? this.v40Wheel.bind(this) : this.supraWheel.bind(this); const wyI = gy - lift - GI.wr * K; wf(g, left + GI.ax[0] * K, wyI, K, 0, 0, true); wf(g, left + GI.ax[1] * K, wyI, K, 0, 0, false); }
    if (I.id === 'style') this.light(g, cx + 20, top + 10, 60, 10, '#ffffff', 0.04 + 0.03 * Math.sin(t * 2), 3);   // riflesso che scorre
    // titolo
    const title = I.name.toUpperCase(), tw = this.textW(title, 2);
    g.fillStyle = 'rgba(8,8,14,.7)'; g.fillRect(cx - tw / 2 - 8, 330, tw + 16, 18); this.text(g, title, cx - tw / 2, 334, I.col, 2);
  }

  update(dt, s, game) {
    const st = this.st, g = this.g, W = this.LW, C = this.C;
    st.t += dt;
    const dist = game ? game.s.dist : (this.dist || 0) + s.v * dt; this.dist = dist;
    // telecamera viva: in velocità l'auto scivola indietro sullo schermo (si vede più strada davanti),
    // in accelerazione resta un attimo indietro, in frenata va avanti
    const camT = 0.38 - Math.min(0.08, Math.abs(s.v) * 0.0017) - Math.max(-8, Math.min(8, s.acc || 0)) * 0.005;
    st.cam = (st.cam ?? camT) + (camT - (st.cam ?? camT)) * Math.min(1, dt * 1.6);
    const PPM = 30, carX = Math.round(W * st.cam), K0 = 0.78;
    const kq = (y) => Math.round(K0 * this.laneS(y) / 0.04) * 0.04;   // scala quantizzata: pochi sprite in cache
    const wx = (m) => Math.round(carX + (m - dist) * PPM);
    const visFrom = dist - carX / PPM - 10, visTo = dist + (W - carX) / PPM + 10;

    const zT = game ? game.laneZ : 3.5;
    st.lzV = (st.lzV || 0) + ((zT - st.lz) * 9 - (st.lzV || 0) * 6) * dt; st.lz += st.lzV * dt;

    const H = (typeof Garage3D !== 'undefined' && Garage3D.roadH) ? Garage3D.roadH : () => 0;
    const sp = Math.min(1, Math.abs(s.v) / 3);
    const bF = H(dist + 1.28, 1) * sp * 320, bR = H(dist - 1.28, 1) * sp * 320;
    const tgtP = Math.max(-0.08, Math.min(0.08, s.acc * 0.009)) + (bF - bR) * 0.005;
    st.pv += ((tgtP - st.pitch) * 140 - st.pv * 10) * dt; st.pitch += st.pv * dt;
    st.hv += (((bF + bR) / 2 - st.heave) * 140 - st.hv * 10) * dt; st.heave += st.hv * dt;
    st.hdv += ((Math.max(-5, Math.min(5, -s.acc * 0.6)) - st.head) * 90 - st.hdv * 8) * dt; st.head += st.hdv * dt;
    st.spin += s.ww * dt; st.front += s.v / 0.322 * dt;
    const idleShake = s.running ? Math.sin(st.t * Math.max(s.rpm, 120) / 60 * 3 * Math.PI * 2) * (s.rpm < 1600 ? 1.2 + 2.4 * (s.lope || 0) : 0.5) : 0;

    if (game && game.inside && game.inside.phase === 'shop') { this.drawInterior(g, game, s, dt); this.present(0, 0); return; }
    // ---- sfondo: cielo, tre piani di città, foschia
    this.drawSky(g, st.t, dist);
    // temporale: con la pioggia ogni tanto un fulmine (saetta nel cielo, lampo su tutta la scena, poi il tuono)
    st.bolt = Math.max(0, (st.bolt || 0) - dt * 3.2);
    if (this.rainOn && st.bolt === 0 && Math.random() < dt / 9) { st.bolt = 1; st.boltX = 40 + Math.random() * (W - 80); st.boltSeed = Math.random() * 1000; this.thunder = 0.6 + Math.random() * 1.4; }
    if (st.bolt > 0.35) {
      g.strokeStyle = `rgba(230,240,255,${st.bolt})`; g.lineWidth = 1; g.beginPath(); let bx = st.boltX, by = 0; g.moveTo(bx, by);
      for (let q = 0; q < 14; q++) { bx += (Street2D.rnd(st.boltSeed + q) - 0.5) * 22; by += 8 + Street2D.rnd(st.boltSeed + q + 50) * 6; g.lineTo(Math.round(bx), Math.round(by)); }
      g.stroke();
    }
    // giorno e tramonto: cielo chiaro sopra quello notturno, sole basso al tramonto
    const dd = this.day || 0, ss = this.sunset || 0, wt = this.rainOn ? 1 : 0;
    if (dd > 0.01 || ss > 0.01) {
      const gr = g.createLinearGradient(0, 0, 0, 224);
      const top = wt ? '108,118,132' : '86,146,214', bot = wt ? '150,156,164' : ss > 0.3 ? '238,156,96' : '178,214,240';
      gr.addColorStop(0, `rgba(${top},${Math.max(dd, ss * 0.8)})`); gr.addColorStop(1, `rgba(${bot},${Math.max(dd, ss * 0.85)})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, 224);
      if (!wt) { const sx = W * 0.22, sy = 150 - dd * 110; this.light(g, sx, sy, 34, 34, ss > 0.3 ? '#ffb070' : '#fff2c0', 0.25, 4); g.fillStyle = ss > 0.3 ? '#ffc890' : '#fff6d8'; this.span(g, sx, sy, 11, 11); }
    }
    this.drawCity(g, dist, st.t, 'haze', 0.025, 188, 50);
    g.fillStyle = 'rgba(70,50,114,.35)'; g.fillRect(0, 150, W, 40);
    this.drawCity(g, dist, st.t, 'far', 0.07, 200, 52);
    g.fillStyle = 'rgba(70,50,114,.22)'; g.fillRect(0, 168, W, 34);
    this.drawTrain(g, dist, st.t);
    const shops = this.drawCity(g, dist, st.t, 'mid', 0.22, 216, 72);

    // ---- marciapiede lontano, luce delle vetrine, pedoni
    g.fillStyle = C.ink; g.fillRect(0, 215, W, 1);
    g.fillStyle = C.walk; g.fillRect(0, 216, W, 16);
    g.fillStyle = '#353a55'; for (let x = -((dist * PPM) % 32); x < W; x += 32) g.fillRect(Math.round(x), 216, 1, 16);
    g.fillRect(0, 222, W, 1);
    g.fillStyle = '#4a5070'; g.fillRect(0, 230, W, 2);
    for (const sh of shops) this.light(g, sh.x, 224, sh.w * 0.6, 7, sh.col, 0.07, 3);
    for (let k = 0; k < 6; k++) {
      const span = W + 120, walkX = ((k * 157 + st.t * (14 + k * 5) * (k % 2 ? 1 : -1) - dist * PPM * 0.22) % span + span) % span - 60;
      const legs = Math.floor(st.t * 7 + k) % 2, X = Math.round(walkX), dir = k % 2 ? 1 : -1;
      const coat = ['#2a1f4f', '#123049', '#3a1f2e', '#1f3a2e', '#4a2a1a', '#2a2a3a'][k], hair = ['#1a1010', '#3a2010', '#d9c08a', '#0a0a0a', '#7a3a1a', '#c0c0c0'][k];
      g.fillStyle = 'rgba(4,5,12,.4)'; g.fillRect(X - 3, 230, 9, 2);
      g.fillStyle = C.ink; g.fillRect(X - 1, 203, 7, 27);
      g.fillStyle = coat; g.fillRect(X, 210, 5, 10); g.fillStyle = Street2D.shade(coat, 0.3); g.fillRect(X, 210, 1, 10);
      g.fillStyle = C.skin; g.fillRect(X, 205, 5, 5); g.fillStyle = hair; g.fillRect(X, 204, 5, 2); g.fillRect(dir > 0 ? X : X + 4, 205, 1, 3);
      g.fillStyle = '#1a1a2a'; g.fillRect(X + (legs ? 0 : 1), 220, 2, 9); g.fillRect(X + (legs ? 3 : 2), 220, 2, 9);
      if (k === 2) { g.fillStyle = C.ink; g.fillRect(X + (dir > 0 ? 6 : -4), 212, 3, 6); g.fillStyle = '#b8ff3a'; g.fillRect(X + (dir > 0 ? 6 : -4), 213, 2, 4); }   // sacchetto
    }
    // ---- carreggiata
    g.fillStyle = C.road2; g.fillRect(0, 232, W, 4);
    const rt = this.roadTile(), ro = ((dist * PPM) % 256 + 256) % 256;
    for (let x = -ro; x < W; x += 256) g.drawImage(rt, Math.round(x), 236);
    for (let m = Math.ceil(visFrom / 47) * 47; m < visTo; m += 47) { const x = wx(m); g.fillStyle = '#14172a'; g.fillRect(x, 236, 3, 104); g.fillStyle = '#3a3f58'; g.fillRect(x + 3, 236, 1, 104); }
    for (let m = Math.ceil(visFrom / 61) * 61 + 20; m < visTo; m += 61) {                       // tombini fumanti
      const x = wx(m);
      g.fillStyle = C.ink; this.span(g, x, 282, 14, 4); g.fillStyle = '#2a2f40'; this.span(g, x, 282, 12, 3);
      g.fillStyle = '#14172a'; for (let k = -10; k <= 10; k += 3) g.fillRect(x + k, 280, 1, 5);
      if (Math.random() < dt * 4) this.parts.push({ k: 'steam', m: m + (Math.random() - 0.5) * 0.6, y: 278, vy: -18 - Math.random() * 10, r: 2, life: 1, dx: 0 });
    }
    for (let m = Math.ceil(visFrom / 113) * 113 + 40; m < visTo; m += 113) {                    // frecce dipinte
      const x = wx(m); g.fillStyle = '#cfcab9';
      g.fillRect(x, 314, 30, 4); for (let k = 0; k < 8; k++) g.fillRect(x + 22 + k, 310 + Math.floor(k / 2), 1, 12 - Math.floor(k / 2) * 2);
    }
    for (let m = Math.ceil(visFrom / 23) * 23; m < visTo; m += 23) { const x = wx(m); g.fillStyle = C.ink; g.fillRect(x - 1, 330, 14, 6); g.fillStyle = '#12141f'; g.fillRect(x, 331, 12, 4); g.fillStyle = '#3a3f58'; for (let k = 1; k < 12; k += 3) g.fillRect(x + k, 331, 1, 4); }
    g.fillStyle = C.line; g.fillRect(0, 238, W, 2); g.fillRect(0, 335, W, 2);
    for (let x = -((dist * PPM) % (12 * PPM)); x < W; x += 12 * PPM) { g.fillRect(Math.round(x), 262, Math.round(4.5 * PPM), 2); g.fillRect(Math.round(x), 300, Math.round(4.5 * PPM), 2); }
    // incroci: strisce pedonali ogni 260 m (il semaforo si disegna davanti, alla fine)
    for (let m = Math.floor((visFrom - 140) / 260) * 260 + 130; m < visTo + 10; m += 260) {
      const x = wx(m);
      for (let yy = 242; yy < 334; yy += 8) { g.fillStyle = 'rgba(216,212,198,.82)'; g.fillRect(x, yy, 4 * PPM, 5); g.fillStyle = 'rgba(120,118,110,.5)'; g.fillRect(x, yy + 5, 4 * PPM, 1); }
      g.fillStyle = 'rgba(232,228,214,.9)'; g.fillRect(x - 12, 242, 3, 92);                    // linea d'arresto
    }
    // pozzanghere che riflettono il cielo e i neon
    for (let m = Math.ceil(visFrom / 37) * 37; m < visTo; m += 37) {
      const k = Math.round(m / 37); if (Street2D.rnd(k) < 0.45) continue;
      const x = wx(m + Street2D.rnd(k + 1) * 20), y = 248 + Math.floor(Street2D.rnd(k + 2) * 80), rx = 12 + Math.floor(Street2D.rnd(k + 3) * 18);
      g.fillStyle = '#262f55'; this.span(g, x, y, rx, 3); g.fillStyle = '#323d6e'; this.span(g, x - 2, y - 1, rx * 0.7, 1.5);
      g.fillStyle = C.neon[k % 5]; g.fillRect(x + 4, y, 4, 1); g.fillRect(x + 6, y - 1, 1, 1);
      g.fillStyle = '#7a86c0'; g.fillRect(x - rx + 5, y - 1, 3, 1);
    }

    // ---- asfalto a specchio: la città (neon, finestre) si riflette capovolta e tremolante sulla strada
    const wetA = this.quality === 'bassa' ? 0 : (this.rainOn ? 0.26 : 0.09) * (1 - 0.7 * (this.day || 0));
    if (wetA > 0.02) {
      if (!this.rf) this.rf = document.createElement('canvas');
      if (this.rf.width !== W) { this.rf.width = W; this.rf.height = 106; }
      const rg = this.rf.getContext('2d'); rg.clearRect(0, 0, W, 106); rg.drawImage(this.lo, 0, 110, W, 106, 0, 0, W, 106);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let r = 0; r < 90; r++) {
        const srcY = 105 - Math.floor(r / 0.85), wob = Math.round(Math.sin(r * 0.55 + st.t * 6) * (1 + r * 0.03) * (this.rainOn ? 1.6 : 0.8));
        g.globalAlpha = wetA * (1 - r / 95);
        g.drawImage(this.rf, 0, Math.max(0, srcY), W, 1, wob, 241 + r, W, 1);
      }
      g.restore();
    }

    // ---- segni di gomma sull'asfalto (restano dove sono stati lasciati)
    for (const mk of this.marks) {
      const x = wx(mk.m); if (x < -40 || x > W + 40) continue;
      g.fillStyle = `rgba(6,6,10,${mk.a})`; g.fillRect(x, mk.y, Math.max(1, Math.round(mk.len * PPM) + 1), 2);
    }
    this.marks = this.marks.filter((mk) => wx(mk.m) > -60).slice(-400);

    // ---- lampioni: alone piccolo, pozza a terra, riflesso sul bagnato (niente fasci)
    const lampX = [];
    for (let lm = Math.floor(visFrom / 24) * 24; lm < visTo + 24; lm += 24) {
      const x = wx(lm); lampX.push(x);
      this.light(g, x + 18, 252, 70, 13, '#ffcf7a', 0.07, 4);               // pozza sull'asfalto, corsia lontana
      this.light(g, x + 18, 226, 46, 6, '#ffcf7a', 0.08, 3);                // pozza sul marciapiede
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,200,120,.05)';
      for (let y = 266; y < 330; y += 2) { const w = Math.max(1, 6 - (y - 266) / 14); g.fillRect(Math.round(x + 18 - w / 2 + Math.sin(y * 0.7 + st.t) * 1.5), y, Math.round(w), 1); }   // riflesso tremolante
      g.restore();
    }
    for (const x of lampX) {
      g.fillStyle = C.ink; g.fillRect(x - 2, 118, 5, 112); g.fillRect(x, 118, 24, 5); g.fillRect(x - 4, 222, 9, 8); g.fillRect(x - 3, 214, 7, 4);
      g.fillStyle = '#4a5070'; g.fillRect(x - 1, 120, 2, 108); g.fillRect(x + 1, 119, 21, 2); g.fillStyle = '#5c6386'; g.fillRect(x - 3, 223, 7, 1);
      g.fillStyle = C.ink; g.fillRect(x + 12, 121, 14, 6);
      g.fillStyle = '#ffcf7a'; g.fillRect(x + 13, 125, 12, 3); g.fillStyle = '#fff6d8'; g.fillRect(x + 15, 125, 8, 1);
      this.light(g, x + 19, 127, 14, 8, '#ffcf7a', 0.1, 3);
    }

    // ---- entità (dalla più lontana)
    const items = game ? game.ents.slice() : [];
    if (game && game.placesOn) for (const p of game.placesBetween(visFrom - 160, visTo + 160)) items.push(p);
    const zOf = (e) => {
      if (e.kind === 'station' || e.kind === 'place' || e.lane === 0) return 9;
      if (e.kind === 'line' || e.kind === 'drop') return 1.75;
      e._z = e._z === undefined ? GAME_LANE_Z[e.lane] : e._z + (GAME_LANE_Z[e.lane] - e._z) * Math.min(1, dt * 1.8);   // cambio corsia morbido
      return e._z;
    };
    items.sort((a, b) => zOf(a) - zOf(b));
    const front = [];
    const drawEnt = (e) => {
      const x = wx(e.x);
      if (x < -300 || x > W + 300) return;
      if (e.kind === 'place') { this.drawPlace(g, e, x, st, game, dist); return; }
      if (e.kind === 'station') { this.drawStation(g, x); return; }
      if (e.kind === 'drop') {
        for (const p of [-36, 32]) { g.fillStyle = C.ink; g.fillRect(x + p - 2, 184, 9, 148); g.fillStyle = '#b8ff3a'; g.fillRect(x + p, 186, 5, 144); g.fillStyle = '#e8ffb0'; g.fillRect(x + p, 186, 1, 144); }
        g.fillStyle = C.ink; g.fillRect(x - 44, 168, 92, 22); g.fillStyle = '#b8ff3a'; g.fillRect(x - 42, 170, 88, 18);
        this.text(g, 'CONSEGNA', x - 31, 174, C.ink, 2);
        this.light(g, x, 300, 70, 30, '#b8ff3a', 0.05, 3);
        return;
      }
      if (e.kind === 'line') {
        for (let y = 240; y < 334; y += 6) for (let k = 0; k < 2; k++) { g.fillStyle = ((y / 6 + k) | 0) % 2 ? '#f4f1e6' : C.ink; g.fillRect(x + k * 6, y, 6, 6); }
        if (e.finish) {
          // arco a scacchi sopra la carreggiata con bandiere
          g.fillStyle = C.ink; g.fillRect(x - 3, 96, 6, 240); g.fillRect(x + 40, 96, 6, 240);
          for (let yy = 96; yy < 118; yy += 6) for (let xx = x - 3; xx < x + 46; xx += 6) { g.fillStyle = ((yy - 96) / 6 + (xx - x + 3) / 6) % 2 ? '#f4f1e6' : C.ink; g.fillRect(xx, yy, 6, 6); }
          const fw = Math.round(Math.sin(st.t * 9) * 2);
          for (const fx2 of [x - 3, x + 40]) { g.fillStyle = C.ink; g.fillRect(fx2 + 2, 70, 2, 28); for (let q = 0; q < 4; q++) { g.fillStyle = q % 2 ? '#f4f1e6' : '#111'; g.fillRect(fx2 + 4, 70 + q * 4 + (q % 2 ? fw : 0), 10, 4); } }
          g.fillStyle = C.ink; g.fillRect(x - 2, 132, 8, 108); g.fillStyle = '#b8ff3a'; g.fillRect(x, 134, 4, 104);
          g.fillStyle = C.ink; g.fillRect(x - 36, 120, 78, 20); g.fillStyle = '#b8ff3a'; g.fillRect(x - 34, 122, 74, 16);
          this.text(g, 'ARRIVO', x - 21, 125, C.ink, 2);
        }
        return;
      }
      const y = this.laneY(zOf(e)), k = kq(y), spr = this.otherSprite(e.kind, e.color, k), sc = k;
      const w = spr.width, left = Math.round(x - w / 2), sy = Math.round(y - 57 * k - 1);
      this.light(g, left + w + 50 * k, y - 2, 70 * k, 6, '#fff2c4', 0.06, 3);
      this.shadow(g, x, y, w * 0.45, 4);
      g.drawImage(spr, left, sy);
      const ang = -(e.x / 0.32);
      for (const ax of spr.geo.ax) this.wheel(g, left + 1 + ax * k, sy + 1 + 42 * k, Math.max(6, Math.round(15 * k)), ang, e.v || 0);
      this.light(g, left + 3, sy + 35 * k, 8, 6, '#ff2a2a', 0.15, 2);
      if (e.sig > 0 && Math.floor(st.t * 3) % 2 === 0) { g.fillStyle = '#ffa020'; g.fillRect(left + 2, sy + Math.round(38 * k), 4, 3); g.fillRect(left + w - 6, sy + Math.round(36 * k), 4, 3); this.light(g, left + 4, sy + 39 * k, 9, 6, '#ffa020', 0.3, 3); }
      if (e.honk > 3.5 && !(this.cool['honk' + e.id] > st.t) && (this.cool['honk' + e.id] = st.t + 3)) this.comic(Math.random() < 0.5 ? 'BEEEP!' : 'HONK!', left + w * 0.3, sy - 8, '#ffe14d', 2);
      if (e.kind === 'police') {
        const on = e.chase || e.v > 0 || Math.abs(e.x - dist) < 120, ph = Math.floor(st.t * 8) % 2;
        const lx = Math.round(left + 82 * k), ly = sy + Math.round(5 * k);
        g.fillStyle = on && ph ? '#ff2e4d' : '#4a1020'; g.fillRect(lx, ly, Math.round(13 * sc), 3);
        if (on) { this.light(g, lx + 14 * sc, ly, 120, 60, ph ? '#ff2e4d' : '#4f7bff', 0.16, 4); this.light(g, lx + 14 * sc, y, 160, 14, ph ? '#ff2e4d' : '#4f7bff', 0.12, 3); }
        g.fillStyle = on && !ph ? '#4f7bff' : '#101a4a'; g.fillRect(lx + Math.round(15 * sc), ly, Math.round(13 * sc), 3);
        if (on) {
          const col = ph ? '#ff2e4d' : '#4f7bff';
          this.light(g, lx + (ph ? 7 : 23) * sc, ly + 2, 16, 8, col, 0.16, 3);
          this.light(g, x, y - 1, 90 * sc, 10, col, 0.07, 3);
        }
        if (e.chase && ph) { g.fillStyle = C.ink; g.fillRect(x - 4, ly - 30, 9, 24); g.fillStyle = '#ffd23f'; g.fillRect(x - 2, ly - 28, 5, 14); g.fillRect(x - 2, ly - 12, 5, 4); }
      }
    };
    const myZ = st.lz;
    for (const e of items) if (zOf(e) > myZ + 0.01) drawEnt(e); else front.push(e);

    // ---- la Supra
    const IN = game && game.inside;
    let entE = 0;
    if (IN) { const ez = (t) => t * t * (3 - 2 * Math.min(1, Math.max(0, t))); entE = IN.phase === 'in' ? ez(Math.min(1, IN.t / 1.3)) : IN.phase === 'out' ? 1 - ez(Math.min(1, IN.t / 1.1)) : 1; }
    const entLift = IN ? (IN.id === 'fuel' ? 12 : 30) * entE : 0;
    const entA = IN && IN.id !== 'fuel' ? 1 - Math.max(0, (entE - 0.5) / 0.5) : 1;
    const entDX = IN ? Math.round((wx(IN.x) - carX) * Math.min(1, entE * 1.6)) : 0;
    const y0 = Math.round(this.laneY(myZ) - entLift), k = kq(y0), sc = k;
    const spr = this.carSprite(k), SW = spr.width, left = Math.round(carX + entDX - SW / 2);
    g.globalAlpha = entA;
    this.carPos = { x: left + SW / 2, y: y0 - 22 * k, k };
    const GE0 = this.geo();
    if (s.ign) this.light(g, left + SW + (s.high ? 110 : 60) * k, y0 - 2, s.high ? 150 : 80, s.high ? 9 : 7, '#fff2c4', s.high ? 0.1 : 0.08, 4);   // pozza dei fari (più lunga con gli abbaglianti)
    if (s.brake > 0.05) this.light(g, left - 30 * k, y0 - 1, 40, 5, '#ff2a2a', 0.1, 3);             // pozza degli stop
    // fascio dei fari nell'aria, di notte e sotto la pioggia
    if (s.ign && (this.day || 0) < 0.6) {
      const fx = left + SW - 4, fy = y0 - 22 * k, len = s.high ? 260 : 170, a2 = (0.09 + (this.rainOn ? 0.06 : 0)) * (1 - (this.day || 0));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 4; b++) {
        const t2 = (b + 1) / 4; g.fillStyle = `rgba(255,240,200,${a2 * (1 - t2 * 0.6)})`;
        g.beginPath(); g.moveTo(fx, fy - 2); g.lineTo(fx + len * t2, fy - 6 * t2 - 2); g.lineTo(fx + len * t2, fy + (y0 - fy) * 0.9 * t2 + 4); g.lineTo(fx, fy + 2); g.closePath(); g.fill();
      }
      g.restore();
    }
    this.shadow(g, carX + entDX, y0, SW * 0.46, 5);
    g.fillStyle = 'rgba(2,3,8,.7)'; for (const wxs of this.geo().ax) this.span(g, left + wxs * k, y0, 14 * k, 2);   // contatto delle gomme
    const glow = this.cos && this.cos.glow && this.cos.glow !== 'none' ? this.cos.glow : null;
    if (glow && s.ign) { this.light(g, left + SW / 2, y0 - 1, SW * 0.62, 9, glow, 0.3 * entA, 4); g.fillStyle = glow; g.fillRect(left + Math.round(SW * 0.18), y0 - 4, Math.round(SW * 0.64), 1); }
    // asfalto bagnato: la Supra si specchia sulla strada, sbiadita
    if (this.rainOn && spr.img) {
      const hgt = spr.height;
      g.save(); g.globalAlpha = 0.2; g.imageSmoothingEnabled = false;
      g.setTransform(1, 0, 0, -0.55, left, y0 + hgt * 0.55 + 2); g.drawImage(spr, 0, 0); g.restore();
    }
    st.popJolt = Math.max(0, (st.popJolt || 0) - dt * 10);
    const heave = Math.round(-st.heave + idleShake * 0.6 - (st.popJolt > 0.3 ? 1 : 0));
    const skew = -st.pitch * 0.8;
    const squash = Math.max(-0.06, Math.min(0.08, -st.pitch * 0.35));
    const GE = this.geo(), archY = GE.wy * k + 1, top = y0 - GE.wr * k - archY * (1 - squash) + heave + GE.low * k;
    g.save();
    g.imageSmoothingEnabled = false;
    g.setTransform(1, skew, 0, 1 - squash, left, top - skew * SW / 2 - (spr.img ? k : 0));
    g.drawImage(spr, 0, 0);
    if (spr.img) g.translate(0, k);
    // pilota (dietro al montante): va indietro in accelerazione, avanti in frenata
    const P = (col, xx, yy, w, h) => { g.fillStyle = col; g.fillRect(Math.round(xx * k) + 1, Math.round(yy * k) + 1, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
    const hx = (spr.img ? GE.hx : 108) + st.head * 0.8, hy = GE.hy;
    P('#14102a', hx - 2, 14 + hy, 6, 9);
    P(C.ink, hx - 2, 12 + hy, 11, 11); P(C.skin, hx, 14 + hy, 7, 7); P(Street2D.shade(C.skin, -0.25), hx, 19 + hy, 7, 2);
    P(C.ink, hx + 2, 16 + hy, 6, 2); P('#2ee6ff', hx + 4, 16 + hy, 2, 1);
    P('#ff2e88', hx - 1, 12 + hy, 8, 3); P('#ff2e88', hx + 5, 14 + hy, 4, 1);
    P('#2a1f4f', hx - 1, 22 + hy, 9, 2);
    if (this.carId !== 'v40') for (let n = 0; n < 6; n++) P('rgba(111,216,255,.55)', 121 + n, 14 + n, 1, 1);
    if (s.brake > 0.05) { if (spr.img) { P('#ff2a2a', GE.tail[0], GE.tail[1], GE.tail[2], GE.tail[3]); P('#ffd0c8', GE.tail[0] + 1, GE.tail[1] + 1, 2, 2); } else { P('#ff2a2a', 1, 31, 5, 7); P('#ffd0c8', 2, 32, 2, 2); } }
    const blinkOn = s.signal && Math.floor(st.t * 3) % 2 === 0;
    if (blinkOn) { P('#ffa020', GE.blinkF[0], GE.blinkF[1], GE.blinkF[2], GE.blinkF[3]); P('#ffe0a0', GE.blinkF[0] + 2, GE.blinkF[1], 3, 1); if (spr.img) P('#ffa020', GE.blinkR[0], GE.blinkR[1], GE.blinkR[2], GE.blinkR[3]); else P('#ffa020', 2, 39, 4, 3); }
    // danni: muso ammaccato, graffi chiari, vernice saltata
    const dmg = s.damage || 0;
    if (dmg > 0.01) {
      const n = Math.round(dmg * 80);
      for (let q = 0; q < n; q++) {
        const r1 = Street2D.rnd(q * 3.3), r2 = Street2D.rnd(q * 7.1 + 1);
        if (q % 3 === 0) P('rgba(8,10,16,.75)', 170 + r1 * 26, 30 + r2 * 18, 3, 2);                       // ammaccature sul muso
        else if (q % 3 === 1) { const len = 6 + r1 * 12; P('rgba(220,226,234,.8)', 120 + r2 * 60, 30 + r1 * 14, len, 1); }   // graffi
        else P('#6a6f7a', 150 + r1 * 44, 36 + r2 * 12, 2, 2);                                               // vernice saltata
      }
      if (dmg > 0.35) { P(C.ink, 182, 31, 11, 3); P('#5a5e66', 184, 32, 5, 1); }                          // faro rotto
      if (dmg > 0.5) P(C.ink, 188, 46, 10, 6);                                                            // paraurti sfondato
    }
    g.restore();
    // luce dei lampioni che scorre sulla carrozzeria passando sotto
    for (const lx of lampX) { const dx = lx + 18 - (left + SW / 2); if (Math.abs(dx) < SW * 0.7) this.light(g, lx + 18, top + 16 * k, 26, 12, '#ffd59a', 0.2 * (1 - Math.abs(dx) / (SW * 0.7)) * (1 - (this.day || 0)), 3); }
    if (s.brake > 0.05) this.light(g, left + 2, top + 34 * k, 12, 9, '#ff2a2a', 0.2, 3);
    if (s.ign) this.light(g, left + SW - 6, top + 33 * k, s.high ? 20 : 12, s.high ? 9 : 6, '#fff2c4', s.high ? 0.3 : 0.2, 3);
    if (s.signal && Math.floor(st.t * 3) % 2 === 0) { this.light(g, left + 178 * k, top + 38 * k, 10, 6, '#ffa020', 0.25, 3); this.light(g, left + 4, top + 40 * k, 8, 6, '#ffa020', 0.25, 3); }
    const wr = Math.max(6, Math.round(GE.wr * k));
    if (spr.img) {
      // freni roventi dopo frenate forti da velocità alta
      this.brakeHot = Math.min(1, Math.max(0, (this.brakeHot || 0) - dt * 0.18) + (s.brake > 0.5 && Math.abs(s.v) > 15 ? dt * 0.25 * s.brake : 0));
      const wfn = this.carId === 'v40' ? this.v40Wheel.bind(this) : this.supraWheel.bind(this);
      wfn(g, left + GE.ax[0] * k, y0 - wr - Math.max(0, bR * 0.4), k, st.spin, Math.abs(s.ww * 0.322), true);
      wfn(g, left + GE.ax[1] * k, y0 - wr - Math.max(0, bF * 0.4), k, st.front, Math.abs(s.v), false);
    } else {
      this.wheel(g, left + 1 + 48 * k, y0 - wr - Math.max(0, bR * 0.4), wr, -st.spin, Math.abs(s.ww * 0.322));
      this.wheel(g, left + 1 + 158 * k, y0 - wr - Math.max(0, bF * 0.4), wr, -st.front, Math.abs(s.v));
    }

    g.globalAlpha = 1;
    // ---- effetti
    const rx = Math.round(left + GE.ex[0] * k), exY = Math.round(top - skew * SW / 2 + skew * GE.ex[0] * k + GE.ex[1] * k * (1 - squash) + (spr.img ? k : 0));
    if (((s.skid || 0) > 0.18 && Math.abs(s.v) > 0.3) || (s.brake > 0.9 && Math.abs(s.v) > 8)) {
      const mRear = dist + (left + 1 + 48 * k - carX) / PPM, len = Math.max(0.15, Math.abs(s.v) * dt * 1.05 + 0.05), a = Math.min(0.7, 0.25 + (s.skid || 0.5));
      this.marks.push({ m: mRear - len, y: y0 - 1, len, a }, { m: mRear - len, y: y0 - 4, len, a: a * 0.6 });
    }
    // spruzzi solo passando sulle pozzanghere (un tratto di 5 m ogni 61), non per tutto il viaggio
    const wet = ((dist % 61) + 61) % 61 < 5;
    if (wet && Math.abs(s.v) > 12) for (let q = 0; q < 2; q++) if (Math.random() < Math.min(0.8, (Math.abs(s.v) - 12) / 25)) {
      const wxm = Math.random() < 0.5 ? 48 : 158;
      this.parts.push({ k: 'spray', m: dist + (left + 1 + wxm * k - 14 * k - carX) / PPM, y: y0 - 2 - Math.random() * 4, vy: -14 - Math.random() * 18, dx: s.v * 0.6 - 4 - Math.random() * 6, r: 1, life: 1 });
    }
    if (game) for (const f of game.fx) if (f.k === 'crash') this.sparkT = 0.35;
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      for (let q = 0; q < 5; q++) this.parts.push({ k: 'spark', m: dist + (left + SW - carX) / PPM, y: y0 - 10 - Math.random() * 20, vy: -40 - Math.random() * 60, dx: 6 + Math.random() * 10, r: 1, life: 1 });
    }
    if (s.spin > 0.25 && Math.random() < s.spin * 0.9) this.parts.push({ k: 'smoke', m: dist + (left + 48 * k - carX) / PPM, y: y0 - 8, vy: -12 - Math.random() * 16, r: 4, life: 1, dx: -20 });
    // scoppiettii: ogni scoppio è una fiammata a strati con una palla di fuoco, braci, fumo e un lampo sulla strada
    st.flame = Math.max(0, st.flame - dt * 8);
    st.popFlash = Math.max(0, (st.popFlash || 0) - dt * 6);
    if (s.flame && Math.random() < s.flame * dt * 22) {
      const big = Math.random() < 0.35 + s.flame * 0.3;
      st.flame = big ? 1.1 + Math.random() * 0.4 : 0.6 + Math.random() * 0.4; st.popFlash = big ? 1 : 0.55; st.popJolt = big ? 1.2 : 0.5;
      for (let q = 0; q < (big ? 9 : 4); q++) this.parts.push({ k: 'spark', m: dist + (rx - carX) / PPM, y: exY + (Math.random() - 0.5) * 4, vy: -20 - Math.random() * 50, dx: -30 - Math.random() * 50, r: 1, life: 1 });
      this.parts.push({ k: 'smoke', m: dist + (rx - 14 - carX) / PPM, y: exY - 2, vy: -8 - Math.random() * 8, r: 3, life: 0.8, dx: -14 });
    }
    if (st.flame > 0.05) {
      // fiammata a tre strati che esce dalla bocca: rosso-arancio fuori, giallo in mezzo, nucleo bianco-azzurro;
      // tremola, si gonfia a metà e sale un po' verso la coda
      const fl = Math.min(1.5, st.flame), L = Math.round((16 + fl * 40) * k), H0 = (2.6 + fl * 3.2) * k, seed = Math.floor(st.t * 30);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < L; i++) {
        const u = i / L, rise = -u * u * 7 * k;
        const wob = (Math.sin(i * 0.7 + st.t * 50) * 1.4 + Math.sin(i * 0.31 + st.t * 23) * 0.8) * u * k;
        const half = H0 * (0.5 + Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.9) * (1 - u * 0.3) * (0.8 + 0.4 * Street2D.rnd(i + seed));
        const X = rx - 1 - i, yc = exY + rise + wob;
        g.fillStyle = `rgba(255,${70 + (1 - u) * 70 | 0},20,${0.85 * (1 - u)})`; g.fillRect(X, Math.round(yc - half), 1, Math.max(1, Math.round(half * 2)));
        const hm = half * 0.62 * (1 - u * 0.7); if (hm > 0.4) { g.fillStyle = `rgba(255,${200 + (1 - u) * 40 | 0},70,${0.9 * (1 - u * 0.9)})`; g.fillRect(X, Math.round(yc - hm), 1, Math.max(1, Math.round(hm * 2))); }
        const hc = half * 0.32 * (1 - u * 1.5); if (hc > 0.3) { g.fillStyle = u < 0.15 ? 'rgba(255,255,255,.95)' : 'rgba(170,225,255,.9)'; g.fillRect(X, Math.round(yc - hc), 1, Math.max(1, Math.round(hc * 2))); }
        // lingue che si staccano dal bordo
        if (u > 0.45 && Street2D.rnd(i * 3 + seed) < 0.12) { g.fillStyle = 'rgba(255,120,30,.7)'; g.fillRect(X, Math.round(yc - half - 2 * k), 1, Math.max(1, Math.round(2 * k))); }
      }
      g.restore();
      if (fl > 0.9) {                                                                       // palla di fuoco a un terzo
        const R = Math.round((3 + (fl - 0.9) * 10) * k), fx = rx - L * 0.38, fy = exY - 2 * k;
        g.fillStyle = '#ff5a1a'; this.span(g, fx, fy, R + 1, R); g.fillStyle = '#ffb000'; this.span(g, fx, fy, R, R - 1); g.fillStyle = '#fff6d0'; this.span(g, fx + 1, fy - 1, R * 0.55, R * 0.5);
      }
      if (Math.random() < fl * 0.8) this.parts.push({ k: 'fire', m: dist + (rx - L * (0.3 + Math.random() * 0.5) - carX) / PPM, y: exY - Math.random() * 3 * k, vy: -14 - Math.random() * 18, dx: -30 - Math.random() * 40, r: 1.5 + Math.random() * 2 * k, life: 1 });
      this.light(g, rx - L / 2, exY, L * 1.1, 14, '#ff9a20', 0.22 * Math.min(1, fl), 3);
      this.light(g, rx + 10 * k, exY - 6 * k, 18 * k, 8 * k, '#ff7a20', 0.18 * Math.min(1, fl), 3);   // riverbero sul paraurti
    }
    // anello d'urto alla bocca negli scoppi grossi; la punta cromata si arroventa
    st.ring = Math.max(0, (st.ring || 0) - dt * 5); st.tipHeat = Math.max(0, (st.tipHeat || 0) - dt * 0.6);
    if (st.flame > 1.05 && !(st.ringLock > st.t)) { st.ring = 1; st.ringLock = st.t + 0.25; st.tipHeat = Math.min(1, st.tipHeat + 0.35); }
    if (st.ring > 0.02) { const rr = (1 - st.ring) * 14 * k + 2; g.strokeStyle = `rgba(255,240,200,${st.ring * 0.8})`; g.lineWidth = 1; g.beginPath(); g.ellipse(rx - 2, exY, rr * 0.6, rr, 0, 0, Math.PI * 2); g.stroke(); }
    if (st.tipHeat > 0.03) { g.fillStyle = `rgba(255,${120 + (1 - st.tipHeat) * 80 | 0},40,${st.tipHeat * 0.8})`; g.fillRect(rx, exY - Math.round(k), Math.max(2, Math.round(5 * k)), Math.max(1, Math.round(2 * k))); }
    if (st.popFlash > 0.02) this.light(g, rx - 20, y0, 70 * st.popFlash, 8, '#ff8a20', 0.25 * st.popFlash, 3);   // lampo sull'asfalto
    if (s.running && Math.random() < dt * (s.rpm < 1500 ? 2.5 : 0.6)) this.parts.push({ k: 'puff', m: dist + (rx - carX) / PPM, y: exY, vy: -6, r: 2, life: 1, dx: -8 });
    for (const p of this.parts) {
      if (p.k === 'spray' || p.k === 'spark') {
        p.life -= dt * (p.k === 'spray' ? 2.6 : 1.8); p.m += p.dx / PPM * dt; p.y += p.vy * dt; p.vy += (p.k === 'spark' ? 160 : 90) * dt;
        const X = wx(p.m), Y = Math.round(p.y);
        if (p.k === 'spark') { g.fillStyle = p.life > 0.5 ? '#fff2a0' : '#ff8a20'; g.fillRect(X, Y, 2, 1); g.fillStyle = 'rgba(255,140,40,.5)'; g.fillRect(X - 2, Y, 2, 1); }
        else { g.fillStyle = `rgba(190,215,255,${0.55 * p.life})`; g.fillRect(X, Y, 2, 2); g.fillStyle = `rgba(255,255,255,${0.4 * p.life})`; g.fillRect(X, Y, 1, 1); }
        continue;
      }
      if (p.k === 'fire') {                                                                // pallina di fuoco: gialla, arancio, rossa, poi fumo
        p.life -= dt * 3.2; p.m += p.dx / PPM * dt; p.y += p.vy * dt; p.r += dt * 7;
        const X = wx(p.m), L2 = Math.max(0, p.life);
        if (L2 > 0.35) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = L2 > 0.75 ? 'rgba(255,230,140,.9)' : L2 > 0.55 ? 'rgba(255,150,40,.85)' : 'rgba(220,60,20,.7)'; this.span(g, X, p.y, p.r, p.r); g.restore(); }
        else { g.fillStyle = `rgba(90,92,104,${L2 * 1.2})`; this.span(g, X, p.y, p.r + 1, p.r + 1); }
        continue;
      }
      p.life -= dt * (p.k === 'smoke' ? 0.8 : p.k === 'steam' ? 0.6 : 1.5);
      p.m += p.dx / PPM * dt; p.y += p.vy * dt; p.r += dt * (p.k === 'smoke' ? 18 : 6);
      const r = Math.round(p.r), cx = wx(p.m), a = Math.max(0, p.life) * (p.k === 'steam' ? 0.35 : p.k === 'smoke' ? 0.7 : 0.5);
      const col = p.k === 'puff' ? '107,112,133' : '217,221,232';
      g.fillStyle = `rgba(${col},${a})`; this.span(g, cx, p.y, r, r);
      g.fillStyle = `rgba(255,255,255,${a * 0.4})`; this.span(g, cx - r * 0.3, p.y - r * 0.3, r * 0.5, r * 0.5);
    }
    this.parts = this.parts.filter((p) => p.life > 0 && wx(p.m) > -60 && wx(p.m) < W + 60);
    if (s.v > 22) {
      g.fillStyle = 'rgba(240,244,255,.45)';
      for (let i = 0; i < Math.min(22, (s.v - 22) * 1.1); i++) {
        const y = 40 + Math.floor(Street2D.rnd(i + Math.floor(st.t * 20)) * 300), x = Math.floor(Street2D.rnd(i * 3 + Math.floor(st.t * 20)) * W);
        g.fillRect(x, y, 20 + Math.floor(Street2D.rnd(i) * 60), 1);
      }
    }

    for (const e of front) drawEnt(e);
    // semafori degli incroci, in primo piano sul marciapiede vicino: verde, giallo, rosso a ciclo
    for (let m = Math.floor((visFrom - 140) / 260) * 260 + 130; m < visTo + 20; m += 260) {
      const px2 = wx(m) + 4 * PPM + 10, ph = ((st.t + m * 0.013) % 14 + 14) % 14, light = ph < 8 ? 2 : ph < 10 ? 1 : 0;
      const ax = px2 - 120;
      g.fillStyle = C.ink; g.fillRect(px2 - 2, 108, 6, 252); g.fillRect(ax, 108, px2 - ax + 2, 5);
      g.fillStyle = '#4a5070'; g.fillRect(px2 - 1, 110, 2, 250); g.fillRect(ax, 109, px2 - ax, 2);
      for (const hx of [ax + 6, px2 - 40]) {
        g.fillStyle = C.ink; g.fillRect(hx - 1, 112, 12, 32); g.fillStyle = '#1a1d2a'; g.fillRect(hx, 113, 10, 30);
        const cols = ['#ff2e2e', '#ffb000', '#3bff7a'];
        for (let q = 0; q < 3; q++) { const on = q === light; g.fillStyle = on ? cols[q] : Street2D.shade(cols[q], -0.75); this.span(g, hx + 5, 118 + q * 9, 3, 3); if (on) this.light(g, hx + 5, 118 + q * 9, 22, 18, cols[q], 0.16, 3); }
      }
      if (light !== 1) this.light(g, ax + 60, 260, 120, 30, light ? '#3bff7a' : '#ff2e2e', 0.035, 3);   // riflesso sull'asfalto
      g.fillStyle = C.ink; g.fillRect(px2 - 6, 286, 14, 18); g.fillStyle = light === 2 ? '#3bff7a' : '#ff2e2e'; g.fillRect(px2 - 4, 289, 3, 6); g.fillRect(px2 - 3, 296, 1, 5);   // omino pedonale
    }

    // ---- scritte: cosa succede, scritto in grande
    const cd = (k2, sec) => { const ok = !(this.cool[k2] > st.t); if (ok) this.cool[k2] = st.t + sec; return ok; };
    const carTop = y0 - 60 * k;
    for (const e of s.events || []) {
      if (e.type === 'bov' && cd('bov', 0.6)) this.comic(['PSSSH!', 'PSHHH!', 'TSSS!'][Math.floor(Math.random() * 3)], left + SW * 0.75, carTop - 10, '#2ee6ff', 3);
      if (e.type === 'grind' && cd('grind', 0.8)) this.comic('GRRRK!', carX, carTop - 14, '#ffb000', 3);
    }
    if (game) for (const f of game.fx) if (f.k === 'crash') this.comic('CRASH!', left + SW + 6, carTop, '#ff2e4d', 5, '#ffd23f');
    if ((st.prevV || 0) < 0.6 && s.v >= 0.6 && s.thr > 0.6 && cd('vroom', 3)) this.comic('VROOOM!', carX - 20, carTop - 20, '#ffd23f', 4);
    if (st.flame > 0.55 && st.flame > (st.prevFlame || 0) + 0.3 && cd('bang', 0.5)) { const w = ['BANG!', 'POP!', 'BRAP!', 'PAH!', 'CRACK!'][Math.floor(Math.random() * 5)]; this.comic(w, rx - 40 - Math.random() * 14, exY - 34 - Math.random() * 12, st.flame > 1 ? '#ffd23f' : '#ff5a1a', st.flame > 1 ? 4 : 3, st.flame > 1 ? '#ff2e1a' : '#ffd23f'); }
    if (s.spin > 0.55 && cd('screech', 1.6)) this.comic('SCREEECH!', left + 40 * k, y0 - 46 * k, '#f4f1e6', 2);
    if (game && game.siren && !st.prevSiren) this.comic('ALT! POLIZIA', carX + 40, carTop - 30, '#4f7bff', 3);
    if (game && game.race && game.race.phase === 'run' && game.race.tt < 0.05 && cd('go', 2)) this.comic('VIA!', carX + 80, carTop - 30, '#b8ff3a', 6, '#163a8c');
    st.prevV = s.v; st.prevFlame = st.flame; st.prevSiren = !!(game && game.siren);
    this.drawComics(g, dt);
    // ---- marciapiede vicino con oggetti in primo piano
    g.fillStyle = C.ink; g.fillRect(0, 339, W, 2);
    g.fillStyle = '#5c6386'; g.fillRect(0, 341, W, 2);
    g.fillStyle = C.curb; g.fillRect(0, 343, W, 17);
    g.fillStyle = '#4a5070'; for (let x = -((dist * PPM) % 40); x < W; x += 40) g.fillRect(Math.round(x), 343, 1, 17);
    g.fillStyle = '#33384f'; g.fillRect(0, 351, W, 1);
    for (let m = Math.floor(visFrom / 17) * 17; m < visTo; m += 17) {
      const k = Math.round(m / 17); if (Street2D.rnd(k + 300) < 0.42) continue;
      const kind = Street2D.rnd(k + 303) < 0.06 ? 6 : Math.floor(Street2D.rnd(k + 301) * 6);
      const x = wx(m + Street2D.rnd(k + 302) * 8);
      g.fillStyle = 'rgba(4,5,12,.45)'; g.fillRect(x - 10, 356, 22, 3);
      this.prop(g, kind, x, 358, st.t);
    }

    // ---- linee di velocità sopra i 90 km/h circa
    if (Math.abs(s.v) > 25) {
      const k2 = Math.min(1, (Math.abs(s.v) - 25) / 25);
      g.fillStyle = `rgba(230,236,255,${0.18 * k2})`;
      for (let i = 0; i < 22; i++) {
        const y = 230 + Street2D.rnd(i * 5 + 1) * 125, len = 18 + Street2D.rnd(i * 5 + 2) * 60 * k2;
        const x = ((Street2D.rnd(i * 5 + 3) * W * 2 - st.t * (600 + i * 25)) % (W + len) + W + len) % (W + len) - len;
        g.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
      }
    }
    if ((st.bolt || 0) > 0.05) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(150,170,220,${0.35 * st.bolt * st.bolt})`; g.fillRect(0, 0, W, 360); g.restore(); }
    // ---- luce del giorno su tutta la scena (le insegne restano accese ma perdono forza)
    if (dd > 0.01 || ss > 0.01) {
      g.save(); g.globalCompositeOperation = 'screen';
      g.fillStyle = `rgba(110,130,160,${0.32 * dd})`; g.fillRect(0, 0, W, 360);
      if (ss > 0.01) { g.fillStyle = `rgba(255,150,90,${0.16 * ss})`; g.fillRect(0, 0, W, 360); }
      g.restore();
    }
    // ---- pioggia: trattini a pixel inclinati con la velocità, schizzi sull'asfalto, velo più scuro
    if (this.rainOn) {
      g.fillStyle = 'rgba(10,14,28,.18)'; g.fillRect(0, 0, W, 360);
      const sl = Math.min(6, Math.abs(s.v) * 0.12), n = 260;
      g.fillStyle = 'rgba(170,190,230,.45)';
      for (let i = 0; i < n; i++) {
        const sx = (Street2D.rnd(i * 3 + 1) * (W + 60) - (st.t * (60 + Math.abs(s.v) * 25) + i * 7) % (W + 60) + W + 60) % (W + 60) - 30;
        const sy = (Street2D.rnd(i * 3 + 2) * 360 + st.t * (420 + Street2D.rnd(i) * 160)) % 360;
        for (let k = 0; k < 5; k++) g.fillRect(Math.round(sx + k * sl / 5), Math.round(sy - k * 2), 1, 2);
      }
      g.fillStyle = 'rgba(190,210,240,.55)';
      for (let i = 0; i < 26; i++) { const x = Street2D.rnd(i + Math.floor(st.t * 9) * 31) * W, y = 230 + Street2D.rnd(i * 7 + Math.floor(st.t * 9)) * 110; g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 1); }
    }

    // ---- gara: semaforo da drag grande, barra di avanzamento, striscione a scacchi
    if (game && game.race) {
      const R = game.race, tx = Math.round(W * 0.66), ty = 74;
      if (R.phase === 'count' || (R.phase === 'run' && R.tt < 1.6)) {
        const lit = R.phase === 'run' ? 4 : R.t < 1 ? 3 : R.t < 2 ? 2 : R.t < 3 ? 1 : 0;
        g.fillStyle = C.ink; g.fillRect(tx - 2, ty + 120, 6, 40); g.fillRect(tx - 18, ty - 4, 38, 128);
        g.fillStyle = '#1b1d28'; g.fillRect(tx - 16, ty - 2, 34, 124);
        for (let i = 0; i < 4; i++) {
          const on = i < 3 ? lit > i && lit < 4 : lit === 4, col = i < 3 ? '#ffb000' : '#3cff6a', yy = ty + 14 + i * 30;
          g.fillStyle = on ? col : '#33281a'; this.span(g, tx + 1, yy, 10, 10);
          if (on) { g.fillStyle = '#fff6d0'; this.span(g, tx - 2, yy - 3, 3, 3); this.light(g, tx + 1, yy, 34, 30, col, 0.28, 4); }
        }
      }
      if (R.phase === 'run') {
        const rival = game.ents.find((e) => e.kind === 'rival'), bx = Math.round(W * 0.3), bw = Math.round(W * 0.4), by = 14;
        g.fillStyle = 'rgba(8,8,14,.75)'; g.fillRect(bx - 4, by - 4, bw + 8, 14);
        g.fillStyle = '#3a3f58'; g.fillRect(bx, by + 3, bw, 2);
        for (let q = 0; q <= 4; q++) g.fillRect(bx + Math.round(bw * q / 4), by, 1, 8);
        for (let q = 0; q < 6; q++) { g.fillStyle = q % 2 ? '#f4f1e6' : C.ink; g.fillRect(bx + bw - 3 + (q % 2) * 3, by - 2 + Math.floor(q / 2) * 4, 3, 4); }
        const mark = (m, col) => { const xx = bx + Math.round(Math.max(0, Math.min(1, m / 402.3)) * bw); g.fillStyle = C.ink; g.fillRect(xx - 4, by - 1, 9, 8); g.fillStyle = col; g.fillRect(xx - 3, by, 7, 6); };
        if (rival) mark(rival.x - R.x0, '#b8b8c8');
        mark(game.s.dist - R.x0, this.paintHex);
      }
    }

    // ---- su schermo
    if (!this.visible) return;
    const shake = Math.round((bF + bR) * 0.05 + (st.popJolt > 0.8 ? (Math.random() < 0.5 ? -1 : 1) : 0));
    const shakeX = st.popJolt > 0.8 ? Math.round((Math.random() - 0.5) * 3) : 0;
    this.present(shake, shakeX);
  }

  present(shake, shakeX) {
    if (!this.visible) return;
    const c = this.ctx; c.imageSmoothingEnabled = false;
    c.fillStyle = '#04060b'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // inquadratura: zoom su un punto (sigla) o scena intera
    const z = Math.max(1, this.zoom || 1), pad = this.padBottom || 0;
    let src = [0, 0, this.LW, this.LH];
    if (z > 1.001 || pad) {
      // padBottom: la ripresa può scendere sotto la scena (lì c'è la banda nera della sigla)
      const sw = this.LW / z, sh = this.LH / z, f = this.zoomFocus || { x: this.LW / 2, y: this.LH / 2 };
      const sx = Math.max(0, Math.min(this.LW - sw, f.x - sw / 2)), sy = Math.max(0, Math.min(this.LH - sh + pad, f.y - sh / 2));
      src = [sx, sy, sw, sh];
      c.drawImage(this.lo, sx + shakeX / z, sy + shake / z, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
    } else c.drawImage(this.lo, shakeX * (this.canvas.height / this.LH), shake * (this.canvas.height / this.LH), this.canvas.width, this.canvas.height);
    // bagliore: copia ridotta, tenute solo le parti luminose, ingrandita e sommata (neon, fari, fiamme, lampioni)
    if (typeof c.filter === 'string' && this.glow !== false && (this.quality || 'alta') === 'alta') {
      const bw = Math.max(1, Math.round(this.LW / 4)), bh = 90;
      if (!this.bl) { this.bl = document.createElement('canvas'); }
      if (this.bl.width !== bw) { this.bl.width = bw; this.bl.height = bh; }
      const b = this.bl.getContext('2d');
      b.filter = 'brightness(0.55) contrast(3.2) blur(2px)'; b.clearRect(0, 0, bw, bh); b.drawImage(this.lo, src[0], src[1], src[2], src[3], 0, 0, bw, bh); b.filter = 'none';
      c.save(); c.imageSmoothingEnabled = true; c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 - (this.day || 0) * 0.3;
      c.drawImage(this.bl, 0, 0, this.canvas.width, this.canvas.height); c.restore();
    }
    // vignettatura
    if (!this.vg || this.vg.w !== this.canvas.width) {
      const W2 = this.canvas.width, H2 = this.canvas.height, gr = c.createRadialGradient(W2 / 2, H2 * 0.55, H2 * 0.35, W2 / 2, H2 * 0.55, Math.max(W2, H2) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); this.vg = { w: W2, gr };
    }
    c.fillStyle = this.vg.gr; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bars > 0.001) { const bh = Math.round(this.canvas.height * this.bars); c.fillStyle = '#000'; c.fillRect(0, 0, this.canvas.width, bh); c.fillRect(0, this.canvas.height - bh, this.canvas.width, bh); }
  }
}
