// LT DECK: il piatto scratch del Mattone Groovebox dentro la LucaTekno_Machine.
// Il DSP gira nell'AudioWorklet (thread audio); se il browser non lo permette, in uno ScriptProcessor.
// Il disco segue la mano: posizione = dove lo porta il dito, velocità della testina = velocità del suono.
// Le tecniche automatiche (baby, chirp, flare, tear, transformer, scribble) sono a tempo col sequencer.

import { finish } from './mattone';

/** 33⅓ giri: serve solo a far girare il disco disegnato alla velocità giusta */
export const SEC_PER_REV = 1.8;
/** vicino al perno: trascinare per tutta la larghezza = 0,9 s di audio */
export const SCRATCH_SEC = 0.9;

export type AutoScratch = '' | 'baby' | 'chirp' | 'flare' | 'tear' | 'trans' | 'scribble';

export const AUTO_SCRATCH: { id: AutoScratch; label: string }[] = [
  { id: '', label: 'MANO' },
  { id: 'baby', label: 'BABY' },
  { id: 'chirp', label: 'CHIRP' },
  { id: 'flare', label: 'FLARE' },
  { id: 'tear', label: 'TEAR' },
  { id: 'trans', label: 'TRANS' },
  { id: 'scribble', label: 'SCRIBBLE' },
];

// Sorgente JavaScript del nucleo DSP: una stringa, così lo stesso codice gira identico
// nel worklet, nello ScriptProcessor di riserva e nei test.
export const DECK_CORE_SRC = `
class DeckCore {
  constructor(sr) {
    this.sr = sr; this.buf = null; this.L = 0; this.bsr = sr; this.pos = 0; this.target = 0; this.touch = false;
    this.motor = false; this.rate = 0; this.auto = ''; this.anchor = 0; this.origin = 0; this.six = 0.09;
    this.xf = 1; this.cut = false; this.pitch = 0; this.g = 0; this.amp = 0; this.prev = 0;
    this.dirt = 0.25; this.held = 0; this.hc = 0; this.lp = 0; this.hpX = 0;
  }
  msg(m) {
    if (m.buf) { this.buf = m.buf; this.L = m.buf.length; this.bsr = m.sr; this.pos = this.target = this.anchor = this.prev = 0; this.rate = 0; }
    if (m.set) Object.assign(this, m.set);
    if (m.touch === true) { this.touch = true; this.auto = ''; this.target = this.pos; }
    if (m.move) this.target += m.move * this.bsr;
    if (m.touch === false) { this.touch = false; this.rate = m.rate || 0; }
    if (m.auto !== undefined) { this.auto = m.auto; this.anchor = this.pos; this.origin = m.origin; }
  }
  // movimento della mano e del crossfader per le tecniche automatiche; u = tempo in sedicesimi
  pattern(u) {
    const A = 0.26 * this.bsr, a = this.auto;
    const stroke = (period) => { const m = ((u % period) + period) % period / period * 2; const fwd = m < 1; const k = fwd ? m : m - 1; return { y: 0.5 - 0.5 * Math.cos(Math.PI * (fwd ? k : 1 - k)), k, fwd }; };
    if (a === 'baby') { const s = stroke(2); return [this.anchor + A * s.y, 1]; }
    if (a === 'chirp') { const s = stroke(2); return [this.anchor + A * s.y, s.k < 0.62 ? 1 : 0]; }
    if (a === 'flare') { const s = stroke(2); return [this.anchor + A * s.y, s.k > 0.42 && s.k < 0.58 ? 0 : 1]; }
    if (a === 'trans') { const s = stroke(4); return [this.anchor + A * 1.2 * s.y, (Math.floor(u * 4) & 1) === 0 ? 1 : 0]; }
    if (a === 'tear') { const s = stroke(3); const y = s.fwd ? s.y : (s.k < 0.5 ? 1 - 0.5 * (0.5 - 0.5 * Math.cos(Math.PI * s.k * 2)) : 0.5 - 0.5 * (0.5 - 0.5 * Math.cos(Math.PI * (s.k - 0.5) * 2))); return [this.anchor + A * y, 1]; }
    if (a === 'scribble') { const s = stroke(0.25); return [this.anchor + A * 0.12 * s.y + (((u % 8) + 8) % 8) * 0.004 * this.bsr, 1]; }
    return [this.anchor, 1];
  }
  render(out, n, t0) {
    if (!this.buf) { out.fill(0); return; }
    const buf = this.buf, L = this.L, sr = this.sr, step = this.bsr / sr, mstep = step * (1 + this.pitch / 100);
    const goal = this.motor ? 1 : 0, kUp = 1 / (0.09 * sr), kDn = 1 / (0.45 * sr);
    const follow = 1 - Math.exp(-1 / (0.0035 * sr));
    const open = this.cut ? (this.xf > 0.5 ? 0 : 1) : this.xf;
    const hold = 1 + Math.floor(this.dirt * 3), q = Math.pow(2, 15 - this.dirt * 8), lpk = 0.85 - this.dirt * 0.45;
    const hpk = 1 - Math.exp(-2 * Math.PI * 35 / sr);
    let p = this.pos, g = this.g, amp = this.amp, prev = this.prev, held = this.held, hc = this.hc, lp = this.lp, hx = this.hpX;
    for (let i = 0; i < n; i++) {
      let gate = 1;
      if (this.auto && !this.touch) { const r = this.pattern((t0 + i / sr - this.origin) / this.six); p = r[0]; gate = r[1]; }
      else if (this.touch) p += (this.target - p) * follow;          // il disco segue la mano
      else { this.rate += (goal - this.rate) * (goal > this.rate ? kUp : kDn) * (Math.abs(goal - this.rate) > 0.02 ? 1 : 3); p += this.rate * mstep; }
      // una testina magnetica dà una tensione proporzionale alla velocità: lento = piano e cupo, veloce = forte
      const sp = Math.abs(p - prev) / step; prev = p;
      const ta = Math.min(1.7, sp);
      amp += (ta - amp) * 0.035;
      g += (open * gate - g) * 0.12;
      // interpolazione di Hermite a 4 punti: anche gli scratch veloci restano puliti
      const x = ((p % L) + L) % L, i1 = x | 0, f = x - i1;
      const y0 = buf[(i1 - 1 + L) % L], y1 = buf[i1], y2 = buf[(i1 + 1) % L], y3 = buf[(i1 + 2) % L];
      const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
      let s = ((c3 * f + c2) * f + c1) * f + y1;
      s += (Math.random() * 2 - 1) * 0.012 * Math.min(1, sp);       // fruscio della puntina solo in movimento
      if (++hc >= hold) { hc = 0; held = Math.round(s * q) / q; }
      lp += (held - lp) * lpk;
      hx += (lp - hx) * hpk;                                            // via il rombo sotto i 35 Hz
      out[i] = (lp - hx) * g * amp;
    }
    if (Math.abs(p) > L * 8) { const off = Math.floor(p / L) * L; p -= off; prev -= off; this.target -= off; this.anchor -= off; }
    this.pos = p; this.prev = prev; this.g = g; this.amp = amp; this.held = held; this.hc = hc; this.lp = lp; this.hpX = hx;
  }
}`;

const WORKLET_SRC = DECK_CORE_SRC + `
class LtDeck extends AudioWorkletProcessor {
  constructor() { super(); this.c = new DeckCore(sampleRate); this.k = 0; this.port.onmessage = (e) => this.c.msg(e.data); }
  process(_i, o) { const out = o[0][0]; this.c.render(out, out.length, currentTime); if ((++this.k & 3) === 0) this.port.postMessage(this.c.pos); return true; }
}
registerProcessor('lt-deck', LtDeck);`;

export interface DeckCoreLike {
  pos: number;
  msg(m: Record<string, unknown>): void;
  render(out: Float32Array, n: number, t0: number): void;
}

/** Costruttore del nucleo DSP sul thread principale (riserva e test) */
export function makeDeckCore(sr: number): DeckCoreLike {
  const Ctor = new Function(DECK_CORE_SRC + '\nreturn DeckCore;')();
  return new Ctor(sr);
}

function satCurve(amount: number) {
  const n = 1024, c = new Float32Array(n), k = 1 + amount * 6;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}

export function toMono(buf: AudioBuffer): Float32Array {
  const n = buf.length, out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

/** Il piatto: catena del colore (sporco → cupo/chiaro → corpo) e comunicazione col DSP */
export class Deck {
  readonly ctx: AudioContext;
  /** posizione del disco in campioni (aggiornata dal thread audio) */
  pos = 0;
  /** frequenza di campionamento del disco caricato */
  sr = 44100;
  loaded = false;
  private send: (m: Record<string, unknown>, transfer?: Transferable[]) => void = () => {};
  private pending: Record<string, unknown>[] = [];
  private drive: WaveShaperNode;
  private tone: BiquadFilterNode;
  private level: GainNode;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.drive = ctx.createWaveShaper();
    this.drive.oversample = '2x';
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.Q.value = 1.1;
    const body = ctx.createBiquadFilter();
    body.type = 'lowshelf';
    body.frequency.value = 160;
    body.gain.value = 7;
    this.level = ctx.createGain();
    this.level.gain.value = 0.55;
    this.drive.connect(this.tone).connect(body).connect(this.level).connect(out);
    // finché il DSP non è pronto i messaggi restano in coda
    this.send = (m) => { this.pending.push(m); };
  }

  async init() {
    const ready = (fn: (m: Record<string, unknown>, transfer?: Transferable[]) => void) => {
      this.send = fn;
      for (const m of this.pending) fn(m);
      this.pending = [];
    };
    try {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(this.ctx, 'lt-deck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (e) => { this.pos = e.data; };
      node.connect(this.drive);
      ready((m, transfer) => node.port.postMessage(m, transfer ?? []));
    } catch (e) {
      console.warn('Piatto: AudioWorklet non disponibile, uso ScriptProcessor', e);
      const core = makeDeckCore(this.ctx.sampleRate);
      const sp = this.ctx.createScriptProcessor(256, 1, 1);
      sp.onaudioprocess = (ev) => {
        const out = ev.outputBuffer.getChannelData(0);
        core.render(out, out.length, ev.playbackTime || this.ctx.currentTime);
        this.pos = core.pos;
      };
      sp.connect(this.drive);
      ready((m) => core.msg(m));
    }
  }

  /** Mette un suono sul disco (normalizzato, mono) */
  load(buf: AudioBuffer | { data: Float32Array; sr: number }) {
    const mono = buf instanceof AudioBuffer ? toMono(buf) : new Float32Array(buf.data);
    const sr = buf instanceof AudioBuffer ? buf.sampleRate : buf.sr;
    let peak = 0;
    for (let i = 0; i < mono.length; i++) peak = Math.max(peak, Math.abs(mono[i]));
    if (peak > 0) for (let i = 0; i < mono.length; i++) mono[i] *= 0.95 / peak;
    this.sr = sr;
    this.pos = 0;
    this.loaded = true;
    this.send({ buf: mono, sr }, [mono.buffer]);
  }

  set(values: Record<string, number | boolean>) { this.send({ set: values }); }
  touch() { this.send({ touch: true }); }
  move(sec: number) { this.send({ move: sec }); }
  release(rate: number) { this.send({ touch: false, rate }); }
  auto(mode: AutoScratch, origin: number, six: number) { this.send({ auto: mode, origin, set: { six } }); }

  /** Colore dello scratch: tone 0..1 (cupo → chiaro), dirt 0..1 (pulito → 12 bit) */
  color(tone: number, dirt: number) {
    const now = this.ctx.currentTime;
    this.tone.frequency.setTargetAtTime(380 * Math.pow(2, tone * 4.4), now, 0.03);
    this.drive.curve = satCurve(0.35 + dirt * 1.2);
    this.set({ dirt });
  }

  setLevel(v: number) { this.level.gain.setTargetAtTime(0.75 * v * v, this.ctx.currentTime, 0.02); }

  /** angolo del disco disegnato (radianti) */
  angle() { return ((this.pos / this.sr) / SEC_PER_REV) * Math.PI * 2; }
}

/** Frase da scratch del Mattone: "aaah" · orchestra hit · "yeah" · "hey" · "uuoh" in fila, con pause */
export function buildPhrase(ctx: BaseAudioContext, parts: AudioBuffer[]): AudioBuffer {
  const lens = [0.75, 0.45, 0.62, 0.5, 0.7];
  const SR = ctx.sampleRate;
  const gap = Math.floor(SR * 0.12);
  const out = new Float32Array(Math.ceil(SR * (lens.reduce((a, b) => a + b, 0) + 1)) + gap * 4);
  let o = 0;
  parts.forEach((b, i) => {
    const m = toMono(b), ratio = b.sampleRate / SR;
    const n = Math.min(m.length, Math.floor((lens[i] ?? 0.6) * b.sampleRate));
    let pk = 0;
    for (let k = 0; k < n; k++) pk = Math.max(pk, Math.abs(m[k]));
    const outN = Math.floor(n / ratio), norm = pk > 0 ? 0.95 / pk : 1;
    for (let k = 0; k < outN && o + k < out.length; k++) {
      const fade = Math.min(1, (outN - k) / (SR * 0.02));
      out[o + k] = m[Math.floor(k * ratio)] * fade * norm;
    }
    o += outN + gap;
  });
  const buf = ctx.createBuffer(1, Math.max(1, o), SR);
  buf.copyToChannel(out.subarray(0, Math.max(1, o)), 0);
  return finish(buf, 0.95);
}
