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
    this.out.connect(dest);
    this.items = [];
  }

  // regime e tipo dal nome del file
  static parse(name) {
    const base = name.replace(/\.[a-z0-9]+$/i, '');
    const nums = (base.match(/\d{3,5}/g) || []).map(Number).filter((n) => n >= 400 && n <= 12000);
    const rpm = nums.length ? nums[nums.length - 1] : 3000;
    const off = /(^|[^a-z])(off|dec|decel|coast|neg|rilascio|overrun)/i.test(base);
    return { rpm, off };
  }

  async add(file) {
    const data = await file.arrayBuffer();
    const buf = await new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(data, res, rej);
      if (p && p.then) p.then(res, rej);
    });
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

  sort() { this.items.sort((a, b) => a.rpm - b.rpm); }

  remove(item) {
    try { item.src.stop(); } catch (e) { /* già fermo */ }
    item.g.disconnect();
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
        const t = (rpm - a.rpm) / Math.max(1, b.rpm - a.rpm);
        w.set(a, Math.cos(t * Math.PI / 2)); w.set(b, Math.sin(t * Math.PI / 2));
        return w;
      }
    }
    return w;
  }

  update(rpm, load, level) {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(rpm > 150 ? level : 0, t, 0.06);
    const on = this.items.filter((i) => !i.off), off = this.items.filter((i) => i.off);
    const wOn = SamplePlayer.weights(on.length ? on : off, rpm);
    const wOff = SamplePlayer.weights(off.length ? off : on, rpm);
    const kOn = on.length && off.length ? Math.sqrt(load) : 1, kOff = on.length && off.length ? Math.sqrt(1 - load) : 0;
    for (const it of this.items) {
      let w = 0;
      if (on.length) w += (wOn.get(it) || 0) * kOn;
      else w += (wOn.get(it) || 0);
      if (on.length && off.length) w += (wOff.get(it) || 0) * kOff;
      it.g.gain.setTargetAtTime(w, t, 0.03);
      it.src.playbackRate.setTargetAtTime(Math.min(4, Math.max(0.2, Math.max(rpm, 200) / it.rpm)), t, 0.015);
    }
  }
}
