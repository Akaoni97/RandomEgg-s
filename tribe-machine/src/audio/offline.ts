// Render offline di un pattern (export WAV e verifica automatica del motore).

import { AudioEngine } from './engine';
import { Sequencer } from '../sequencer/sequencer';
import { stepDuration } from '../sequencer/timing';
import type { Pattern } from '../state/types';

export async function renderPattern(pattern: Pattern, bars: number, sampleRate = 44100): Promise<AudioBuffer> {
  const steps = Math.max(1, Math.round(bars * 16));
  const seconds = 0.05 + steps * stepDuration(pattern.bpm) + 2.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = new AudioEngine(ctx);
  await engine.init();
  pattern.parts.forEach((p, i) => engine.applyPart(i, p));
  engine.applyFx(pattern.fx, pattern.bpm);
  const seq = new Sequencer(engine, {
    getPattern: () => ({ pattern, index: 0 }),
    getQueued: () => null,
    commitQueued: () => ({ pattern, index: 0 }),
    onStep: () => {},
  });
  seq.renderSteps(pattern, steps, 0.05);
  return ctx.startRendering();
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
