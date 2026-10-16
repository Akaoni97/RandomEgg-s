// Stato dell'applicazione (zustand). Gli aggiornamenti sono immutabili e mirati:
// cambiare una manopola crea un nuovo oggetto solo per quella parte, così il
// motore audio sa esattamente cosa riapplicare.

import { create } from 'zustand';
import { clone, makePart, makePattern, makeProject } from './factory';
import { clampParam, paramDef, TYPE_LABEL } from './params';
import { BPM_MAX, BPM_MIN, MAX_SONG, MAX_STEPS, NUM_PATTERNS, type MasterFx, type SongEntry, type PartState, type PartType, type Pattern, type Project, type Step } from './types';

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
  /** cassa dei dischi (libreria suoni del Mattone) aperta */
  crateOpen: boolean;
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
  /** song mode attivo (PLAY suona la catena di pattern) */
  songMode: boolean;
  /** voce della song selezionata / in riproduzione */
  songPos: number;
  /** ripetizione corrente della voce di song in riproduzione */
  songRep: number;
  /** campo di testo aperto per rinominare */
  rename: { target: 'pattern' | 'project' | 'part'; value: string } | null;
  midi: { enabled: boolean; inputs: string[] };
  canUndo: boolean;
  canRedo: boolean;
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
  crateOpen: false,
  powered: false,
  dirty: false,
  held: {},
  shift: false,
  slot: 0,
  presetSel: 0,
  wavBars: 8,
  confirm: null,
  latencyMs: 0,
  songMode: false,
  songPos: 0,
  songRep: 0,
  rename: null,
  midi: { enabled: false, inputs: [] },
  canUndo: false,
  canRedo: false,
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

  setPartSample(pi: number, sampleId: string, name: string) {
    const old = curPattern().parts[pi];
    const base = old.type === 'sample' ? old : { ...makePart('sample'), steps: old.steps, mute: old.mute, solo: old.solo };
    updatePart(pi, () => ({ ...base, sampleId, name: name.slice(0, 8) }));
    const s = get();
    if (!s.project.samples.some((x) => x.id === sampleId)) {
      set({ project: { ...s.project, samples: [...s.project.samples, { id: sampleId, name }] } });
    }
  },

  /** Scrive un valore nella motion sequence della parte allo step indicato */
  recordMotion(pi: number, id: string, step: number, v: number) {
    updatePart(pi, (p) => {
      const lane = (p.motion[id] ?? new Array(MAX_STEPS).fill(null)).slice();
      lane[step] = v;
      return { ...p, motion: { ...p.motion, [id]: lane } };
    });
  },

  clearMotion(pi: number, id?: string) {
    updatePart(pi, (p) => {
      if (!id) return { ...p, motion: {} };
      const m = { ...p.motion };
      delete m[id];
      return { ...p, motion: m };
    });
  },

  rename(target: 'pattern' | 'project' | 'part', value: string) {
    const v = value.toUpperCase().replace(/[^A-Z0-9 .#&+_!-]/g, '').trim();
    if (!v) return;
    const s = get();
    if (target === 'project') set({ project: { ...s.project, name: v.slice(0, 24) }, dirty: true });
    else if (target === 'pattern') updatePattern((p) => ({ ...p, name: v.slice(0, 16) }));
    else updatePart(s.selectedPart, (p) => ({ ...p, name: v.slice(0, 8) }));
  },

  // --- song ---
  setSong(song: SongEntry[]) {
    const s = get();
    set({ project: { ...s.project, song: song.slice(0, MAX_SONG) }, dirty: true });
  },

  songEdit(pos: number, patch: Partial<SongEntry>) {
    const song = get().project.song.slice();
    if (!song[pos]) return;
    const e = { ...song[pos], ...patch };
    e.pattern = (e.pattern + NUM_PATTERNS) % NUM_PATTERNS;
    e.repeats = Math.min(16, Math.max(1, e.repeats));
    song[pos] = e;
    actions.setSong(song);
  },

  songInsert(pos: number) {
    const song = get().project.song.slice();
    if (song.length >= MAX_SONG) { flash('SONG FULL (64)'); return; }
    const src = song[pos] ?? { pattern: get().project.current, repeats: 1 };
    song.splice(pos + 1, 0, { ...src });
    actions.setSong(song);
    set({ songPos: pos + 1 });
  },

  songDelete(pos: number) {
    const song = get().project.song.slice();
    if (song.length <= 1) { flash('SONG: MIN 1 VOCE'); return; }
    song.splice(pos, 1);
    actions.setSong(song);
    set({ songPos: Math.min(pos, song.length - 1) });
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
