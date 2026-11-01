// ============================================================================
//  CarRadio · musica di sottofondo mentre si guida, come un'autoradio
//  Stazioni: spenta, FM 89.7 (Redline at Midnight, dal file), FM 76.1 (synth notturno
//  generato in tempo reale con Web Audio: cassa, rullante, charleston, basso, accordi).
//  Cambiando stazione si sente il fruscio della sintonia. Volume basso e separato dal motore.
// ============================================================================
/* global window, Audio */
class CarRadio {
  constructor(opts = {}) {
    this.stations = [
      { id: 'off', freq: '', name: 'Radio spenta' },
      { id: 'redline', freq: 'FM 89.7', name: 'Redline at Midnight', src: opts.src },
      { id: 'synth', freq: 'FM 76.1', name: 'Synth Notturno', gen: true },
    ];
    this.i = 1; this.vol = 0.3; this.master = 1; this.muted = false; this.on = false;
    this.el = null; this.ctx = null; this.timer = null;
    this.onChange = opts.onChange || (() => {});
  }
  get station() { return this.stations[this.i]; }
  level() { return this.muted ? 0 : this.vol * this.master; }

  attach(ctx) {
    if (this.ctx || !ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = this.level(); this.out.connect(ctx.destination);
    // riverbero corto per il synth (eco a nastro)
    this.genBus = ctx.createGain(); this.genBus.gain.value = 0.9; this.genBus.connect(this.out);
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.47; const fb = ctx.createGain(); fb.gain.value = 0.28; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.genBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.out);
    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = n.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    this.noiseBuf = n;
  }

  // accensione: riprende la stazione scelta (si chiama dopo un gesto dell'utente)
  start(ctx) { this.attach(ctx); this.on = true; this.play(); }
  stop() { this.on = false; this.halt(); }

  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); this.apply(); }
  setMaster(m, muted) { this.master = m; this.muted = !!muted; this.apply(); }
  apply() {
    if (this.el) this.el.volume = Math.min(1, this.level());
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.05);
  }

  select(i) {
    this.i = ((i % this.stations.length) + this.stations.length) % this.stations.length;
    if (this.on) { this.static(); this.play(); }
    this.onChange(this.station);
  }
  next() { this.select(this.i + 1); }

  halt() {
    if (this.el) { this.el.pause(); }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  play() {
    this.halt();
    const st = this.station;
    if (!this.on || st.id === 'off') return;
    if (st.src) {
      if (!this.el) { this.el = new Audio(st.src); this.el.loop = true; this.el.preload = 'auto'; }
      this.apply();
      const p = this.el.play(); if (p && p.catch) p.catch(() => {});
    } else if (st.gen && this.ctx) this.startSynth();
  }

  // fruscio di sintonia fra una stazione e l'altra
  static() {
    if (!this.ctx) return;
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), bp = c.createBiquadFilter();
    s.buffer = this.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
    const t = c.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 0.35);
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(3500, t + 0.3);
    s.connect(bp); bp.connect(g); g.connect(this.out); s.start(t); s.stop(t + 0.4);
  }

  // ------------------------------------------------------------- synth notturno (96 BPM, La minore)
  startSynth() {
    const c = this.ctx, spb = 60 / 96 / 4;          // durata di una semicroma
    this.step = 0; this.nextT = c.currentTime + 0.12;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const tick = () => {
      while (this.nextT < c.currentTime + 0.15) {
        const t = this.nextT, k = this.step % 16, bar = Math.floor(this.step / 16) % 4, ch = chords[bar];
        if (k % 4 === 0) this.kick(t);
        if (k === 4 || k === 12) this.snare(t);
        if (k % 2 === 1) this.hat(t, k % 4 === 3 ? 0.05 : 0.03);
        if (k % 2 === 0) this.bass(t, hz(ch[[0, 0, 2, 1][(k / 2) % 4]] - 24), spb * 1.8);
        if (k === 0) for (const m of ch) this.pad(t, hz(m), spb * 16);
        if (k === 6 || k === 14) this.bell(t, hz(ch[(bar + k) % 3] + 12));
        this.nextT += spb; this.step++;
      }
    };
    tick(); this.timer = setInterval(tick, 25);
  }
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  kick(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.003, 0.9, 0.28); o.connect(g); g.connect(this.genBus); o.start(t); o.stop(t + 0.35);
  }
  noise(t, dur, type, f, peak) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f;
    this.env(g, t, 0.002, peak, dur); s.connect(fl); fl.connect(g); g.connect(this.genBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  snare(t) { this.noise(t, 0.2, 'bandpass', 1900, 0.45); const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.value = 190; this.env(g, t, 0.002, 0.25, 0.1); o.connect(g); g.connect(this.genBus); o.start(t); o.stop(t + 0.15); }
  hat(t, d) { this.noise(t, d, 'highpass', 7500, 0.16); }
  bass(t, f, d) {
    const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + d);
    this.env(g, t, 0.005, 0.32, d); o.connect(lp); lp.connect(g); g.connect(this.genBus); o.start(t); o.stop(t + d + 0.05);
  }
  pad(t, f, d) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1300;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.6); g.gain.setValueAtTime(0.06, t + d - 0.4); g.gain.linearRampToValueAtTime(0.0001, t + d);
    for (const det of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + 0.05); }
    lp.connect(g); g.connect(this.genBus);
  }
  bell(t, f) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f; this.env(g, t, 0.004, 0.12, 0.6); o.connect(g); g.connect(this.genBus); o.start(t); o.stop(t + 0.7);
  }
}
window.CarRadio = CarRadio;
