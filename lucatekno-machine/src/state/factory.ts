import { defaultParams, paramsFor, clampParam, TYPE_LABEL } from './params';
import {
  BPM_MAX, BPM_MIN, MAX_SONG, MAX_STEPS, NUM_PARTS, NUM_PATTERNS, PART_TYPES,
  type MasterFx, type PartState, type PartType, type Pattern, type Project, type Step,
} from './types';

export const DEFAULT_LAYOUT: PartType[] = ['kick', 'snare', 'clap', 'hat', 'ohat', 'perc', 'bass', 'acid'];

export const emptyStep = (): Step => ({ on: false, acc: false, slide: false, note: 0, gate: 0.6 });

export function makePart(type: PartType, name = TYPE_LABEL[type]): PartState {
  return {
    type,
    name,
    params: defaultParams(type),
    steps: Array.from({ length: MAX_STEPS }, emptyStep),
    mute: false,
    solo: false,
    motion: {},
    sampleId: null,
  };
}

export const defaultFx = (): MasterFx => ({ filter: 0, crush: 0, delayDiv: 5, delayFb: 0.35, revSize: 0.45, volume: 0.85 });

export function makePattern(name = 'INIT'): Pattern {
  return {
    name,
    bpm: 165,
    swing: 50,
    length: 16,
    parts: DEFAULT_LAYOUT.map((t) => makePart(t)),
    fx: defaultFx(),
  };
}

export function makeProject(): Project {
  return {
    format: 'lucatekno-machine',
    version: 1,
    name: 'NUOVO PROGETTO',
    patterns: Array.from({ length: NUM_PATTERNS }, () => makePattern()),
    current: 0,
    song: [{ pattern: 0, repeats: 4 }],
    samples: [],
  };
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Validazione / normalizzazione dei progetti caricati da file o storage.
// Un file corrotto o di una versione futura non deve mai bloccare la macchina.
// ---------------------------------------------------------------------------

const num = (v: unknown, def: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

function sanitizeStep(s: any): Step {
  const e = emptyStep();
  if (!s || typeof s !== 'object') return e;
  return {
    on: !!s.on,
    acc: !!s.acc,
    slide: !!s.slide,
    note: Math.round(num(s.note, 0, -24, 24)),
    gate: num(s.gate, e.gate, 0.1, 1),
  };
}

function sanitizePart(p: any, fallback: PartType): PartState {
  const type: PartType = PART_TYPES.includes(p?.type) ? p.type : fallback;
  const part = makePart(type, typeof p?.name === 'string' ? p.name.slice(0, 8).toUpperCase() : undefined);
  if (p?.params && typeof p.params === 'object') {
    for (const d of paramsFor(type)) {
      if (typeof p.params[d.id] === 'number') part.params[d.id] = clampParam(d, p.params[d.id]);
    }
  }
  if (Array.isArray(p?.steps)) {
    for (let i = 0; i < MAX_STEPS; i++) part.steps[i] = sanitizeStep(p.steps[i]);
  }
  part.mute = !!p?.mute;
  part.solo = !!p?.solo;
  if (p?.motion && typeof p.motion === 'object') {
    for (const d of paramsFor(type)) {
      const m = p.motion[d.id];
      if (!Array.isArray(m)) continue;
      const lane = Array.from({ length: MAX_STEPS }, (_, i) => (typeof m[i] === 'number' && Number.isFinite(m[i]) ? clampParam(d, m[i]) : null));
      if (lane.some((v) => v !== null)) part.motion[d.id] = lane;
    }
  }
  part.sampleId = typeof p?.sampleId === 'string' ? p.sampleId.slice(0, 64) : null;
  return part;
}

export function sanitizePattern(pt: any): Pattern {
  const base = makePattern();
  if (!pt || typeof pt !== 'object') return base;
  const len = [16, 32, 48, 64].includes(pt.length) ? pt.length : 16;
  const fx = { ...base.fx };
  if (pt.fx && typeof pt.fx === 'object') {
    fx.filter = num(pt.fx.filter, 0, -1, 1);
    fx.crush = num(pt.fx.crush, 0, 0, 1);
    fx.delayDiv = Math.round(num(pt.fx.delayDiv, fx.delayDiv, 0, 8));
    fx.delayFb = num(pt.fx.delayFb, fx.delayFb, 0, 0.9);
    fx.revSize = num(pt.fx.revSize, fx.revSize, 0, 1);
    fx.volume = num(pt.fx.volume, fx.volume, 0, 1);
  }
  return {
    name: typeof pt.name === 'string' ? pt.name.slice(0, 16).toUpperCase() : base.name,
    bpm: num(pt.bpm, base.bpm, BPM_MIN, BPM_MAX),
    swing: num(pt.swing, 50, 50, 75),
    length: len,
    parts: Array.from({ length: NUM_PARTS }, (_, i) => sanitizePart(pt.parts?.[i], DEFAULT_LAYOUT[i])),
    fx,
  };
}

export function sanitizeProject(raw: any): Project {
  if (!raw || typeof raw !== 'object' || (raw.format !== 'lucatekno-machine' && raw.format !== 'tribe-machine')) {
    throw new Error('File non riconosciuto: non è un progetto LucaTekno_Machine o TRIBE MACHINE');
  }
  const proj = makeProject();
  proj.name = typeof raw.name === 'string' ? raw.name.slice(0, 24) : proj.name;
  for (let i = 0; i < NUM_PATTERNS; i++) {
    if (raw.patterns?.[i]) proj.patterns[i] = sanitizePattern(raw.patterns[i]);
  }
  proj.current = Math.round(num(raw.current, 0, 0, NUM_PATTERNS - 1));
  if (Array.isArray(raw.song) && raw.song.length) {
    proj.song = raw.song.slice(0, MAX_SONG).map((e: any) => ({
      pattern: Math.round(num(e?.pattern, 0, 0, NUM_PATTERNS - 1)),
      repeats: Math.round(num(e?.repeats, 1, 1, 16)),
    }));
  }
  if (Array.isArray(raw.samples)) {
    proj.samples = raw.samples
      .filter((x: any) => typeof x?.id === 'string')
      .map((x: any) => ({ id: x.id.slice(0, 64), name: typeof x.name === 'string' ? x.name.slice(0, 32) : 'SAMPLE' }));
  }
  return proj;
}
