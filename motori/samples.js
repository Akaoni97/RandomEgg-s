// ============================================================================
//  SamplePlayer · suona i campioni audio di una mod caricati dall'utente
//  Ogni file è un anello registrato a un regime noto (es. "on_4000.ogg",
//  "off_2500.wav"): viene riprodotto in loop, intonato sui giri attuali e
//  miscelato con i vicini. I file restano nel browser, non vengono caricati altrove.
// ============================================================================
class SamplePlayer {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    // catena: corpo sui bassi sotto carico, filtro che si chiude in rilascio, saturazione morbida (calore)
    this.body = ctx.createBiquadFilter(); this.body.type = 'lowshelf'; this.body.frequency.value = 180; this.body.gain.value = 0;
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 9000; this.tone.Q.value = 0.5;
    this.warm = ctx.createWaveShaper(); const k = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; k[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
    this.warm.curve = k; this.warm.oversample = '2x';
    this.out.connect(this.body); this.body.connect(this.tone); this.tone.connect(this.warm); this.warm.connect(dest);
    // effetti registrati (valvola, turbo, scoppi): uscita a parte, senza il filtro di carico del motore
    this.fxOut = ctx.createGain(); this.fxOut.gain.value = 0; this.fxOut.connect(dest);
    this.items = []; this.voices = 0;
  }

  // regime e tipo dal nome del file
  static parse(name) {
    const base = name.replace(/\.[a-z0-9]+$/i, '');
    const nums = (base.match(/\d{3,5}/g) || []).map(Number).filter((n) => n >= 400 && n <= 12000);
    const rpm = nums.length ? nums[nums.length - 1] : 3000;
    const off = /(^|[^a-z])(off|dec|decel|coast|neg|rilascio|overrun)/i.test(base);
    return { rpm, off };
  }

  // effetti riconosciuti dal nome: valvola, flutter, fischio e sibilo del turbo, scoppi, limitatore.
  // Un nome tipo "on_4000" / "off_2500" resta sempre un anello del motore.
  static role(name) {
    const b = name.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
    if (/(^|[^a-z])(on|off)[_ -]?\d{3,5}/.test(b)) return null;
    if (/flutter|chatter|stutu/.test(b)) return 'flutter';
    if (/dump|bov|blow.?off|pssh/.test(b)) return 'bov';
    if (/hiss/.test(b)) return 'hiss';
    if (/bang|backfire|afterfire|rumble|crackle|(^|[^a-z])pops?([^a-z]|$)|(^|[^a-z])bf[_ -]/.test(b)) return 'pop';
    if (/limiter/.test(b)) return 'lim';
    if (/whine|spool|turbo/.test(b)) return 'whine';
    return null;
  }

  async add(file) {
    const data = await file.arrayBuffer();
    const buf = await new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(data, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    const role = SamplePlayer.role(file.name);
    if (role) return this.addFx(file.name, role, buf);
    const meta = SamplePlayer.parse(file.name);
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(this.out);
    src.start(0, Math.random() * buf.duration);
    const item = { name: file.name, rpm: meta.rpm, off: meta.off, dur: buf.duration, src, g };
    this.items.push(item);
    this.sort();
    return item;
  }

  addFx(name, role, buf) {
    // livello uniforme: ogni effetto normalizzato sul suo picco
    let pk = 1e-4;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 3) pk = Math.max(pk, Math.abs(d[i])); }
    const item = { name, fx: role, rpm: 0, off: false, dur: buf.duration, buf, norm: Math.min(8, 0.7 / pk), g: { gain: { value: 0 } } };
    if (role === 'whine' || role === 'hiss' || role === 'lim') {
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(g).connect(this.fxOut); src.start(0, Math.random() * buf.duration);
      item.src = src; item.g = g;
    }
    this.items.push(item); this.sort();
    return item;
  }

  has(role) { return this.items.some((i) => i.fx === role && !i.mute); }

  // effetto singolo: un file a caso del suo tipo, con piccole variazioni di tono
  shot(role, I = 1, opt = {}) {
    const list = this.items.filter((i) => i.fx === role && !i.mute);
    if (!list.length || this.voices > 6) return false;
    const it = list[Math.floor(Math.random() * list.length)];
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = it.buf;
    src.playbackRate.value = (opt.rate || 1) * (0.95 + Math.random() * 0.1);
    const g = ctx.createGain(); const a = I * it.norm;
    src.connect(g).connect(this.fxOut);
    const len = opt.len ? Math.min(opt.len, it.dur) : it.dur;
    const off = opt.len && it.dur > len + 0.2 ? Math.random() * (it.dur - len - 0.1) : 0;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.006);
    if (opt.len) { g.gain.setValueAtTime(a, t + len * 0.55); g.gain.linearRampToValueAtTime(0, t + len); }
    src.start(t, off, len + 0.02);
    this.voices++; src.onended = () => { this.voices--; g.disconnect(); };
    return true;
  }

  // anelli d'effetto seguiti dalla pressione del turbo e dal limitatore
  updateFx(p, level) {
    const t = this.ctx.currentTime;
    this.fxOut.gain.setTargetAtTime(level, t, 0.05);
    const b = Math.min(1, Math.max(0, p.boost / 0.8)), sp = Math.min(1, Math.max(0, p.turbo));
    for (const it of this.items) {
      if (!it.fx || !it.src) continue;
      let w = 0, r = 1;
      if (!it.mute && p.running) {
        // come nella mod: tono del turbo da -0,29 a +0,24 ottave con la pressione
        if (it.fx === 'whine') { w = Math.pow(b, 1.3) * 0.45 * (p.thr > 0.1 ? 1 : 0.5); r = Math.pow(2, -0.293 + 0.532 * Math.max(b, sp * 0.8)); }
        else if (it.fx === 'hiss') { w = b * 0.28 * (0.5 + 0.5 * Math.min(1, p.thr * 2)); r = Math.pow(2, -0.293 + 0.293 * b); }
        else if (it.fx === 'lim') { w = p.cut === 2 ? 0.75 : 0; r = Math.max(0.6, p.rpm / 7100); }
      }
      it.g.gain.setTargetAtTime(w * it.norm, t, it.fx === 'lim' ? 0.02 : 0.06);
      it.src.playbackRate.setTargetAtTime(r, t, 0.05);
    }
  }

  sort() { this.items.sort((a, b) => a.rpm - b.rpm); }

  remove(item) {
    try { if (item.src) item.src.stop(); } catch (e) { /* già fermo */ }
    if (item.g.disconnect) item.g.disconnect();
    this.items = this.items.filter((i) => i !== item);
  }

  clear() { [...this.items].forEach((i) => this.remove(i)); }

  // pesi di dissolvenza a potenza costante tra i due campioni più vicini ai giri attuali
  static weights(list, rpm) {
    const w = new Map();
    if (!list.length) return w;
    if (rpm <= list[0].rpm) { w.set(list[0], 1); return w; }
    const last = list[list.length - 1];
    if (rpm >= last.rpm) { w.set(last, 1); return w; }
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      if (rpm <= b.rpm) {
        // dissolvenza solo nella fascia centrale: vicino al proprio regime ogni anello suona da solo
        // (due motori a giri diversi sovrapposti a lungo suonano "doppi")
        let t = (rpm - a.rpm) / Math.max(1, b.rpm - a.rpm); t = Math.min(1, Math.max(0, (t - 0.275) / 0.45));
        w.set(a, Math.cos(t * Math.PI / 2)); w.set(b, Math.sin(t * Math.PI / 2));
        return w;
      }
    }
    return w;
  }

  update(rpm, load, level) {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(rpm > 150 ? level : 0, t, 0.06);
    this.body.gain.setTargetAtTime(1 + 4 * load, t, 0.08);
    this.tone.frequency.setTargetAtTime(2600 + 7400 * load, t, 0.12);
    const live = this.items.filter((i) => !i.mute && !i.fx);
    for (const it of this.items) if (it.mute && !it.fx) it.g.gain.setTargetAtTime(0, t, 0.03);
    const on = live.filter((i) => !i.off), off = live.filter((i) => i.off);
    const wOn = SamplePlayer.weights(on.length ? on : off, rpm);
    const wOff = SamplePlayer.weights(off.length ? off : on, rpm);
    const kOn = on.length && off.length ? Math.sqrt(load) : 1, kOff = on.length && off.length ? Math.sqrt(1 - load) : 0;
    for (const it of live) {
      let w = 0;
      if (on.length) w += (wOn.get(it) || 0) * kOn;
      else w += (wOn.get(it) || 0);
      if (on.length && off.length) w += (wOff.get(it) || 0) * kOff;
      it.g.gain.setTargetAtTime(w, t, 0.03);
      it.src.playbackRate.setTargetAtTime(Math.min(4, Math.max(0.2, Math.max(rpm, 200) / it.rpm)), t, 0.015);
    }
  }
}
