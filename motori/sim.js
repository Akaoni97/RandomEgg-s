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
      tank: 70, gears: [0, 3.827, 2.360, 1.685, 1.312, 1.000, 0.793], rev: -3.280, fd: 3.133, clutchMax: 820,
      // coppia indicata a pieno carico atmosferico (Nm) — il turbo la moltiplica
      tq: [[0, 140], [500, 160], [1000, 212], [1500, 240], [2000, 258], [2500, 270], [3000, 281], [3500, 290],
        [4000, 296], [4500, 298], [5000, 295], [5500, 287], [6000, 275], [6500, 260], [7000, 244], [7500, 225]],
    };
    // parti montate (default: Supra originale). tuning.js → tuningParams(sel).sim
    this.tune = { turbo: { max: 0.75, a: 1500, b: 3000, up: 0.26, down: 0.75, twin: true }, limiter: 7000, sparkCut: false,
      ecuLaunch: false, ecuPops: false, idle: 750, camLow: 1, camHigh: 1, lope: 0, Ie: 0.21, valve: 'recirc', pw: 1 };
    this.cfg = { valve: 'recirc', pops: false, launch: false, autoClutch: true, revMatch: true, tc: true };
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
      tireT: 24, tireWear: 0, damage: 0, slipPow: 0, skid: 0,
      run0: null, best100: null, best400: null, last100: null, last400: null,
    });
  }

  // cambio d'auto: parametri della scocca, del motore e del cambio (null = Supra di serie)
  setCar(over) {
    if (!this.P0) this.P0 = JSON.parse(JSON.stringify(this.P));
    this.P = Object.assign(JSON.parse(JSON.stringify(this.P0)), over || {});
    if (this.gear > this.P.gears.length - 1) this.gear = this.P.gears.length - 1;
  }
  topGear() { return this.P.gears.length - 1; }
  setTune(t) {
    Object.assign(this.tune, t);
    this.P.limiter = this.tune.limiter; this.P.idle = this.tune.idle; this.P.Ie = this.tune.Ie;
    if (this.tune.mu) this.P.mu = this.tune.mu;
    if (this.tune.fd) this.P.fd = this.tune.fd;
    if (this.tune.clutchMax) this.P.clutchMax = this.tune.clutchMax;
    if (Array.isArray(this.tune.gears)) this.P.gears = this.tune.gears.slice();
    if (this.tune.tyre && this.tune.tyre.crr) this.P.crr = this.tune.tyre.crr;
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
      const T = this.tqAt(rpm) * tn.pw * camF * Math.max(0, (1 + 0.78 * (tn.boostK || 1) * boost) - 0.1) / 0.9 - (16 + 0.0035 * rpm + 0.9e-6 * rpm * rpm);
      const cv = T * rpm / 7023;
      if (cv > best.cv) { best.cv = cv; best.rpmCv = rpm; }
      if (T > best.nm) { best.nm = T; best.rpmNm = rpm; }
    }
    return best;
  }
  // aderenza da temperatura (ottimo verso 90 °C) e usura (fino a −30 %)
  tireGrip() {
    const ty = this.tune.tyre || {}, d = (this.tireT - (ty.opt || 90)) / (ty.win || 65);
    const cooked = this.tireT > 110 ? (this.tireT - 110) * 0.004 : 0;
    // asfalto bagnato: circa un quarto di aderenza in meno (wet da 0 a 1)
    return SIM_CLAMP(1.03 - 0.08 * d * d - cooked, 0.7, 1.03) * (1 - 0.3 * this.tireWear) * (1 - 0.27 * (this.wet || 0));
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
    target = SIM_CLAMP(target, -1, this.P.gears.length - 1);
    if (target === this.gear || this.shiftSeq) return false;
    if (target === -1 && Math.abs(this.v) > 1.2) { this.events.push({ type: 'grind' }); return false; }
    if (this.gear === -1 && target > 0 && this.v < -1.2) { this.events.push({ type: 'grind' }); return false; }
    // scalata che manderebbe il motore fuori giri ("money shift"): il sincronizzatore non entra, gratta
    if (target > 0 && this.gear > 0 && target < this.gear && Math.abs(this.wo * this.ratio(target)) * 9.5493 > this.P.limiter + 900) { this.events.push({ type: 'grind' }); return false; }
    if (this.cfg.autoClutch) {
      const down = target > 0 && this.gear > 0 && target < this.gear;
      this.shiftSeq = { t: 0, target, down, done: false, fast: !!this.fastShift && !down, quick: !!this.quickShift };
      this.fastShift = false;
      return true;
    }
    if (target === 0 || this.in.clutch > 0.65) { this.gear = target; this.lock = false; if (target !== 0) this.events.push({ type: 'clunk' }); return true; }
    this.events.push({ type: 'grind' });
    return false;
  }

  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const n = Math.max(1, Math.ceil(dt * 4000)), h = dt / n;
    for (let i = 0; i < n; i++) this.step(h);
    // grandezze lente: temperature, carburante, cronometri
    const load = this.running ? SIM_CLAMP(this.charge, 0, 2.4) * this.rpm / 7000 : 0;
    this.waterT += ((this.running ? 86 + 5 * load : this.waterT > 40 ? 60 : this.waterT) - this.waterT) * dt * 0.012;
    this.oilT += ((this.running ? 90 + 14 * load : 60) - this.oilT) * dt * 0.006;
    const mt = this.tune.maint || {}, oilK = 0.35 + 0.65 * Math.min(1, (mt.oil ?? 1) / 0.25);
    const oilTarget = (this.running ? (this.oilT > 85 ? 0.9 : 1.4) + 4.0 * Math.min(1, this.rpm / 5500) : (this.starter ? 0.35 : 0)) * oilK;
    this.oilP += (oilTarget - this.oilP) * Math.min(1, dt * 4);
    // temperatura delle gomme: scaldano con lo slittamento e con la frenata, raffreddano con l'aria
    const heatIn = this.slipPow * 0.00028 + (this.in.brake || 0) * Math.abs(this.v) * 0.12 + Math.abs(this.v) * 0.035;
    this.tireT += (heatIn - (this.tireT - 22) * (0.035 + Math.abs(this.v) * 0.0012)) * dt;
    this.tireT = SIM_CLAMP(this.tireT, 15, 160);
    this.tireWear = Math.min(1, this.tireWear + this.slipPow * dt * 4e-8 + Math.abs(this.v) * dt * 1.5e-7);
    this.skid = SIM_CLAMP(this.slipPow / 60000, 0, 1);
    const voltT = !this.ign ? 12.5 : this.starter && !this.running ? 10.3 : this.running ? 14.1 : 12.2;
    this.volt += (voltT - this.volt) * Math.min(1, dt * 6);
    // consumo: ~300 g/kWh di potenza effettiva + minimo; serbatoio da 70 litri
    if (this.running) {
      const kw = Math.max(0, this.Tnet) * this.rpm / 9549;
      this.fuelRate = (0.00035 + kw * 300 / 740 / 3600);            // litri al secondo
      this.fuel = Math.max(0, this.fuel - dt * this.fuelRate / this.P.tank);
    } else this.fuelRate = 0;
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
        // 3-step (flat shift): in salita col gas a fondo non si alza il piede, la centralina taglia l'accensione
        if (s.flat === undefined) s.flat = !!tn.flatShift && !s.down && I.thr > 0.8 && this.running;
        const f = (s.fast ? 0.55 : s.quick ? 0.75 : 1) * (s.flat ? 0.7 : 1) * (P.shiftK || 1);   // cambiata perfetta: frizione aperta per meno tempo
        if (s.t < 0.07 * f) { this.clutch = Math.min(1, this.clutch + h / (0.045 * f)); if (!s.down && !s.flat) thrCmd = 0; }
        else {
          if (!s.done) { s.done = true; this.gear = s.target; this.lock = false; if (s.target !== 0) this.events.push({ type: 'clunk' }); }
          if (this.gear !== 0) {
            const floor = wheelRpm(this.gear) < 1100 ? 1 - SIM_SS(1050, 2700, rpm) : 0;
            this.clutch = Math.max(floor, this.clutch - h / (0.2 * f));
          }
          if (!s.down && s.t < 0.15 * f && !s.flat) thrCmd = 0;
        }
        this.flatCut = s.flat && s.t < 0.16 * f;
        if (s.down && cfg.revMatch && s.t < 0.27) {
          const tg = wheelRpm(s.target);
          thrCmd = Math.max(thrCmd, SIM_CLAMP((tg - rpm) / 650, 0, 1));
        }
        if (s.t > 0.3 * f) {
          this.shiftSeq = null; this.flatCut = false;
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

    // ---- controllo di trazione (TRC): oltre il picco della gomma toglie gas finché le ruote riprendono ----
    const tcOn = cfg.tc && this.gear > 0 && this.running && Math.abs(this.v) > 0.3 && !this.shiftSeq;
    const over = tcOn && (this.slipNow || 0) > 0.16 ? 1 : 0;
    this.tcCut = (this.tcCut || 0) + (over - (this.tcCut || 0)) * Math.min(1, h / (over ? 0.03 : 0.12));
    this.tcAct = this.tcCut > 0.15;
    if (this.tcCut > 0.01) thrCmd *= 1 - 0.8 * this.tcCut;
    // ---- launch control (2-step) -------------------------------------------------
    this.launchArmed = cfg.launch && tn.ecuLaunch && this.running && this.gear >= 1 && Math.abs(this.v) < 1.5 &&
      (cfg.autoClutch ? I.brake > 0.25 : clutchPos > 0.5);

    // ---- farfalla e aria ------------------------------------------------------------
    // esitazione: gas spalancato di colpo ai bassi giri, la miscela si smagrisce per un attimo e il motore "si siede"
    const dThr = thrCmd - this.thr;
    if (dThr > 0.02 && rpm < 3400 && this.running) this.hes = Math.max(this.hes || 0, Math.min(0.6, dThr * (P.hesK ?? 0.3) * (1 - rpm / 3400) * 0.8));   // indipendente dal passo d'integrazione
    this.hes = (this.hes || 0) * Math.exp(-h / 0.16);
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
    // tipi di limitatore: taglio d'iniezione (di serie), soft cut a ritardo d'accensione, hard cut d'accensione (MSD),
    // stutter box ritmato; il 2-step è un secondo limitatore per la partenza, il 3-step taglia durante le cambiate
    const lt = tn.limType || (tn.sparkCut ? 'spark' : 'fuel');
    this.softK = 1;
    if (this.running) {
      const lim = P.limiter, hyst = lt === 'spark' || lt === 'stutter' ? 240 : lt === 'soft' ? 60 : P.limHyst;
      if (lt === 'soft') {
        // toglie anticipo negli ultimi 300 giri: la coppia sparisce senza strappi e il motore "galleggia" vibrando
        this.softK = 1 - 0.95 * SIM_SS(lim - 300, lim + 40, rpm);
        if (this.softK < 0.9 && Math.random() < h * 60 * (1 - this.softK)) this.misT = Math.max(this.misT || 0, 0.012);
        const hard = lim + 140;
        if (this.cutLim) { if (rpm < hard - 100) this.cutLim = false; } else if (rpm > hard) this.cutLim = true;
      } else if (this.cutLim) { if (rpm < lim - hyst) this.cutLim = false; } else if (rpm > lim) this.cutLim = true;
      // stutter box: da fermo (o in folle) limita ai giri di launch con un taglio a tempo, regolare come una mitragliatrice
      this.stutter = lt === 'stutter' && Math.abs(this.v) < 1.5 && (this.gear === 0 || this.launchArmed) && I.thr > 0.5;
      if (this.stutter) { this.stuT = ((this.stuT || 0) + h) % 0.13; this.cutLaunch = rpm > P.launchRpm - 350 && (this.stuT < 0.065 || rpm > P.launchRpm); }
      else if (this.launchArmed) { if (this.cutLaunch) { if (rpm < P.launchRpm - 150) this.cutLaunch = false; } else if (rpm > P.launchRpm) this.cutLaunch = true; }
      else this.cutLaunch = false;
      if (this.thr < 0.02 && rpm > 1700 && !this.shiftSeq) this.dfco = true;
      if (this.thr > 0.03 || rpm < 1250) this.dfco = false;
    } else { this.cutLim = this.cutLaunch = this.dfco = false; }
    this.cut = !this.running ? 0 : this.cutLaunch || this.flatCut ? 3 : this.cutLim ? 2 : this.dfco ? 1 : 0;
    this.ovr = this.cut === 1 ? this.ovr + h : 0;
    if (this.running && this.fuel <= 0) { this.running = false; this.stalled = true; this.dry = true; }
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
    if (this.cut === 3) drive += (this.flatCut ? 0.8 : 0.45) * SIM_SS(3000, 4300, rpm);      // anti-lag del 2-step; nel flat shift la pressione resta
    else if (!burning) drive *= 0.15;
    const closed = this.thr < 0.12 && !this.flatCut;
    const tgtT = Math.min(1, Math.sqrt(SIM_CLAMP(drive, 0, 1))) * 0.92 + 0.08 * Math.min(1, rpm / 7000) * (0.3 + this.air);
    this.wg = SIM_CLAMP((drive - 1) * 3, 0, 1);
    const tau = tgtT > this.tur ? tc.up * ((tn.ic && tn.ic.lag) || 1) : (closed && cfg.valve === 'flutter' ? 0.5 : tc.down * (closed ? 1.6 : 1));
    this.tur += (tgtT - this.tur) * Math.min(1, h / tau);
    if (!closed) this.pipeP += (tc.max * Math.min(1, this.tur * this.tur) * SIM_SS(0.12, 0.6, this.thr) - this.pipeP) * Math.min(1, h / 0.08);
    else this.pipeP += (0 - this.pipeP) * Math.min(1, h / (cfg.valve === 'flutter' ? 0.45 : 0.07));
    if (closed && !this.bovLatch && this.pipeP > (cfg.valve === 'flutter' ? 0.1 : 0.2)) {
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
    // intercooler: con la pressione l'aria si scalda, il flusso d'aria la raffredda; aria calda = meno coppia
    const icH = tn.ic ? tn.ic.heat : 0;
    this.iat = Math.max(0, (this.iat || 0) + (Math.pow(Math.max(0, this.pipeP), 1.5) * this.air * 0.075 * icH - (this.iat || 0) * (0.05 + Math.abs(this.v) * 0.004)) * h);
    // manutenzione: olio vecchio (attriti, −6 %), candele consumate (accensioni perse a scatti)
    const mt = tn.maint || {};
    const maintK = 1 - Math.max(0, 0.25 - (mt.oil ?? 1)) * 0.25;
    if (burning && (mt.plugs ?? 1) < 0.4 && Math.random() < (0.4 - mt.plugs) * h * 30) this.misT = 0.04 + Math.random() * 0.05;
    this.misT = Math.max(0, (this.misT || 0) - h);
    const Tcomb = burning ? Tind * tn.pw * camF * lopeF * maintK * (1 - 0.18 * this.iat) * (this.misT > 0 ? 0.4 : 1) * this.softK * (1 - (this.hes || 0)) * Math.max(0, this.air * (1 + 0.78 * (tn.boostK || 1) * this.pipeP) - 0.1) / 0.9 : 0;
    const Tfric = rpm > 0 ? 16 + 0.0035 * rpm + 0.9e-6 * rpm * rpm + 9 * (1 - this.air) * (rpm / 3000) : 0;
    let Tcomp = 0;
    if (!this.running && rpm > 0.5) Tcomp = -38 * Math.sin(3 * this.theta) * SIM_CLAMP(1 - rpm / 700, 0, 1);
    const Tst = this.starter && !this.running ? 150 * Math.max(0, 1 - rpm / 320) : 0;
    const Te = Tcomb + Tst + Tcomp - Tfric * Math.min(1, rpm / 30);
    this.Tnet = Tcomb - Tfric;

    // ---- gomme posteriori ------------------------------------------------------------------
    const vw = this.ww * P.r;
    const slip = (vw - this.v) / Math.max(Math.abs(this.v), 2.5);
    // gomme: carico (con trasferimento in accelerazione), sensibilità al carico, temperatura e usura
    // carico sull'asse motore: in accelerazione il peso va dietro (aiuta la trazione posteriore, toglie a quella anteriore)
    // la cassa è una massa sulle molle: il trasferimento di carico segue il beccheggio (si siede, sorpassa un po' e si assesta)
    const pk = (tn.susp || {}).pitch || 1, wn = 2 * Math.PI * (1.25 / Math.sqrt(pk)), zeta = 0.42 + 0.28 * (1 - Math.min(1, pk));
    this.pzV = (this.pzV || 0) + h * (wn * wn * (this.acc - (this.pz || 0)) - 2 * zeta * wn * (this.pzV || 0));
    this.pz = (this.pz || 0) + h * this.pzV;
    // saltellamento dell'assale (wheel hop): gomma che aggrappa e molla oltre il picco, a bassa velocità e con tanta coppia
    const hopOn = this.gear > 0 && Math.abs(this.v) < 16 && Math.abs(this.kap || 0) > 0.08 && Math.abs(this.kap || 0) < 0.3 && this.Tc > 150;
    const hopK = (((tn.tyre || {}).C || 1.42) > 1.5 ? 1.4 : 1) * (tn.diff === 'open' ? 0.8 : 1.1) * (((tn.susp || {}).launch || 1) > 1.06 ? 0.3 : 1);
    this.hopE = SIM_CLAMP((this.hopE || 0) + h * (hopOn ? 1.1 * hopK : -4), 0, 0.8);
    this.hopPh = ((this.hopPh || 0) + h * 10.5) % 1;
    const hopF = 1 + 0.26 * this.hopE * Math.sin(this.hopPh * 6.2832);
    if (this.hopE > 0.3 && this.hopPh < h * 10.5) this.events.push({ type: 'bump', I: 0.25 * this.hopE });
    const Nr = SIM_CLAMP((P.mass * 9.81 * P.rearW + (P.fwd ? -1 : 1) * P.mass * this.pz * P.cgH / P.wb) * hopF, 2500, 12000);
    // differenziale: aperto (la ruota scarica gira a vuoto), Torsen (ripartisce), autobloccante (blocca)
    const dk = tn.diff === 'lsd' ? 1 : tn.diff === 'torsen' ? 0.96 : 0.87;
    // assetto: in partenza un posteriore che si "siede" (o un anteriore che non si alza) carica le ruote motrici
    const launchK = 1 + (((tn.susp || {}).launch || 1) - 1) * (1 - SIM_SS(4, 22, Math.abs(this.v)));
    const Fmax = P.mu * Nr * (1 - 0.08 * (Nr / 7260 - 1)) * this.tireGrip() * dk * launchK;
    // gomma: lo slittamento "visto" dal battistrada segue quello reale con un ritardo (lunghezza di rilassamento ~0,3 m),
    // poi curva di Pacejka della mescola: picco, e oltre la forza cala più o meno in fretta
    const ty = tn.tyre || { B: 20, C: 1.42, E: 0.1 };
    this.kap = (this.kap || 0) + (slip - (this.kap || 0)) * Math.min(1, h * (Math.abs(this.v) + 3) / 0.3);
    const bk = ty.B * this.kap;
    const Ft = Fmax * Math.sin(ty.C * Math.atan(bk - ty.E * (bk - Math.atan(bk))));
    this.slipNow = slip;
    this.slipPow = Math.abs(Ft * (vw - this.v));                          // potenza dissipata nello slittamento (W)
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
    const drag = 0.5 * 1.2 * P.cd * (1 + this.damage * 0.25) * P.A * this.v * Math.abs(this.v);
    // freni: chiedono fino a 1,1 g, ma più di quanto tengono le quattro gomme non danno; l'ABS lavora a impulsi al limite
    const ty2 = tn.tyre || {}, gripAll = (P.mu * 0.92 + 0.08) * this.tireGrip() * (ty2.brake || 1) * P.mass * 9.81;
    const pads = (tn.maint || {}).pads ?? 1;
    let Fb = I.brake * P.mass * 9.81 * 1.1 * (0.7 + 0.3 * Math.min(1, pads / 0.3));
    if (pads < 0.1 && I.brake > 0.3 && Math.abs(this.v) > 3 && Math.random() < h * 3) this.events.push({ type: 'grind' });   // ferro su ferro
    this.abs = Fb > gripAll * 0.97 && Math.abs(this.v) > 1.5;
    if (this.abs) { this.absPh = ((this.absPh || 0) + h * 14) % 1; Fb = gripAll * (this.absPh < 0.7 ? 0.97 : 0.8); }
    const Froll = P.crr * (1 + Math.abs(this.v) / 120) * P.mass * 9.81;
    if (Math.abs(this.v) < 0.03) {
      const Fs = Fb + Froll;
      if (Math.abs(Ft) <= Fs) this.v = 0;
      else this.v += h * (Ft - Math.sign(Ft) * Fs) / P.mass;
    } else {
      let nv = this.v + h * (Ft - drag - Math.sign(this.v) * (Froll + Fb) - P.mass * 9.81 * (this.grade || 0)) / P.mass;
      if (Math.sign(nv) !== Math.sign(this.v) && Math.abs(Ft) < Fb + Froll) nv = 0;
      this.v = nv;
    }
    this.acc += ((this.v - v0) / h - this.acc) * Math.min(1, h / 0.05);

    // ---- accensione, avviamento, stallo ---------------------------------------------------------------
    if (this.running) this.runT += h;
    if (this.ign && this.starter && !this.running) {
      this.crankT += h;
      if (this.crankT > this.catchAt && rpm > 110 && this.fuel > 0) { this.running = true; this.runT = 0; this.iacI = 0.05; }
    }
    if (this.running && this.starter && rpm > 500) this.starter = false;
    if (this.running && rpm < 300 && !this.starter) { this.running = false; this.stalled = true; }
    if (!this.ign) this.running = false;
  }

  // parametri per il motore audio
  audioParams() {
    const P = this.P, vw = this.ww * P.r;
    return {
      rpm: this.rpm, charge: this.charge * (0.35 + 0.65 * (this.softK ?? 1)), soft: 1 - (this.softK ?? 1), air: this.air, thr: this.thr, boost: this.pipeP, turbo: this.tur,
      cut: this.cut, ovr: this.ovr, running: this.running ? 1 : 0, starter: this.starter ? 1 : 0,
      speed: Math.abs(this.v), spin: SIM_CLAMP((Math.abs(vw - this.v) - 1.5) / 5, 0, 1), abs: this.abs ? 1 : 0, tc: this.tcAct ? 1 : 0, iat: this.iat || 0,
      drive: Math.abs(this.Tc * this.ratio(this.gear)) / 3000, gearRpm: this.ww * this.ratio(this.gear) * 9.5493,
      rev: this.gear === -1 ? 1 : 0, wg: this.wg, sec: this.tune.turbo.twin ? this.sec : 0,
      rattle: this.running && (this.gear === 0 || this.shiftSeq) && this.clutch < 0.3 ? 1 - SIM_SS(900, 1600, this.rpm) : 0,
      pump: this.pumpT > 0 ? 1 : this.running ? 0.25 : 0,
    };
  }
}

