// Render offline di un pattern (export WAV e verifica automatica del motore).

import { AudioEngine } from './engine';
import { Sequencer } from '../sequencer/sequencer';
import { stepDuration, swingOffset } from '../sequencer/timing';
import type { Pattern, Project } from '../state/types';

const TAIL = 2.5;
const CHUNK = 2;
export const MAX_RENDER_SECONDS = 15 * 60;

interface Section { pattern: Pattern; steps: number }

/**
 * Render offline di una sequenza di sezioni. Gli step vengono programmati a blocchi di pochi
 * secondi (suspend/resume del contesto offline): anche una song lunga non crea centinaia di
 * migliaia di nodi tutti insieme.
 */
async function renderSections(sections: Section[], sampleRate: number): Promise<AudioBuffer> {
  const total = sections.reduce((t, s) => t + s.steps * stepDuration(s.pattern.bpm), 0);
  const seconds = Math.min(total, MAX_RENDER_SECONDS) + 0.05 + TAIL;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = new AudioEngine(ctx);
  await engine.init();
  const first = sections[0].pattern;
  first.parts.forEach((p, i) => engine.applyPart(i, p));
  engine.applyFx(first.fx, first.bpm);
  const seq = new Sequencer(engine, { getPattern: () => ({ pattern: first, index: 0 }), atBar: () => null, onStep: () => {} });

  let si = 0;
  let n = 0;
  let t = 0.05;
  const limit = seconds - TAIL;
  const scheduleUntil = (until: number) => {
    while (si < sections.length && t < until && t < limit) {
      const sec = sections[si];
      const step = n % sec.pattern.length;
      const dur = stepDuration(sec.pattern.bpm);
      seq.scheduleStep(sec.pattern, step, t + swingOffset(step, sec.pattern.swing, dur));
      t += dur;
      if (++n >= sec.steps) {
        seq.releaseAll(t);
        si++;
        n = 0;
      }
    }
    if (si >= sections.length || t >= limit) seq.releaseAll(t);
  };
  scheduleUntil(CHUNK * 2);
  for (let at = CHUNK; at < limit; at += CHUNK) {
    const target = at + CHUNK * 2;
    ctx.suspend(at).then(() => {
      engine.gc();
      scheduleUntil(target);
      void ctx.resume();
    });
  }
  return ctx.startRendering();
}

export function renderPattern(pattern: Pattern, bars: number, sampleRate = 44100): Promise<AudioBuffer> {
  return renderSections([{ pattern, steps: Math.max(1, Math.round(bars * 16)) }], sampleRate);
}

/** Durata in secondi della song di un progetto */
export function songSeconds(project: Project): number {
  return project.song.reduce((t, e) => {
    const pt = project.patterns[e.pattern];
    return t + pt.length * e.repeats * stepDuration(pt.bpm);
  }, 0);
}

export function renderSong(project: Project, sampleRate = 44100): Promise<AudioBuffer> {
  return renderSections(
    project.song.map((e) => ({ pattern: project.patterns[e.pattern], steps: project.patterns[e.pattern].length * e.repeats })),
    sampleRate,
  );
}

/** Codifica WAV PCM 16 bit stereo */
export function encodeWav(buf: AudioBuffer): Blob {
  const ch = Math.min(2, buf.numberOfChannels);
  const len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF');
  data.setUint32(4, 36 + len * ch * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  w(36, 'data');
  data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

export function analyze(buf: AudioBuffer) {
  let peak = 0;
  let sum = 0;
  let n = 0;
  let nan = false;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) nan = true;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      n++;
    }
  }
  return { peak, rms: Math.sqrt(sum / n), nan };
}
