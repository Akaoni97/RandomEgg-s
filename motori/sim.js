// ============================================================================
//  SupraSim · fisica di Toyota Supra RZ (JZA80) con 2JZ-GTE e cambio Getrag V160
//  Passo d'integrazione 1/4000 s: motore, turbo, frizione, ruote, gomme, auto.
// ============================================================================
const SIM_CLAMP = (x, a, b) => (x < a ? a : x > b ? b : x);
const SIM_SS = (a, b, x) => { const t = SIM_CLAMP((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class SupraSim {
  constructor() {
    this.P = {
      idle: 750, limiter: 7000, limHyst: 130, launchRpm: 4300,
      Ie: 0.21, Iw: 3.0, mass: 1570, r: 0.322, cd: 0.31, A: 1.95, crr: 0.012, mu: 1.1, cgH: 0.48, wb: 2.55, rearW: 0.47,
      gears: [0, 3.827, 2.360, 1.685, 1.312, 1.000, 0.793], rev: -3.280, fd: 3.133, clutchMax: 820,
      // coppia indicata a pieno carico atmosferico (Nm) — il turbo la moltiplica
      tq: [[0, 140], [500, 160], [1000, 212], [1500, 240], [2000, 258], [2500, 270], [3000, 281], [3500, 290],
        [4000, 296], [4500, 298], [5000, 295], [5500, 287], [6000, 275], [6500, 260], [7000, 244], [7500, 225]],
    };
    // parti montate (default: Supra originale). tuning.js → tuningParams(sel).sim
    this.tune = { turbo: { max: 0.75, a: 1500, b: 3000, up: 0.26, down: 0.75, twin: true }, limiter: 7000, sparkCut: false,
      ecuLaunch: false, ecuPops: false, idle: 750, camLow: 1, camHigh: 1, lope: 0, Ie: 0.21, valve: 'recirc', pw: 1 };
    this.cfg = { valve: 'recirc', pops: false, launch: false, autoClutch: true, revMatch: true };
    this.in = { thr: 0, brake: 0, clutch: 0 };
    this.reset();
  }

  reset() {
    Object.assign(this, {
      we: 0, ww: 0, wo: 0, phi: 0, v: 0, acc: 0, theta: 0, gear: 0, ign: false, running: false, starter: false, crankT: 0, catchAt: 0.6,
      thr: 0, air: 0, iacI: 0, tur: 0, pipeP: 0, sec: 0, wg: 0, cut: 0, cutLim: false, cutLaunch: false, dfco: false, ovr: 9,
      clutch: 0, lock: false, shiftSeq: null, events: [], runT: 0, pumpT: 0, bovLatch: false, launchArmed: false,
      Tc: 0, Tnet: 0, charge: 0, stalled: false,
      fuel: 0.72, waterT: 74, oilT: 69, oilP: 0, volt: 12.5, odo: 48213.4, trip: 0,
      run0: null, best100: null, best400: null, last100: null, last400: null,
    });
  }

  setTune(t) {
    Object.assign(this.tune, t);
    this.P.limiter = this.tune.limiter; this.P.idle = this.tune.idle; this.P.Ie = this.tune.Ie;
    this.cfg.valve = this.tune.valve;
  }
  // potenza e coppia massime a regime stabilizzato, per la scheda del tuning
  estimatePeak() {
    const tn = this.tune, tc = tn.turbo, P = this.P;
    let best = { cv: 0, nm: 0, rpmCv: 0, rpmNm: 0 };
    for (let rpm = 1000; rpm <= P.limiter; rpm += 50) {
      const frac = tc.twin ? SIM_SS(tc.a, tc.b, rpm) * 0.6 + 0.4 * SIM_SS(3800, 4400, rpm) : Math.pow(SIM_SS(tc.a, tc.b, rpm), 1.3);
      const boost = tc.max * Math.min(1, frac * 1.18);
      const camK = SIM_SS(3000, 5500, rpm), camF = tn.camLow * (1 - camK) + tn.camHigh * camK;
      const T = this.tqAt(rpm) * tn.pw * camF * Math.max(0, (1 + 0.78 * boost) - 0.1) / 0.9 - (16 + 0.0035 * rpm + 0.9e-6 * rpm * rpm);
      const cv = T * rpm / 7023;
      if (cv > best.cv) { best.cv = cv; best.rpmCv = rpm; }
      if (T > best.nm) { best.nm = T; best.rpmNm = rpm; }
    }
    return best;
  }
  get rpm() { return Math.max(0, this.we) * 9.5493; }
  get kmh() { return Math.abs(this.v) * 3.6; }
  ratio(g) { return g === 0 ? 0 : (g < 0 ? this.P.rev : this.P.gears[g]) * this.P.fd; }
  tqAt(rpm) {
    const t = this.P.tq;
    if (rpm >= t[t.length - 1][0]) return t[t.length - 1][1];
    for (let i = 1; i < t.length; i++) if (rpm < t[i][0]) {
      const [a, ta] = t[i - 1], [b, tb] = t[i];
      return ta + (tb - ta) * (rpm - a) / (b - a);
    }
    return t[0][1];
  }

  setIgnition(on) {
    if (on && !this.ign) { this.ign = true; this.pumpT = 2.2; this.events.push({ type: 'click' }); }
    if (!on && this.ign) { this.ign = false; this.running = false; this.starter = false; this.pumpT = 0; }
  }
  setStarter(on) {
    if (on && !this.ign) this.setIgnition(true);
    if (on && !this.starter && !this.running) { this.events.push({ type: 'click' }); this.crankT = 0; this.catchAt = 0.45 + Math.random() * 0.5; this.stalled = false; }
    this.starter = on && this.ign;
  }

  shift(target) {
    target = SIM_CLAMP(target, -1, 6);
    if (target === this.gear || this.shiftSeq) return false;
    if (target === -1 && Math.abs(this.v) > 1.2) { this.events.push({ type: 'grind' }); return false; }
    if (this.gear === -1 && target > 0 && this.v < -1.2) { this.events.push({ type: 'grind' }); return false; }
    if (this.cfg.autoClutch) {
      const down = target > 0 && this.gear > 0 && target < this.gear;
      this.shiftSeq = { t: 0, target, down, done: false };
      return true;
    }
    if (target === 0 || this.in.clutch > 0.65) { this.gear = target; this.lock = false; if (target !== 0) this.events.push({ type: 'clunk' }); return true; }
    this.events.push({ type: 'grind' });
    return false;
  }

  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    const n = Math.max(1, Math.ceil(dt * 4000)), h = dt / n;
    for (let i = 0; i < n; i++) this.step(h);
    // grandezze lente: temperature, carburante, cronometri
    const load = this.running ? SIM_CLAMP(this.charge, 0, 2.4) * this.rpm / 7000 : 0;
    this.waterT += ((this.running ? 86 + 5 * load : this.waterT > 40 ? 60 : this.waterT) - this.waterT) * dt * 0.012;
    this.oilT += ((this.running ? 90 + 14 * load : 60) - this.oilT) * dt * 0.006;
    const oilTarget = this.running ? (this.oilT > 85 ? 0.9 : 1.4) + 4.0 * Math.min(1, this.rpm / 5500) : (this.starter ? 0.35 : 0);
    this.oilP += (oilTarget - this.oilP) * Math.min(1, dt * 4);
    const voltT = !this.ign ? 12.5 : this.starter && !this.running ? 10.3 : this.running ? 14.1 : 12.2;
    this.volt += (voltT - this.volt) * Math.min(1, dt * 6);
    if (this.running) this.fuel = Math.max(0, this.fuel - dt * (0.000004 + 0.00006 * load));
    const dist = Math.abs(this.v) * dt / 1000;
    this.odo += dist; this.trip += dist;
    this.pumpT = Math.max(0, this.pumpT - dt);
    // 0-100 km/h e 400 m da fermo
    if (Math.abs(this.v) < 0.05 && !this.in.thr) this.run0 = { armed: true, t: 0, d: 0 };
    if (this.run0) {
      const r = this.run0;
      if (r.armed && this.v > 0.05) { r.armed = false; this.last100 = null; this.last400 = null; }
      if (!r.armed) {
        r.t += dt; r.d += this.v * dt;
        if (!r.done100 && this.kmh >= 100) { r.done100 = true; this.last100 = r.t; if (!this.best100 || r.t < this.best100) this.best100 = r.t; }
        if (!r.done400 && r.d >= 402.3) { r.done400 = true; this.last400 = { t: r.t, v: this.kmh }; if (!this.best400 || r.t < this.best400.t) this.best400 = { t: r.t, v: this.kmh }; }
        if (this.v < -0.1 || r.t > 60) this.run0 = null;
      }
    }
  }

  step(h) {
    const P = this.P, I = this.in, cfg = this.cfg, tn = this.tune, tc = tn.turbo;
    const rpm = this.rpm;
    let thrCmd = I.thr;
    const wheelRpm = (g) => Math.abs(this.wo * this.ratio(g)) * 9.5493;

    // ---- frizione (automatica o pedale) ----------------------------------------
    let clutchPos;
    if (cfg.autoClutch) {
      if (this.shiftSeq) {
        const s = this.shiftSeq; s.t += h;
        if (s.t < 0.07) { this.clutch = Math.min(1, this.clutch + h / 0.045); if (!s.down) thrCmd = 0; }
        else {
          if (!s.done) { s.done = true; this.gear = s.target; this.lock = false; if (s.target !== 0) this.events.push({ type: 'clunk' }); }
          if (this.gear !== 0) {
            const floor = wheelRpm(this.gear) < 1100 ? 1 - SIM_SS(1050, 2700, rpm) : 0;
            this.clutch = Math.max(floor, this.clutch - h / 0.2);
          }
          if (!s.down && s.t < 0.15) thrCmd = 0;
        }
        if (s.down && cfg.revMatch && s.t < 0.27) {
          const tg = wheelRpm(s.target);
          thrCmd = Math.max(thrCmd, SIM_CLAMP((tg - rpm) / 650, 0, 1));
        }
        if (s.t > 0.3) {
          this.shiftSeq = null;
          if (this.gear !== 0 && Math.abs(rpm - wheelRpm(this.gear)) < 250 && rpm > 950) this.lock = true;
        }
      } else if (this.gear !== 0) {
        const slip = Math.abs(rpm - wheelRpm(this.gear));
        if (I.brake > 0.25 && Math.abs(this.v) < 1.0) { this.lock = false; this.clutch = Math.min(1, this.clutch + h / 0.08); }
        else if (this.lock) {
          this.clutch = Math.max(0, this.clutch - h / 0.1);
          if (rpm < 880) this.lock = false;
          if (rpm < 700) this.clutch = 1;
        } else {
          const tgt = 1 - SIM_SS(1050, 2700, rpm);
          this.clutch += SIM_CLAMP(tgt - this.clutch, -h * 5, h * 8);
          if (slip < 70 && this.clutch < 0.35 && rpm > 950) this.lock = true;
        }
      } else this.clutch = Math.max(0, this.clutch - h / 0.2);
      clutchPos = this.clutch;
    } else {
      clutchPos = I.clutch;
      this.clutch = clutchPos;
    }

    // ---- launch control (2-step) -------------------------------------------------
    this.launchArmed = cfg.launch && tn.ecuLaunch && this.running && this.gear >= 1 && Math.abs(this.v) < 1.5 &&
      (cfg.autoClutch ? I.brake > 0.25 : clutchPos > 0.5);

    // ---- farfalla e aria ------------------------------------------------------------
    this.thr += (thrCmd - this.thr) * Math.min(1, h / 0.018);
    const rk = Math.max(rpm / 3000, 0.35), k = 4.2 / rk;
    const aThr = (1 - Math.exp(-k * this.thr)) / (1 - Math.exp(-k));
    let iac = 0;
    const idleT = P.idle + 520 * Math.exp(-this.runT / 4) + tn.lope * 45 * Math.sin(this.runT * 4.1) * Math.sin(this.runT * 1.3);
    if (this.running) {
      const err = (idleT - rpm) / idleT;
      if (this.thr < 0.03 && !this.dfco) this.iacI = SIM_CLAMP(this.iacI + err * h * 1.2, -0.08, 0.25);
      iac = SIM_CLAMP(0.1 + err * 0.7 + this.iacI, 0, 0.45);
    } else if (this.starter) iac = 0.18;
    const airT = SIM_CLAMP(aThr + iac * (1 - aThr), 0.015, 1);
    this.air += (airT - this.air) * Math.min(1, h / 0.035);

    // ---- tagli d'iniezione/accensione -------------------------------------------------
    if (this.running) {
      if (this.cutLim) { if (rpm < P.limiter - P.limHyst) this.cutLim = false; } else if (rpm > P.limiter) this.cutLim = true;
      if (this.launchArmed) { if (this.cutLaunch) { if (rpm < P.launchRpm - 150) this.cutLaunch = false; } else if (rpm > P.launchRpm) this.cutLaunch = true; }
      else this.cutLaunch = false;
      if (this.thr < 0.02 && rpm > 1700 && !this.shiftSeq) this.dfco = true;
      if (this.thr > 0.03 || rpm < 1250) this.dfco = false;
    } else { this.cutLim = this.cutLaunch = this.dfco = false; }
    this.cut = !this.running ? 0 : this.cutLaunch ? 3 : this.cutLim ? 2 : this.dfco ? 1 : 0;
    this.ovr = this.cut === 1 ? this.ovr + h : 0;
    const burning = this.running && this.cut === 0;

    // ---- turbo ---------------------------------------------------------------------------
    let frac;
    if (tc.twin) {
      const secT = rpm > 4000 && this.air > 0.55 ? 1 : rpm < 3700 || this.air < 0.35 ? 0 : this.sec;
      this.sec += (secT - this.sec) * Math.min(1, h / 0.25);
      frac = SIM_SS(tc.a, tc.b, rpm) * 0.6 + 0.4 * this.sec * SIM_SS(3800, 4400, rpm);
    } else {
      frac = Math.pow(SIM_SS(tc.a, tc.b, rpm), 1.3); this.sec = 0;
    }
    let drive = frac * Math.pow(this.air, 1.3) * 1.18;
    if (this.cut === 3) drive += 0.45 * SIM_SS(3000, 4300, rpm);      // anti-lag del 2-step
    else if (!burning) drive *= 0.15;
    const closed = this.thr < 0.12;
    const tgtT = Math.min(1, Math.sqrt(SIM_CLAMP(drive, 0, 1))) * 0.92 + 0.08 * Math.min(1, rpm / 7000) * (0.3 + this.air);
    this.wg = SIM_CLAMP((drive - 1) * 3, 0, 1);
    const tau = tgtT > this.tur ? tc.up : (closed && cfg.valve === 'flutter' ? 0.5 : tc.down * (closed ? 1.6 : 1));
    this.tur += (tgtT - this.tur) * Math.min(1, h / tau);
    if (!closed) this.pipeP += (tc.max * Math.min(1, this.tur * this.tur) * SIM_SS(0.12, 0.6, this.thr) - this.pipeP) * Math.min(1, h / 0.08);
    else this.pipeP += (0 - this.pipeP) * Math.min(1, h / (cfg.valve === 'flutter' ? 0.45 : 0.07));
    if (closed && !this.bovLatch && this.pipeP > 0.2) {
      this.bovLatch = true;
      this.events.push({ type: 'bov', I: SIM_CLAMP(this.pipeP / tc.max * 1.1, 0.35, 1.25) });
    }
    if (this.thr > 0.3) this.bovLatch = false;
    this.charge = this.air * (1 + this.pipeP);

    // ---- coppia motore -------------------------------------------------------------------
    const Tind = this.tqAt(rpm);
    const camK = SIM_SS(3000, 5500, rpm), camF = tn.camLow * (1 - camK) + tn.camHigh * camK;
    // cilindri non perfettamente uguali: con camme lunghe al minimo uno "zoppica" (mezzo ordine)
    const lopeF = 1 + tn.lope * 0.22 * Math.sin(this.theta * 0.5) * (1 - SIM_SS(1200, 2600, rpm));
    const Tcomb = burning ? Tind * tn.pw * camF * lopeF * Math.max(0, this.air * (1 + 0.78 * this.pipeP) - 0.1) / 0.9 : 0;
    const Tfric = rpm > 0 ? 16 + 0.0035 * rpm + 0.9e-6 * rpm * rpm + 9 * (1 - this.air) * (rpm / 3000) : 0;
    let Tcomp = 0;
    if (!this.running && rpm > 0.5) Tcomp = -38 * Math.sin(3 * this.theta) * SIM_CLAMP(1 - rpm / 700, 0, 1);
    const Tst = this.starter && !this.running ? 150 * Math.max(0, 1 - rpm / 320) : 0;
    const Te = Tcomb + Tst + Tcomp - Tfric * Math.min(1, rpm / 30);
    this.Tnet = Tcomb - Tfric;

    // ---- gomme posteriori ------------------------------------------------------------------
    const vw = this.ww * P.r;
    const slip = (vw - this.v) / Math.max(Math.abs(this.v), 2.5);
    const Nr = P.mass * 9.81 * P.rearW + P.mass * this.acc * P.cgH / P.wb;
    const Fmax = P.mu * SIM_CLAMP(Nr, 2500, 12000);
    const Ft = Fmax * Math.sin(1.3 * Math.atan(18 * slip));
    const Tloss = (6 + 0.35 * Math.abs(this.ww)) * Math.tanh(this.ww * 4);
    const Tload = Ft * P.r + Tloss;

    // ---- frizione: coppia trasmessa (aggancio implicito, stabile) ------------------------------
    const G = this.ratio(this.gear);
    // semiassi e albero di trasmissione elastici: oscillazione di 3–5 Hz su attacco e stacco del gas
    const Ig = 0.5, Ks = 16000, Cs = 260;
    const Ts = Ks * this.phi + Cs * (this.wo - this.ww);
    const cap = P.clutchMax * SIM_SS(0.15, 0.85, 1 - clutchPos);
    let Tc = 0;
    if (G !== 0 && cap > 0) {
      const s = this.we - this.wo * G;
      const Tlock = (s / h + Te / P.Ie + G * Ts / Ig) / (1 / P.Ie + G * G / Ig);
      Tc = SIM_CLAMP(Tlock, -cap, cap);
    }
    this.Tc = Tc;
    this.we += h * (Te - Tc) / P.Ie;
    if (this.we < 0) this.we = 0;
    this.wo += h * (Tc * G - Ts) / Ig;
    this.ww += h * (Ts - Tload) / P.Iw;
    this.phi += h * (this.wo - this.ww);
    this.theta = (this.theta + this.we * h) % (4 * Math.PI);

    // ---- vettura ---------------------------------------------------------------------------------
    const v0 = this.v;
    const drag = 0.5 * 1.2 * P.cd * P.A * this.v * Math.abs(this.v);
    const Fb = I.brake * P.mass * 9.81 * 1.05;
    const Froll = P.crr * P.mass * 9.81;
    if (Math.abs(this.v) < 0.03) {
      const Fs = Fb + Froll;
      if (Math.abs(Ft) <= Fs) this.v = 0;
      else this.v += h * (Ft - Math.sign(Ft) * Fs) / P.mass;
    } else {
      let nv = this.v + h * (Ft - drag - Math.sign(this.v) * (Froll + Fb)) / P.mass;
      if (Math.sign(nv) !== Math.sign(this.v) && Math.abs(Ft) < Fb + Froll) nv = 0;
      this.v = nv;
    }
    this.acc += ((this.v - v0) / h - this.acc) * Math.min(1, h / 0.05);

    // ---- accensione, avviamento, stallo ---------------------------------------------------------------
    if (this.running) this.runT += h;
    if (this.ign && this.starter && !this.running) {
      this.crankT += h;
      if (this.crankT > this.catchAt && rpm > 110) { this.running = true; this.runT = 0; this.iacI = 0.05; }
    }
    if (this.running && this.starter && rpm > 500) this.starter = false;
    if (this.running && rpm < 300 && !this.starter) { this.running = false; this.stalled = true; }
    if (!this.ign) this.running = false;
  }

  // parametri per il motore audio
  audioParams() {
    const P = this.P, vw = this.ww * P.r;
    return {
      rpm: this.rpm, charge: this.charge, air: this.air, thr: this.thr, boost: this.pipeP, turbo: this.tur,
      cut: this.cut, ovr: this.ovr, running: this.running ? 1 : 0, starter: this.starter ? 1 : 0,
      speed: Math.abs(this.v), spin: SIM_CLAMP((Math.abs(vw - this.v) - 1.5) / 5, 0, 1),
      drive: Math.abs(this.Tc * this.ratio(this.gear)) / 3000, gearRpm: this.ww * this.ratio(this.gear) * 9.5493,
      rev: this.gear === -1 ? 1 : 0, wg: this.wg, sec: this.tune.turbo.twin ? this.sec : 0,
      rattle: this.running && (this.gear === 0 || this.shiftSeq) && this.clutch < 0.3 ? 1 - SIM_SS(900, 1600, this.rpm) : 0,
      pump: this.pumpT > 0 ? 1 : this.running ? 0.25 : 0,
    };
  }
}

