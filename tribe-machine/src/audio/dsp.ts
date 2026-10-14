// Utility DSP condivise: curve di saturazione, buffer di rumore, IR del riverbero,
// processore AudioWorklet per il bitcrusher.

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const curveCache = new Map<string, Float32Array<ArrayBuffer>>();

/** Curva tanh normalizzata: drive 0 = quasi lineare, 1 = distorsione pesante */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const q = Math.round(amount * 50) / 50;
  const key = 'd' + q;
  let c = curveCache.get(key);
  if (!c) {
    const n = 2048;
    c = new Float32Array(n);
    const k = 1 + q * 28;
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / norm;
    }
    curveCache.set(key, c);
  }
  return c;
}

/** Clip asimmetrico "industriale" per i kick */
export function hardCurve(amount: number): Float32Array<ArrayBuffer> {
  const q = Math.round(amount * 20) / 20;
  const key = 'h' + q;
  let c = curveCache.get(key);
  if (!c) {
    const n = 2048;
    c = new Float32Array(n);
    const k = 1 + q * 12;
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * k;
      // lato positivo più duro, negativo più morbido: armoniche pari, suono "sporco"
      const y = x >= 0 ? Math.min(1, x) * 0.9 + Math.tanh(x) * 0.1 : Math.tanh(x * 0.8);
      c[i] = y;
    }
    curveCache.set(key, c);
  }
  return c;
}

/** Soft clipper master: lineare fino a 0.85, poi saturazione morbida verso 0.98 */
export function masterClipCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const c = new Float32Array(n);
  const knee = 0.85;
  const ceil = 0.98;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < d.length; i++) {
      // PRNG deterministico: render offline riproducibili
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

/** Risposta all'impulso sintetica: rumore stereo con decadimento esponenziale e smorzamento acuti */
export function reverbIR(ctx: BaseAudioContext, size: number): AudioBuffer {
  const seconds = 0.35 + size * 3.6;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 9876;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      const t = i / len;
      // il filtro si chiude col tempo: coda più scura, tipo stanza di cemento
      const damp = 0.15 + 0.8 * t;
      lp = lp + (white - lp) * (1 - damp);
      const env = Math.pow(1 - t, 2.2) * Math.exp(-t * 3);
      const early = i < ctx.sampleRate * 0.012 ? 0 : 1; // pre-delay 12 ms
      d[i] = lp * env * early;
    }
  }
  return buf;
}

export const CRUSHER_WORKLET = `
class TMCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 16, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'hold', defaultValue: 1, minValue: 1, maxValue: 64, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() { super(); this.cnt = 0; this.h = [0, 0]; }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0];
    const mix = params.mix[0];
    if (!inp || inp.length === 0) return true;
    if (mix <= 0.0001) {
      for (let c = 0; c < out.length; c++) out[c].set(inp[c] || inp[0]);
      return true;
    }
    const steps = Math.pow(2, params.bits[0]) / 2;
    const hold = Math.max(1, Math.round(params.hold[0]));
    const n = out[0].length;
    for (let i = 0; i < n; i++) {
      if (this.cnt <= 0) {
        for (let c = 0; c < out.length; c++) {
          const x = (inp[c] || inp[0])[i];
          this.h[c] = Math.round(x * steps) / steps;
        }
        this.cnt = hold;
      }
      this.cnt--;
      for (let c = 0; c < out.length; c++) {
        const x = (inp[c] || inp[0])[i];
        out[c][i] = x * (1 - mix) + this.h[c] * mix;
      }
    }
    return true;
  }
}
registerProcessor('tm-crusher', TMCrusher);
`;
