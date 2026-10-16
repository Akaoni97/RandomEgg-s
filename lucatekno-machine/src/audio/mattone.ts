// Suoni sintetizzati del MATTONE GROOVEBOX, portati nella LucaTekno_Machine.
// Ogni generatore produce un AudioBuffer calcolato campione per campione (niente file):
// effetti tekno (salite, zap, laser, caduta), voci formantiche da scratch, accordi, synth.

let SR = 44100;
let ctx: BaseAudioContext;

class BQ {
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private b0 = 0; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  constructor(private type: 'lp' | 'hp' | 'bp', f: number, q: number) { this.set(f, q); }
  set(f: number, q: number) {
    f = Math.min(Math.max(f, 20), SR * 0.45);
    const w = (2 * Math.PI * f) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0: number, b1: number, b2: number;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  p(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const rnd = () => Math.random() * 2 - 1;
const TAU = Math.PI * 2;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const sq = (ph: number) => (Math.sin(ph) >= 0 ? 1 : -1);

/** Normalizza al picco indicato e chiude con una dissolvenza di 6 ms (niente click) */
export function finish(b: AudioBuffer, peak = 0.9): AudioBuffer {
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c), n = d.length;
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) { const k = peak / m; for (let i = 0; i < n; i++) d[i] *= k; }
    const fade = Math.min(n, Math.floor(b.sampleRate * 0.006));
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
  }
  return b;
}

function mk(dur: number, fn: (d: Float32Array, n: number) => void, peak?: number) {
  const n = Math.max(1, Math.floor(dur * SR));
  const b = ctx.createBuffer(1, n, SR);
  fn(b.getChannelData(0), n);
  return finish(b, peak);
}

function metal(t: number, ph: number[]) {
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800];
  let s = 0;
  for (let k = 0; k < 6; k++) s += sq(TAU * fr[k] * t + ph[k]);
  return s / 6;
}
const HAT_PH = [0.3, 1.1, 2.0, 2.7, 4.1, 5.0];

const tone = (f0: number, f1: number, dur: number, rate: number) => mk(dur, (d, n) => {
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t * 12))) / SR;
    d[i] = Math.sin(ph) * Math.exp(-t * rate) + 0.08 * rnd() * Math.exp(-t * 40);
  }
});

function chord(notes: number[], dur = 1.8) {
  return mk(dur, (d, n) => {
    const fs = notes.map(mtof), det = notes.map(() => 1 + (Math.random() - 0.5) * 0.002);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (let k = 0; k < fs.length; k++) {
        const ph = TAU * fs[k] * det[k] * t;
        s += Math.sin(ph) + 0.28 * Math.sin(2 * ph) * Math.exp(-t * 6) + 0.12 * Math.sin(3 * ph) * Math.exp(-t * 10);
      }
      d[i] = (s / fs.length) * Math.min(1, t / 0.006) * Math.exp(-t * 1.8) * (1 + 0.04 * Math.sin(TAU * 4.5 * t));
    }
  });
}

// voce formantica: impulsi glottali attraverso quattro risonanze del tratto vocale, con respiro e intonazione umana
const VOWELS: Record<string, number[]> = {
  a: [730, 1090, 2440, 3400], e: [530, 1840, 2480, 3500], i: [300, 2250, 3000, 3600], o: [570, 840, 2410, 3300], u: [320, 870, 2240, 3300],
};
function vocal(frames: [number, string][], dur: number, f0: number, breathLead = 0.04, pitchCurve = [1.1, 1, 0.94]) {
  return mk(dur, (d, n) => {
    const bws = [90, 110, 170, 250], gains = [1, 0.62, 0.3, 0.12];
    const res = [0, 1, 2, 3].map((k) => new BQ('bp', VOWELS.a[k], VOWELS.a[k] / bws[k]));
    let ph = 0, prevG = 0, jit = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = t / dur;
      if (i % 48 === 0) {
        let j = 0;
        while (j < frames.length - 1 && frames[j + 1][0] <= u) j++;
        const A = frames[j], B = frames[Math.min(j + 1, frames.length - 1)];
        const w = B[0] > A[0] ? Math.min(1, (u - A[0]) / (B[0] - A[0])) : 0, ws = w * w * (3 - 2 * w);
        for (let k = 0; k < 4; k++) { const f = VOWELS[A[1]][k] * (1 - ws) + VOWELS[B[1]][k] * ws; res[k].set(f, f / bws[k]); }
        jit += ((Math.random() - 0.5) * 0.02 - jit) * 0.3;
      }
      const pc = u < 0.5 ? pitchCurve[0] + (pitchCurve[1] - pitchCurve[0]) * (u / 0.5) : pitchCurve[1] + (pitchCurve[2] - pitchCurve[1]) * ((u - 0.5) / 0.5);
      const vib = t > 0.15 ? 1 + 0.014 * Math.sin(TAU * 5.4 * t) : 1;
      ph += (f0 * pc * vib * (1 + jit)) / SR;
      const x = ph % 1;
      const gl = x < 0.4 ? 0.5 * (1 - Math.cos((Math.PI * x) / 0.4)) : x < 0.62 ? Math.cos((Math.PI * (x - 0.4)) / 0.44) : 0;
      const src = (gl - prevG) * 18; // derivata del flusso glottale: brillante, ronzante
      prevG = gl;
      const voiced = t < breathLead ? t / breathLead : 1;
      const breath = rnd() * (t < breathLead ? 0.9 : 0.06 + 0.12 * gl);
      const exc = src * voiced + breath;
      let y = 0;
      for (let k = 0; k < 4; k++) y += res[k].p(exc) * gains[k];
      const env = Math.min(1, t / 0.012) * (t > dur - 0.09 ? Math.max(0, (dur - t) / 0.09) : 1);
      d[i] = Math.tanh(y * 1.6) * env;
    }
  });
}

const SYNTH: Record<string, () => AudioBuffer> = {
  sy_kick: () => mk(0.6, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (45 + 115 * Math.exp(-t * 28))) / SR; const click = t < 0.004 ? rnd() * (1 - t / 0.004) * 0.4 : 0; d[i] = Math.tanh(1.7 * Math.sin(ph) * Math.exp(-t * 6.5)) + click; } }),
  sy_kick808: () => mk(1.6, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (48 + 90 * Math.exp(-t * 35))) / SR; d[i] = Math.tanh(1.3 * Math.sin(ph)) * Math.exp(-t * 2.2); } }),
  sy_snare: () => mk(0.35, (d, n) => { let ph = 0; const hp = new BQ('hp', 1400, 0.7); for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * 185 * (1 + 0.45 * Math.exp(-t * 40))) / SR; d[i] = 0.55 * Math.sin(ph) * Math.exp(-t * 24) + 0.8 * hp.p(rnd()) * Math.exp(-t * 13); } }),
  sy_clap: () => mk(0.5, (d, n) => { const bp = new BQ('bp', 1150, 0.9); for (let i = 0; i < n; i++) { const t = i / SR; let e = 0; for (let k = 0; k < 3; k++) { const s = k * 0.011; if (t >= s) e += Math.exp(-(t - s) * 170); } if (t >= 0.033) e += 0.8 * Math.exp(-(t - 0.033) * 15); d[i] = bp.p(rnd()) * e; } }),
  sy_hat: () => mk(0.12, (d, n) => { const hp = new BQ('hp', 7000, 0.8), bp = new BQ('bp', 10000, 1.2); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = bp.p(hp.p(metal(t, HAT_PH) + 0.3 * rnd())) * Math.exp(-t * 45); } }),
  sy_hat_open: () => mk(0.7, (d, n) => { const hp = new BQ('hp', 6500, 0.8), bp = new BQ('bp', 9500, 1.0); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = bp.p(hp.p(metal(t, HAT_PH) + 0.3 * rnd())) * Math.exp(-t * 5.5); } }),
  sy_tom_lo: () => tone(130, 82, 0.55, 7),
  sy_tom_hi: () => tone(210, 145, 0.5, 8),
  sy_rim: () => mk(0.08, (d, n) => { const bp = new BQ('bp', 3000, 2); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(TAU * 1700 * t) * Math.exp(-t * 90) + 0.6 * bp.p(rnd()) * Math.exp(-t * 120); } }),
  sy_cowbell: () => mk(0.4, (d, n) => { const bp = new BQ('bp', 2400, 1.6); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = bp.p(0.6 * sq(TAU * 562 * t) + 0.6 * sq(TAU * 845 * t)) * (0.7 * Math.exp(-t * 30) + 0.3 * Math.exp(-t * 9)); } }),
  sy_shaker: () => mk(0.16, (d, n) => { const hp = new BQ('hp', 5000, 0.7); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = hp.p(rnd()) * (t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) * 30)); } }),
  sy_crash: () => mk(1.8, (d, n) => { const hp = new BQ('hp', 5500, 0.7), ph = [0.9, 0.2, 3.3, 1.4, 2.2, 4.8]; for (let i = 0; i < n; i++) { const t = i / SR; d[i] = hp.p(0.6 * metal(t * 1.37, ph) + 0.7 * rnd()) * Math.exp(-t * 2.6); } }),
  sy_snap: () => mk(0.12, (d, n) => { const bp = new BQ('bp', 2600, 1.4); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = bp.p(rnd()) * (Math.exp(-t * 70) + (t > 0.008 ? 0.6 * Math.exp(-(t - 0.008) * 80) : 0)); } }),
  sy_bass: () => mk(1.2, (d, n) => { const f = mtof(36); let ph = 0; const lp = new BQ('lp', 1500, 1.3); for (let i = 0; i < n; i++) { const t = i / SR; if (i % 32 === 0) lp.set(110 + 1700 * Math.exp(-t * 9), 1.3); ph += f / SR; const c = ph % 1; d[i] = Math.tanh(1.4 * lp.p(0.5 * (2 * c - 1) + 0.65 * Math.sin(TAU * c))) * Math.min(1, t / 0.003) * Math.exp(-t * 2.2); } }),
  sy_sub: () => mk(1.5, (d, n) => { const f = mtof(36); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.tanh(1.2 * Math.sin(TAU * f * t)) * Math.min(1, t / 0.005) * Math.exp(-t * 1.4); } }),
  sy_acid: () => mk(0.9, (d, n) => { const f = mtof(36); let ph = 0; const lp = new BQ('lp', 1500, 9); for (let i = 0; i < n; i++) { const t = i / SR; if (i % 16 === 0) lp.set(180 + 2600 * Math.exp(-t * 7), 9); ph += f / SR; d[i] = Math.tanh(2.2 * lp.p(2 * (ph % 1) - 1)) * Math.min(1, t / 0.002) * Math.exp(-t * 2.8); } }),
  sy_pluck: () => mk(1.4, (d, n) => { const p = Math.round(SR / mtof(60)); const buf = new Float32Array(p).map(() => rnd()); let j = 0, prev = 0; for (let i = 0; i < n; i++) { const x = buf[j]; const y = 0.5 * (x + prev) * 0.996; prev = x; buf[j] = y; j = (j + 1) % p; d[i] = x; } }),
  sy_lead: () => mk(2, (d, n) => { const f = mtof(60); let ph = 0; const lp = new BQ('lp', 2400, 1.2); for (let i = 0; i < n; i++) { const t = i / SR; ph += (f * (1 + 0.006 * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.4))) / SR; const c = ph % 1; d[i] = lp.p(0.6 * (2 * c - 1) + 0.4 * (c < 0.5 ? 1 : -1)) * Math.min(1, t / 0.015) * (0.75 + 0.25 * Math.exp(-t * 3)); } }),
  sy_pad: () => {
    const b = ctx.createBuffer(2, Math.floor(2.6 * SR), SR);
    const f = mtof(60);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), n = d.length;
      const det = [0.993, 1, 1.007].map((x) => x * (ch ? 1.002 : 0.998));
      const ph = [0, 0, 0];
      const lp = new BQ('lp', 1600, 0.8);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        let s = 0;
        for (let k = 0; k < 3; k++) { ph[k] += (f * det[k]) / SR; s += 2 * (ph[k] % 1) - 1; }
        d[i] = lp.p(s / 3) * Math.min(1, t / 0.35) * (t > 2.2 ? Math.max(0, 1 - (t - 2.2) / 0.4) : 1);
      }
    }
    return finish(b);
  },
  sy_bell: () => mk(2.4, (d, n) => { const f = mtof(72); for (let i = 0; i < n; i++) { const t = i / SR; const mod = Math.sin(TAU * f * 3.5 * t) * 2.4 * Math.exp(-t * 2.5); d[i] = Math.sin(TAU * f * t + mod) * Math.exp(-t * 1.6); } }),
  sy_organ: () => mk(2, (d, n) => { const f = mtof(60); for (let i = 0; i < n; i++) { const t = i / SR; const s = Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * 2 * f * t) + 0.4 * Math.sin(TAU * 3 * f * t) + 0.25 * Math.sin(TAU * 4 * f * t) + 0.15 * Math.sin(TAU * 0.5 * f * t); d[i] = s * Math.min(1, t / 0.01) * (1 + 0.08 * Math.sin(TAU * 6.5 * t)) * (t > 1.8 ? Math.max(0, 1 - (t - 1.8) / 0.2) : 1); } }),
  sy_chip: () => mk(0.5, (d, n) => { const f = mtof(72); for (let i = 0; i < n; i++) { const t = i / SR; const c = (f * t) % 1; d[i] = (c < 0.25 ? 1 : -1) * 0.5 * (t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.1)); } }),
  sy_chord_min: () => chord([48, 60, 63, 67]),
  sy_chord_maj: () => chord([48, 60, 64, 67]),
  sy_chord_7: () => chord([48, 64, 67, 70]),
  sy_chord_m9: () => chord([48, 63, 67, 70, 74]),
  sy_riser: () => mk(2, (d, n) => { const bp = new BQ('bp', 300, 4); for (let i = 0; i < n; i++) { const t = i / SR, u = t / 2; if (i % 64 === 0) bp.set(300 * Math.pow(20, u), 4); d[i] = bp.p(rnd()) * u * u; } }),
  sy_zap: () => mk(0.35, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (80 + 2300 * Math.exp(-t * 18))) / SR; d[i] = Math.sin(ph) * Math.exp(-t * 8); } }),
  sy_blip: () => mk(0.07, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = sq(TAU * 1320 * t) * 0.5 * (1 - i / n); } }),
  sy_drop: () => mk(1.4, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (30 + 130 * Math.exp(-t * 3))) / SR; d[i] = Math.tanh(1.5 * Math.sin(ph)) * Math.exp(-t * 2); } }),
  sy_whoosh: () => mk(1.2, (d, n) => { const lp = new BQ('lp', 300, 0.8); for (let i = 0; i < n; i++) { const t = i / SR, s = Math.sin((Math.PI * t) / 1.2); if (i % 64 === 0) lp.set(200 + 4000 * s, 0.9); d[i] = lp.p(rnd()) * s * s; } }),
  sy_glitch: () => mk(0.32, (d, n) => { let hold = 0, left = 0; for (let i = 0; i < n; i++) { if (left-- <= 0) { hold = Math.round(rnd() * 4) / 4; left = 30 + Math.random() * 260; } d[i] = hold * sq((TAU * 220 * i) / SR) * (1 - i / n); } }),
  sy_vinyl: () => mk(3, (d, n) => { const lp = new BQ('lp', 2500, 0.7); for (let i = 0; i < n; i++) { const pop = Math.random() < 0.0009 ? rnd() : 0; d[i] = pop + 0.04 * lp.p(rnd()); } }, 0.6),
  sy_laser: () => mk(0.4, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (500 + 700 * Math.exp(-t * 6) + 120 * Math.sin(TAU * 32 * t))) / SR; d[i] = sq(ph) * 0.5 * Math.exp(-t * 6); } }),
  sy_ping: () => mk(1.2, (d, n) => { const f = mtof(84); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 1.5 * t)) * Math.exp(-t * 5); } }),
  sy_noise: () => mk(0.45, (d, n) => { const lp = new BQ('lp', 2800, 0.8); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (60 + 60 * Math.exp(-t * 20))) / SR; d[i] = Math.tanh(2 * (lp.p(rnd()) + 0.8 * Math.sin(ph))) * Math.exp(-t * 9); } }),
  sy_ahh: () => vocal([[0, 'a'], [1, 'a']], 0.75, 142, 0.05, [1.08, 1, 0.9]),
  sy_yeah: () => vocal([[0, 'i'], [0.14, 'e'], [0.32, 'a'], [1, 'a']], 0.62, 160, 0.01, [1.0, 1.12, 0.92]),
  sy_hey: () => vocal([[0, 'e'], [0.55, 'e'], [1, 'i']], 0.5, 185, 0.07, [1.0, 1.06, 1.18]),
  sy_ooh: () => vocal([[0, 'u'], [0.6, 'o'], [1, 'o']], 0.7, 150, 0.02, [0.95, 1.02, 0.96]),
  sy_vox: () => mk(1.2, (d, n) => { const f1 = new BQ('bp', 800, 8), f2 = new BQ('bp', 1150, 10), f3 = new BQ('bp', 2900, 12); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (mtof(48) * (1 + 0.012 * Math.sin(TAU * 5 * t))) / SR; const s = 2 * (ph % 1) - 1; d[i] = (f1.p(s) + 0.6 * f2.p(s) + 0.25 * f3.p(s)) * Math.min(1, t / 0.05) * (t > 1 ? Math.max(0, 1 - (t - 1) / 0.2) : 1); } }),
};

export const hasSynth = (id: string) => id in SYNTH;

/** Genera un suono sintetizzato del Mattone nel contesto indicato */
export function synthBuffer(c: BaseAudioContext, id: string): AudioBuffer | null {
  const fn = SYNTH[id];
  if (!fn) return null;
  ctx = c;
  SR = c.sampleRate;
  return fn();
}
