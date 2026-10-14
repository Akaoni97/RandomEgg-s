// Libreria di preset originali. Ogni preset è un progetto con due pattern
// (A = groove principale, B = variazione) costruiti da zero per questa macchina.
// I nomi indicano categorie sonore, non brani esistenti.

import { makePart, makePattern, makeProject } from './factory';
import type { PartState, PartType, Pattern, Project } from './types';

/** 'x' = colpo, 'X' = colpo accentato, '.' o '-' = pausa. Spazi e '|' ignorati. */
function drum(part: PartState, grid: string, notes: number[] = []) {
  const g = grid.replace(/[\s|]/g, '');
  let k = 0;
  for (let i = 0; i < g.length && i < 64; i++) {
    const c = g[i];
    if (c === 'x' || c === 'X') {
      part.steps[i] = { on: true, acc: c === 'X', slide: false, note: notes.length ? notes[k++ % notes.length] : 0, gate: 0.6 };
    }
  }
  return part;
}

/**
 * Linea melodica: token separati da spazi. '.' = pausa,
 * numero = semitoni dalla tonica, suffissi: a = accento, s = slide, g = gate lungo.
 */
function line(part: PartState, src: string) {
  const toks = src.replace(/\|/g, ' ').trim().split(/\s+/);
  toks.slice(0, 64).forEach((t, i) => {
    if (t === '.' || t === '-') return;
    const m = /^(-?\d+)([asg]*)$/.exec(t);
    if (!m) return;
    const flags = m[2];
    part.steps[i] = { on: true, acc: flags.includes('a'), slide: flags.includes('s'), note: +m[1], gate: flags.includes('g') ? 0.95 : 0.5 };
  });
  return part;
}

function setP(part: PartState, p: Record<string, number>) {
  Object.assign(part.params, p);
  return part;
}

function base(name: string, bpm: number, swing: number, types?: PartType[]): Pattern {
  const pt = makePattern(name);
  pt.bpm = bpm;
  pt.swing = swing;
  if (types) pt.parts = types.map((t) => makePart(t));
  return pt;
}

const dup = (p: Pattern, name: string): Pattern => ({ ...JSON.parse(JSON.stringify(p)), name });
const clearSteps = (part: PartState) => part.steps.forEach((s) => { s.on = false; s.acc = false; s.slide = false; });

// ---------------------------------------------------------------------------

function oldSchoolTribe(): Project {
  const A = base('OLDSCHOOL TRIBE', 172, 52);
  const [kick, snare, clap, hat, ohat, perc, bass, acid] = A.parts;
  setP(kick, { tune: 52, pamt: 38, pdec: 32, decay: 420, attack: 0.55, tone: 5200, shape: 0.35, drive: 0.45, level: 0.9 });
  drum(kick, 'X...X...X...X...');
  setP(snare, { tune: 210, snap: 0.75, decay: 140, tone: 6500, rev: 0.25, level: 0.55 });
  drum(snare, '................');
  setP(clap, { tone: 1500, decay: 220, rev: 0.3, level: 0.5 });
  drum(clap, '....x.......x...');
  setP(hat, { tone: 8500, decay: 32, color: 0.45, level: 0.5, pan: 0.15 });
  drum(hat, 'x.xX x.xX x.xX x.xx');
  setP(ohat, { decay: 260, tone: 7000, level: 0.55, pan: -0.1 });
  drum(ohat, '..x...x...x...x.');
  // tom tribali con altezze diverse per step
  setP(perc, { tune: 150, pamt: 14, pdec: 45, decay: 240, fm: 0.12, ratio: 1, noise: 0.15, drive: 0.25, dly: 0.25, level: 0.6, pan: -0.25 });
  drum(perc, 'x..x..x...x.x..x', [0, 7, 3, 0, 12, 7]);
  setP(bass, { wave: 2, sub: 0.5, cutoff: 420, reso: 5, egint: 0.5, decay: 160, drive: 0.35, level: 0.72 });
  line(bass, '. 0 0 0 | . 0 0 0 | . 0 0 12 | . 0 0 0');
  // ACID lasciato vuoto: pronto per scriverci sopra la propria linea
  setP(acid, { cutoff: 450, reso: 16, level: 0.6 });
  A.fx = { ...A.fx, delayDiv: 5, delayFb: 0.4, revSize: 0.5 };

  const B = dup(A, 'TRIBE BREAK');
  const [bk, , bclap, , , bperc, bbass] = B.parts;
  clearSteps(bk);
  drum(bk, 'X...............');
  clearSteps(bclap);
  drum(bclap, '....x.......x.xx');
  clearSteps(bperc);
  drum(bperc, 'x.xx..x.xx.x.xxx', [0, 3, 7, 0, 12, 10, 7, 3]);
  setP(bbass, { cutoff: 900 });
  B.fx = { ...B.fx, filter: 0.25 };

  return pack('OLD SCHOOL TRIBE', [A, B]);
}

function freetekHypnotic(): Project {
  const A = base('HYPNOTIC', 176, 50);
  const [kick, , clap, hat, ohat, perc, bass, acid] = A.parts;
  setP(kick, { tune: 49, pamt: 34, pdec: 40, decay: 500, attack: 0.4, shape: 0.25, drive: 0.35, level: 0.9 });
  drum(kick, 'X...X...X...X...');
  setP(clap, { tone: 1200, decay: 300, rev: 0.45, dly: 0.15, level: 0.45 });
  drum(clap, '............x...');
  setP(hat, { decay: 28, tone: 9000, level: 0.45 });
  drum(hat, 'xxXx xxXx xxXx xxXx');
  setP(ohat, { decay: 300, level: 0.5 });
  drum(ohat, '..x...x...x...x.');
  setP(perc, { tune: 620, fm: 0.55, ratio: 4, pamt: 3, decay: 90, dly: 0.45, rev: 0.2, level: 0.42, pan: 0.35 });
  drum(perc, '...x.....x....x.');
  setP(bass, { wave: 2, sub: 0.45, cutoff: 360, reso: 6, egint: 0.55, decay: 140, drive: 0.3, level: 0.7 });
  line(bass, '. 0 0 0 | . 0 0 0 | . 0 0 0 | . 0 3 0');
  setP(acid, { cutoff: 420, reso: 17, egint: 0.5, decay: 380, accent: 0.75, drive: 0.4, dly: 0.3, lfoRate: 0, lfoAmt: 0.35, level: 0.62, pan: -0.1 });
  line(acid, '0 0 12s 0 | 3 0 0 10a | 0 0 12 0s | 7 5a 3 0');
  A.fx = { ...A.fx, delayDiv: 3, delayFb: 0.45, revSize: 0.55 };

  const B = dup(A, 'HYPNO VAR');
  const bacid = B.parts[7];
  clearSteps(bacid);
  line(bacid, '0a 0 0 0s | 1 0 0 0 | 12a 0 0s 1 | 0 0 13s 12');
  setP(bacid, { cutoff: 700, reso: 20 });
  return pack('FREETEKNO HYPNOTIC', [A, B]);
}

function mentalAcid(): Project {
  const A = base('MENTAL ACID', 186, 50);
  const [kick, snare, , hat, ohat, perc, bass, acid] = A.parts;
  setP(kick, { tune: 54, pamt: 42, pdec: 28, decay: 360, attack: 0.6, shape: 0.55, drive: 0.6, level: 0.88 });
  drum(kick, 'X...X...X...X...');
  setP(snare, { tune: 240, snap: 0.85, decay: 110, tone: 8000, rev: 0.2, level: 0.45 });
  drum(snare, '....x.......x..x');
  setP(hat, { decay: 22, tone: 10000, color: 0.7, level: 0.4 });
  drum(hat, 'x.x.x.x.x.x.x.x.');
  setP(ohat, { decay: 220, level: 0.45, pan: 0.2 });
  drum(ohat, '..x...x...x...x.');
  setP(perc, { tune: 900, fm: 0.8, ratio: 6, decay: 60, level: 0.3, dly: 0.5 });
  drum(perc, '..........x.....');
  setP(bass, { wave: 3, sub: 0.6, cutoff: 260, reso: 3, egint: 0.4, decay: 120, drive: 0.4, level: 0.68 });
  line(bass, '. 0 . 0 | . 0 . 0 | . 0 . 0 | . 0 . 0');
  setP(acid, { cutoff: 300, reso: 23, egint: 0.7, decay: 260, accent: 0.9, drive: 0.65, dly: 0.2, lfoRate: 1, lfoAmt: 0.45, level: 0.6 });
  line(acid, '0a 12s 0 0 | 1s 0 13a 0 | 0 0s 6 0a | 12s 0 1 0s');
  A.fx = { ...A.fx, delayDiv: 4, delayFb: 0.5, revSize: 0.35, crush: 0.08 };

  const B = dup(A, 'MENTAL 2');
  const bacid = B.parts[7];
  clearSteps(bacid);
  line(bacid, '0a 0 0s 12 | 0 0a 0 0s | 13 12 0a 0 | 6s 7 0a 0s');
  setP(bacid, { cutoff: 520, decay: 180 });
  B.parts[1].steps.forEach((s, i) => { s.on = i % 4 === 2 && i > 7; });
  return pack('MENTAL ACID', [A, B]);
}

function industrial(): Project {
  const A = base('INDUSTRIAL', 168, 50, ['kick', 'snare', 'clap', 'hat', 'ohat', 'perc', 'bass', 'perc']);
  const [kick, snare, clap, hat, ohat, perc, bass, metal] = A.parts;
  setP(kick, { tune: 46, pamt: 46, pdec: 22, decay: 300, attack: 0.8, shape: 0.85, tone: 3800, drive: 0.75, level: 0.85 });
  drum(kick, 'X...X...X...X..x');
  setP(snare, { tune: 160, snap: 0.9, decay: 260, tone: 4000, reso: 2.5, drive: 0.6, rev: 0.5, level: 0.45 });
  drum(snare, '....x.......x...');
  setP(clap, { tone: 900, reso: 4, decay: 400, rev: 0.4, level: 0.35 });
  drum(clap, '..............x.');
  setP(hat, { decay: 40, tone: 6000, color: 0.9, reso: 3, level: 0.45, drive: 0.4 });
  drum(hat, 'xxxX xxxX xxxX xxxX');
  setP(ohat, { decay: 180, color: 0.95, level: 0.35 });
  drum(ohat, '..x...x...x...x.');
  setP(perc, { tune: 95, pamt: 20, pdec: 60, decay: 350, fm: 0.4, ratio: 0, noise: 0.3, drive: 0.6, level: 0.5 });
  drum(perc, '.......x.....x..', [0, -5]);
  setP(bass, { wave: 3, sub: 0.3, cutoff: 700, reso: 9, egint: 0.35, decay: 100, drive: 0.7, level: 0.6 });
  line(bass, '. 0 . 0 | . 0 . 0 | . 0 . 0 | . 0 . 1');
  metal.name = 'METAL';
  setP(metal, { tune: 380, fm: 0.95, ratio: 6, pamt: 0, decay: 160, noise: 0.4, drive: 0.5, dly: 0.55, rev: 0.3, level: 0.33, pan: 0.4 });
  drum(metal, '...x..x....x..x.');
  A.fx = { ...A.fx, delayDiv: 5, delayFb: 0.55, revSize: 0.7, crush: 0.15 };

  const B = dup(A, 'FACTORY');
  clearSteps(B.parts[0]);
  drum(B.parts[0], 'X..xX...X..xX.x.');
  B.fx = { ...B.fx, crush: 0.35 };
  return pack('INDUSTRIAL TEKNO', [A, B]);
}

function hardtek(): Project {
  const A = base('HARDTEK PUMP', 192, 50);
  const [kick, snare, clap, hat, ohat, perc, bass, acid] = A.parts;
  setP(kick, { tune: 44, pamt: 40, pdec: 45, decay: 720, attack: 0.5, shape: 0.6, tone: 6000, drive: 0.55, level: 0.92 });
  drum(kick, 'X...X...X...X...');
  setP(snare, { level: 0.4, rev: 0.3 });
  drum(snare, '................');
  setP(clap, { tone: 1400, decay: 200, level: 0.45, rev: 0.25 });
  drum(clap, '....x.......x...');
  setP(hat, { decay: 26, level: 0.42 });
  drum(hat, 'x.x.x.x.x.x.x.xX');
  setP(ohat, { decay: 240, level: 0.55 });
  drum(ohat, '..X...X...X...X.');
  setP(perc, { tune: 330, pamt: 5, fm: 0.3, ratio: 2, decay: 120, dly: 0.35, level: 0.35 });
  drum(perc, 'x......x..x.....', [0, 5, 7]);
  // basso "pumping" in levare, molto tipico
  setP(bass, { wave: 2, sub: 0.6, cutoff: 600, reso: 7, egint: 0.6, decay: 110, drive: 0.5, level: 0.7 });
  line(bass, '. . 0a 0 | . . 0a 0 | . . 0a 0 | . . 0a 3');
  setP(acid, { cutoff: 500, reso: 19, egint: 0.45, decay: 200, drive: 0.5, dly: 0.25, level: 0.5 });
  line(acid, '. . . . | 0a 0 12s 0 | . . . . | 5 3 0s 12a');
  A.fx = { ...A.fx, delayDiv: 3, delayFb: 0.35 };

  const B = dup(A, 'PUMP BUILD');
  B.parts[0].steps.forEach((s, i) => { s.on = i % 2 === 0 && i >= 8 ? true : i % 4 === 0; s.acc = i % 4 === 0; });
  B.fx = { ...B.fx, filter: 0.35 };
  return pack('HARDTEK PUMPING', [A, B]);
}

function pack(name: string, pats: Pattern[]): Project {
  const proj = makeProject();
  proj.name = name;
  pats.forEach((p, i) => { proj.patterns[i] = p; });
  return proj;
}

export interface PresetInfo {
  id: string;
  name: string;
  build: () => Project;
}

export const PRESETS: PresetInfo[] = [
  { id: 'tribe', name: 'OLD SCHOOL TRIBE', build: oldSchoolTribe },
  { id: 'hypno', name: 'FREETEKNO HYPNOTIC', build: freetekHypnotic },
  { id: 'mental', name: 'MENTAL ACID', build: mentalAcid },
  { id: 'indus', name: 'INDUSTRIAL TEKNO', build: industrial },
  { id: 'hardtek', name: 'HARDTEK PUMPING', build: hardtek },
];
