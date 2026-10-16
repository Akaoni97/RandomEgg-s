/**
 * Tiny ABC notation reader: enough for a single-voice folk tune with chord symbols.
 * Supports X/T/M/L/Q/K headers, notes A-G a-g with ' and , octaves, accidentals ^ _ =,
 * lengths (2, 3/2, /, /2), rests z, ties -, bars | (also |: :| [1 [2, played once),
 * and "Chord" symbols, which drive the bass. Repeats are not expanded.
 */

export interface AbcNote {
  /** MIDI number, null for a rest */
  midi: number | null;
  /** start and length in units of L (the default note length) */
  start: number;
  len: number;
}

export interface AbcChord {
  start: number;
  /** MIDI number of the chord root in octave 2 */
  root: number;
}

export interface AbcTune {
  title: string;
  /** seconds per L unit */
  unit: number;
  /** length of a bar in L units */
  bar: number;
  notes: AbcNote[];
  chords: AbcChord[];
  total: number;
}

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
/** fifths for major keys; minor = relative major */
const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};
const MINOR_TO_MAJOR: Record<string, string> = {
  A: 'C', E: 'G', B: 'D', 'F#': 'A', 'C#': 'E', 'G#': 'B', D: 'F', G: 'Bb', C: 'Eb', F: 'Ab', Bb: 'Db', Eb: 'Gb',
};

function frac(s: string): number {
  const [a, b] = s.split('/').map((x) => x.trim());
  return b === undefined ? Number(a) : Number(a) / Number(b);
}

function keySignature(k: string): Record<string, number> {
  const m = /^([A-G][#b]?)\s*(m|min|minor)?/i.exec(k.trim());
  const sig: Record<string, number> = {};
  if (!m) return sig;
  const tonic = m[1][0].toUpperCase() + m[1].slice(1);
  const major = m[2] ? MINOR_TO_MAJOR[tonic] : tonic;
  const fifths = MAJOR_FIFTHS[major ?? 'C'] ?? 0;
  if (fifths > 0) SHARPS.slice(0, fifths).forEach((n) => (sig[n] = 1));
  if (fifths < 0) FLATS.slice(0, -fifths).forEach((n) => (sig[n] = -1));
  return sig;
}

function readLength(src: string, i: number): [number, number] {
  const m = /^(\d*)(\/*)(\d*)/.exec(src.slice(i))!;
  const [all, num, slashes, den] = m;
  if (!all) return [1, i];
  let len = num ? Number(num) : 1;
  if (slashes) len /= den ? Number(den) : 2 ** slashes.length;
  return [len, i + all.length];
}

export function parseAbc(text: string): AbcTune {
  let title = '';
  let L = 1 / 8;
  let meter = 6 / 8;
  let tempo: { beat: number; bpm: number } | null = null;
  let sig: Record<string, number> = {};
  const body: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/%.*$/, '').trim();
    if (!line) continue;
    const h = /^([A-Za-z]):(.*)$/.exec(line);
    if (h && body.length === 0 && h[1] !== '|') {
      const v = h[2].trim();
      if (h[1] === 'T' && !title) title = v;
      if (h[1] === 'L') L = frac(v);
      if (h[1] === 'M') meter = v === 'C' ? 1 : v === 'C|' ? 1 : frac(v);
      if (h[1] === 'Q') {
        const q = /(?:(\d+\/\d+)\s*=\s*)?(\d+)/.exec(v);
        if (q) tempo = { beat: q[1] ? frac(q[1]) : L, bpm: Number(q[2]) };
      }
      if (h[1] === 'K') {
        sig = keySignature(v);
        body.push('');
      }
      continue;
    }
    body.push(line);
  }
  const src = body.join(' ');
  const notes: AbcNote[] = [];
  const chords: AbcChord[] = [];
  let t = 0;
  let barAcc: Record<string, number> = {};
  let tie = false;
  for (let i = 0; i < src.length; ) {
    const ch = src[i];
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      const name = src.slice(i + 1, end < 0 ? src.length : end);
      const m = /^([A-G])([#b]?)/.exec(name);
      if (m) chords.push({ start: t, root: 36 + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) });
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    if (ch === '|' || ch === ':' || ch === ']' || ch === '[') {
      barAcc = {};
      i += 1;
      if (/[12]/.test(src[i] ?? '') && ch === '[') i += 1;
      continue;
    }
    if (ch === '-') {
      tie = true;
      i += 1;
      continue;
    }
    if (/[\^_=A-Ga-gz]/.test(ch)) {
      i = readNote(i);
      continue;
    }
    i += 1;
  }

  function readNote(i: number): number {
    let acc: number | null = null;
    while (src[i] === '^' || src[i] === '_' || src[i] === '=') {
      acc = (acc ?? 0) + (src[i] === '^' ? 1 : src[i] === '_' ? -1 : 0);
      i += 1;
    }
    const letter = src[i];
    i += 1;
    if (letter === 'z') {
      const [len, ni] = readLength(src, i);
      notes.push({ midi: null, start: t, len });
      t += len;
      return ni;
    }
    const upper = letter.toUpperCase();
    let octave = letter === upper ? 4 : 5;
    while (src[i] === "'" || src[i] === ',') {
      octave += src[i] === "'" ? 1 : -1;
      i += 1;
    }
    if (acc !== null) barAcc[`${upper}${octave}`] = acc;
    const shift = barAcc[`${upper}${octave}`] ?? sig[upper] ?? 0;
    const midi = 12 * (octave + 1) + LETTER[upper] + shift;
    const [len, ni] = readLength(src, i);
    const prev = notes[notes.length - 1];
    if (tie && prev?.midi === midi) prev.len += len;
    else notes.push({ midi, start: t, len });
    tie = false;
    t += len;
    return ni;
  }

  const barUnits = meter / L;
  // 6/8 & co. are felt in dotted quarters; default 100 per minute
  const beat = tempo?.beat ?? (meter === 6 / 8 || meter === 9 / 8 || meter === 12 / 8 ? 3 / 8 : 1 / 4);
  const bpm = tempo?.bpm ?? 100;
  const unit = (60 / bpm) * (L / beat);
  return { title, unit, bar: barUnits, notes, chords, total: t };
}

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
