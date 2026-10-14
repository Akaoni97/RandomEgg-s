// Stato dell'applicazione (zustand). Gli aggiornamenti sono immutabili e mirati:
// cambiare una manopola crea un nuovo oggetto solo per quella parte, così il
// motore audio sa esattamente cosa riapplicare.

import { create } from 'zustand';
import { clone, makePart, makePattern, makeProject } from './factory';
import { clampParam, paramDef, TYPE_LABEL } from './params';
import { BPM_MAX, BPM_MIN, NUM_PATTERNS, type MasterFx, type PartState, type PartType, type Pattern, type Project, type Step } from './types';

export type PageId = 'pattern' | 'osc' | 'filter' | 'env' | 'mod' | 'partfx' | 'master' | 'step' | 'song' | 'global' | 'file';

export const PAGE_ORDER: PageId[] = ['pattern', 'osc', 'filter', 'env', 'mod', 'partfx', 'master', 'step', 'song', 'global', 'file'];

export type KbdMode = 'step' | 'live';

export interface AppState {
  project: Project;
  selectedPart: number;
  page: PageId;
  cursor: number;
  kbdMode: KbdMode;
  playing: boolean;
  recording: boolean;
  queuedPattern: number | null;
  /** banco di 16 step visualizzato (0..3) */
  stepPage: number;
  /** segue automaticamente il banco in riproduzione */
  follow: boolean;
  /** step selezionato per la pagina STEP EDIT */
  selectedStep: number;
  clipboard: Pattern | null;
  message: { text: string; until: number } | null;
  lcdZoom: boolean;
  help: boolean;
  keymapOpen: boolean;
  powered: boolean;
  dirty: boolean;
  /** tasti fisici attualmente premuti (per evidenziare i tasti virtuali) */
  held: Record<string, true>;
  shift: boolean;
  /** slot di salvataggio locale selezionato (0..7) */
  slot: number;
  presetSel: number;
  wavBars: number;
  /** azione distruttiva in attesa di conferma (premere ENTER due volte) */
  confirm: string | null;
  latencyMs: number;
}

export const usePlayhead = create<{ step: number; pattern: number; flash: number[] }>(() => ({
  step: -1,
  pattern: 0,
  flash: new Array(8).fill(0),
}));

const initial = (): AppState => ({
  project: makeProject(),
  selectedPart: 0,
  page: 'pattern',
  cursor: 0,
  kbdMode: 'step',
  playing: false,
  recording: false,
  queuedPattern: null,
  stepPage: 0,
  follow: true,
  selectedStep: 0,
  clipboard: null,
  message: null,
  lcdZoom: false,
  help: false,
  keymapOpen: false,
  powered: false,
  dirty: false,
  held: {},
  shift: false,
  slot: 0,
  presetSel: 0,
  wavBars: 8,
  confirm: null,
  latencyMs: 0,
});

export const useStore = create<AppState>(initial);

// ---------------------------------------------------------------------------
// helper di aggiornamento immutabile
// ---------------------------------------------------------------------------

const get = () => useStore.getState();
const set = (p: Partial<AppState>) => useStore.setState(p);

export const curPattern = (s: AppState = get()) => s.project.patterns[s.project.current];
export const curPart = (s: AppState = get()) => curPattern(s).parts[s.selectedPart];

function updatePattern(fn: (p: Pattern) => Pattern, dirty = true) {
  const s = get();
  const idx = s.project.current;
  const patterns = s.project.patterns.slice();
  patterns[idx] = fn(patterns[idx]);
  set({ project: { ...s.project, patterns }, dirty: dirty || s.dirty });
}

function updatePart(pi: number, fn: (p: PartState) => PartState) {
  updatePattern((pt) => {
    const parts = pt.parts.slice();
    parts[pi] = fn(parts[pi]);
    return { ...pt, parts };
  });
}

function updateStep(pi: number, si: number, fn: (s: Step) => Step) {
  updatePart(pi, (p) => {
    const steps = p.steps.slice();
    steps[si] = fn(steps[si]);
    return { ...p, steps };
  });
}

export function flash(text: string, ms = 1400) {
  set({ message: { text, until: performance.now() + ms } });
}

// ---------------------------------------------------------------------------
// azioni
// ---------------------------------------------------------------------------

export const actions = {
  setParam(pi: number, id: string, v: number) {
    const part = curPattern().parts[pi];
    const d = paramDef(part.type, id);
    if (!d) return;
    const val = clampParam(d, v);
    if (part.params[id] === val) return;
    updatePart(pi, (p) => ({ ...p, params: { ...p.params, [id]: val } }));
  },

  setPartType(pi: number, type: PartType) {
    const old = curPattern().parts[pi];
    if (old.type === type) return;
    updatePart(pi, () => ({ ...makePart(type), steps: old.steps, mute: old.mute, solo: old.solo, name: TYPE_LABEL[type] }));
  },

  toggleStep(pi: number, si: number) {
    updateStep(pi, si, (s) => ({ ...s, on: !s.on }));
    set({ selectedStep: si });
  },

  setStepOn(pi: number, si: number, on: boolean, note?: number) {
    updateStep(pi, si, (s) => ({ ...s, on, note: note ?? s.note }));
  },

  toggleAccent(pi: number, si: number) {
    updateStep(pi, si, (s) => ({ ...s, acc: !s.acc, on: true }));
    set({ selectedStep: si });
  },

  toggleSlide(pi: number, si: number) {
    updateStep(pi, si, (s) => ({ ...s, slide: !s.slide, on: true }));
    set({ selectedStep: si });
  },

  setStepField(pi: number, si: number, patch: Partial<Step>) {
    updateStep(pi, si, (s) => {
      const n = { ...s, ...patch };
      n.note = Math.max(-24, Math.min(24, Math.round(n.note)));
      n.gate = Math.max(0.1, Math.min(1, n.gate));
      return n;
    });
  },

  setBpm(bpm: number) {
    const v = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, bpm)) * 10) / 10;
    updatePattern((p) => ({ ...p, bpm: v }));
  },

  setSwing(sw: number) {
    updatePattern((p) => ({ ...p, swing: Math.round(Math.min(75, Math.max(50, sw))) }));
  },

  setLength(len: number) {
    const v = [16, 32, 48, 64].includes(len) ? len : 16;
    updatePattern((p) => ({ ...p, length: v }));
    if (get().stepPage * 16 >= v) set({ stepPage: 0 });
  },

  setFx(patch: Partial<MasterFx>) {
    updatePattern((p) => ({ ...p, fx: { ...p.fx, ...patch } }));
  },

  selectPart(pi: number) {
    set({ selectedPart: (pi + 8) % 8 });
  },

  toggleMute(pi: number) {
    updatePart(pi, (p) => ({ ...p, mute: !p.mute }));
  },

  toggleSolo(pi: number) {
    updatePart(pi, (p) => ({ ...p, solo: !p.solo }));
  },

  /** Selezione pattern: immediata da fermo, in coda (fine battuta) in riproduzione */
  selectPattern(idx: number) {
    const i = (idx + NUM_PATTERNS) % NUM_PATTERNS;
    const s = get();
    if (s.playing) {
      set({ queuedPattern: i === s.project.current ? null : i });
      flash(`NEXT PAT ${String(i + 1).padStart(2, '0')}`);
    } else {
      set({ project: { ...s.project, current: i }, queuedPattern: null, stepPage: 0 });
    }
  },

  /** Chiamata dal sequencer quando esegue il cambio in coda */
  commitQueued(): number {
    const s = get();
    const q = s.queuedPattern;
    if (q === null) return s.project.current;
    set({ project: { ...s.project, current: q }, queuedPattern: null, stepPage: 0 });
    return q;
  },

  copyPattern() {
    set({ clipboard: clone(curPattern()) });
    flash('PATTERN COPIED');
  },

  pastePattern() {
    const c = get().clipboard;
    if (!c) { flash('CLIPBOARD EMPTY'); return; }
    updatePattern(() => clone(c));
    flash('PATTERN PASTED');
  },

  clearPart(pi: number) {
    updatePart(pi, (p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, on: false, acc: false, slide: false })) }));
    flash(`CLEAR ${curPattern().parts[pi].name}`);
  },

  clearPattern() {
    updatePattern((p) => {
      const fresh = makePattern('INIT');
      fresh.bpm = p.bpm;
      return fresh;
    });
    flash('PATTERN CLEARED');
  },

  loadProject(p: Project, msg = 'LOADED') {
    set({ project: p, queuedPattern: null, stepPage: 0, selectedStep: 0, dirty: false });
    flash(msg);
  },

  setPage(page: PageId) {
    set({ page, cursor: 0 });
  },

  movePage(dir: number) {
    const i = PAGE_ORDER.indexOf(get().page);
    set({ page: PAGE_ORDER[(i + dir + PAGE_ORDER.length) % PAGE_ORDER.length], cursor: 0 });
  },
};

export type Actions = typeof actions;
