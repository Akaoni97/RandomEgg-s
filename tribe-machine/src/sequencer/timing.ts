// Funzioni pure di temporizzazione (testate in src/sequencer/timing.test.ts)

/** Durata di uno step da 1/16 in secondi */
export const stepDuration = (bpm: number) => 60 / bpm / 4;

/**
 * Ritardo dello step dovuto allo swing. swing in % (50 = dritto, 66.7 = terzina, 75 = massimo).
 * Solo gli step dispari (i "levare" dei sedicesimi) vengono spostati.
 */
export function swingOffset(step: number, swing: number, dur: number): number {
  if (step % 2 === 0) return 0;
  const s = Math.min(75, Math.max(50, swing));
  return (s / 50 - 1) * dur;
}

export interface StepTime {
  step: number;
  time: number;
  /** true se lo step non è ancora stato programmato nel motore audio */
  pending: boolean;
}

/** Trova lo step più vicino a un istante (quantizzazione della registrazione live) */
export function nearestStep(candidates: StepTime[], t: number): StepTime | null {
  let best: StepTime | null = null;
  for (const c of candidates) {
    if (!best || Math.abs(c.time - t) < Math.abs(best.time - t)) best = c;
  }
  return best;
}

/** Tap tempo: media degli intervalli recenti, ignora pause lunghe */
export function tapTempo(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const iv: number[] = [];
  for (let i = 1; i < taps.length; i++) {
    const d = taps[i] - taps[i - 1];
    if (d > 0.2 && d < 1.5) iv.push(d);
  }
  if (!iv.length) return null;
  const avg = iv.reduce((a, b) => a + b, 0) / iv.length;
  return Math.round((60 / avg) * 10) / 10;
}
