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

  carSprite(k) { return this.vehicle('supra', this.paintHex, k); }
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
  setTips(n) { this.dual = n > 1; }
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
    for (let i = 0; i < 150; i++) {
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
    const base = far ? ['#171640', '#1c1a4a', '#141338', '#1e1844'][Math.floor(r(4) * 4)] : this.C.mid[Math.floor(r(4) * this.C.mid.length)];
    px(this.C.ink, 0, top - 1, w + 2, h + 1);
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
  update(dt, s, game) {
    const st = this.st, g = this.g, W = this.LW, C = this.C;
    st.t += dt;
    const dist = game ? game.s.dist : (this.dist || 0) + s.v * dt; this.dist = dist;
    const PPM = 30, carX = Math.round(W * 0.36), K0 = 0.78;
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

    // ---- sfondo: cielo, tre piani di città, foschia
    this.drawSky(g, st.t, dist);
    this.drawCity(g, dist, st.t, 'haze', 0.025, 188, 50);
    g.fillStyle = 'rgba(70,50,114,.35)'; g.fillRect(0, 150, W, 40);
    this.drawCity(g, dist, st.t, 'far', 0.07, 200, 52);
    g.fillStyle = 'rgba(70,50,114,.22)'; g.fillRect(0, 168, W, 34);
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
    // pozzanghere che riflettono il cielo e i neon
    for (let m = Math.ceil(visFrom / 37) * 37; m < visTo; m += 37) {
      const k = Math.round(m / 37); if (Street2D.rnd(k) < 0.45) continue;
      const x = wx(m + Street2D.rnd(k + 1) * 20), y = 248 + Math.floor(Street2D.rnd(k + 2) * 80), rx = 12 + Math.floor(Street2D.rnd(k + 3) * 18);
      g.fillStyle = '#262f55'; this.span(g, x, y, rx, 3); g.fillStyle = '#323d6e'; this.span(g, x - 2, y - 1, rx * 0.7, 1.5);
      g.fillStyle = C.neon[k % 5]; g.fillRect(x + 4, y, 4, 1); g.fillRect(x + 6, y - 1, 1, 1);
      g.fillStyle = '#7a86c0'; g.fillRect(x - rx + 5, y - 1, 3, 1);
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
    const zOf = (e) => (e.kind === 'station' || e.lane === 0 ? 9 : e.kind === 'line' || e.kind === 'drop' ? 1.75 : GAME_LANE_Z[e.lane]);
    items.sort((a, b) => zOf(a) - zOf(b));
    const front = [];
    const drawEnt = (e) => {
      const x = wx(e.x);
      if (x < -300 || x > W + 300) return;
      if (e.kind === 'station') {
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
        return;
      }
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
      if (e.kind === 'police') {
        const on = e.chase || e.v > 0 || Math.abs(e.x - dist) < 120, ph = Math.floor(st.t * 8) % 2;
        const lx = Math.round(left + 82 * k), ly = sy + Math.round(5 * k);
        g.fillStyle = on && ph ? '#ff2e4d' : '#4a1020'; g.fillRect(lx, ly, Math.round(13 * sc), 3);
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
    const y0 = Math.round(this.laneY(myZ)), k = kq(y0), sc = k;
    const spr = this.carSprite(k), SW = spr.width, left = Math.round(carX - SW / 2);
    if (s.ign) this.light(g, left + SW + (s.high ? 110 : 60) * k, y0 - 2, s.high ? 150 : 80, s.high ? 9 : 7, '#fff2c4', s.high ? 0.1 : 0.08, 4);   // pozza dei fari (più lunga con gli abbaglianti)
    if (s.brake > 0.05) this.light(g, left - 30 * k, y0 - 1, 40, 5, '#ff2a2a', 0.1, 3);             // pozza degli stop
    this.shadow(g, carX, y0, SW * 0.46, 5);
    const heave = Math.round(-st.heave + idleShake * 0.6);
    const skew = -st.pitch * 0.8;
    const squash = Math.max(-0.06, Math.min(0.08, -st.pitch * 0.35));
    const archY = 42 * k + 1, top = y0 - 15 * k - archY * (1 - squash) + heave;
    g.save();
    g.imageSmoothingEnabled = false;
    g.setTransform(1, skew, 0, 1 - squash, left, top - skew * SW / 2);
    g.drawImage(spr, 0, 0);
    // pilota (dietro al montante): va indietro in accelerazione, avanti in frenata
    const P = (col, xx, yy, w, h) => { g.fillStyle = col; g.fillRect(Math.round(xx * k) + 1, Math.round(yy * k) + 1, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
    const hx = 108 + st.head * 0.8;
    P('#14102a', 90, 14, 6, 9);
    P(C.ink, hx - 2, 12, 11, 11); P(C.skin, hx, 14, 7, 7); P(Street2D.shade(C.skin, -0.25), hx, 19, 7, 2);
    P(C.ink, hx + 2, 16, 6, 2); P('#2ee6ff', hx + 4, 16, 2, 1);
    P('#ff2e88', hx - 1, 12, 8, 3); P('#ff2e88', hx + 5, 14, 4, 1);
    P('#2a1f4f', hx - 1, 22, 9, 2);
    for (let n = 0; n < 6; n++) P('rgba(111,216,255,.55)', 121 + n, 14 + n, 1, 1);
    if (s.brake > 0.05) { P('#ff2a2a', 1, 31, 5, 7); P('#ffd0c8', 2, 32, 2, 2); }
    const blinkOn = s.signal && Math.floor(st.t * 3) % 2 === 0;
    if (blinkOn) { P('#ffa020', 176, 37, 7, 3); P('#ffe0a0', 178, 37, 3, 1); P('#ffa020', 2, 39, 4, 3); }
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
    if (s.brake > 0.05) this.light(g, left + 2, top + 34 * k, 12, 9, '#ff2a2a', 0.2, 3);
    if (s.ign) this.light(g, left + SW - 6, top + 33 * k, s.high ? 20 : 12, s.high ? 9 : 6, '#fff2c4', s.high ? 0.3 : 0.2, 3);
    if (s.signal && Math.floor(st.t * 3) % 2 === 0) { this.light(g, left + 178 * k, top + 38 * k, 10, 6, '#ffa020', 0.25, 3); this.light(g, left + 4, top + 40 * k, 8, 6, '#ffa020', 0.25, 3); }
    const wr = Math.max(6, Math.round(15 * k));
    this.wheel(g, left + 1 + 48 * k, y0 - wr - Math.max(0, bR * 0.4), wr, -st.spin, Math.abs(s.ww * 0.322));
    this.wheel(g, left + 1 + 158 * k, y0 - wr - Math.max(0, bF * 0.4), wr, -st.front, Math.abs(s.v));

    // ---- effetti
    const rx = left, exY = y0 - 9 * k;
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
    st.flame = Math.max(0, st.flame - dt * 9);
    if (s.flame && Math.random() < s.flame * dt * 18) st.flame = 0.7 + Math.random() * 0.5;
    if (st.flame > 0.05) {
      const L = Math.round(8 + st.flame * 20);
      for (let i = 0; i < L; i++) {
        const wob = Math.round(Math.sin(i * 0.8 + st.t * 40) * 1.5), th = Math.max(1, Math.round((1 - i / L) * 6));
        g.fillStyle = i < 3 ? '#fff6c2' : i < L * 0.45 ? '#ffb000' : '#ff5a1a'; g.fillRect(Math.round(rx - 2 - i), Math.round(exY - th / 2 + wob), 1, th);
      }
      this.light(g, rx - L / 2, exY, L * 0.8, 10, '#ff9a20', 0.18, 3);
    }
    if (s.running && Math.random() < dt * (s.rpm < 1500 ? 2.5 : 0.6)) this.parts.push({ k: 'puff', m: dist + (rx - carX) / PPM, y: exY, vy: -6, r: 2, life: 1, dx: -8 });
    for (const p of this.parts) {
      if (p.k === 'spray' || p.k === 'spark') {
        p.life -= dt * (p.k === 'spray' ? 2.6 : 1.8); p.m += p.dx / PPM * dt; p.y += p.vy * dt; p.vy += (p.k === 'spark' ? 160 : 90) * dt;
        const X = wx(p.m), Y = Math.round(p.y);
        if (p.k === 'spark') { g.fillStyle = p.life > 0.5 ? '#fff2a0' : '#ff8a20'; g.fillRect(X, Y, 2, 1); g.fillStyle = 'rgba(255,140,40,.5)'; g.fillRect(X - 2, Y, 2, 1); }
        else { g.fillStyle = `rgba(190,215,255,${0.55 * p.life})`; g.fillRect(X, Y, 2, 2); g.fillStyle = `rgba(255,255,255,${0.4 * p.life})`; g.fillRect(X, Y, 1, 1); }
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

    // ---- scritte: cosa succede, scritto in grande
    const cd = (k2, sec) => { const ok = !(this.cool[k2] > st.t); if (ok) this.cool[k2] = st.t + sec; return ok; };
    const carTop = y0 - 60 * k;
    for (const e of s.events || []) {
      if (e.type === 'bov' && cd('bov', 0.6)) this.comic(['PSSSH!', 'PSHHH!', 'TSSS!'][Math.floor(Math.random() * 3)], left + SW * 0.75, carTop - 10, '#2ee6ff', 3);
      if (e.type === 'grind' && cd('grind', 0.8)) this.comic('GRRRK!', carX, carTop - 14, '#ffb000', 3);
    }
    if (game) for (const f of game.fx) if (f.k === 'crash') this.comic('CRASH!', left + SW + 6, carTop, '#ff2e4d', 5, '#ffd23f');
    if ((st.prevV || 0) < 0.6 && s.v >= 0.6 && s.thr > 0.6 && cd('vroom', 3)) this.comic('VROOOM!', carX - 20, carTop - 20, '#ffd23f', 4);
    if (st.flame > 0.9 && (st.prevFlame || 0) < 0.5 && cd('bang', 0.35)) this.comic(Math.random() < 0.55 ? 'BANG!' : 'POP!', rx - 26, exY - 16, '#ff5a1a', 3, '#ffd23f');
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

    // ---- su schermo
    if (!this.visible) return;
    const shake = Math.round((bF + bR) * 0.05);
    const c = this.ctx; c.imageSmoothingEnabled = false;
    c.fillStyle = '#04060b'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.lo, 0, shake * (this.canvas.height / this.LH), this.canvas.width, this.canvas.height);
  }
}
