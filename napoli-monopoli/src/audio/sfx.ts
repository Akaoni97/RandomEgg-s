import type { PawnId } from '../engine/types';
import { midiToFreq, parseAbc, type AbcTune } from './abc';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxOn = true;
let musicOn = true;
let musicTimer: number | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
  if (musicOn) startMusic();
}

/** sets preferences without touching the AudioContext (no user gesture yet) */
export function configureAudio(p: { sfx: boolean; music: boolean }) {
  sfxOn = p.sfx;
  musicOn = p.music;
}

export function setSfx(on: boolean) {
  sfxOn = on;
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (on) startMusic();
  else stopMusic();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number; out?: AudioNode } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(opts.out ?? master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { gain?: number; delay?: number; freq?: number; q?: number; type?: BiquadFilterType } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  dice() {
    if (!sfxOn) return;
    for (let k = 0; k < 9; k++) noise(0.05, { delay: k * 0.09 + Math.random() * 0.04, freq: 2500 + Math.random() * 2000, q: 4, gain: 0.35 });
  },
  hop() {
    if (!sfxOn) return;
    tone(520 + Math.random() * 80, 0.09, { type: 'triangle', gain: 0.12, slide: 1.6 });
  },
  coinIn() {
    if (!sfxOn) return;
    tone(1318, 0.12, { type: 'square', gain: 0.08 });
    tone(1760, 0.3, { type: 'square', gain: 0.08, delay: 0.08 });
  },
  coinOut() {
    if (!sfxOn) return;
    tone(660, 0.15, { type: 'triangle', gain: 0.15, slide: 0.6 });
  },
  card() {
    if (!sfxOn) return;
    noise(0.35, { freq: 3000, q: 0.6, gain: 0.25, type: 'highpass' });
    tone(880, 0.2, { type: 'sine', gain: 0.1, delay: 0.25 });
    tone(1320, 0.3, { type: 'sine', gain: 0.1, delay: 0.35 });
  },
  siren() {
    if (!sfxOn) return;
    for (let k = 0; k < 4; k++) {
      tone(960, 0.28, { type: 'sawtooth', gain: 0.06, delay: k * 0.56 });
      tone(720, 0.28, { type: 'sawtooth', gain: 0.06, delay: k * 0.56 + 0.28 });
    }
  },
  clacson() {
    if (!sfxOn) return;
    for (let k = 0; k < 5; k++) {
      const d = k * 0.32 + Math.random() * 0.1;
      tone(392, 0.22, { type: 'square', gain: 0.06, delay: d });
      tone(494, 0.22, { type: 'square', gain: 0.05, delay: d });
    }
  },
  firework() {
    if (!sfxOn) return;
    for (let k = 0; k < 8; k++) {
      const d = k * 0.25 + Math.random() * 0.2;
      tone(1200 + Math.random() * 600, 0.4, { type: 'sine', gain: 0.03, delay: d, slide: 0.3 });
      noise(0.5, { delay: d + 0.4, freq: 600, q: 0.5, gain: 0.35, type: 'lowpass' });
    }
  },
  rumble() {
    if (!sfxOn) return;
    noise(3.2, { freq: 90, q: 0.7, gain: 0.9, type: 'lowpass' });
    noise(2.0, { freq: 200, q: 0.7, gain: 0.5, type: 'lowpass', delay: 0.8 });
    tone(55, 3, { type: 'sawtooth', gain: 0.12, slide: 0.6 });
  },
  ruspa() {
    if (!sfxOn) return;
    for (let k = 0; k < 18; k++) tone(70 + (k % 2) * 8, 0.12, { type: 'sawtooth', gain: 0.08, delay: k * 0.1 });
    noise(1.0, { delay: 1.6, freq: 300, q: 0.4, gain: 0.6, type: 'lowpass' });
  },
  fail() {
    if (!sfxOn) return;
    [523, 494, 466, 440].forEach((f, k) => tone(f, 0.4, { type: 'triangle', gain: 0.12, delay: k * 0.35, slide: k === 3 ? 0.7 : 1 }));
  },
  win() {
    if (!sfxOn) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, 0.35, { type: 'square', gain: 0.07, delay: k * 0.16 }));
  },
  magic() {
    if (!sfxOn) return;
    [1047, 1319, 1568, 2093, 2637].forEach((f, k) => tone(f, 0.5, { type: 'sine', gain: 0.07, delay: k * 0.08 }));
  },
  curse() {
    if (!sfxOn) return;
    tone(220, 0.9, { type: 'sawtooth', gain: 0.08, slide: 0.5 });
    tone(233, 0.9, { type: 'sawtooth', gain: 0.06, slide: 0.5 });
  },
  pop() {
    if (!sfxOn) return;
    noise(0.15, { freq: 900, q: 2, gain: 0.5 });
    tone(300, 0.15, { type: 'square', gain: 0.08, slide: 3 });
  },
  bip() {
    if (!sfxOn) return;
    tone(1000, 0.35, { type: 'sine', gain: 0.18 });
  },
  click() {
    if (!sfxOn) return;
    tone(1400, 0.04, { type: 'square', gain: 0.05 });
  },
};

const VOICE: Record<PawnId, { base: number; type: OscillatorType }> = {
  ciro: { base: 260, type: 'square' },
  toto: { base: 170, type: 'triangle' },
  gigi: { base: 330, type: 'sawtooth' },
  gennaro: { base: 120, type: 'sine' },
};

/** Animal-Crossing style babble: one blip per syllable */
export function babble(pawn: PawnId, text: string) {
  if (!sfxOn) return;
  const syll = Math.min(14, Math.max(3, Math.round(text.length / 4)));
  const v = VOICE[pawn];
  for (let k = 0; k < syll; k++) {
    const f = v.base * (0.85 + Math.random() * 0.5);
    tone(f, 0.07, { type: v.type, gain: 0.05, delay: k * 0.075 });
  }
}

let ttsVoice: SpeechSynthesisVoice | null | undefined;

export function speak(pawn: PawnId, text: string) {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    if (ttsVoice === undefined) {
      ttsVoice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('it')) ?? null;
    }
    const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s',.!?]/gu, ''));
    u.lang = 'it-IT';
    if (ttsVoice) u.voice = ttsVoice;
    u.pitch = { ciro: 1.2, toto: 0.9, gigi: 1.4, gennaro: 0.6 }[pawn];
    u.rate = { ciro: 1.25, toto: 0.95, gigi: 1.1, gennaro: 0.85 }[pawn];
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no TTS */
  }
}

// ───────────── mandolin: plays every tune in ./tunes/*.abc in turn ─────────────

const TUNES: AbcTune[] = Object.values(
  import.meta.glob('./tunes/*.abc', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
).map(parseAbc);
let tuneIdx = 0;

function pluck(freq: number, when: number, dur: number, gain: number) {
  const c = ctx!;
  // tremolo picking: repeated short plucks
  const reps = Math.max(1, Math.floor(dur / 0.075));
  for (let r = 0; r < reps; r++) {
    const t = when + r * 0.075;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * (r === 0 ? 1 : 0.65), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(f).connect(g).connect(musicGain!);
    o.start(t);
    o.stop(t + 0.08);
  }
}

function scheduleLoop() {
  const c = ac();
  if (!c || !musicGain || !TUNES.length) return 0;
  const tune = TUNES[tuneIdx % TUNES.length];
  tuneIdx += 1;
  const t0 = c.currentTime + 0.1;
  for (const n of tune.notes) {
    if (n.midi !== null) pluck(midiToFreq(n.midi), t0 + n.start * tune.unit, n.len * tune.unit * 0.95, 0.5);
  }
  // bass: chord root on the strong beats of every bar
  for (let bar = 0; bar < tune.total; bar += tune.bar) {
    for (const half of [0, tune.bar / 2]) {
      const at = bar + half;
      const chord = [...tune.chords].reverse().find((ch) => ch.start <= at);
      if (!chord) continue;
      const f = midiToFreq(chord.root) * (half ? 2 : 1);
      pluck(f, t0 + at * tune.unit, 0.08, half ? 0.35 : 0.6);
    }
  }
  return tune.total * tune.unit;
}

function startMusic() {
  if (musicTimer !== null || !musicOn) return;
  const c = ac();
  if (!c || !musicGain) return;
  musicGain.gain.setTargetAtTime(0.16, c.currentTime, 0.1);
  const loop = () => {
    const len = scheduleLoop();
    musicTimer = window.setTimeout(loop, Math.max(1000, len * 1000));
  };
  loop();
}

function stopMusic() {
  if (musicTimer !== null) window.clearTimeout(musicTimer);
  musicTimer = null;
  if (ctx && musicGain) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}
