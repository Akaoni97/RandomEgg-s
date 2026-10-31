// ============================================================================
//  Street2D · strada notturna in pixel art cartoonesca, vista di lato
//  Stessa interfaccia della vista 3D: update(dt, stato, gioco), setPaint, resize.
//  Si disegna su una tela a bassa risoluzione (180 px di altezza) poi ingrandita a pixel netti.
// ============================================================================
class Street2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lo = document.createElement('canvas');
    this.g = this.lo.getContext('2d');
    this.LH = 180;
    this.paintHex = '#c81d11'; this.dual = false;
    this.st = { heave: 0, hv: 0, pitch: 0, pv: 0, spin: 0, front: 0, t: 0, flame: 0, lz: 3.5, shake: 0 };
    this.parts = [];
    this.spr = {};
    this.visible = true;
    this.C = {
      ink: '#0a0d18', road: '#23273c', road2: '#1c2032', line: '#e8e4d6', curb: '#3a3f58', walk: '#2b2f45',
      sky: ['#0b0a24', '#141238', '#1d1a4a', '#28225a', '#352a68', '#463272'],
      far: '#1a1840', farWin: '#3d3a7a', mid: ['#123049', '#1b2a52', '#2a1f4f', '#163d4a'],
      win: ['#ffd36b', '#7fe7ff', '#ffb35c', '#ff7ab8'], neon: ['#2ee6ff', '#ff2e88', '#b8ff3a', '#ffb000'],
      lamp: '#ffd27a', moon: '#fff1c9',
    };
    this.resize();
  }

  // ---------------------------------------------------------------- utilità pixel
  static rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  static shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  static bayer(x, y) { const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; return m[(x & 3) + (y & 3) * 4] / 16; }

  // disegna con i tracciati del canvas, poi rende i pixel netti e aggiunge il contorno scuro (stile cartone)
  sprite(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
    const x = c.getContext('2d'); x.translate(1, 1); draw(x);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = c.height;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
    const a = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3];
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      const i = y * W + x2; if (a[i]) continue;
      if ((x2 > 0 && a[i - 1]) || (x2 < W - 1 && a[i + 1]) || (y > 0 && a[i - W]) || (y < H - 1 && a[i + W])) { d[i * 4] = 10; d[i * 4 + 1] = 13; d[i * 4 + 2] = 24; d[i * 4 + 3] = 255; }
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.putImageData(im, 0, 0);
    return c;
  }

  // la Supra in versione cartone: più corta e alta, alettone grande, coda tronca
  carSprite() {
    if (this.spr.car && this.spr.carHex === this.paintHex) return this.spr.car;
    const P = this.paintHex, D = Street2D.shade(P, -0.38), L = Street2D.shade(P, 0.4);
    this.spr.car = this.sprite(84, 30, (x) => {
      const body = new Path2D('M5 25 L4 17 Q5 13 12 12.5 L30 12 Q36 3.5 46 3.5 L54 4.5 Q60 8.5 64 12.5 L75 14.5 Q79 16 79 20 L78 25 Z');
      x.fillStyle = P; x.fill(body);
      x.save(); x.clip(body); x.fillStyle = D; x.fillRect(0, 21, 90, 10); x.fillStyle = L; x.fillRect(9, 15, 66, 1); x.restore();
      x.fillStyle = '#13284a'; x.fill(new Path2D('M33.5 12 Q38.5 6 46 6 L53 6.8 Q57 9 60.5 12 Z'));
      x.fillStyle = '#6fd8ff'; x.fillRect(40, 7, 6, 1); x.fillRect(39, 8, 3, 1);
      x.fillStyle = D; x.fillRect(46, 6, 1, 6); x.fillRect(45, 12, 1, 12);
      x.fillStyle = D; x.fillRect(1, 8, 16, 3); x.fillRect(6, 10, 2, 4); x.fillRect(12, 10, 2, 3);
      x.fillStyle = '#7a0f08'; x.fillRect(4, 15, 3, 3);
      x.fillStyle = '#fff2c4'; x.fillRect(76, 16, 3, 2);
      x.fillStyle = '#0a0d18'; for (const cx of [20, 63]) { x.beginPath(); x.arc(cx, 26, 10.5, Math.PI, 0); x.fill(); }
      x.fillStyle = '#c9ced6'; x.fillRect(2, 23, 4, 2); if (this.dual) x.fillRect(8, 23, 3, 2);
    });
    this.spr.carHex = P;
    return this.spr.car;
  }
  // auto del traffico, polizia, rivale: berline e coupé generiche
  otherSprite(kind, color) {
    const key = kind + color;
    if (this.spr[key]) return this.spr[key];
    const P = kind === 'police' ? '#16307a' : '#' + (color || 0x777777).toString(16).padStart(6, '0');
    const D = Street2D.shade(P, -0.38), L = Street2D.shade(P, 0.35);
    this.spr[key] = this.sprite(80, 30, (x) => {
      const sport = kind === 'rival';
      const body = new Path2D(sport ? 'M4 25 L4 16 Q6 13 14 13 L28 12 Q35 5 45 5 L54 6 Q60 10 63 13 L74 15 Q78 17 78 21 L77 25 Z'
        : 'M4 25 L3 15 Q4 12 10 12 L22 12 L28 3 L56 3 L62 12 L74 13 Q78 14 78 19 L77 25 Z');
      x.fillStyle = P; x.fill(body);
      x.save(); x.clip(body); x.fillStyle = D; x.fillRect(0, 21, 90, 10); x.fillStyle = L; x.fillRect(8, 15, 66, 1); x.restore();
      x.fillStyle = '#13284a'; x.fill(new Path2D(sport ? 'M31 12.5 Q36 7 45 7 L53 7.6 Q57 10 60 12.5 Z' : 'M24 12 L29.5 5 L41 5 L41 12 Z M43 12 L43 5 L55 5 L60 12 Z'));
      if (kind === 'police') {
        x.fillStyle = '#eef2ff'; x.fillRect(22, 14, 30, 7);
        x.fillStyle = '#16307a'; x.fillRect(26, 16, 22, 1); x.fillRect(26, 18, 18, 1);
        x.fillStyle = '#2a2f45'; x.fillRect(34, 0, 14, 3);
      }
      if (sport) { x.fillStyle = D; x.fillRect(1, 9, 14, 3); x.fillRect(6, 11, 2, 3); }
      x.fillStyle = '#7a0f08'; x.fillRect(3, 15, 3, 3);
      x.fillStyle = '#fff2c4'; x.fillRect(75, 16, 3, 2);
      x.fillStyle = '#0a0d18'; for (const cx of [19, 61]) { x.beginPath(); x.arc(cx, 26, 10.5, Math.PI, 0); x.fill(); }
    });
    return this.spr[key];
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
  }

  // corsia (coordinata z del gioco) → linea di terra sullo schermo e scala prospettica
  laneY(z) { return z > 5 ? 112 : 160 - (3.5 - z) / 3.5 * 22; }
  laneS(y) { return 0.72 + (y - 112) / 48 * 0.28; }

  // ---------------------------------------------------------------- disegno
  wheel(g, cx, cy, r, ang) {
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const q = x * x + y * y;
      if (q > (r + 1.2) * (r + 1.2)) continue;
      g.fillStyle = q > r * r ? this.C.ink : q > (r - 3) * (r - 3) ? '#1b1d26' : q > 2 ? '#a3adbd' : '#eef3fa';
      g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
    g.fillStyle = '#5e6779';
    for (let k = 0; k < 5; k++) {
      const a = ang + k * Math.PI * 2 / 5;
      for (let t = 1.5; t < r - 3; t += 0.7) g.fillRect(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), 1, 1);
    }
  }

  // coni di luce retinati (lampioni, fari)
  cone(g, x0, y0, x1a, y1a, x1b, y1b, color, alpha) {
    const minX = Math.floor(Math.min(x0, x1a, x1b)), maxX = Math.ceil(Math.max(x0, x1a, x1b));
    const minY = Math.floor(Math.min(y0, y1a, y1b)), maxY = Math.ceil(Math.max(y0, y1a, y1b));
    const s = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    g.fillStyle = color;
    for (let y = Math.max(0, minY); y <= Math.min(this.LH - 1, maxY); y++) for (let x = Math.max(0, minX); x <= Math.min(this.LW - 1, maxX); x++) {
      const a = s(x0, y0, x1a, y1a, x, y), b = s(x1a, y1a, x1b, y1b, x, y), c = s(x1b, y1b, x0, y0, x, y);
      if (!((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0))) continue;
      const dist = Math.hypot(x - x0, y - y0) / Math.hypot(x1a - x0, y1a - y0);
      if (Street2D.bayer(x, y) < alpha * (1 - dist * 0.7)) g.fillRect(x, y, 1, 1);
    }
  }

  drawSky(g, t) {
    const W = this.LW, b = this.C.sky;
    for (let i = 0; i < b.length; i++) { g.fillStyle = b[i]; g.fillRect(0, i * 18, W, 18); }
    for (let i = 0; i < b.length - 1; i++) for (let y = 0; y < 4; y++) for (let x = 0; x < W; x++) if (Street2D.bayer(x, y) < (y + 1) / 5) { g.fillStyle = b[i + 1]; g.fillRect(x, i * 18 + 14 + y, 1, 1); }
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(Street2D.rnd(i) * W), y = Math.floor(Street2D.rnd(i + 50) * 80);
      const tw = Math.sin(t * 3 + i) > 0.6;
      g.fillStyle = tw ? '#ffffff' : '#9aa6ff'; g.fillRect(x, y, 1, 1);
      if (tw && i % 7 === 0) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
    const mx = W - 46, my = 26;
    for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) {
      const q = x * x + y * y; if (q > 150) continue;
      g.fillStyle = q > 132 ? this.C.ink : (x + 4) * (x + 4) + (y + 3) * (y + 3) < 10 || (x - 4) * (x - 4) + (y - 5) * (y - 5) < 5 ? '#e6d4a6' : this.C.moon;
      g.fillRect(mx + x, my + y, 1, 1);
    }
  }

  drawLayer(g, dist, speed, base, seed, tall, colors, wins, neon) {
    const off = dist * speed, tileW = 34;
    const i0 = Math.floor(off / tileW) - 1, i1 = i0 + Math.ceil(this.LW / tileW) + 3;
    for (let i = i0; i < i1; i++) {
      const r = (k) => Street2D.rnd(i * 13.7 + seed + k);
      const w = 20 + Math.floor(r(1) * 18), h = tall[0] + Math.floor(r(2) * (tall[1] - tall[0]));
      const x = Math.round(i * tileW - off + r(3) * 6), y = base - h;
      g.fillStyle = this.C.ink; g.fillRect(x - 1, y - 1, w + 2, h + 1);
      g.fillStyle = colors[Math.floor(r(4) * colors.length)]; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, y, 2, h);
      if (r(5) < 0.35) { g.fillStyle = this.C.ink; g.fillRect(x + 4, y - 5, 1, 5); g.fillRect(x + 3, y - 6, 3, 1); }
      if (r(9) < 0.3) { g.fillStyle = this.C.ink; g.fillRect(x + w - 9, y - 4, 7, 4); }
      for (let yy = y + 4; yy < base - 5; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) {
        if (r(xx * 0.31 + yy * 1.7) < 0.45) continue;
        g.fillStyle = wins[Math.floor(r(xx + yy) * wins.length)]; g.fillRect(xx, yy, 3, 3);
      }
      if (neon && r(6) < 0.35) {
        const col = this.C.neon[Math.floor(r(7) * 4)], sx = x + 3, sy = y + 6 + Math.floor(r(8) * 10);
        g.fillStyle = this.C.ink; g.fillRect(sx - 1, sy - 1, w - 4, 8);
        g.fillStyle = col; g.fillRect(sx, sy, w - 6, 6);
        g.fillStyle = this.C.ink; for (let k = sx + 2; k < sx + w - 8; k += 4) g.fillRect(k, sy + 2, 2, 2);
      }
    }
  }

  // ---------------------------------------------------------------- aggiornamento
  update(dt, s, game) {
    const st = this.st, g = this.g, W = this.LW, C = this.C;
    st.t += dt;
    const dist = game ? game.s.dist : (this.dist || 0) + s.v * dt; this.dist = dist;
    const PPM = 13, carX = Math.round(W * 0.36);

    // cambio corsia morbido
    const zT = game ? game.laneZ : 3.5;
    st.lzV = (st.lzV || 0) + ((zT - st.lz) * 9 - (st.lzV || 0) * 6) * dt; st.lz += st.lzV * dt;

    // sospensioni da cartone: stesse molle della 3D, movimenti esagerati
    const H = (typeof Garage3D !== 'undefined' && Garage3D.roadH) ? Garage3D.roadH : () => 0;
    const sp = Math.min(1, Math.abs(s.v) / 3);
    const bF = H(dist + 1.28, 1) * sp * 160, bR = H(dist - 1.28, 1) * sp * 160;
    const tgtP = Math.max(-0.08, Math.min(0.08, s.acc * 0.009)) + (bF - bR) * 0.01;
    st.pv += ((tgtP - st.pitch) * 140 - st.pv * 10) * dt; st.pitch += st.pv * dt;
    st.hv += (((bF + bR) / 2 - st.heave) * 140 - st.hv * 10) * dt; st.heave += st.hv * dt;
    st.spin += s.ww * dt; st.front += s.v / 0.322 * dt;
    const idleShake = s.running ? Math.sin(st.t * Math.max(s.rpm, 120) / 60 * 3 * Math.PI * 2) * (s.rpm < 1600 ? 0.6 + 1.2 * (s.lope || 0) : 0.25) : 0;

    // ---- sfondo
    this.drawSky(g, st.t);
    this.drawLayer(g, dist, 0.06, 96, 1, [20, 54], ['#191742', '#1f1b4c', '#15163a'], [C.farWin, '#4b468f'], false);
    this.drawLayer(g, dist, 0.22, 108, 77, [26, 70], C.mid, C.win, true);

    // ---- marciapiede lontano con lampioni, stazioni, polizia ferma
    g.fillStyle = C.ink; g.fillRect(0, 107, W, 1);
    g.fillStyle = C.walk; g.fillRect(0, 108, W, 8);
    g.fillStyle = '#353a55'; for (let x = -((dist * PPM) % 16); x < W; x += 16) g.fillRect(Math.round(x), 108, 1, 8);
    g.fillStyle = C.road2; g.fillRect(0, 116, W, 2);
    g.fillStyle = C.road; g.fillRect(0, 118, W, 52);
    for (let y = 118; y < 170; y += 3) for (let x = (y * 7) % 11; x < W; x += 23) { g.fillStyle = C.road2; g.fillRect(x - Math.round((dist * PPM) % 23), y, 2, 1); }
    // giunti dell'asfalto
    const j0 = Math.ceil((dist - carX / PPM) / 47) * 47;
    for (let jx = j0; jx < dist + (W - carX) / PPM; jx += 47) { const x = Math.round(carX + (jx - dist) * PPM); g.fillStyle = C.road2; g.fillRect(x, 118, 2, 52); }
    // strisce
    g.fillStyle = C.line; g.fillRect(0, 119, W, 1); g.fillRect(0, 168, W, 1);
    for (let x = -((dist * PPM) % (12 * PPM)); x < W; x += 12 * PPM) { g.fillRect(Math.round(x), 131, Math.round(4.5 * PPM), 1); g.fillRect(Math.round(x), 150, Math.round(4.5 * PPM), 1); }
    // lampioni ogni 32 m sul lato lontano, con cono di luce sulla strada
    const l0 = Math.floor((dist - carX / PPM) / 32) * 32;
    for (let lx = l0; lx < dist + (W - carX) / PPM + 32; lx += 32) {
      const x = Math.round(carX + (lx - dist) * PPM);
      this.cone(g, x + 9, 64, x - 12, 150, x + 34, 150, C.lamp, 0.42);
      g.fillStyle = C.ink; g.fillRect(x - 1, 60, 3, 50); g.fillRect(x, 60, 12, 3);
      g.fillStyle = '#4a5070'; g.fillRect(x, 61, 1, 48); g.fillRect(x + 1, 61, 10, 1);
      g.fillStyle = C.lamp; g.fillRect(x + 7, 63, 6, 2);
    }

    // ---- entità (ordinate dalla più lontana)
    const items = [];
    if (game) for (const e of game.ents) items.push(e);
    const zOf = (e) => (e.kind === 'station' || e.lane === 0 ? 9 : e.kind === 'line' || e.kind === 'drop' ? 1.75 : GAME_LANE_Z[e.lane]);
    items.sort((a, b) => zOf(a) - zOf(b));
    const drawn = [];
    const drawEnt = (e) => {
      const x = Math.round(carX + (e.x - dist) * PPM);
      if (x < -140 || x > W + 140) return;
      if (e.kind === 'station') {
        g.fillStyle = C.ink; g.fillRect(x - 60, 76, 122, 6); g.fillStyle = '#e8ecf5'; g.fillRect(x - 59, 77, 120, 4);
        g.fillStyle = '#2ee6ff'; g.fillRect(x - 59, 81, 120, 1);
        for (const px of [-52, 48]) { g.fillStyle = C.ink; g.fillRect(x + px - 1, 82, 4, 26); g.fillStyle = '#9aa3b2'; g.fillRect(x + px, 82, 2, 26); }
        for (const px of [-20, 14]) { g.fillStyle = C.ink; g.fillRect(x + px - 1, 94, 8, 14); g.fillStyle = '#b8ff3a'; g.fillRect(x + px, 95, 6, 12); g.fillStyle = C.ink; g.fillRect(x + px + 1, 97, 4, 3); }
        g.fillStyle = C.ink; g.fillRect(x - 80, 58, 18, 26); g.fillStyle = '#0b0f16'; g.fillRect(x - 79, 59, 16, 24);
        g.fillStyle = '#2ee6ff'; g.fillRect(x - 77, 61, 12, 2); g.fillStyle = '#b8ff3a'; g.font = '7px monospace'; g.fillText('1,95', x - 78, 74);
        g.fillStyle = C.ink; g.fillRect(x - 72, 84, 2, 24);
        return;
      }
      if (e.kind === 'drop') {
        g.fillStyle = C.ink; g.fillRect(x - 2, 96, 5, 70); g.fillRect(x - 2, 94, 5, 3);
        g.fillStyle = '#b8ff3a'; g.fillRect(x - 1, 97, 3, 68);
        g.fillStyle = C.ink; g.fillRect(x - 16, 88, 34, 9); g.fillStyle = '#b8ff3a'; g.fillRect(x - 15, 89, 32, 7);
        g.fillStyle = C.ink; g.fillRect(x - 12, 91, 3, 3); g.fillRect(x - 6, 91, 3, 3); g.fillRect(x, 91, 3, 3); g.fillRect(x + 6, 91, 3, 3);
        return;
      }
      if (e.kind === 'line') {
        for (let y = 122; y < 168; y += 3) for (let k = 0; k < 2; k++) { g.fillStyle = ((y / 3 + k) | 0) % 2 ? '#f4f1e6' : C.ink; g.fillRect(x + k * 3 - (y - 122) * 0.0, y, 3, 3); }
        if (e.finish) { g.fillStyle = C.ink; g.fillRect(x - 1, 70, 4, 50); g.fillStyle = '#b8ff3a'; g.fillRect(x, 71, 2, 48); g.fillRect(x - 10, 70, 22, 4); }
        return;
      }
      // auto
      const y = this.laneY(zOf(e)), sc = this.laneS(y), spr = this.otherSprite(e.kind, e.color);
      const w = Math.round(spr.width * sc), h = Math.round(spr.height * sc);
      g.drawImage(spr, Math.round(x - w / 2), Math.round(y - h + 1), w, h);
      const ang = -(e.x / 0.32) * 1.0;
      for (const fx of [-21, 21]) this.wheel(g, Math.round(x + fx * sc), Math.round(y - h + 1 + 27 * sc), Math.max(5, Math.round(9 * sc)), ang);
      g.fillStyle = '#ff2a2a'; g.fillRect(Math.round(x - w / 2) + 2, Math.round(y - h + 15 * sc), 2, 2);
      if (e.kind === 'police') {
        const on = e.chase || e.v > 0 || Math.abs(e.x - dist) < 120, ph = Math.floor(st.t * 8) % 2;
        const lx = Math.round(x - w / 2 + 34 * sc), ly = Math.round(y - h + 1);
        g.fillStyle = on && ph ? '#ff2e4d' : '#4a1020'; g.fillRect(lx, ly, Math.round(6 * sc), 2);
        g.fillStyle = on && !ph ? '#4f7bff' : '#101a4a'; g.fillRect(lx + Math.round(7 * sc), ly, Math.round(6 * sc), 2);
        if (on) this.cone(g, lx + 6, ly, lx - 18, ly + 26, lx + 30, ly + 26, ph ? '#ff2e4d' : '#4f7bff', 0.18);
        if (e.chase && ph) { g.fillStyle = C.ink; g.fillRect(x - 2, ly - 14, 5, 11); g.fillStyle = '#ffd23f'; g.fillRect(x - 1, ly - 13, 3, 6); g.fillRect(x - 1, ly - 6, 3, 2); }
      }
    };
    const myZ = st.lz;
    for (const e of items) if (zOf(e) > myZ + 0.01) drawEnt(e); else drawn.push(e);

    // ---- la Supra
    const y0 = Math.round(this.laneY(myZ)), sc = this.laneS(y0);
    const spr = this.carSprite();
    // fari: cono davanti
    if (s.ign) this.cone(g, carX + 38 * sc, y0 - 13 * sc, carX + 110, y0 - 18, carX + 110, y0 - 2, '#fff2c4', 0.16);
    const heave = Math.round(-st.heave + idleShake * 0.6);
    const skew = -st.pitch;                                       // muso su in accelerazione, giù in frenata
    const squash = Math.max(-0.08, Math.min(0.1, -st.pitch * 0.4));
    g.save();
    g.imageSmoothingEnabled = false;
    // origine in alto a sinistra dello sprite; i passaruota (y 27) devono cadere sui mozzi (9 px sopra terra)
    const top = y0 - 9 * sc - 27 * sc * (1 - squash) + heave;
    g.setTransform(sc, skew * sc, 0, sc * (1 - squash), Math.round(carX - spr.width * sc / 2), top - skew * sc * 43);
    g.drawImage(spr, 0, 0);
    // stop accesi
    if (s.brake > 0.05) { g.fillStyle = '#ff2a2a'; g.fillRect(4, 15, 4, 4); g.fillStyle = 'rgba(255,40,40,.5)'; g.fillRect(0, 13, 4, 8); }
    g.restore();
    const wr = Math.round(9 * sc);
    this.wheel(g, Math.round(carX + (20 - 42) * sc), Math.round(y0 - wr - Math.max(0, bR * 0.4)), wr, -st.spin);
    this.wheel(g, Math.round(carX + (63 - 42) * sc), Math.round(y0 - wr - Math.max(0, bF * 0.4)), wr, -st.front);

    // ---- effetti: fumo delle gomme, fiammate, scarico, linee di velocità
    const rx = carX - 42 * sc, exY = y0 - 6 * sc;
    if (s.spin > 0.25 && Math.random() < s.spin * 0.9) this.parts.push({ k: 'smoke', x: carX - 22 * sc, y: y0 - 4, vx: -20 - s.v * 4, vy: -6 - Math.random() * 8, r: 2, life: 1 });
    st.flame = Math.max(0, st.flame - dt * 9);
    if (s.flame && Math.random() < s.flame * dt * 18) st.flame = 0.7 + Math.random() * 0.5;
    if (st.flame > 0.05) {
      const L = Math.round(4 + st.flame * 9);
      for (let i = 0; i < L; i++) { g.fillStyle = i < 2 ? '#fff6c2' : i < L * 0.5 ? '#ffb000' : '#ff5a1a'; g.fillRect(Math.round(rx - 1 - i), Math.round(exY - 1 + Math.sin(i + st.t * 40)), 1, i < L * 0.6 ? 3 : 2); }
    }
    if (s.running && Math.random() < dt * (s.rpm < 1500 ? 2 : 0.5)) this.parts.push({ k: 'puff', x: rx, y: exY, vx: -8 - s.v * 3, vy: -3, r: 1, life: 1 });
    for (const p of this.parts) {
      p.life -= dt * (p.k === 'smoke' ? 0.9 : 1.6); p.x += (p.vx - s.v * PPM * 0.0) * dt; p.y += p.vy * dt; p.r += dt * (p.k === 'smoke' ? 9 : 3);
      const r = Math.round(p.r), col = p.k === 'smoke' ? '#d9dde8' : '#6b7085';
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const q = xx * xx + yy * yy; if (q > r * r + 1) continue;
        if (Street2D.bayer(Math.round(p.x + xx), Math.round(p.y + yy)) > p.life * 0.9) continue;
        g.fillStyle = q > (r - 1) * (r - 1) && r > 2 ? '#8e94a8' : col; g.fillRect(Math.round(p.x + xx), Math.round(p.y + yy), 1, 1);
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0 && p.x > -20);
    if (s.v > 22) {
      g.fillStyle = 'rgba(240,244,255,.55)';
      for (let i = 0; i < Math.min(14, (s.v - 22) * 0.8); i++) {
        const y = 20 + Math.floor(Street2D.rnd(i + Math.floor(st.t * 20)) * 150), x = Math.floor(Street2D.rnd(i * 3 + Math.floor(st.t * 20)) * W);
        g.fillRect(x, y, 10 + Math.floor(Street2D.rnd(i) * 30), 1);
      }
    }

    // entità davanti alla Supra (corsie più vicine)
    for (const e of drawn) drawEnt(e);
    // marciapiede vicino
    g.fillStyle = C.ink; g.fillRect(0, 170, W, 1);
    g.fillStyle = C.curb; g.fillRect(0, 171, W, 9);
    g.fillStyle = '#4a5070'; for (let x = -((dist * PPM) % 20); x < W; x += 20) g.fillRect(Math.round(x), 171, 1, 9);

    // ---- su schermo: ingrandimento a pixel netti (leggero sobbalzo sui giunti)
    if (!this.visible) return;
    const shake = Math.round((bF + bR) * 0.08);
    const c = this.ctx; c.imageSmoothingEnabled = false;
    c.fillStyle = '#04060b'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.lo, 0, shake * (this.canvas.height / this.LH), this.canvas.width, this.canvas.height);
  }
}
