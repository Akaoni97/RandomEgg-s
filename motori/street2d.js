// ============================================================================
//  Street2D · strada notturna in pixel art cartoonesca, vista di lato
//  Stessa interfaccia della vista 3D: update(dt, stato, gioco), setPaint, resize.
//  Tela a bassa risoluzione (180 px di altezza) ingrandita a pixel netti.
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

class Street2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lo = document.createElement('canvas');
    this.g = this.lo.getContext('2d');
    this.LH = 180;
    this.paintHex = '#c81d11'; this.dual = false;
    this.st = { heave: 0, hv: 0, pitch: 0, pv: 0, spin: 0, front: 0, t: 0, flame: 0, lz: 3.5, head: 0, hdv: 0 };
    this.parts = [];
    this.spr = {};
    this.tiles = new Map();
    this.visible = true;
    this.C = {
      ink: '#0a0d18', road: '#23273c', road2: '#1c2032', road3: '#2b3048', line: '#e8e4d6', curb: '#3a3f58', walk: '#2b2f45',
      sky: ['#0b0a24', '#141238', '#1d1a4a', '#28225a', '#352a68', '#463272', '#56397a'],
      mid: ['#123049', '#1b2a52', '#2a1f4f', '#163d4a', '#2b2a5c'],
      win: ['#ffd36b', '#ffe6a3', '#7fe7ff', '#ffb35c', '#ff9ccf'], neon: ['#2ee6ff', '#ff2e88', '#b8ff3a', '#ffb000', '#b07bff'],
      lamp: '#ffd27a', moon: '#fff1c9', skin: '#e3a97a',
    };
    this.resize();
  }

  // ---------------------------------------------------------------- utilità pixel
  static rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  static shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  static bayer(x, y) { const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; return m[(x & 3) + (y & 3) * 4] / 16; }

  // scritta con carattere a pixel 3×5
  text(g, str, x, y, color, shadow) {
    let cx = Math.round(x);
    for (const ch of String(str).toUpperCase()) {
      const m = PX_FONT[ch] || PX_FONT[' '];
      for (let i = 0; i < 15; i++) if (m[i] === '1') {
        if (shadow) { g.fillStyle = shadow; g.fillRect(cx + (i % 3) + 1, Math.round(y) + Math.floor(i / 3) + 1, 1, 1); }
        g.fillStyle = color; g.fillRect(cx + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
      }
      cx += 4;
    }
  }
  textW(str) { return String(str).length * 4 - 1; }

  // area retinata (luci, ombre, foschia)
  dith(g, x, y, w, h, color, alpha) {
    g.fillStyle = color;
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.LH, y + h); yy++)
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.LW, x + w); xx++)
        if (Street2D.bayer(xx, yy) < alpha) g.fillRect(xx, yy, 1, 1);
  }
  ellipse(g, cx, cy, rx, ry, color, alpha) {
    g.fillStyle = color;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const q = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (q > 1) continue;
      const px = Math.round(cx + x), py = Math.round(cy + y);
      if (Street2D.bayer(px, py) < alpha * (1 - q * 0.6)) g.fillRect(px, py, 1, 1);
    }
  }

  // tracciati del canvas → pixel netti + contorno scuro (stile cartone)
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
  // dettagli a pixel singolo dopo la pulizia dei bordi
  touch(c, fn) { const x = c.getContext('2d'); x.save(); x.translate(1, 1); fn(x); x.restore(); return c; }

  // ---------------------------------------------------------------- la Supra
  carSprite() {
    if (this.spr.car && this.spr.carHex === this.paintHex) return this.spr.car;
    const P = this.paintHex, D = Street2D.shade(P, -0.4), DD = Street2D.shade(P, -0.6), L = Street2D.shade(P, 0.35), LL = Street2D.shade(P, 0.65);
    const body = 'M5 25 L4 17 Q5 13 12 12.5 L30 12 Q36 3.5 46 3.5 L54 4.5 Q60 8.5 64 12.5 L75 14.5 Q79 16 79 20 L78 25 Z';
    const c = this.sprite(84, 30, (x) => {
      const b = new Path2D(body);
      x.fillStyle = P; x.fill(b);
      x.save(); x.clip(b);
      x.fillStyle = D; x.fillRect(0, 21, 90, 10);
      x.fillStyle = DD; x.fillRect(0, 24, 90, 4);
      x.restore();
      x.fillStyle = '#0f1d38'; x.fill(new Path2D('M33 12.3 Q38.5 5.5 46 5.5 L53.3 6.3 Q57.5 8.8 61 12.3 Z'));
      x.fillStyle = D; x.fillRect(1, 8, 16, 3); x.fillRect(6, 10, 2, 4); x.fillRect(12, 10, 2, 3);
      x.fillStyle = '#0a0d18'; for (const cx of [20, 63]) { x.beginPath(); x.arc(cx, 26, 10.5, Math.PI, 0); x.fill(); }
    });
    this.touch(c, (x) => {
      const px = (col, xx, yy, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(xx, yy, w, h); };
      px(LL, 38, 4, 12); px(L, 50, 5, 5); px(L, 13, 12, 17); px(LL, 66, 14, 8);          // luce su tetto e cofano
      px(L, 9, 15, 66);                                                                     // linea di fiancata
      px(D, 46, 6, 1, 6); px(DD, 45, 12, 1, 12); px(DD, 33, 13, 1, 11);                    // montante e portiere
      px(LL, 40, 16, 3); px(DD, 40, 17, 3);                                                 // maniglia
      px(DD, 25, 15, 3, 3); px(D, 26, 16, 1, 1);                                            // tappo benzina
      px('#6fd8ff', 38, 7, 5); px('#6fd8ff', 37, 8, 3); px('#3c7fb0', 49, 7, 4); px('#3c7fb0', 48, 8, 2);   // riflessi sul vetro
      px(D, 57, 9, 3, 2); px(DD, 58, 11, 1, 1);                                             // specchietto
      px('#ffb000', 72, 20, 2, 1);                                                          // luce laterale
      px('#3a0805', 4, 15, 3, 3); px('#a3150c', 5, 15, 2, 2);                               // fanale
      px('#fff7d6', 76, 16, 3, 2); px('#ffffff', 77, 16, 1, 1); px('#c9b98a', 75, 18, 4, 1); // faro
      px('#14161e', 74, 23, 6, 2); px('#14161e', 3, 23, 6, 2); px('#4a5070', 4, 24, 1, 1); px('#4a5070', 6, 24, 1, 1);  // labbro e diffusore
      px('#d6dbe4', 1, 22, 3, 3); px('#14161e', 1, 23, 2, 1);                               // terminale cromato
      if (this.dual) px('#d6dbe4', 8, 23, 3, 2);
      this.text(x, '2JZ', 50, 18, LL);
      px(DD, 30, 22, 26, 1);                                                                // minigonna
    });
    this.spr.car = c; this.spr.carHex = P;
    return c;
  }

  // auto del traffico, polizia, rivale
  otherSprite(kind, color) {
    const key = kind + color;
    if (this.spr[key]) return this.spr[key];
    const P = kind === 'police' ? '#163a8c' : '#' + (color || 0x777777).toString(16).padStart(6, '0');
    const D = Street2D.shade(P, -0.4), DD = Street2D.shade(P, -0.6), L = Street2D.shade(P, 0.35), LL = Street2D.shade(P, 0.6);
    const sport = kind === 'rival';
    const c = this.sprite(80, 30, (x) => {
      const body = new Path2D(sport ? 'M4 25 L4 16 Q6 13 14 13 L28 12 Q35 5 45 5 L54 6 Q60 10 63 13 L74 15 Q78 17 78 21 L77 25 Z'
        : 'M4 25 L3 15 Q4 12 10 12 L22 12 L28 3 L56 3 L62 12 L74 13 Q78 14 78 19 L77 25 Z');
      x.fillStyle = P; x.fill(body);
      x.save(); x.clip(body); x.fillStyle = D; x.fillRect(0, 21, 90, 10); x.fillStyle = DD; x.fillRect(0, 24, 90, 4); x.restore();
      x.fillStyle = '#0f1d38'; x.fill(new Path2D(sport ? 'M31 12.5 Q36 7 45 7 L53 7.6 Q57 10 60 12.5 Z' : 'M24 12 L29.5 5 L41 5 L41 12 Z M43 12 L43 5 L55 5 L60 12 Z'));
      if (sport) { x.fillStyle = D; x.fillRect(1, 9, 14, 3); x.fillRect(6, 11, 2, 3); }
      if (kind === 'police') { x.fillStyle = '#eef2ff'; x.fillRect(20, 13, 36, 8); x.fillStyle = '#2a2f45'; x.fillRect(33, 0, 16, 3); }
      x.fillStyle = '#0a0d18'; for (const cx of [19, 61]) { x.beginPath(); x.arc(cx, 26, 10.5, Math.PI, 0); x.fill(); }
    });
    this.touch(c, (x) => {
      const px = (col, xx, yy, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(xx, yy, w, h); };
      if (sport) { px(LL, 36, 6, 10); px(L, 14, 13, 14); } else { px(LL, 29, 4, 26); px(L, 10, 12, 12); px(L, 62, 12, 10); }
      px(L, 8, 15, 64);
      px('#6fd8ff', sport ? 36 : 30, 7, 4); px('#3c7fb0', sport ? 48 : 45, 7, 4);
      px(DD, 42, 6, 1, 18); px(LL, 34, 16, 3); px(LL, 50, 16, 3);
      px('#3a0805', 3, 15, 3, 3); px('#a3150c', 4, 15, 2, 2);
      px('#fff7d6', 75, 16, 3, 2); px('#ffb000', 70, 20, 2, 1);
      px('#14161e', 3, 23, 6, 2); px('#14161e', 73, 23, 6, 2);
      if (kind === 'police') { this.text(x, 'POLIZIA', 22, 15, '#163a8c'); px('#163a8c', 20, 21, 36, 1); }
    });
    this.spr[key] = c;
    return c;
  }

  setPaint(hex) { if (hex && hex !== 'model') { this.paintHex = hex; this.spr.car = null; } }
  setTips(n) { const d = n > 1; if (d !== this.dual) { this.dual = d; this.spr.car = null; } }
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

  laneY(z) { return z > 5 ? 112 : 160 - (3.5 - z) / 3.5 * 22; }
  laneS(y) { return 0.72 + (y - 112) / 48 * 0.28; }

  // ---------------------------------------------------------------- ruote
  wheel(g, cx, cy, r, ang, speed) {
    cx = Math.round(cx); cy = Math.round(cy);
    const blur = speed > 14;
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const q = x * x + y * y;
      if (q > (r + 1.2) * (r + 1.2)) continue;
      let col;
      if (q > r * r) col = this.C.ink;
      else if (q > (r - 1) * (r - 1)) col = '#2a2d38';
      else if (q > (r - 3) * (r - 3)) col = (y < -r + 3 && x < 0) ? '#30343f' : '#16181f';
      else if (q > (r - 4) * (r - 4)) col = '#dfe5ef';
      else if (q > 2) col = blur ? '#8a93a6' : '#545c6e';
      else col = '#eef3fa';
      g.fillStyle = col; g.fillRect(cx + x, cy + y, 1, 1);
    }
    const rr = r - 4;
    g.fillStyle = '#c42a1a'; g.fillRect(cx - Math.round(rr * 0.75), cy - Math.round(rr * 0.55), 2, 3);   // pinza
    if (blur) {
      g.fillStyle = '#b3bccb';
      for (let a = 0; a < Math.PI * 2; a += 0.35) g.fillRect(Math.round(cx + Math.cos(a) * (rr - 1)), Math.round(cy + Math.sin(a) * (rr - 1)), 1, 1);
      return;
    }
    for (let k = 0; k < 5; k++) {
      const a = ang + k * Math.PI * 2 / 5;
      for (let t = 1.5; t < rr; t += 0.6) {
        g.fillStyle = '#c8d0dc'; g.fillRect(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), 1, 1);
        g.fillStyle = '#8a93a6'; g.fillRect(Math.round(cx + Math.cos(a + 0.18) * t), Math.round(cy + Math.sin(a + 0.18) * t), 1, 1);
      }
    }
  }

  cone(g, x0, y0, x1a, y1a, x1b, y1b, color, alpha) {
    const minX = Math.floor(Math.min(x0, x1a, x1b)), maxX = Math.ceil(Math.max(x0, x1a, x1b));
    const minY = Math.floor(Math.min(y0, y1a, y1b)), maxY = Math.ceil(Math.max(y0, y1a, y1b));
    const s = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    g.fillStyle = color;
    const L = Math.hypot(x1a - x0, y1a - y0);
    for (let y = Math.max(0, minY); y <= Math.min(this.LH - 1, maxY); y++) for (let x = Math.max(0, minX); x <= Math.min(this.LW - 1, maxX); x++) {
      const a = s(x0, y0, x1a, y1a, x, y), b = s(x1a, y1a, x1b, y1b, x, y), c = s(x1b, y1b, x0, y0, x, y);
      if (!((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0))) continue;
      if (Street2D.bayer(x, y) < alpha * (1 - Math.hypot(x - x0, y - y0) / L * 0.7)) g.fillRect(x, y, 1, 1);
    }
  }

  // ---------------------------------------------------------------- cielo (in cache), nuvole, aereo
  drawSky(g, t, dist) {
    const W = this.LW, b = this.C.sky;
    if (!this.skyCache || this.skyCache.width !== W) {
      const c = document.createElement('canvas'); c.width = W; c.height = 112; const x = c.getContext('2d');
      for (let i = 0; i < b.length; i++) { x.fillStyle = b[i]; x.fillRect(0, i * 16, W, 16); }
      for (let i = 0; i < b.length - 1; i++) for (let y = 0; y < 5; y++) for (let xx = 0; xx < W; xx++) if (Street2D.bayer(xx, y) < (y + 1) / 6) { x.fillStyle = b[i + 1]; x.fillRect(xx, i * 16 + 11 + y, 1, 1); }
      for (let y = 70; y < 112; y++) for (let xx = 0; xx < W; xx++) if (Street2D.bayer(xx, y) < (y - 70) / 90) { x.fillStyle = '#7a3f6e'; x.fillRect(xx, y, 1, 1); }
      const mx = W - 46, my = 24;
      for (let y = -16; y <= 16; y++) for (let xx = -16; xx <= 16; xx++) { const q = xx * xx + y * y; if (q < 256 && q > 150 && Street2D.bayer(mx + xx, my + y) < 0.3) { x.fillStyle = '#5a4a8a'; x.fillRect(mx + xx, my + y, 1, 1); } }
      for (let y = -12; y <= 12; y++) for (let xx = -12; xx <= 12; xx++) {
        const q = xx * xx + y * y; if (q > 150) continue;
        const crater = (xx + 4) ** 2 + (y + 3) ** 2 < 10 || (xx - 4) ** 2 + (y - 5) ** 2 < 5 || (xx - 5) ** 2 + (y + 6) ** 2 < 3;
        x.fillStyle = q > 132 ? this.C.ink : crater ? '#e6d4a6' : xx + y > 8 ? '#f0dfb4' : this.C.moon; x.fillRect(mx + xx, my + y, 1, 1);
      }
      this.skyCache = c;
    }
    g.drawImage(this.skyCache, 0, 0);
    for (let i = 0; i < 80; i++) {
      const x = Math.floor(Street2D.rnd(i) * W), y = Math.floor(Street2D.rnd(i + 50) * 78);
      const tw = Math.sin(t * (2 + Street2D.rnd(i + 9) * 3) + i) > 0.55;
      g.fillStyle = tw ? '#ffffff' : '#7f88d8'; g.fillRect(x, y, 1, 1);
      if (tw && i % 9 === 0) { g.fillStyle = '#c9d0ff'; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
    }
    if (!this.spr.clouds) {
      this.spr.clouds = [0, 1, 2].map((k) => this.sprite(46 + k * 10, 12, (x) => {
        x.fillStyle = '#3a3474';
        for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(6 + i * (7 + k * 1.6), 7 - Math.sin(i * 1.7 + k) * 2.5, 5 + Street2D.rnd(i + k * 7) * 2, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = '#4c4590'; x.fillRect(4, 2, 30, 2);
      }, false));
    }
    this.spr.clouds.forEach((c, k) => {
      const span = W + 120, x = ((-(t * (1.5 + k)) - dist * 0.02 + k * 157) % span + span) % span - 60;
      g.drawImage(c, Math.round(x), 18 + k * 13);
    });
    const ax = ((t * 6) % (W + 40)) - 20, ay = 12 + Math.sin(t * 0.2) * 2;
    g.fillStyle = '#2a2850'; g.fillRect(Math.round(ax), Math.round(ay), 4, 1);
    if (Math.floor(t * 2) % 2) { g.fillStyle = '#ff3b3b'; g.fillRect(Math.round(ax), Math.round(ay), 1, 1); }
    else { g.fillStyle = '#ffffff'; g.fillRect(Math.round(ax) + 3, Math.round(ay), 1, 1); }
  }

  // ---------------------------------------------------------------- palazzi (cache per tessera)
  building(layer, i) {
    const key = layer + ':' + i;
    let t = this.tiles.get(key);
    if (t) return t;
    const far = layer === 'far';
    const r = (k) => Street2D.rnd(i * 13.7 + (far ? 1 : 77) + k);
    const w = far ? 20 + Math.floor(r(1) * 18) : 24 + Math.floor(r(1) * 18);
    const h = far ? 22 + Math.floor(r(2) * 34) : 30 + Math.floor(r(2) * 44);
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 12;
    const x = c.getContext('2d'), top = 11;
    const px = (col, xx, yy, ww = 1, hh = 1) => { x.fillStyle = col; x.fillRect(xx, yy, ww, hh); };
    const base = far ? ['#171640', '#1c1a4a', '#141338'][Math.floor(r(4) * 3)] : this.C.mid[Math.floor(r(4) * this.C.mid.length)];
    const meta = { w: w + 2, h: h + 12, signs: [], beacons: [] };
    px(this.C.ink, 0, top - 1, w + 2, h + 1);
    px(base, 1, top, w, h);
    if (!far) {
      px(Street2D.shade(base, 0.18), 1, top, 2, h); px(Street2D.shade(base, -0.3), w, top, 1, h);
      for (let yy = top + 12; yy < top + h - 10; yy += 12) px(Street2D.shade(base, 0.12), 1, yy, w, 1);
      px(Street2D.shade(base, 0.25), 1, top, w, 1);
    }
    const ww = far ? 2 : 3, step = far ? 4 : 5, yEnd = top + h - (far ? 3 : 11);
    for (let yy = top + 3; yy < yEnd; yy += far ? 5 : 6) for (let xx = 3; xx < w - 2; xx += step) {
      const q = r(xx * 0.31 + yy * 1.7);
      if (far) { if (q < 0.7) continue; px(q > 0.93 ? '#8a86d0' : '#4b468f', xx, yy, ww, 2); continue; }
      if (q < 0.32) { px('#0d1426', xx, yy, ww, 3); continue; }
      const col = this.C.win[Math.floor(r(xx + yy) * this.C.win.length)];
      px(col, xx, yy, ww, 3);
      const v = r(xx * 2.1 + yy);
      if (v < 0.2) px(Street2D.shade(col, -0.45), xx, yy + 1, ww, 2);            // tende
      else if (v < 0.3) px('#1a1530', xx + 1, yy + 1, 1, 2);                      // sagoma
      else if (v < 0.36) px('#5d8cff', xx, yy, ww, 3);                            // TV
      if (r(xx + yy * 3.3) < 0.12) px('#8a90a6', xx, yy + 3, 2, 1);               // condizionatore
    }
    if (!far && r(11) < 0.3) {                                                     // scala antincendio
      for (let yy = top + 10; yy < top + h - 12; yy += 12) { px('#0b0f1c', w - 9, yy, 8, 1); for (let k = 0; k < 6; k++) px('#0b0f1c', w - 2 - k, yy + 1 + k * 2, 1, 1); }
    }
    const roof = r(12);
    if (roof < 0.25) { px(this.C.ink, 4, top - 8, 9, 8); px('#6b4a2e', 5, top - 7, 7, 6); px('#8a6440', 5, top - 7, 7, 1); px(this.C.ink, 5, top - 2, 1, 2); px(this.C.ink, 11, top - 2, 1, 2); }
    else if (roof < 0.5) { px(this.C.ink, 5, top - 10, 1, 10); px(this.C.ink, 3, top - 7, 5, 1); meta.beacons.push({ x: 5, y: top - 11 }); }
    else if (roof < 0.62 && !far && w > 26) {
      px(this.C.ink, 3, top - 11, w - 4, 10); px('#f2e9d0', 4, top - 10, w - 6, 8);
      px('#ff2e88', 6, top - 8, 8, 4); px('#2ee6ff', 16, top - 8, w - 22, 1); px('#2ee6ff', 16, top - 6, w - 26, 1);
      px(this.C.ink, 6, top - 1, 1, 1); px(this.C.ink, w - 4, top - 1, 1, 1);
    } else if (far && roof < 0.7) meta.beacons.push({ x: Math.floor(w / 2), y: top - 1 });
    if (!far) {                                                                     // negozio al piano terra
      const gy = top + h - 9;
      px('#0b0f1c', 1, gy, w, 9);
      const lit = r(13) < 0.7;
      px(lit ? '#ffe6a3' : '#1b2a44', 3, gy + 3, w - 9, 5);
      if (lit) { px('#d9a85a', 3, gy + 6, w - 9, 2); px('#6b4a2e', 5, gy + 4, 2, 2); px('#2b8a6e', 10, gy + 4, 3, 3); }
      px('#2a1d12', w - 5, gy + 3, 3, 6);
      const aw = [['#ff2e88', '#f2e9d0'], ['#2ee6ff', '#123049'], ['#b8ff3a', '#1b2a52'], ['#ffb000', '#2a1f4f']][Math.floor(r(14) * 4)];
      for (let k = 1; k < w + 1; k++) px(k % 4 < 2 ? aw[0] : aw[1], k, gy, 1, 2);
      for (let k = 1; k < w + 1; k += 2) px(aw[0], k, gy + 2, 1, 1);
    }
    if (!far && r(6) < 0.55) {                                                      // insegna al neon
      const words = ['RAMEN', 'BAR', '24H', 'HOTEL', 'GARAGE', 'SUSHI', 'MOTEL', 'AUTO', 'DISCO', 'GOMME', 'PIZZA', 'CAFE'];
      let word = words[Math.floor(r(7) * words.length)];
      while (this.textW(word) > w - 6) word = word.slice(0, -1);
      meta.signs.push({ word, x: Math.round((w + 2 - this.textW(word)) / 2), y: top + 4 + Math.floor(r(8) * 8), col: this.C.neon[Math.floor(r(9) * this.C.neon.length)], flick: r(10) < 0.2 });
    }
    t = { c, ...meta };
    this.tiles.set(key, t);
    if (this.tiles.size > 220) this.tiles.delete(this.tiles.keys().next().value);
    return t;
  }

  drawCity(g, dist, t, layer, speed, baseY, tileW) {
    const off = dist * speed;
    const i0 = Math.floor(off / tileW) - 2, i1 = i0 + Math.ceil(this.LW / tileW) + 4;
    for (let i = i0; i < i1; i++) {
      const b = this.building(layer, i), x = Math.round(i * tileW - off + Street2D.rnd(i * 3.1 + speed) * 6), y = baseY - b.h + 1;
      if (x > this.LW || x + b.w < 0) continue;
      g.drawImage(b.c, x, y);
      for (const s of b.signs) {
        const on = !s.flick || Math.sin(t * 13 + i) > -0.6 || Math.sin(t * 2.3 + i) > 0.3;
        const w = this.textW(s.word);
        if (on) this.dith(g, x + s.x - 5, y + s.y - 5, w + 10, 15, s.col, 0.14);          // alone sotto l'insegna
        g.fillStyle = this.C.ink; g.fillRect(x + s.x - 2, y + s.y - 2, w + 4, 9);
        g.fillStyle = on ? Street2D.shade(s.col, -0.72) : '#141826'; g.fillRect(x + s.x - 1, y + s.y - 1, w + 2, 7);
        this.text(g, s.word, x + s.x, y + s.y, on ? s.col : '#3a3f58');
      }
      for (const bc of b.beacons) if (Math.floor(t * 1.5 + i) % 2) { g.fillStyle = '#ff3b3b'; g.fillRect(x + bc.x, y + bc.y, 1, 1); }
    }
  }

  // ---------------------------------------------------------------- asfalto (tessera in cache)
  roadTile() {
    if (this.spr.road) return this.spr.road;
    const c = document.createElement('canvas'); c.width = 128; c.height = 52; const x = c.getContext('2d');
    x.fillStyle = this.C.road; x.fillRect(0, 0, 128, 52);
    for (let i = 0; i < 380; i++) { x.fillStyle = Street2D.rnd(i) > 0.5 ? this.C.road2 : this.C.road3; x.fillRect(Math.floor(Street2D.rnd(i + 1) * 128), Math.floor(Street2D.rnd(i + 2) * 52), 1, 1); }
    x.fillStyle = '#1f2335'; x.fillRect(70, 30, 26, 9);
    x.fillStyle = this.C.road2; x.fillRect(70, 30, 26, 1);
    x.fillStyle = '#15182a';
    let cx = 20, cy = 10; for (let k = 0; k < 14; k++) { x.fillRect(cx, cy, 1, 1); cx += 1; cy += Street2D.rnd(k + 40) > 0.5 ? 1 : 0; }
    cx = 100; cy = 44; for (let k = 0; k < 10; k++) { x.fillRect(cx, cy, 1, 1); cx += 1; cy -= Street2D.rnd(k + 60) > 0.6 ? 1 : 0; }
    this.spr.road = c;
    return c;
  }

  // ---------------------------------------------------------------- oggetti del marciapiede vicino
  prop(g, kind, x, base) {
    const px = (col, xx, yy, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x + xx), Math.round(base + yy), w, h); };
    if (kind === 0) { px(this.C.ink, -3, -11, 7, 11); px('#c42a1a', -2, -10, 5, 10); px('#ff5a45', -2, -10, 1, 9); px(this.C.ink, -4, -7, 9, 2); px('#e8e4d6', -1, -12, 3, 1); }          // idrante
    else if (kind === 1) { px(this.C.ink, -2, -12, 5, 12); px('#8a90a6', -1, -11, 3, 11); px('#ffb000', -1, -9, 3, 2); px('#c9ced6', -1, -11, 1, 11); }                           // paletto
    else if (kind === 2) { px(this.C.ink, -4, -12, 9, 12); px('#1f6b4a', -3, -11, 7, 11); px('#2b8a6e', -3, -11, 1, 11); px(this.C.ink, -4, -12, 9, 1); px('#0f3d2a', -3, -9, 7, 1); px('#0f3d2a', -3, -5, 7, 1); }   // cestino
    else if (kind === 3) { px(this.C.ink, 0, -14, 1, 14); px(this.C.ink, -2, -18, 5, 6); px('#c9ced6', -1, -17, 3, 4); px('#2ee6ff', -1, -16, 3, 1); }                       // parchimetro
    else { px(this.C.ink, -4, -11, 9, 11); px('#1d4fa8', -3, -10, 7, 10); px('#e8e4d6', -2, -8, 5, 3); px('#5d8cff', -3, -10, 1, 10); }                                   // giornali
  }

  // ---------------------------------------------------------------- aggiornamento
  update(dt, s, game) {
    const st = this.st, g = this.g, W = this.LW, C = this.C;
    st.t += dt;
    const dist = game ? game.s.dist : (this.dist || 0) + s.v * dt; this.dist = dist;
    const PPM = 13, carX = Math.round(W * 0.36);
    const wx = (m) => Math.round(carX + (m - dist) * PPM);
    const visFrom = dist - carX / PPM - 10, visTo = dist + (W - carX) / PPM + 10;

    const zT = game ? game.laneZ : 3.5;
    st.lzV = (st.lzV || 0) + ((zT - st.lz) * 9 - (st.lzV || 0) * 6) * dt; st.lz += st.lzV * dt;

    const H = (typeof Garage3D !== 'undefined' && Garage3D.roadH) ? Garage3D.roadH : () => 0;
    const sp = Math.min(1, Math.abs(s.v) / 3);
    const bF = H(dist + 1.28, 1) * sp * 160, bR = H(dist - 1.28, 1) * sp * 160;
    const tgtP = Math.max(-0.08, Math.min(0.08, s.acc * 0.009)) + (bF - bR) * 0.01;
    st.pv += ((tgtP - st.pitch) * 140 - st.pv * 10) * dt; st.pitch += st.pv * dt;
    st.hv += (((bF + bR) / 2 - st.heave) * 140 - st.hv * 10) * dt; st.heave += st.hv * dt;
    st.hdv += ((Math.max(-3, Math.min(3, -s.acc * 0.35)) - st.head) * 90 - st.hdv * 8) * dt; st.head += st.hdv * dt;
    st.spin += s.ww * dt; st.front += s.v / 0.322 * dt;
    const idleShake = s.running ? Math.sin(st.t * Math.max(s.rpm, 120) / 60 * 3 * Math.PI * 2) * (s.rpm < 1600 ? 0.6 + 1.2 * (s.lope || 0) : 0.25) : 0;

    // ---- sfondo
    this.drawSky(g, st.t, dist);
    this.drawCity(g, dist, st.t, 'far', 0.06, 98, 26);
    this.dith(g, 0, 78, W, 22, '#463272', 0.18);
    this.drawCity(g, dist, st.t, 'mid', 0.22, 108, 36);

    // ---- marciapiede lontano, pedoni
    g.fillStyle = C.ink; g.fillRect(0, 107, W, 1);
    g.fillStyle = C.walk; g.fillRect(0, 108, W, 8);
    g.fillStyle = '#353a55'; for (let x = -((dist * PPM) % 16); x < W; x += 16) g.fillRect(Math.round(x), 108, 1, 8);
    g.fillRect(0, 111, W, 1);
    g.fillStyle = '#4a5070'; g.fillRect(0, 115, W, 1);
    for (let k = 0; k < 4; k++) {
      const walkX = ((k * 97 + st.t * (8 + k * 3) - dist * PPM * 0.98) % (W + 60) + W + 60) % (W + 60) - 30;
      const legs = Math.floor(st.t * 6 + k) % 2, col = ['#2a1f4f', '#123049', '#3a1f2e', '#1f3a2e'][k], X = Math.round(walkX);
      g.fillStyle = C.ink; g.fillRect(X - 1, 101, 5, 9);
      g.fillStyle = col; g.fillRect(X, 104, 3, 4);
      g.fillStyle = C.skin; g.fillRect(X, 102, 3, 2);
      g.fillStyle = C.ink; g.fillRect(X + (legs ? 0 : 1), 108, 1, 2); g.fillRect(X + (legs ? 2 : 1), 108, 1, 2);
    }
    // ---- carreggiata
    g.fillStyle = C.road2; g.fillRect(0, 116, W, 2);
    const rt = this.roadTile(), ro = ((dist * PPM) % 128 + 128) % 128;
    for (let x = -ro; x < W; x += 128) g.drawImage(rt, Math.round(x), 118);
    for (let m = Math.ceil(visFrom / 47) * 47; m < visTo; m += 47) { const x = wx(m); g.fillStyle = '#15182a'; g.fillRect(x, 118, 2, 52); g.fillStyle = '#3a3f58'; g.fillRect(x + 2, 118, 1, 52); }
    for (let m = Math.ceil(visFrom / 61) * 61 + 20; m < visTo; m += 61) {
      const x = wx(m);
      this.ellipse(g, x, 141, 6, 2, '#0e111d', 1.2);
      g.fillStyle = '#3a3f58'; for (let k = -4; k <= 4; k += 2) g.fillRect(x + k, 141, 1, 1);
      if (Math.random() < dt * 3) this.parts.push({ k: 'steam', m: m + (Math.random() - 0.5) * 0.4, y: 139, vy: -10 - Math.random() * 6, r: 1, life: 1, dx: 0 });
    }
    for (let m = Math.ceil(visFrom / 113) * 113 + 40; m < visTo; m += 113) {
      const x = wx(m); g.fillStyle = '#cfcab9';
      g.fillRect(x, 158, 14, 2); g.fillRect(x + 10, 156, 2, 6); g.fillRect(x + 12, 157, 2, 4); g.fillRect(x + 14, 158, 1, 2);
    }
    for (let m = Math.ceil(visFrom / 37) * 37; m < visTo; m += 37) {
      const k = Math.round(m / 37); if (Street2D.rnd(k) < 0.5) continue;
      const x = wx(m + Street2D.rnd(k + 1) * 20), y = 124 + Math.floor(Street2D.rnd(k + 2) * 40), rx = 6 + Math.floor(Street2D.rnd(k + 3) * 8);
      this.ellipse(g, x, y, rx, 2, '#2f3a66', 1.1);
      g.fillStyle = '#5b6aa8'; g.fillRect(x - rx + 3, y - 1, Math.floor(rx * 0.6), 1);
      g.fillStyle = C.neon[k % 5]; g.fillRect(x + 2, y, 2, 1);
    }
    for (let m = Math.ceil(visFrom / 23) * 23; m < visTo; m += 23) { const x = wx(m); g.fillStyle = '#12141f'; g.fillRect(x, 166, 6, 2); g.fillStyle = '#3a3f58'; g.fillRect(x + 1, 166, 1, 2); g.fillRect(x + 3, 166, 1, 2); }
    g.fillStyle = C.line; g.fillRect(0, 119, W, 1); g.fillRect(0, 168, W, 1);
    for (let x = -((dist * PPM) % (12 * PPM)); x < W; x += 12 * PPM) { g.fillRect(Math.round(x), 131, Math.round(4.5 * PPM), 1); g.fillRect(Math.round(x), 150, Math.round(4.5 * PPM), 1); }
    // lampioni con cono di luce e riflesso sull'asfalto bagnato
    for (let lm = Math.floor(visFrom / 32) * 32; lm < visTo + 32; lm += 32) {
      const x = wx(lm);
      this.cone(g, x + 9, 64, x - 12, 150, x + 34, 150, C.lamp, 0.4);
      for (let y = 152; y < 168; y++) if (Street2D.bayer(x + 9, y) < 0.6 - (y - 152) / 30) { g.fillStyle = C.lamp; g.fillRect(x + 8 + (y % 3), y, 2, 1); }
      g.fillStyle = C.ink; g.fillRect(x - 1, 60, 3, 50); g.fillRect(x, 60, 12, 3); g.fillRect(x - 2, 106, 5, 3);
      g.fillStyle = '#4a5070'; g.fillRect(x, 61, 1, 48); g.fillRect(x + 1, 61, 10, 1);
      g.fillStyle = C.lamp; g.fillRect(x + 7, 63, 6, 2); g.fillStyle = '#fff6d8'; g.fillRect(x + 8, 63, 3, 1);
      this.dith(g, x + 4, 60, 14, 8, C.lamp, 0.15);
    }

    // ---- entità
    const items = game ? game.ents.slice() : [];
    const zOf = (e) => (e.kind === 'station' || e.lane === 0 ? 9 : e.kind === 'line' || e.kind === 'drop' ? 1.75 : GAME_LANE_Z[e.lane]);
    items.sort((a, b) => zOf(a) - zOf(b));
    const front = [];
    const drawEnt = (e) => {
      const x = wx(e.x);
      if (x < -150 || x > W + 150) return;
      if (e.kind === 'station') {
        this.dith(g, x - 58, 82, 116, 26, '#e8f0ff', 0.25);
        g.fillStyle = C.ink; g.fillRect(x - 60, 75, 122, 8); g.fillStyle = '#e8ecf5'; g.fillRect(x - 59, 76, 120, 6);
        g.fillStyle = '#2ee6ff'; g.fillRect(x - 59, 81, 120, 1);
        this.text(g, 'BENZINA 24H', x - 21, 77, '#163a8c');
        for (const p of [-52, 48]) { g.fillStyle = C.ink; g.fillRect(x + p - 1, 83, 4, 25); g.fillStyle = '#9aa3b2'; g.fillRect(x + p, 83, 2, 25); }
        for (const p of [-22, 12]) {
          g.fillStyle = C.ink; g.fillRect(x + p - 1, 92, 10, 16); g.fillStyle = '#b8ff3a'; g.fillRect(x + p, 93, 8, 14);
          g.fillStyle = '#0b0f16'; g.fillRect(x + p + 1, 95, 6, 3); g.fillStyle = '#b8ff3a'; g.fillRect(x + p + 2, 96, 3, 1);
          g.fillStyle = C.ink; g.fillRect(x + p + 8, 97, 2, 1); g.fillRect(x + p + 9, 98, 1, 6);
        }
        g.fillStyle = C.ink; g.fillRect(x - 84, 54, 22, 30); g.fillStyle = '#0b0f16'; g.fillRect(x - 83, 55, 20, 28);
        this.text(g, 'BENZ', x - 81, 57, '#2ee6ff'); this.text(g, '1,95', x - 81, 65, '#b8ff3a'); this.text(g, 'GPL', x - 81, 73, '#ffb000');
        g.fillStyle = C.ink; g.fillRect(x - 74, 84, 2, 24);
        return;
      }
      if (e.kind === 'drop') {
        for (const p of [-18, 16]) { g.fillStyle = C.ink; g.fillRect(x + p - 1, 92, 5, 74); g.fillStyle = '#b8ff3a'; g.fillRect(x + p, 93, 3, 72); }
        g.fillStyle = C.ink; g.fillRect(x - 22, 84, 46, 11); g.fillStyle = '#b8ff3a'; g.fillRect(x - 21, 85, 44, 9);
        this.text(g, 'CONSEGNA', x - 15, 87, C.ink);
        this.dith(g, x - 24, 80, 50, 20, '#b8ff3a', 0.12);
        return;
      }
      if (e.kind === 'line') {
        for (let y = 120; y < 168; y += 3) for (let k = 0; k < 2; k++) { g.fillStyle = ((y / 3 + k) | 0) % 2 ? '#f4f1e6' : C.ink; g.fillRect(x + k * 3, y, 3, 3); }
        if (e.finish) {
          g.fillStyle = C.ink; g.fillRect(x - 1, 66, 4, 54); g.fillStyle = '#b8ff3a'; g.fillRect(x, 67, 2, 52);
          g.fillStyle = C.ink; g.fillRect(x - 18, 60, 38, 10); g.fillStyle = '#b8ff3a'; g.fillRect(x - 17, 61, 36, 8);
          this.text(g, 'ARRIVO', x - 11, 63, C.ink);
        }
        return;
      }
      const y = this.laneY(zOf(e)), sc = this.laneS(y), spr = this.otherSprite(e.kind, e.color);
      const w = Math.round(spr.width * sc), h = Math.round(spr.height * sc);
      this.ellipse(g, x, y, Math.round(31 * sc), 2, '#05060c', 1.6);
      g.drawImage(spr, Math.round(x - w / 2), Math.round(y - h + 1), w, h);
      const ang = -(e.x / 0.32);
      for (const fx of [-21, 21]) this.wheel(g, x + fx * sc, y - h + 1 + 27 * sc, Math.max(5, Math.round(9 * sc)), ang, e.v || 0);
      g.fillStyle = '#ff2a2a'; g.fillRect(Math.round(x - w / 2) + 2, Math.round(y - h + 16 * sc), 2, 2);
      this.dith(g, x - w / 2 - 4, y - h + 13 * sc, 6, 6, '#ff2a2a', 0.25);
      if (e.kind === 'police') {
        const on = e.chase || e.v > 0 || Math.abs(e.x - dist) < 120, ph = Math.floor(st.t * 8) % 2;
        const lx = Math.round(x - w / 2 + 34 * sc), ly = Math.round(y - h + 1);
        g.fillStyle = on && ph ? '#ff2e4d' : '#4a1020'; g.fillRect(lx, ly, Math.round(7 * sc), 2);
        g.fillStyle = on && !ph ? '#4f7bff' : '#101a4a'; g.fillRect(lx + Math.round(8 * sc), ly, Math.round(7 * sc), 2);
        if (on) { this.cone(g, lx + 7, ly, lx - 20, ly + 30, lx + 34, ly + 30, ph ? '#ff2e4d' : '#4f7bff', 0.2); this.dith(g, lx - 6, ly - 6, 26, 8, ph ? '#ff2e4d' : '#4f7bff', 0.2); }
        if (e.chase && ph) { g.fillStyle = C.ink; g.fillRect(x - 2, ly - 15, 5, 12); g.fillStyle = '#ffd23f'; g.fillRect(x - 1, ly - 14, 3, 7); g.fillRect(x - 1, ly - 6, 3, 2); }
      }
    };
    const myZ = st.lz;
    for (const e of items) if (zOf(e) > myZ + 0.01) drawEnt(e); else front.push(e);

    // ---- la Supra
    const y0 = Math.round(this.laneY(myZ)), sc = this.laneS(y0);
    const spr = this.carSprite();
    this.ellipse(g, carX, y0, Math.round(33 * sc), 2, '#05060c', 1.6);
    if (s.ign) {
      this.cone(g, carX + 38 * sc, y0 - 13 * sc, carX + 110, y0 - 18, carX + 110, y0 - 2, '#fff2c4', 0.16);
      this.dith(g, carX + 34 * sc, y0 - 18 * sc, 8, 8, '#fff2c4', 0.3);
    }
    const heave = Math.round(-st.heave + idleShake * 0.6);
    const skew = -st.pitch;
    const squash = Math.max(-0.08, Math.min(0.1, -st.pitch * 0.4));
    const top = y0 - 9 * sc - 27 * sc * (1 - squash) + heave;
    g.save();
    g.imageSmoothingEnabled = false;
    g.setTransform(sc, skew * sc, 0, sc * (1 - squash), Math.round(carX - spr.width * sc / 2), top - skew * sc * 43);
    g.drawImage(spr, 0, 0);
    // pilota: va indietro in accelerazione, avanti in frenata
    const hx = Math.round(50 + st.head), hy = 7;
    g.fillStyle = '#1a1530'; g.fillRect(hx - 1, hy + 1, 5, 5);
    g.fillStyle = C.skin; g.fillRect(hx, hy + 1, 3, 3); g.fillStyle = C.ink; g.fillRect(hx + 1, hy + 2, 3, 1);
    g.fillStyle = '#ff2e88'; g.fillRect(hx - 1, hy, 4, 1); g.fillRect(hx + 2, hy, 2, 1);
    g.fillStyle = '#6fd8ff'; g.fillRect(39, 7, 3, 1);
    if (s.brake > 0.05) { g.fillStyle = '#ff2a2a'; g.fillRect(5, 16, 3, 3); g.fillStyle = '#ffd0c8'; g.fillRect(6, 16, 1, 1); }
    g.restore();
    if (s.brake > 0.05) this.dith(g, carX - 46 * sc, y0 - 22 * sc, 10, 10, '#ff2a2a', 0.45);
    const wr = Math.round(9 * sc);
    this.wheel(g, carX + (21 - 43) * sc, y0 - wr - Math.max(0, bR * 0.4), wr, -st.spin, Math.abs(s.ww * 0.322));
    this.wheel(g, carX + (64 - 43) * sc, y0 - wr - Math.max(0, bF * 0.4), wr, -st.front, Math.abs(s.v));

    // ---- effetti
    const rx = carX - 43 * sc, exY = y0 - 7 * sc;
    if (s.spin > 0.25 && Math.random() < s.spin * 0.9) this.parts.push({ k: 'smoke', m: dist - 22 * sc / PPM, y: y0 - 4, vy: -6 - Math.random() * 8, r: 2, life: 1, dx: -20 });
    st.flame = Math.max(0, st.flame - dt * 9);
    if (s.flame && Math.random() < s.flame * dt * 18) st.flame = 0.7 + Math.random() * 0.5;
    if (st.flame > 0.05) {
      const L = Math.round(4 + st.flame * 10);
      for (let i = 0; i < L; i++) { g.fillStyle = i < 2 ? '#fff6c2' : i < L * 0.5 ? '#ffb000' : '#ff5a1a'; g.fillRect(Math.round(rx - 1 - i), Math.round(exY - 1 + Math.sin(i + st.t * 40)), 1, i < L * 0.6 ? 3 : 2); }
      this.dith(g, rx - L - 3, exY - 5, L + 4, 10, '#ffb000', 0.25);
    }
    if (s.running && Math.random() < dt * (s.rpm < 1500 ? 2.5 : 0.6)) this.parts.push({ k: 'puff', m: dist + (rx - carX) / PPM, y: exY, vy: -3, r: 1, life: 1, dx: -8 });
    for (const p of this.parts) {
      p.life -= dt * (p.k === 'smoke' ? 0.9 : p.k === 'steam' ? 0.7 : 1.6);
      p.m += p.dx / PPM * dt; p.y += p.vy * dt; p.r += dt * (p.k === 'smoke' ? 9 : 3);
      const r = Math.round(p.r), col = p.k === 'puff' ? '#6b7085' : '#d9dde8', cx = wx(p.m);
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const q = xx * xx + yy * yy; if (q > r * r + 1) continue;
        const X = cx + xx, Y = Math.round(p.y + yy);
        if (Street2D.bayer(X, Y) > p.life * (p.k === 'steam' ? 0.55 : 0.9)) continue;
        g.fillStyle = q > (r - 1) * (r - 1) && r > 2 ? '#8e94a8' : col; g.fillRect(X, Y, 1, 1);
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0 && wx(p.m) > -30 && wx(p.m) < W + 30);
    if (s.v > 22) {
      g.fillStyle = 'rgba(240,244,255,.5)';
      for (let i = 0; i < Math.min(16, (s.v - 22) * 0.8); i++) {
        const y = 20 + Math.floor(Street2D.rnd(i + Math.floor(st.t * 20)) * 150), x = Math.floor(Street2D.rnd(i * 3 + Math.floor(st.t * 20)) * W);
        g.fillRect(x, y, 10 + Math.floor(Street2D.rnd(i) * 30), 1);
      }
    }

    for (const e of front) drawEnt(e);
    // ---- marciapiede vicino con oggetti in primo piano
    g.fillStyle = C.ink; g.fillRect(0, 170, W, 1);
    g.fillStyle = '#585e7a'; g.fillRect(0, 171, W, 1);
    g.fillStyle = C.curb; g.fillRect(0, 172, W, 8);
    g.fillStyle = '#4a5070'; for (let x = -((dist * PPM) % 20); x < W; x += 20) g.fillRect(Math.round(x), 172, 1, 8);
    for (let m = Math.floor(visFrom / 17) * 17; m < visTo; m += 17) {
      const k = Math.round(m / 17); if (Street2D.rnd(k + 300) < 0.45) continue;
      this.prop(g, Math.floor(Street2D.rnd(k + 301) * 5), wx(m + Street2D.rnd(k + 302) * 8), 180);
    }

    // ---- su schermo
    if (!this.visible) return;
    const shake = Math.round((bF + bR) * 0.08);
    const c = this.ctx; c.imageSmoothingEnabled = false;
    c.fillStyle = '#04060b'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.lo, 0, shake * (this.canvas.height / this.LH), this.canvas.width, this.canvas.height);
  }
}
