// Voci percussive generate in tempo reale (nessun campione).
// Ogni colpo crea un piccolo grafo di nodi che si autodistrugge a fine coda.
// Il nodo "choke" finale permette di strozzare la voce precedente senza click.

import { hardCurve, noiseBuffer } from './dsp';
import type { PartType } from '../state/types';

export interface Voice {
  choke: GainNode;
  sources: AudioScheduledSourceNode[];
  end: number;
}

export interface Hit {
  time: number;
  vel: number; // 0..1
  /** trasposizione in semitoni (note dello step / tastiera live) */
  pitch: number;
  params: Record<string, number>;
  /** campione (solo parti SAMPLE) */
  buffer?: AudioBuffer | null;
}

const st = (n: number) => Math.pow(2, n / 12);

function finish(ctx: BaseAudioContext, out: AudioNode, choke: GainNode, sources: AudioScheduledSourceNode[], end: number): Voice {
  choke.connect(out);
  for (const s of sources) s.stop(end);
  const last = sources[0];
  last.onended = () => {
    // scollega tutto il sottografo appena l'ultima sorgente termina
    try { choke.disconnect(); } catch { /* già scollegato */ }
  };
  void ctx;
  return { choke, sources, end };
}

function noiseSrc(ctx: BaseAudioContext, t: number): AudioBufferSourceNode {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  n.loop = true;
  // offset pseudo-casuale per non ripetere sempre lo stesso grano
  n.start(t, ((t * 7.31) % 1.5));
  return n;
}

function kick(ctx: BaseAudioContext, out: AudioNode, h: Hit): Voice {
  const P = h.params;
  const t = h.time;
  const choke = ctx.createGain();
  const decay = P.decay / 1000;
  const end = t + decay * 1.6 + 0.03;

  const f0 = P.tune * st(h.pitch);
  const osc = ctx.createOscillator();
  osc.type = P.wave >= 1 ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(Math.min(f0 * st(P.pamt), 12000), t);
  osc.frequency.setTargetAtTime(f0, t, P.pdec / 1000 / 2.5);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(h.vel, t + 0.0015);
  amp.gain.setTargetAtTime(0, t + 0.0015 + decay * 0.12, decay / 5);

  osc.connect(amp);
  let node: AudioNode = amp;
  if (P.shape > 0.01) {
    const ws = ctx.createWaveShaper();
    ws.curve = hardCurve(P.shape);
    ws.oversample = '2x';
    amp.connect(ws);
    node = ws;
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = P.tone;
  lp.Q.value = 0.5;
  node.connect(lp);
  lp.connect(choke);

  const sources: AudioScheduledSourceNode[] = [osc];
  osc.start(t);
  if (P.attack > 0.01) {
    // transiente: rumore filtrato cortissimo
    const n = noiseSrc(ctx, t);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3500;
    hp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(P.attack * h.vel * 0.9, t);
    g.gain.setTargetAtTime(0, t + 0.001, 0.004);
    n.connect(hp).connect(g).connect(choke);
    sources.push(n);
  }
  return finish(ctx, out, choke, sources, end);
}

function snare(ctx: BaseAudioContext, out: AudioNode, h: Hit): Voice {
  const P = h.params;
  const t = h.time;
  const choke = ctx.createGain();
  const decay = P.decay / 1000;
  const end = t + decay * 1.8 + 0.03;
  const f = P.tune * st(h.pitch);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(f * st(P.pamt), t);
  body.frequency.setTargetAtTime(f, t, 0.015);
  const body2 = ctx.createOscillator();
  body2.type = 'sine';
  body2.frequency.setValueAtTime(f * 1.72 * st(P.pamt), t);
  body2.frequency.setTargetAtTime(f * 1.72, t, 0.015);
  const bg = ctx.createGain();
  const bodyLvl = 1.25 * h.vel * (1 - P.snap * 0.55);
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(bodyLvl, t + 0.001);
  bg.gain.setTargetAtTime(0, t + 0.002, decay / 6);
  body.connect(bg);
  body2.connect(bg);
  bg.connect(choke);

  const n = noiseSrc(ctx, t);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = P.tone;
  lp.Q.value = P.reso;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(1.25 * h.vel * (0.25 + P.snap * 0.75), t + 0.001);
  ng.gain.setTargetAtTime(0, t + 0.004, decay / 4);
  n.connect(hp).connect(lp).connect(ng).connect(choke);

  body.start(t);
  body2.start(t);
  return finish(ctx, out, choke, [body, body2, n], end);
}

function clap(ctx: BaseAudioContext, out: AudioNode, h: Hit): Voice {
  const P = h.params;
  const t = h.time;
  const choke = ctx.createGain();
  const decay = P.decay / 1000;
  const gap = 0.005 + P.spread * 0.016;
  const end = t + gap * 3 + decay * 1.8 + 0.03;

  const n = noiseSrc(ctx, t);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = P.tone * st(h.pitch);
  bp.Q.value = P.reso;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;
  const g = ctx.createGain();
  const v = h.vel * 4.5;
  g.gain.setValueAtTime(0, t);
  for (let i = 0; i < 3; i++) {
    const ti = t + i * gap;
    g.gain.setValueAtTime(v, ti);
    g.gain.setTargetAtTime(v * 0.08, ti + 0.0005, 0.0025);
  }
  const tail = t + 3 * gap;
  g.gain.setValueAtTime(v * 0.9, tail);
  g.gain.setTargetAtTime(0, tail + 0.001, decay / 4.5);
  n.connect(bp).connect(hp).connect(g).connect(choke);
  return finish(ctx, out, choke, [n], end);
}

const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];

function hat(ctx: BaseAudioContext, out: AudioNode, h: Hit): Voice {
  const P = h.params;
  const t = h.time;
  const choke = ctx.createGain();
  const decay = P.decay / 1000;
  const end = t + decay * 1.8 + 0.02;
  const k = st(P.tune + h.pitch) * 1.6;

  const mix = ctx.createGain();
  const sources: AudioScheduledSourceNode[] = [];
  if (P.color > 0.02) {
    const mg = ctx.createGain();
    mg.gain.value = P.color * 0.55;
    for (const f of HAT_FREQS) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * k;
      o.connect(mg);
      o.start(t);
      sources.push(o);
    }
    mg.connect(mix);
  }
  const n = noiseSrc(ctx, t);
  const ng = ctx.createGain();
  ng.gain.value = (1 - P.color) * 0.9 + 0.1;
  n.connect(ng).connect(mix);
  sources.push(n);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(16000, P.tone * 1.35);
  bp.Q.value = 0.6;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = P.tone;
  hp.Q.value = P.reso;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(h.vel * 3.2, t + 0.0008);
  amp.gain.setTargetAtTime(0, t + 0.001, decay / 3.5);
  mix.connect(bp).connect(hp).connect(amp).connect(choke);
  return finish(ctx, out, choke, sources, end);
}

const RATIOS = [0.5, 1, 1.41, 2, 2.76, 3.5, 5.19, 7.1];

function perc(ctx: BaseAudioContext, out: AudioNode, h: Hit): Voice {
  const P = h.params;
  const t = h.time;
  const choke = ctx.createGain();
  const decay = P.decay / 1000;
  const end = t + decay * 1.8 + 0.03;
  const f = P.tune * st(h.pitch);
  const r = RATIOS[Math.round(P.ratio)] ?? 1.41;
  const ptau = P.pdec / 1000 / 2.5;

  const car = ctx.createOscillator();
  car.type = 'sine';
  car.frequency.setValueAtTime(f * st(P.pamt), t);
  car.frequency.setTargetAtTime(f, t, ptau);
  const sources: AudioScheduledSourceNode[] = [car];

  if (P.fm > 0.01) {
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(f * r * st(P.pamt), t);
    mod.frequency.setTargetAtTime(f * r, t, ptau);
    const mg = ctx.createGain();
    const idx = P.fm * P.fm * f * r * 6;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.setTargetAtTime(0, t, decay / 5);
    mod.connect(mg).connect(car.frequency);
    mod.start(t);
    sources.push(mod);
  }
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(h.vel * 1.4, t + 0.001);
  amp.gain.setTargetAtTime(0, t + 0.002, decay / 5);
  car.connect(amp).connect(choke);
  car.start(t);

  if (P.noise > 0.01) {
    const n = noiseSrc(ctx, t);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(12000, f * 5);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(P.noise * h.vel, t);
    g.gain.setTargetAtTime(0, t + 0.001, 0.012 + decay * 0.05);
    n.connect(bp).connect(g).connect(choke);
    sources.push(n);
  }
  return finish(ctx, out, choke, sources, end);
}

const reversed = new WeakMap<AudioBuffer, AudioBuffer>();
function reversedOf(b: AudioBuffer): AudioBuffer {
  let r = reversed.get(b);
  if (!r) {
    r = new AudioBuffer({ length: b.length, numberOfChannels: b.numberOfChannels, sampleRate: b.sampleRate });
    for (let c = 0; c < b.numberOfChannels; c++) {
      const src = b.getChannelData(c);
      const dst = r.getChannelData(c);
      for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
    }
    reversed.set(b, r);
  }
  return r;
}

function sample(ctx: BaseAudioContext, out: AudioNode, h: Hit): Voice | null {
  if (!h.buffer) return null;
  const P = h.params;
  const t = h.time;
  const buf = P.reverse >= 1 ? reversedOf(h.buffer) : h.buffer;
  const rate = st(P.tune + h.pitch);
  const offset = P.start * buf.duration;
  const playable = (buf.duration - offset) / rate;
  const decay = P.decay / 1000;
  const len = Math.min(playable, decay);
  const end = t + len + 0.02;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = P.tone;
  lp.Q.value = P.reso;
  const amp = ctx.createGain();
  // micro-fade in/out: nessun click anche con start nel mezzo di una forma d'onda
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(h.vel * 1.2, t + 0.002);
  if (len < playable) {
    amp.gain.setValueAtTime(h.vel * 1.2, t + len * 0.75);
    amp.gain.linearRampToValueAtTime(0, t + len);
  } else {
    amp.gain.setValueAtTime(h.vel * 1.2, Math.max(t + 0.003, t + len - 0.01));
    amp.gain.linearRampToValueAtTime(0, t + len);
  }
  const choke = ctx.createGain();
  src.connect(lp).connect(amp).connect(choke);
  src.start(t, offset);
  return finish(ctx, out, choke, [src], end);
}

export function playDrum(ctx: BaseAudioContext, type: PartType, out: AudioNode, h: Hit): Voice | null {
  switch (type) {
    case 'kick': return kick(ctx, out, h);
    case 'snare': return snare(ctx, out, h);
    case 'clap': return clap(ctx, out, h);
    case 'hat':
    case 'ohat': return hat(ctx, out, h);
    case 'perc': return perc(ctx, out, h);
    case 'sample': return sample(ctx, out, h);
    default: return null;
  }
}

/** Strozza una voce: rampa di 4 ms e stop, niente click */
export function chokeVoice(v: Voice, t: number) {
  if (t >= v.end) return;
  const g = v.choke.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(1, t);
  g.setTargetAtTime(0, t, 0.004);
  const stopAt = t + 0.03;
  for (const s of v.sources) {
    try { s.stop(stopAt); } catch { /* già fermata */ }
  }
  v.end = stopAt;
}
