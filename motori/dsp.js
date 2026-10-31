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
      speed: 0, spin: 0, drive: 0, gearRpm: 0, rev: 0, wg: 0, sec: 0, pump: 0, rattle: 0 };
    this.S = Object.assign({}, this.T);
    this.cfg = { tune: EngineDSP.stock(), pops: 0, view: 0, vol: 0.8 };
    this.rpmI = 0; this.rpmStep = 0; this.fluM = 0;      // giri interpolati campione per campione
    this.flu = 0;                          // fluttuazione istantanea della velocità d'albero
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
    this.tb = 0; this.tbA = 0.2; this.catS = 0; this.catA = 1; this.catG = 1; this.rasp = 0;
    this.tips = new Float32Array(256); this.tw = 0; this.tipD = 0; this.tipBP = new BQ();
    this.scrBP = new BQ().set('bp', 950, 0.9, sr); this.scrHP = new BQ().set('hp', 300, 0.7, sr);
    this.rattle = 0; this.ratBP = new BQ().set('bp', 3300, 3, sr); this.ratBP2 = new BQ().set('bp', 5400, 4, sr);
    this.chirpPh = 0;
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

  // parti di serie (stesso contenuto di tuningParams(stock).dsp)
  static stock() {
    return {
      ex: { L: 4.4, r: -0.42, m: [['lp', 360, 0.6], ['lp', 1000, 0.5], ['peak', 105, 1.0, 6], ['peak', 420, 2, -5]], g: 1.7, jet: 0.12, rasp: 0, tips: 1 },
      cat: { lp: 2600, g: 0.85, pop: 1 },
      tb: { f0: 2500, f1: 8700, w: 0.035, wh: 0.05, damp: 1700, twin: 1, mani: 0 },
      bov: { v: 0, f0: 1800, sw: 600, q: 0.7, g: 0.12, chirp: 0 },
      scream: 0, intake: { in: 1, roar: 1, wh: 1 }, lope: 0, rattle: 0, spark: 0,
    };
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
    const sr = this.sr, t = c.tune || EngineDSP.stock();
    this.tn = t;
    // collettori: ghisa originale 3+3 (biturbo) oppure tubolare 6-1 a lunghezze quasi uguali (single)
    const twin = t.tb.mani === 0;
    const L = twin ? [0.44, 0.35, 0.30, 0.32, 0.37, 0.47] : [0.88, 0.86, 0.84, 0.84, 0.86, 0.88];
    this.cyl.forEach((cy, i) => {
      cy.D = Math.max(2, Math.round((L[i] + (twin && i >= 3 ? 0.22 : 0)) / 610 * sr));
      cy.rf = twin ? -0.28 : -0.38;
    });
    this.tbA = 1 - Math.exp(-2 * Math.PI * t.tb.damp / sr);
    // catalizzatore
    this.catA = t.cat.lp > 0 ? 1 - Math.exp(-2 * Math.PI * t.cat.lp / sr) : 1;
    this.catG = t.cat.g;
    // tubo e silenziatore
    const ex = t.ex;
    this.pD = Math.min(8000, Math.round(ex.L / 495 * sr));
    this.pR = ex.r;
    ex.m.forEach((m, i) => this.muf[i].set(m[0], m[1], m[2], sr, m[3]));
    this.mufG = ex.g; this.jetG = ex.jet; this.rasp = ex.rasp;
    this.jetBP.set('bp', 3200, 0.6, sr);
    // doppia uscita: il secondo terminale arriva 0,4 ms dopo e con un timbro leggermente diverso
    this.tipD = ex.tips > 1 ? Math.round(0.00042 * sr) : 0;
    this.tipBP.set('peak', 1250, 1.2, sr, 3);
    // valvola: 0 ricircolo OEM, 1 blow-off, 2 nessuna (flutter)
    // punto d'ascolto: 0 abitacolo, 1 esterno posteriore, 2 vano motore
    const V = [
      { exh: 0.62, lp: 1300, boom: 0.9, intake: 0.5, mech: 0.12, turbo: 0.3, bov: 0.45, road: 1.0, wind: 0.9, tire: 0.55, gear: 1.0, starter: 0.55, pump: 1.0, rev: 0.14, width: 0.15 },
      { exh: 1.0, lp: 14000, boom: 0.0, intake: 0.16, mech: 0.07, turbo: 0.32, bov: 0.6, road: 0.35, wind: 0.12, tire: 1.0, gear: 0.15, starter: 0.3, pump: 0.0, rev: 0.11, width: 1.0 },
      { exh: 0.35, lp: 2600, boom: 0.0, intake: 1.0, mech: 1.0, turbo: 1.0, bov: 1.0, road: 0.15, wind: 0.1, tire: 0.3, gear: 0.45, starter: 1.0, pump: 0.25, rev: 0.08, width: 0.35 },
    ];
    this.mixT = Object.assign({}, V[c.view]);
  }

  event(e) {
    const T = this.T;
    if (e.type === 'bov') {
      this.bov.I = Math.min(1.3, e.I || 0.8); this.bov.t = 0; this.bov.env = 0.0001;
      this.bov.len = this.tn.bov.v === 2 ? 0.45 + 0.35 * this.bov.I : 0.16 + 0.38 * this.bov.I;
      this.chirpPh = 0;
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
      const low = Math.max(0, 1 - S.rpm / 1600), lope = this.tn.lope * Math.max(0, 1 - S.rpm / 2600);
      let jitter = 1 + this.g() * (0.03 + 0.07 * low + 0.12 * lope);
      // camme lunghe: incrocio delle valvole, qualche ciclo debole e "sporco"
      if (lope > 0 && Math.abs(this.r()) < 0.09 * lope) jitter *= 0.35 + 0.3 * Math.abs(this.r());
      comb = Math.pow(ch, 0.9) * jitter;
      // ogni scoppio dà una piccola spinta all'albero: la velocità oscilla dentro il ciclo
      this.flu += (0.03 + 0.05 * lope) * comb * Math.min(1, 1100 / Math.max(S.rpm, 300));
      if (S.rattle > 0.01) this.rattle += S.rattle * (0.6 + 0.4 * Math.abs(this.r()));
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
      const pm = this.tn.cat.pop, sp = this.tn.spark;
      if (T.cut === 1) ch = this.cfg.pops ? (0.16 * Math.exp(-T.ovr / 2.2) + 0.02) * pm : 0;
      else if (T.cut === 2) { ch = sp ? (this.cfg.pops ? 0.34 : 0.16) * pm : 0.02; big = true; }
      else if (T.cut === 3) { ch = (this.cfg.pops ? 0.55 : 0.3) * pm; big = true; }
      if (Math.abs(this.r()) < ch) this.addPop(big || Math.abs(this.r()) < 0.15);
    }
  }

  control() {
    const S = this.S, T = this.T;
    const rTarget = S.rpm + (T.rpm - S.rpm) * this.aRpm;
    this.rpmStep = (rTarget - this.rpmI) / 32;
    S.rpm = rTarget;
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
    S.rattle += (T.rattle - S.rattle) * f;
    const M = this.mix, MT = this.mixT;
    for (const k in MT) M[k] += (MT[k] - M[k]) * s;
    this.viewLP.set('lp', M.lp, 0.6, this.sr);
    this.viewLP2.set('lp', Math.min(16000, M.lp * 1.6), 0.6, this.sr);
    if (this.bov.env > 0) {
      const pr = Math.min(1, this.bov.t / this.bov.len);
      const b = this.tn.bov;
      this.bovBP.set('bp', b.f0 - b.sw * pr, b.q, this.sr);
      this.bov.rate = 24 - 12 * pr;
    }
  }

  render(outL, outR, n) {
    const sr = this.sr, S = this.S, cfg = this.cfg, cyl = this.cyl, tn = this.tn;
    const TAU = 6.283185307179586;
    for (let i = 0; i < n; i++) {
      if ((this.k++ & 31) === 0) this.control();
      const M = this.mix;
      const rn = S.rpm / 7000;
      // giri interpolati senza gradini + oscillazione della velocità d'albero dopo ogni scoppio
      this.rpmI += this.rpmStep;
      const dth = Math.max(0, this.rpmI) * 6 / sr;
      this.flu *= 1 - Math.min(0.5, dth / 55);
      this.fluM += (this.flu - this.fluM) * 0.0008;
      this.th += dth * (1 + this.flu - this.fluM);
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
      // catalizzatore
      this.catS += this.catA * (x - this.catS);
      x = this.catS * this.catG;
      // onda d'urto: a pieno carico gli impulsi si irripidiscono (più armoniche, più "rasp")
      if (this.rasp > 0) x += this.rasp * 0.55 * x * Math.abs(x);

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
      // screamer pipe della wastegate: gas di scarico liberi, impulsi compresi
      if (tn.scream && S.wg > 0.005) exh += (this.scrBP.p(nz2) * 0.6 + this.scrHP.p(col) * 0.45) * S.wg * 0.4;
      // secondo terminale (scarichi a doppia uscita)
      this.tips[this.tw] = exh;
      const exhR = this.tipD ? this.tipBP.p(this.tips[(this.tw - this.tipD) & 255]) : exh;
      this.tw = (this.tw + 1) & 255;

      // ---- aspirazione -------------------------------------------------------------
      let intake = this.inLP.p(this.inPK.p(this.inHP.p(inn))) * 1.1 * tn.intake.in;
      intake += this.roarBP.p(nz2) * S.air * Math.pow(rn, 1.5) * 0.12 * (1 - 0.5 * S.turbo) * tn.intake.roar;

      // ---- turbo: fischio della girante, soffio, valvola --------------------------
      const tb = tn.tb, ft = tb.f0 + (tb.f1 - tb.f0) * S.turbo;
      this.lfo += (nz * 0.002 - this.lfo * 0.0005);
      this.tph += ft * (1 + this.lfo) / sr; if (this.tph > 1) this.tph -= 1;
      let whistle = Math.sin(TAU * this.tph) + 0.25 * Math.sin(2 * TAU * this.tph);
      if (tb.twin) {
        this.tph2 += ft * 0.87 / sr; if (this.tph2 > 1) this.tph2 -= 1;
        whistle += S.sec * 0.8 * Math.sin(TAU * this.tph2);
      }
      const tAmp = Math.pow(S.turbo, 1.7) * (0.22 + 0.78 * S.thr) * tb.w * (0.6 + 0.4 * tn.intake.wh);
      let turbo = whistle * tAmp + this.whooshBP.p(nz3) * S.turbo * S.air * tb.wh * tn.intake.wh;

      let bov = 0;
      if (this.bov.env > 0) {
        const B = this.bov; B.t += 1 / sr;
        const att = 0.004;
        const env = B.t < att ? B.t / att : Math.exp(-(B.t - att) / (B.len * 0.38));
        const nb = this.bovHP.p(this.bovBP.p(nz));
        const bv = tn.bov;
        if (bv.v === 2) {
          this.flPh += B.rate / sr; if (this.flPh > 1) this.flPh -= 1;
          const chop = Math.pow(0.5 + 0.5 * Math.cos(TAU * this.flPh), 5);
          bov = (nb * 0.5 + this.flBP.p(nz2) * 1.4 + Math.sin(TAU * this.tph) * 0.12) * chop * env * B.I * bv.g;
        } else {
          bov = nb * env * B.I * bv.g;
          // sibilo tonale iniziale (tipo "trombetta") che scende di frequenza
          if (bv.chirp > 0 && B.t < 0.25) {
            this.chirpPh += (3400 - 5200 * B.t) / sr; if (this.chirpPh > 1) this.chirpPh -= 1;
            bov += Math.sin(TAU * this.chirpPh) * bv.chirp * B.I * 0.1 * Math.exp(-B.t / 0.07) * Math.min(1, B.t / 0.006);
          }
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

      // tintinnio della frizione bidisco in folle al minimo
      if (this.rattle > 1e-3) {
        mech += (this.ratBP.p(nz2) + this.ratBP2.p(nz3) * 0.7) * this.rattle * 0.5;
        this.rattle *= this.knockDec;
      }

      // ---- mix per punto d'ascolto ---------------------------------------------------------
      const side = exhR * M.exh - exh * M.exh;   // differenza tra i terminali → immagine stereo
      let out = exh * M.exh + boom * M.boom + intake * M.intake + mech * M.mech + turbo * M.turbo + bov * M.bov
        + road * M.road + wind * M.wind + tire * M.tire + gear * M.gear + starter * M.starter + pump * M.pump;
      out += 1e-18;

      // ---- riverbero corto (garage / abitacolo) -----------------------------------------------
      const rin = out * 0.22;
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
      const w = side * 0.5 * M.width;
      outL[i] = Math.tanh((out - w + wl * M.rev * 0.25) * g) * 0.9;
      outR[i] = Math.tanh((out + w + wr * M.rev * 0.25) * g) * 0.9;
    }
  }
}
