// Modello dati della macchina. Tutto ciò che sta qui è serializzabile in JSON
// e costituisce un progetto salvabile.

export type PartType = 'kick' | 'snare' | 'clap' | 'hat' | 'ohat' | 'perc' | 'bass' | 'acid' | 'sample';

export const PART_TYPES: PartType[] = ['kick', 'snare', 'clap', 'hat', 'ohat', 'perc', 'bass', 'acid', 'sample'];

export const MAX_STEPS = 64;
export const NUM_PARTS = 8;
export const NUM_PATTERNS = 16;

export interface Step {
  on: boolean;
  /** Accento: velocity piena + per l'acid apertura filtro extra */
  acc: boolean;
  /** Slide/legato verso lo step successivo (parti melodiche) */
  slide: boolean;
  /** Nota in semitoni relativa alla tonica della parte */
  note: number;
  /** Lunghezza della nota in frazione di step (0.1 – 1) */
  gate: number;
}

export interface PartState {
  type: PartType;
  name: string;
  params: Record<string, number>;
  steps: Step[];
  mute: boolean;
  solo: boolean;
  /**
   * Motion sequence: per parametro, un valore registrato per step (null = usa la manopola).
   * Registrato muovendo le manopole con REC attivo durante la riproduzione.
   */
  motion: Record<string, (number | null)[]>;
  /** id del campione (parti di tipo SAMPLE) */
  sampleId: string | null;
}

export interface MasterFx {
  /** -1..1: <0 passa-basso, >0 passa-alto, 0 neutro */
  filter: number;
  /** 0..1 bitcrusher */
  crush: number;
  /** indice nella tabella DELAY_DIVS */
  delayDiv: number;
  delayFb: number;
  /** 0..1 dimensione/coda del riverbero */
  revSize: number;
  volume: number;
}

export interface Pattern {
  name: string;
  bpm: number;
  /** 50..75 (%) */
  swing: number;
  /** 16 | 32 | 48 | 64 */
  length: number;
  parts: PartState[];
  fx: MasterFx;
}

export interface SongEntry {
  pattern: number;
  /** quante volte ripetere il pattern (1..16) */
  repeats: number;
}

export interface SampleInfo {
  id: string;
  name: string;
}

export interface Project {
  /** 'tribe-machine' è accettato in importazione: i progetti TRIBE MACHINE si aprono qui */
  format: 'lucatekno-machine';
  version: 1;
  name: string;
  patterns: Pattern[];
  current: number;
  /** song mode: catena di pattern */
  song: SongEntry[];
  /** campioni usati dal progetto (i dati audio stanno in IndexedDB / nel file esportato) */
  samples: SampleInfo[];
}

export const MAX_SONG = 64;

export const DELAY_DIVS: { label: string; beats: number }[] = [
  { label: '1/32', beats: 0.125 },
  { label: '1/16', beats: 0.25 },
  { label: '1/16T', beats: 1 / 6 },
  { label: '1/8T', beats: 1 / 3 },
  { label: '1/8', beats: 0.5 },
  { label: '3/16', beats: 0.75 },
  { label: '1/4', beats: 1 },
  { label: '3/8', beats: 1.5 },
  { label: '1/2', beats: 2 },
];

export const BPM_MIN = 60;
export const BPM_MAX = 260;
