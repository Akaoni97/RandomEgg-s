// Definizione dei parametri sonori per ogni tipo di parte.
// Ogni parametro sa come mostrarsi sul display, su quale pagina LCD vive
// e su quale manopola del pannello è mappato.

import type { PartType } from './types';

export type LcdPage = 'osc' | 'filter' | 'env' | 'mod' | 'fx';
export type Curve = 'lin' | 'exp';

export interface ParamDef {
  id: string;
  /** etichetta corta (display e serigrafia manopola) */
  label: string;
  /** descrizione per il tooltip */
  hint: string;
  min: number;
  max: number;
  def: number;
  curve?: Curve;
  /** passo di quantizzazione del valore (es. 1 per valori interi) */
  step?: number;
  unit?: string;
  options?: string[];
  page: LcdPage;
}

const p = (d: ParamDef) => d;

// Parametri comuni a tutte le parti (sezione PART MIX del pannello)
export const COMMON_PARAMS: ParamDef[] = [
  p({ id: 'drive', label: 'DRIVE', hint: 'Saturazione / distorsione della parte', min: 0, max: 1, def: 0, page: 'fx' }),
  p({ id: 'dly', label: 'DLY SEND', hint: 'Mandata al delay sincronizzato', min: 0, max: 1, def: 0, page: 'fx' }),
  p({ id: 'rev', label: 'REV SEND', hint: 'Mandata al riverbero', min: 0, max: 1, def: 0, page: 'fx' }),
  p({ id: 'pan', label: 'PAN', hint: 'Posizione stereo', min: -1, max: 1, def: 0, page: 'fx' }),
  p({ id: 'level', label: 'LEVEL', hint: 'Volume della parte', min: 0, max: 1, def: 0.8, page: 'fx' }),
];

const WAVES = ['SINE', 'TRI', 'SAW', 'SQUARE'];

const TYPE_PARAMS: Record<PartType, ParamDef[]> = {
  kick: [
    p({ id: 'tune', label: 'PITCH', hint: 'Frequenza fondamentale del kick', min: 28, max: 90, def: 48, curve: 'exp', unit: 'Hz', page: 'osc' }),
    p({ id: 'wave', label: 'WAVE', hint: 'Forma d\'onda del corpo', min: 0, max: 1, def: 0, step: 1, options: ['SINE', 'TRI'], page: 'osc' }),
    p({ id: 'pamt', label: 'P.ENV', hint: 'Quantità di pitch envelope (semitoni)', min: 0, max: 60, def: 34, unit: 'st', page: 'mod' }),
    p({ id: 'pdec', label: 'P.DECAY', hint: 'Velocità della discesa di pitch', min: 4, max: 250, def: 38, curve: 'exp', unit: 'ms', page: 'mod' }),
    p({ id: 'attack', label: 'CLICK', hint: 'Transiente / click d\'attacco', min: 0, max: 1, def: 0.45, page: 'env' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Lunghezza della coda: secco ↔ rimbombante', min: 40, max: 2500, def: 480, curve: 'exp', unit: 'ms', page: 'env' }),
    p({ id: 'tone', label: 'TONE', hint: 'Filtro passa-basso sul kick', min: 150, max: 18000, def: 7000, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'shape', label: 'HARDNESS', hint: 'Durezza industriale (clip prima del filtro)', min: 0, max: 1, def: 0.25, page: 'filter' }),
  ],
  snare: [
    p({ id: 'tune', label: 'PITCH', hint: 'Intonazione del corpo', min: 100, max: 450, def: 190, curve: 'exp', unit: 'Hz', page: 'osc' }),
    p({ id: 'snap', label: 'SNAPPY', hint: 'Quantità di rumore (cordiera)', min: 0, max: 1, def: 0.6, page: 'osc' }),
    p({ id: 'tone', label: 'TONE', hint: 'Brillantezza del rumore', min: 800, max: 14000, def: 5200, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'reso', label: 'RESO', hint: 'Risonanza del filtro rumore', min: 0.3, max: 8, def: 0.8, page: 'filter' }),
    p({ id: 'pamt', label: 'P.ENV', hint: 'Pitch envelope del corpo', min: 0, max: 24, def: 7, unit: 'st', page: 'mod' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Lunghezza', min: 30, max: 900, def: 170, curve: 'exp', unit: 'ms', page: 'env' }),
  ],
  clap: [
    p({ id: 'tone', label: 'TONE', hint: 'Frequenza del filtro', min: 500, max: 5000, def: 1300, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'reso', label: 'RESO', hint: 'Risonanza / colore', min: 0.4, max: 10, def: 1.6, page: 'filter' }),
    p({ id: 'spread', label: 'SPREAD', hint: 'Distanza tra i colpi di mano', min: 0, max: 1, def: 0.45, page: 'mod' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Coda', min: 40, max: 1000, def: 260, curve: 'exp', unit: 'ms', page: 'env' }),
  ],
  hat: [
    p({ id: 'tune', label: 'PITCH', hint: 'Intonazione metallica', min: -12, max: 12, def: 0, step: 1, unit: 'st', page: 'osc' }),
    p({ id: 'color', label: 'METAL', hint: 'Rumore ↔ metallo', min: 0, max: 1, def: 0.55, page: 'osc' }),
    p({ id: 'tone', label: 'CUTOFF', hint: 'Passa-alto', min: 2000, max: 15000, def: 7500, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'reso', label: 'RESO', hint: 'Risonanza', min: 0.3, max: 10, def: 1, page: 'filter' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Lunghezza', min: 8, max: 400, def: 45, curve: 'exp', unit: 'ms', page: 'env' }),
  ],
  ohat: [
    p({ id: 'tune', label: 'PITCH', hint: 'Intonazione metallica', min: -12, max: 12, def: 0, step: 1, unit: 'st', page: 'osc' }),
    p({ id: 'color', label: 'METAL', hint: 'Rumore ↔ metallo', min: 0, max: 1, def: 0.6, page: 'osc' }),
    p({ id: 'tone', label: 'CUTOFF', hint: 'Passa-alto', min: 2000, max: 15000, def: 6800, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'reso', label: 'RESO', hint: 'Risonanza', min: 0.3, max: 10, def: 1, page: 'filter' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Lunghezza (viene strozzato dal closed hat)', min: 60, max: 1800, def: 360, curve: 'exp', unit: 'ms', page: 'env' }),
  ],
  perc: [
    p({ id: 'tune', label: 'PITCH', hint: 'Intonazione', min: 50, max: 1500, def: 210, curve: 'exp', unit: 'Hz', page: 'osc' }),
    p({ id: 'fm', label: 'FM AMT', hint: 'Modulazione FM: legno → metallo', min: 0, max: 1, def: 0.35, page: 'osc' }),
    p({ id: 'ratio', label: 'FM RATIO', hint: 'Rapporto del modulatore', min: 0, max: 7, def: 3, step: 1, options: ['0.5', '1', '1.41', '2', '2.76', '3.5', '5.19', '7.1'], page: 'osc' }),
    p({ id: 'noise', label: 'NOISE', hint: 'Rumore d\'attacco', min: 0, max: 1, def: 0.1, page: 'osc' }),
    p({ id: 'pamt', label: 'P.ENV', hint: 'Pitch envelope (tom tribali)', min: 0, max: 36, def: 9, unit: 'st', page: 'mod' }),
    p({ id: 'pdec', label: 'P.DECAY', hint: 'Velocità del pitch envelope', min: 4, max: 300, def: 40, curve: 'exp', unit: 'ms', page: 'mod' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Lunghezza', min: 15, max: 1500, def: 190, curve: 'exp', unit: 'ms', page: 'env' }),
  ],
  bass: [
    p({ id: 'tune', label: 'PITCH', hint: 'Trasposizione (semitoni, tonica = F1)', min: -12, max: 24, def: 0, step: 1, unit: 'st', page: 'osc' }),
    p({ id: 'wave', label: 'WAVE', hint: 'Forma d\'onda oscillatore', min: 0, max: 3, def: 2, step: 1, options: WAVES, page: 'osc' }),
    p({ id: 'sub', label: 'SUB', hint: 'Oscillatore sub un\'ottava sotto', min: 0, max: 1, def: 0.4, page: 'osc' }),
    p({ id: 'glide', label: 'GLIDE', hint: 'Tempo di portamento sugli step con SLIDE', min: 5, max: 400, def: 60, curve: 'exp', unit: 'ms', page: 'osc' }),
    p({ id: 'cutoff', label: 'CUTOFF', hint: 'Frequenza di taglio', min: 40, max: 9000, def: 520, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'reso', label: 'RESO', hint: 'Risonanza', min: 0.5, max: 18, def: 4, page: 'filter' }),
    p({ id: 'ftype', label: 'F.TYPE', hint: 'Tipo filtro', min: 0, max: 1, def: 0, step: 1, options: ['LPF', 'HPF'], page: 'filter' }),
    p({ id: 'egint', label: 'EG INT', hint: 'Quantità dell\'inviluppo sul filtro', min: 0, max: 1, def: 0.45, page: 'filter' }),
    p({ id: 'attack', label: 'ATTACK', hint: 'Attacco dell\'ampiezza', min: 1, max: 300, def: 2, curve: 'exp', unit: 'ms', page: 'env' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Decadimento inviluppo', min: 20, max: 2500, def: 230, curve: 'exp', unit: 'ms', page: 'env' }),
    p({ id: 'lfoRate', label: 'LFO RATE', hint: 'Velocità LFO sul filtro (sincronizzato)', min: 0, max: 6, def: 2, step: 1, options: ['4 BAR', '2 BAR', '1 BAR', '1/2', '1/4', '1/8', '1/16'], page: 'mod' }),
    p({ id: 'lfoAmt', label: 'LFO AMT', hint: 'Profondità LFO sul filtro', min: 0, max: 1, def: 0, page: 'mod' }),
  ],
  acid: [
    p({ id: 'tune', label: 'PITCH', hint: 'Trasposizione (semitoni, tonica = F2)', min: -12, max: 24, def: 0, step: 1, unit: 'st', page: 'osc' }),
    p({ id: 'wave', label: 'WAVE', hint: 'Forma d\'onda', min: 0, max: 1, def: 0, step: 1, options: ['SAW', 'SQUARE'], page: 'osc' }),
    p({ id: 'glide', label: 'SLIDE T', hint: 'Tempo dello slide', min: 10, max: 300, def: 55, curve: 'exp', unit: 'ms', page: 'osc' }),
    p({ id: 'cutoff', label: 'CUTOFF', hint: 'Frequenza di taglio (24 dB/oct)', min: 60, max: 8000, def: 380, curve: 'exp', unit: 'Hz', page: 'filter' }),
    p({ id: 'reso', label: 'RESO', hint: 'Risonanza: il "fischio" acido', min: 0.5, max: 26, def: 15, page: 'filter' }),
    p({ id: 'egint', label: 'EG INT', hint: 'Inviluppo sul filtro', min: 0, max: 1, def: 0.55, page: 'filter' }),
    p({ id: 'accent', label: 'ACCENT', hint: 'Forza degli accenti', min: 0, max: 1, def: 0.7, page: 'env' }),
    p({ id: 'decay', label: 'DECAY', hint: 'Decadimento inviluppo filtro', min: 30, max: 2500, def: 320, curve: 'exp', unit: 'ms', page: 'env' }),
    p({ id: 'lfoRate', label: 'LFO RATE', hint: 'Velocità LFO sul filtro (sincronizzato)', min: 0, max: 6, def: 1, step: 1, options: ['4 BAR', '2 BAR', '1 BAR', '1/2', '1/4', '1/8', '1/16'], page: 'mod' }),
    p({ id: 'lfoAmt', label: 'LFO AMT', hint: 'Profondità LFO sul filtro', min: 0, max: 1, def: 0, page: 'mod' }),
  ],
};

/** Durata in battute (beat da 1/4) delle opzioni LFO RATE */
export const LFO_BEATS = [16, 8, 4, 2, 1, 0.5, 0.25];

/** Le 8 manopole della sezione SOUND del pannello, per tipo di parte */
export const KNOB_MAP: Record<PartType, (string | null)[]> = {
  kick: ['tune', 'pamt', 'pdec', 'attack', 'decay', 'tone', 'shape', 'wave'],
  snare: ['tune', 'pamt', 'snap', 'tone', 'reso', 'decay', null, null],
  clap: ['tone', 'reso', 'spread', 'decay', null, null, null, null],
  hat: ['tune', 'color', 'tone', 'reso', 'decay', null, null, null],
  ohat: ['tune', 'color', 'tone', 'reso', 'decay', null, null, null],
  perc: ['tune', 'pamt', 'pdec', 'fm', 'ratio', 'noise', 'decay', null],
  bass: ['tune', 'wave', 'glide', 'cutoff', 'reso', 'egint', 'decay', 'lfoAmt'],
  acid: ['tune', 'glide', 'cutoff', 'reso', 'egint', 'decay', 'accent', 'lfoAmt'],
};

export const TYPE_LABEL: Record<PartType, string> = {
  kick: 'KICK', snare: 'SNARE', clap: 'CLAP', hat: 'C.HAT', ohat: 'O.HAT', perc: 'PERC', bass: 'BASS', acid: 'ACID',
};

export const isMelodic = (t: PartType) => t === 'bass' || t === 'acid';

const cache = new Map<PartType, ParamDef[]>();
export function paramsFor(type: PartType): ParamDef[] {
  let list = cache.get(type);
  if (!list) {
    list = [...TYPE_PARAMS[type], ...COMMON_PARAMS];
    cache.set(type, list);
  }
  return list;
}

export function paramDef(type: PartType, id: string): ParamDef | undefined {
  return paramsFor(type).find((d) => d.id === id);
}

export function defaultParams(type: PartType): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of paramsFor(type)) out[d.id] = d.def;
  return out;
}

// --- conversioni valore <-> posizione normalizzata (0..1) per manopole/rotella ---

export function toNorm(d: ParamDef, v: number): number {
  if (d.curve === 'exp') return Math.log(v / d.min) / Math.log(d.max / d.min);
  return (v - d.min) / (d.max - d.min);
}

export function fromNorm(d: ParamDef, n: number): number {
  const c = Math.min(1, Math.max(0, n));
  let v = d.curve === 'exp' ? d.min * Math.pow(d.max / d.min, c) : d.min + c * (d.max - d.min);
  if (d.step) v = Math.round(v / d.step) * d.step;
  return clampParam(d, v);
}

export function clampParam(d: ParamDef, v: number): number {
  if (!Number.isFinite(v)) return d.def;
  return Math.min(d.max, Math.max(d.min, v));
}

export function formatParam(d: ParamDef, v: number): string {
  if (d.options) return d.options[Math.round(v)] ?? '?';
  if (d.id === 'pan') {
    if (Math.abs(v) < 0.02) return 'C';
    return (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100);
  }
  if (!d.unit) return d.max > 1 ? v.toFixed(1) : String(Math.round(v * 100));
  if (d.unit === 'Hz' && v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 1 : 2) + 'k';
  if (d.unit === 'st') return (v > 0 ? '+' : '') + Math.round(v) + d.unit;
  return Math.round(v) + d.unit;
}

/** Incremento "di un click" (rotella VALUE, +/-) in spazio normalizzato o a step interi */
export function nudge(d: ParamDef, v: number, dir: number, fine = false): number {
  if (d.step) return clampParam(d, v + dir * d.step);
  const n = toNorm(d, v) + dir * (fine ? 0.002 : 0.01);
  return fromNorm(d, n);
}
