// ============================================================================
//  EngineDSP · sintesi fisica del suono di un 6 cilindri in linea (2JZ-GTE)
//  Gira dentro un AudioWorklet (o in uno ScriptProcessor come ripiego).
//  Nessun campione registrato: ogni scoppio è calcolato sull'angolo di manovella.
// ============================================================================
class BQ {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  set(t, f, q, sr, db) {
    f = Math.max(10, Math.min(f, sr * 0.45));
    const w = 2 * Math.PI * f / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, (db || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (t === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (t === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (t === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  p(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

class EngineDSP {
  constructor(sr) {
    this.sr = sr;
    this.seed = 0x2f6b1a3d;
    this.th = 0;          // angolo di manovella in gradi, 0..720
    this.k = 0;
    // parametri in arrivo dalla simulazione (target) e copie smussate
    this.T = { rpm: 0, charge: 0, air: 0, thr: 0, boost: 0, turbo: 0, cut: 0, ovr: 9, running: 0, starter: 0,
      speed: 0, spin: 0, drive: 0, gearRpm: 0, rev: 0, wg: 0, sec: 0, pump: 0 };
    this.S = Object.assign({}, this.T);
    this.cfg = { turbo: 0, exhaust: 0, valve: 1, pops: 0, view: 0, vol: 0.8 };
    this.mix = null; this.mixT = null;

    // cilindri: ordine di scoppio 1-5-3-6-2-4, uno ogni 120° di manovella
    const order = [0, 4, 2, 5, 1, 3];
    this.cyl = [];
    for (let i = 0; i < 6; i++) {
      this.cyl.push({ off: 0, prevA: 719.9, amp: 0, tp: 26, nz: 0.1, disp: 0, ain: 0,
        bias: 1 + this.r() * 0.05, buf: new Float32Array(2048), wi: 0, D: 30, lp: 0, rf: -0.3 });
    }
    order.forEach((c, k) => { this.cyl[c].off = k * 120; });

    // tubo principale (guida d'onda a quarto d'onda)
    this.pipe = new Float32Array(16384); this.pw = 0; this.pD = 400; this.pLp = 0; this.pR = -0.5;
    this.tb = 0; this.tbA = 0.2;
    this.muf = [new BQ(), new BQ(), new BQ(), new BQ()]; this.mufG = 1;
    this.jetBP = new BQ(); this.jetG = 0.2;
    this.radPrev = 0; this.dc1x = 0; this.dc1y = 0;
    this.viewLP = new BQ(); this.viewLP2 = new BQ();
    this.boomBP = new BQ().set('bp', 78, 1.6, sr);
    this.crackHP = new BQ().set('hp', 700, 0.7, sr);
    this.turbHP = new BQ().set('hp', 2500, 0.7, sr);

    // aspirazione
    this.inHP = new BQ().set('hp', 55, 0.7, sr);
    this.inPK = new BQ().set('peak', 290, 1.4, sr, 7);
    this.inLP = new BQ().set('lp', 1100, 0.7, sr);
    this.roarBP = new BQ().set('bp', 1350, 0.9, sr);
    this.whooshBP = new BQ().set('bp', 2600, 0.8, sr);

    // turbo
    this.tph = 0; this.tph2 = 0; this.lfo = 0;
    this.bov = { env: 0, t: 1, I: 0, len: 0.3, rate: 20 };
    this.bovBP = new BQ(); this.bovHP = new BQ().set('hp', 500, 0.7, sr);
    this.flBP = new BQ().set('bp', 520, 1.2, sr); this.flPh = 0;
    this.wgBP = new BQ().set('bp', 950, 0.9, sr);

    // meccanica
    this.tickEnv = 0; this.tickHP = new BQ().set('hp', 4200, 0.8, sr); this.tickDec = Math.exp(-1 / (sr * 0.0007)); this.lastTick = 0;
    this.knock = 0; this.knockBP = new BQ().set('bp', 1900, 1.1, sr); this.knockDec = Math.exp(-1 / (sr * 0.0035));
    this.beltPh = 0;

    // scoppiettii (afterfire)
    this.pops = []; this.popEnv = 0; this.popDec = Math.exp(-1 / (sr * 0.009)); this.thPh = 0;

    // motorino d'avviamento, pompa benzina
    this.stPh = 0; this.stLP = new BQ().set('lp', 900, 0.7, sr); this.pumpPh = 0; this.pumpLP = new BQ().set('lp', 600, 0.7, sr);

    // strada, vento, gomme, trasmissione
    this.brown = 0; this.roadLP = new BQ().set('lp', 320, 0.7, sr);
    this.windBP = new BQ().set('bp', 850, 0.55, sr);
    this.sq1 = new BQ().set('bp', 1040, 14, sr); this.sq2 = new BQ().set('bp', 1460, 12, sr); this.sqPh = 0;
    this.gPh = 0;
    this.grind = 0; this.grBP = new BQ().set('bp', 1700, 1.5, sr); this.grPh = 0;
    this.clunk = 0; this.clPh = 0; this.click = 0;

    // riverbero (Schroeder/Freeverb ridotto)
    const sc = sr / 44100;
    this.rv = [1116, 1188, 1277, 1356, 1139, 1211, 1300, 1379].map((l) => ({ b: new Float32Array(Math.round(l * sc * 0.55)), i: 0, f: 0 }));
    this.ap = [556, 441, 579, 464].map((l) => ({ b: new Float32Array(Math.round(l * sc)), i: 0 }));

    this.dcL = 0; this.dcLy = 0;
    this.configure(this.cfg);
    this.mix = Object.assign({}, this.mixT);
    this.aRpm = 1 - Math.exp(-32 / (sr * 0.018));
    this.aFast = 1 - Math.exp(-32 / (sr * 0.03));
    this.aSlow = 1 - Math.exp(-32 / (sr * 0.12));
  }

  // rumore bianco [-1,1)
  r() {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s;
    return (s | 0) / 2147483648;
  }
  g() { return (this.r() + this.r() + this.r()) * 0.577; }

  msg(m) {
    if (m.p) Object.assign(this.T, m.p);
    if (m.cfg) this.configure(Object.assign(this.cfg, m.cfg));
    if (m.ev) for (const e of m.ev) this.event(e);
  }

  configure(c) {
    const sr = this.sr;
    // collettori: ghisa originale 3+3 (biturbo) oppure tubolare 6-1 a lunghezze quasi uguali (single)
    const L = c.turbo === 0 ? [0.44, 0.35, 0.30, 0.32, 0.37, 0.47] : [0.88, 0.86, 0.84, 0.84, 0.86, 0.88];
    const extraRear = c.turbo === 0 ? 0.22 : 0;
    this.cyl.forEach((cy, i) => {
      const len = L[i] + (i >= 3 ? extraRear : 0);
      cy.D = Math.max(2, Math.round(len / 610 * sr));
      cy.rf = c.turbo === 0 ? -0.28 : -0.38;
    });
    this.tbA = 1 - Math.exp(-2 * Math.PI * (c.turbo === 0 ? 1700 : 2400) / sr);
    // tubo e silenziatore
    const ex = [
      { L: 4.4, r: -0.42, m: [['lp', 360, 0.6], ['lp', 1000, 0.5], ['peak', 105, 1.0, 6], ['peak', 420, 2, -5]], g: 1.7, jet: 0.12 },
      { L: 4.1, r: -0.55, m: [['lp', 1500, 0.65], ['peak', 165, 0.9, 4], ['peak', 640, 1.3, 3.5], ['peak', 2600, 1.5, -4]], g: 2.3, jet: 0.35 },
      { L: 3.5, r: -0.68, m: [['lp', 5200, 0.55], ['peak', 140, 0.9, 3], ['peak', 1850, 1.4, 5], ['peak', 3600, 2, 2]], g: 3.6, jet: 1.0 },
    ][c.exhaust];
    this.pD = Math.min(8000, Math.round(ex.L / 495 * sr));
    this.pR = ex.r;
    ex.m.forEach((m, i) => this.muf[i].set(m[0], m[1], m[2], sr, m[3]));
    this.mufG = ex.g; this.jetG = ex.jet;
    this.jetBP.set('bp', 3200, 0.6, sr);
    // valvola: 0 ricircolo OEM, 1 blow-off, 2 nessuna (flutter)
    // punto d'ascolto: 0 abitacolo, 1 esterno posteriore, 2 vano motore
    const V = [
      { exh: 0.62, lp: 950, boom: 0.9, intake: 0.5, mech: 0.12, turbo: 0.3, bov: 0.45, road: 1.0, wind: 0.9, tire: 0.55, gear: 1.0, starter: 0.55, pump: 1.0, rev: 0.22 },
      { exh: 1.0, lp: 14000, boom: 0.0, intake: 0.16, mech: 0.07, turbo: 0.32, bov: 0.6, road: 0.35, wind: 0.12, tire: 1.0, gear: 0.15, starter: 0.3, pump: 0.0, rev: 0.16 },
      { exh: 0.35, lp: 2600, boom: 0.0, intake: 1.0, mech: 1.0, turbo: 1.0, bov: 1.0, road: 0.15, wind: 0.1, tire: 0.3, gear: 0.45, starter: 1.0, pump: 0.25, rev: 0.1 },
    ];
    this.mixT = Object.assign({}, V[c.view]);
  }

  event(e) {
    const T = this.T;
    if (e.type === 'bov') {
      this.bov.I = Math.min(1.3, e.I || 0.8); this.bov.t = 0; this.bov.env = 0.0001;
      this.bov.len = this.cfg.valve === 2 ? 0.45 + 0.35 * this.bov.I : 0.16 + 0.38 * this.bov.I;
      this.bov.rate = 23;
    } else if (e.type === 'grind') this.grind = 1;
    else if (e.type === 'clunk') this.clunk = 1;
    else if (e.type === 'click') this.click = 1;
    void T;
  }

  addPop(big) {
    if (this.pops.length > 8) return;
    const d = Math.round((0.002 + this.r() * 0.5 * 0.03 + 0.015) * this.sr);
    const a = big ? 0.9 + 0.7 * Math.abs(this.r()) : 0.25 + 0.45 * Math.abs(this.r());
    this.pops.push({ d: Math.max(1, d), a });
  }

  cycle(c) {
    const S = this.S, T = this.T;
    const run = S.running > 0.5;
    const fire = run && T.cut === 0;
    const rn = S.rpm / 7000;
    let comb = 0;
    if (fire) {
      const ch = Math.max(S.charge, 0.04);
      const jitter = 1 + this.g() * (0.03 + 0.07 * Math.max(0, 1 - S.rpm / 1600));
      comb = Math.pow(ch, 0.9) * jitter;
      c.tp = 11 + 15 * Math.max(0, 1 - Math.min(ch, 1));
      c.nz = 0.22 + 0.32 * Math.min(ch, 1.6);
      this.knock += comb * 0.5;
    } else {
      c.tp = 28; c.nz = 0.12;
    }
    c.amp = (0.045 + 0.055 * rn) * (0.4 + S.air) + comb * c.bias;
    if (!run) c.amp = S.rpm > 20 ? 0.06 * Math.min(1, S.rpm / 180) : 0;
    c.disp = 0.06 * rn * (0.3 + S.air);
    c.ain = S.air * (0.25 + rn) * (1 - 0.55 * S.turbo);
    // afterfire: carburante incombusto che esplode nello scarico
    if (!fire && run && S.rpm > 1600) {
      let ch = 0, big = false;
      if (T.cut === 1) ch = this.cfg.pops ? 0.16 * Math.exp(-T.ovr / 2.2) + 0.02 : 0;
      else if (T.cut === 2) { ch = this.cfg.pops ? 0.32 : 0.04; big = true; }
      else if (T.cut === 3) { ch = this.cfg.pops ? 0.55 : 0.14; big = true; }
      if (Math.abs(this.r()) < ch) this.addPop(big || Math.abs(this.r()) < 0.15);
    }
  }

  control() {
    const S = this.S, T = this.T;
    S.rpm += (T.rpm - S.rpm) * this.aRpm;
    const f = this.aFast, s = this.aSlow;
    S.charge += (T.charge - S.charge) * f;
    S.air += (T.air - S.air) * f;
    S.thr += (T.thr - S.thr) * f;
    S.boost += (T.boost - S.boost) * f;
    S.turbo += (T.turbo - S.turbo) * f;
    S.running += (T.running - S.running) * f;
    S.starter += (T.starter - S.starter) * f;
    S.speed += (T.speed - S.speed) * s;
    S.spin += (T.spin - S.spin) * f;
    S.drive += (T.drive - S.drive) * s;
    S.gearRpm += (T.gearRpm - S.gearRpm) * f;
    S.rev += (T.rev - S.rev) * s;
    S.wg += (T.wg - S.wg) * f;
    S.sec += (T.sec - S.sec) * f;
    S.pump += (T.pump - S.pump) * s;
    const M = this.mix, MT = this.mixT;
    for (const k in MT) M[k] += (MT[k] - M[k]) * s;
    this.viewLP.set('lp', M.lp, 0.6, this.sr);
    this.viewLP2.set('lp', Math.min(16000, M.lp * 1.6), 0.6, this.sr);
    if (this.bov.env > 0) {
      const pr = Math.min(1, this.bov.t / this.bov.len);
      this.bovBP.set('bp', (this.cfg.valve === 2 ? 1500 : 2300) - 1000 * pr, 0.75, this.sr);
      this.bov.rate = 24 - 12 * pr;
    }
  }

  render(outL, outR, n) {
    const sr = this.sr, S = this.S, cfg = this.cfg, cyl = this.cyl;
    const TAU = 6.283185307179586;
    for (let i = 0; i < n; i++) {
      if ((this.k++ & 31) === 0) this.control();
      const M = this.mix;
      const rn = S.rpm / 7000;
      this.th += S.rpm * 6 / sr;
      if (this.th >= 720) this.th -= 720;
      const th = this.th;
      const nz = this.r(), nz2 = this.r(), nz3 = this.r();

      // ---- 6 cilindri: impulsi di scarico (blowdown) e aspirazione ------------
      let col = 0, inn = 0;
      for (let j = 0; j < 6; j++) {
        const c = cyl[j];
        let a = th - c.off; if (a < 0) a += 720;
        if (a < c.prevA) this.cycle(c);
        c.prevA = a;
        let p = 0;
        if (a < 300) {
          const x = a / c.tp;
          p = c.amp * x * x * Math.exp(2 - 2 * x) * (1 + c.nz * nz);
          if (a < 240) p += c.disp * Math.sin(a * 0.01308997);
        }
        // collettore: guida d'onda con riflessione all'unione
        const b = c.buf, m = 2047;
        c.lp += 0.45 * (b[(c.wi - 2 * c.D) & m] - c.lp);
        b[c.wi] = p + c.rf * c.lp;
        col += b[(c.wi - c.D) & m];
        c.wi = (c.wi + 1) & m;
        let ai = a - 380; if (ai < 0) ai += 720;
        if (ai < 230) inn += c.ain * Math.sin(ai * 0.01365);
      }

      // ---- turbina: smorza e leviga gli impulsi --------------------------------
      this.tb += this.tbA * (col - this.tb);
      let x = col * 0.22 + this.tb * 0.62;
      x += this.turbHP.p(nz2) * S.turbo * S.air * 0.015;

      // ---- afterfire -------------------------------------------------------------
      for (let q = this.pops.length - 1; q >= 0; q--) {
        const pp = this.pops[q];
        if (--pp.d <= 0) { this.popEnv = Math.min(2.5, this.popEnv + pp.a); this.thPh = 0; this.pops.splice(q, 1); }
      }
      let pop = 0;
      if (this.popEnv > 1e-4) {
        this.thPh += 68 / sr;
        pop = this.popEnv * (nz3 * 0.85 + 0.7 * Math.sin(TAU * this.thPh));
        this.popEnv *= this.popDec;
      }
      x += pop * 0.9;

      // ---- tubo principale (risonanze a quarto d'onda) --------------------------
      const pb = this.pipe, pm = 16383;
      this.pLp += 0.35 * (pb[(this.pw - 2 * this.pD) & pm] - this.pLp);
      pb[this.pw] = x + this.pR * this.pLp;
      let y = pb[(this.pw - this.pD) & pm];
      this.pw = (this.pw + 1) & pm;
      // getto in uscita: fruscio proporzionale alla velocità dei gas
      const flow = rn * (0.25 + S.charge);
      y += this.jetBP.p(nz) * flow * flow * 0.05 * this.jetG;
      // silenziatore
      for (let q = 0; q < 4; q++) y = this.muf[q].p(y);
      y *= this.mufG;
      // radiazione dalla bocca del terminale (≈ derivata) + blocco DC
      const rad = y - 0.9 * this.radPrev; this.radPrev = y;
      const ex = rad - this.dc1x + 0.995 * this.dc1y; this.dc1x = rad; this.dc1y = ex;
      const crack = this.crackHP.p(pop) * 0.35;
      let exh = this.viewLP2.p(this.viewLP.p(ex + crack));
      const boom = this.boomBP.p(ex) * 1.6;
      // wastegate a cielo aperto (single con straight pipe)
      if (cfg.turbo === 1 && cfg.exhaust === 2 && S.wg > 0.01) exh += this.wgBP.p(nz2) * S.wg * 0.12;

      // ---- aspirazione -------------------------------------------------------------
      let intake = this.inLP.p(this.inPK.p(this.inHP.p(inn))) * 1.1;
      intake += this.roarBP.p(nz2) * S.air * Math.pow(rn, 1.5) * 0.12 * (1 - 0.5 * S.turbo);

      // ---- turbo: fischio della girante, soffio, valvola --------------------------
      const ft = cfg.turbo === 0 ? 2500 + 6200 * S.turbo : 1600 + 4400 * S.turbo;
      this.lfo += (nz * 0.002 - this.lfo * 0.0005);
      this.tph += ft * (1 + this.lfo) / sr; if (this.tph > 1) this.tph -= 1;
      let whistle = Math.sin(TAU * this.tph) + 0.25 * Math.sin(2 * TAU * this.tph);
      if (cfg.turbo === 0) {
        this.tph2 += ft * 0.87 / sr; if (this.tph2 > 1) this.tph2 -= 1;
        whistle += S.sec * 0.8 * Math.sin(TAU * this.tph2);
      }
      const tAmp = Math.pow(S.turbo, 1.7) * (0.22 + 0.78 * S.thr) * (cfg.turbo === 0 ? 0.035 : 0.06);
      let turbo = whistle * tAmp + this.whooshBP.p(nz3) * S.turbo * S.air * (cfg.turbo === 0 ? 0.05 : 0.09);

      let bov = 0;
      if (this.bov.env > 0) {
        const B = this.bov; B.t += 1 / sr;
        const att = 0.004;
        const env = B.t < att ? B.t / att : Math.exp(-(B.t - att) / (B.len * 0.38));
        const nb = this.bovHP.p(this.bovBP.p(nz));
        if (cfg.valve === 2) {
          this.flPh += B.rate / sr; if (this.flPh > 1) this.flPh -= 1;
          const chop = Math.pow(0.5 + 0.5 * Math.cos(TAU * this.flPh), 5);
          bov = (nb * 0.5 + this.flBP.p(nz2) * 1.4 + Math.sin(TAU * this.tph) * 0.12) * chop * env * B.I * 0.55;
        } else if (cfg.valve === 1) {
          bov = nb * env * B.I * 0.75;
        } else {
          bov = nb * env * B.I * 0.12;
        }
        if (B.t > B.len * 3) B.env = 0;
      }

      // ---- meccanica: punterie, combustione nel basamento, cinghia ----------------
      const tk = Math.floor(th / 30);
      if (tk !== this.lastTick) { this.lastTick = tk; if (S.rpm > 30) this.tickEnv = 0.4 + 0.6 * Math.abs(nz2); }
      let mech = this.tickHP.p(nz) * this.tickEnv * (0.12 + 0.5 * rn) * 0.15;
      this.tickEnv *= this.tickDec;
      mech += this.knockBP.p(nz3) * this.knock * 0.05;
      this.knock *= this.knockDec;
      this.beltPh += S.rpm / 60 * 9.3 / sr; if (this.beltPh > 1) this.beltPh -= 1;
      mech += Math.sin(TAU * this.beltPh) * 0.004 * Math.min(1, S.rpm / 600);

      // ---- motorino d'avviamento e pompa benzina ------------------------------------
      let starter = 0;
      if (S.starter > 0.002) {
        const f0 = 28 + S.rpm * 10.5 / 60;
        this.stPh += f0 / sr; if (this.stPh > 1) this.stPh -= 1;
        const saw = 2 * this.stPh - 1;
        starter = (this.stLP.p(saw) * 0.5 + Math.sin(TAU * 24 * this.stPh) * 0.1 + nz2 * 0.05 * (0.6 + 0.4 * saw)) * S.starter * 0.32;
      }
      let pump = 0;
      if (S.pump > 0.002) {
        this.pumpPh += 152 / sr; if (this.pumpPh > 1) this.pumpPh -= 1;
        pump = (Math.sin(TAU * this.pumpPh) * 0.5 + this.pumpLP.p(nz) * 0.6) * S.pump * 0.02;
      }

      // ---- strada, vento, gomme, cambio ------------------------------------------------
      const v = S.speed;
      this.brown = this.brown * 0.996 + nz2 * 0.06;
      const road = this.roadLP.p(this.brown) * Math.min(1.6, Math.pow(v / 30, 1.1)) * 0.5;
      const wind = this.windBP.p(nz3) * Math.min(3, (v / 55) * (v / 55)) * 0.22;
      let tire = 0;
      if (S.spin > 0.005) {
        this.sqPh += 8.5 / sr; if (this.sqPh > 1) this.sqPh -= 1;
        tire = (this.sq1.p(nz) + this.sq2.p(nz2) * 0.8) * S.spin * 1.3 * (0.75 + 0.25 * Math.sin(TAU * this.sqPh));
      }
      const gr = Math.abs(S.gearRpm);
      this.gPh += gr / 60 * 31 / sr; if (this.gPh > 1) this.gPh -= 1;
      let gear = Math.sin(TAU * this.gPh) * (0.006 * Math.min(1, S.drive) + S.rev * 0.05 * Math.min(1, gr / 500));
      if (this.grind > 1e-3) {
        this.grPh += 52 / sr; if (this.grPh > 1) this.grPh -= 1;
        gear += this.grBP.p(nz) * this.grind * (0.4 + 0.6 * this.grPh) * 0.5;
        this.grind *= Math.exp(-1 / (sr * 0.12));
      }
      if (this.clunk > 1e-3) {
        this.clPh += 58 / sr;
        gear += Math.sin(TAU * this.clPh) * this.clunk * 0.12 + nz * this.clunk * this.clunk * 0.04;
        this.clunk *= Math.exp(-1 / (sr * 0.03));
      } else this.clPh = 0;
      if (this.click > 1e-3) { gear += this.tickHP.p(nz3) * this.click * 0.25; this.click *= Math.exp(-1 / (sr * 0.004)); }

      // ---- mix per punto d'ascolto ---------------------------------------------------------
      let out = exh * M.exh + boom * M.boom + intake * M.intake + mech * M.mech + turbo * M.turbo + bov * M.bov
        + road * M.road + wind * M.wind + tire * M.tire + gear * M.gear + starter * M.starter + pump * M.pump;
      out += 1e-18;

      // ---- riverbero corto (garage / abitacolo) -----------------------------------------------
      const rin = out * 0.3;
      let wl = 0, wr = 0;
      for (let q = 0; q < 8; q++) {
        const cb = this.rv[q], buf = cb.b, o = buf[cb.i];
        cb.f = o * 0.7 + cb.f * 0.3;
        buf[cb.i] = rin + cb.f * 0.78;
        cb.i = (cb.i + 1) % buf.length;
        if (q < 4) wl += o; else wr += o;
      }
      for (let q = 0; q < 4; q++) {
        const ap = this.ap[q], buf = ap.b, o = buf[ap.i];
        const inp = q < 2 ? wl : wr;
        const yv = -inp + o;
        buf[ap.i] = inp + o * 0.5;
        ap.i = (ap.i + 1) % buf.length;
        if (q < 2) wl = yv; else wr = yv;
      }
      const g = cfg.vol * 2.6;
      outL[i] = Math.tanh((out + wl * M.rev * 0.25) * g) * 0.9;
      outR[i] = Math.tanh((out + wr * M.rev * 0.25) * g) * 0.9;
    }
  }
}
