// Synth monofonico persistente per BASS e ACID.
// Gli oscillatori girano sempre: le note sono solo automazioni di frequenza
// e inviluppi. Questo rende slide/legato veri e senza click.
//
// Il cutoff impostato dalle manopole va su filter.frequency, mentre inviluppo
// e LFO agiscono su filter.detune (in cents): così muovere il CUTOFF durante
// la riproduzione non interferisce con le automazioni già programmate.

import { midiToHz } from './dsp';
import { LFO_BEATS } from '../state/params';

const BASS_ROOT = 29; // F1
const ACID_ROOT = 41; // F2
const OSC_TYPES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];

export interface NoteOpts {
  time: number;
  note: number; // semitoni relativi alla tonica
  vel: number;
  accent: boolean;
  /** legato: niente retrigger degli inviluppi, glide verso la nuova nota */
  legato: boolean;
}

export class MonoSynth {
  readonly kind: 'bass' | 'acid';
  private ctx: BaseAudioContext;
  private osc: OscillatorNode;
  private sub: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  private filters: BiquadFilterNode[];
  private vca: GainNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private params: Record<string, number> = {};

  constructor(ctx: BaseAudioContext, kind: 'bass' | 'acid', out: AudioNode) {
    this.ctx = ctx;
    this.kind = kind;
    this.osc = ctx.createOscillator();
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    this.osc.connect(mix);
    if (kind === 'bass') {
      this.sub = ctx.createOscillator();
      this.sub.type = 'sine';
      this.subGain = ctx.createGain();
      this.sub.connect(this.subGain).connect(mix);
    }
    // ACID: due biquad in cascata = 24 dB/ottava, la risonanza solo sul secondo
    this.filters = kind === 'acid'
      ? [ctx.createBiquadFilter(), ctx.createBiquadFilter()]
      : [ctx.createBiquadFilter()];
    let node: AudioNode = mix;
    for (const f of this.filters) {
      f.type = 'lowpass';
      node.connect(f);
      node = f;
    }
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    // trim d'uscita: allinea il livello dei synth a quello delle percussioni
    const trim = ctx.createGain();
    trim.gain.value = kind === 'acid' ? 3.2 : 2;
    node.connect(this.vca).connect(trim).connect(out);

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    for (const f of this.filters) this.lfoGain.connect(f.detune);

    const t = ctx.currentTime;
    this.osc.start(t);
    this.sub?.start(t);
    this.lfo.start(t);
  }

  private get root() {
    return this.kind === 'bass' ? BASS_ROOT : ACID_ROOT;
  }

  /** Applica i parametri delle manopole (chiamato ad ogni modifica) */
  setParams(p: Record<string, number>, bpm: number) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.params = { ...p };
    const wave = this.kind === 'acid' ? (p.wave >= 1 ? 'square' : 'sawtooth') : OSC_TYPES[Math.round(p.wave)] ?? 'sawtooth';
    if (this.osc.type !== wave) this.osc.type = wave;
    if (this.subGain) this.subGain.gain.setTargetAtTime(p.sub * 0.9, now, 0.01);

    const last = this.filters[this.filters.length - 1];
    if (this.kind === 'bass') {
      const ft: BiquadFilterType = p.ftype >= 1 ? 'highpass' : 'lowpass';
      if (last.type !== ft) last.type = ft;
      last.Q.setTargetAtTime(p.reso, now, 0.01);
    } else {
      this.filters[0].Q.setTargetAtTime(-3, now, 0.01);
      last.Q.setTargetAtTime(p.reso, now, 0.01);
    }
    for (const f of this.filters) f.frequency.setTargetAtTime(p.cutoff, now, 0.008);

    const beats = LFO_BEATS[Math.round(p.lfoRate)] ?? 4;
    this.lfo.frequency.setTargetAtTime(bpm / 60 / beats, now, 0.02);
    this.lfoGain.gain.setTargetAtTime(p.lfoAmt * 2400, now, 0.02);
  }

  private freq(note: number) {
    return midiToHz(this.root + (this.params.tune ?? 0) + note);
  }

  noteOn(o: NoteOpts) {
    const P = this.params;
    const t = Math.max(o.time, this.ctx.currentTime);
    const f = this.freq(o.note);
    const fp = this.osc.frequency;
    fp.cancelScheduledValues(t);
    if (o.legato) {
      fp.setTargetAtTime(f, t, (P.glide / 1000) / 3);
      this.sub?.frequency.cancelScheduledValues(t);
      this.sub?.frequency.setTargetAtTime(f / 2, t, (P.glide / 1000) / 3);
      return;
    }
    fp.setValueAtTime(f, t);
    if (this.sub) {
      this.sub.frequency.cancelScheduledValues(t);
      this.sub.frequency.setValueAtTime(f / 2, t);
    }

    const decay = P.decay / 1000;
    const g = this.vca.gain;
    g.cancelScheduledValues(t);
    if (this.kind === 'acid') {
      const accAmt = o.accent ? P.accent : 0;
      // compensazione: con risonanza alta il filtro guadagna parecchio
      const comp = 1 - (P.reso / 26) * 0.45;
      const peak = (0.55 + 0.45 * accAmt) * comp * o.vel;
      // micro-rampa di 3 ms dal valore corrente: niente click al retrigger
      g.setTargetAtTime(peak, t, 0.001);
      g.setTargetAtTime(peak * 0.75, t + 0.004, 0.4);
      const envCents = (P.egint * 4200 + accAmt * 2400);
      const fdec = o.accent ? Math.min(decay, 0.2) : decay;
      for (const f of this.filters) {
        f.detune.cancelScheduledValues(t);
        f.detune.setTargetAtTime(envCents, t, 0.0015);
        f.detune.setTargetAtTime(0, t + 0.006, fdec / 3);
      }
    } else {
      const att = Math.max(0.001, P.attack / 1000);
      g.setTargetAtTime(o.vel * 0.95, t, att / 2.5);
      g.setTargetAtTime(o.vel * 0.55, t + att, decay / 2);
      const envCents = P.egint * 5400 * (o.accent ? 1.3 : 1);
      for (const f of this.filters) {
        f.detune.cancelScheduledValues(t);
        f.detune.setTargetAtTime(envCents, t, 0.002);
        f.detune.setTargetAtTime(0, t + 0.008, decay / 3);
      }
    }
  }

  noteOff(time: number) {
    const t = Math.max(time, this.ctx.currentTime);
    const g = this.vca.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, this.kind === 'acid' ? 0.004 : 0.012);
  }

  /** Silenzio immediato (stop / cambio tipo di parte) */
  kill() {
    const now = this.ctx.currentTime;
    this.vca.gain.cancelScheduledValues(now);
    this.vca.gain.setTargetAtTime(0, now, 0.005);
  }

  dispose() {
    this.kill();
    const stopAt = this.ctx.currentTime + 0.1;
    this.osc.stop(stopAt);
    this.sub?.stop(stopAt);
    this.lfo.stop(stopAt);
    this.osc.onended = () => {
      try { this.vca.disconnect(); } catch { /* ok */ }
    };
  }
}
