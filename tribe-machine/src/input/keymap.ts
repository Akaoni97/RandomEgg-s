// Mappatura tastiera. Si usano i codici FISICI dei tasti (KeyboardEvent.code):
// la griglia 1234/QWER/ASDF/ZXCV resta la stessa anche su tastiere AZERTY/QWERTZ.

import { loadJSON, saveJSON } from '../state/storage';

export type ActionId =
  | 'play' | 'stop' | `step${number}`
  | 'partPrev' | 'partNext' | 'paramPrev' | 'paramNext' | 'valUp' | 'valDown'
  | 'pagePrev' | 'pageNext' | 'mode' | 'mute' | 'solo' | 'tap'
  | 'bankPrev' | 'bankNext' | 'patPrev' | 'patNext'
  | 'help' | 'zoom' | 'enter' | 'exit' | 'clear' | 'slide' | 'fullscreen';

export const STEP_CODES = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR',
  'KeyA', 'KeyS', 'KeyD', 'KeyF',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV',
];

export interface ActionInfo {
  id: ActionId;
  label: string;
  group: 'TRASPORTO' | 'STEP / PAD' | 'NAVIGAZIONE' | 'PARTI' | 'SISTEMA';
  def: string[];
}

export const ACTIONS: ActionInfo[] = [
  { id: 'play', label: 'Play / Pausa', group: 'TRASPORTO', def: ['Space'] },
  { id: 'stop', label: 'Stop (2 volte = silenzia tutto)', group: 'TRASPORTO', def: ['Escape'] },
  { id: 'tap', label: 'Tap tempo', group: 'TRASPORTO', def: ['KeyT'] },
  { id: 'patPrev', label: 'Pattern precedente (in coda)', group: 'TRASPORTO', def: ['PageDown'] },
  { id: 'patNext', label: 'Pattern successivo (in coda)', group: 'TRASPORTO', def: ['PageUp'] },
  ...STEP_CODES.map((c, i) => ({ id: `step${i}` as ActionId, label: `Step ${i + 1} / Pad ${i + 1}`, group: 'STEP / PAD' as const, def: [c] })),
  { id: 'mode', label: 'Modalità tastiera STEP ↔ LIVE', group: 'STEP / PAD', def: ['Tab'] },
  { id: 'bankPrev', label: 'Banco step precedente (1-16 / 17-32 …)', group: 'STEP / PAD', def: ['KeyO'] },
  { id: 'bankNext', label: 'Banco step successivo', group: 'STEP / PAD', def: ['KeyP'] },
  { id: 'slide', label: 'Slide sullo step tenuto / selezionato', group: 'STEP / PAD', def: ['KeyG'] },
  { id: 'clear', label: 'Cancella parte (Shift = pattern)', group: 'STEP / PAD', def: ['Delete'] },
  { id: 'partPrev', label: 'Parte precedente', group: 'PARTI', def: ['ArrowUp'] },
  { id: 'partNext', label: 'Parte successiva', group: 'PARTI', def: ['ArrowDown'] },
  { id: 'mute', label: 'Mute parte selezionata', group: 'PARTI', def: ['KeyM'] },
  { id: 'solo', label: 'Solo parte selezionata', group: 'PARTI', def: ['KeyN'] },
  { id: 'paramPrev', label: 'Parametro precedente', group: 'NAVIGAZIONE', def: ['ArrowLeft'] },
  { id: 'paramNext', label: 'Parametro successivo', group: 'NAVIGAZIONE', def: ['ArrowRight'] },
  { id: 'valUp', label: 'Valore + (Shift = fine)', group: 'NAVIGAZIONE', def: ['Equal', 'NumpadAdd'] },
  { id: 'valDown', label: 'Valore − (Shift = fine)', group: 'NAVIGAZIONE', def: ['Minus', 'NumpadSubtract'] },
  { id: 'pagePrev', label: 'Pagina LCD precedente', group: 'NAVIGAZIONE', def: ['Comma'] },
  { id: 'pageNext', label: 'Pagina LCD successiva', group: 'NAVIGAZIONE', def: ['Period'] },
  { id: 'enter', label: 'ENTER (esegue la voce)', group: 'NAVIGAZIONE', def: ['Enter', 'NumpadEnter'] },
  { id: 'exit', label: 'EXIT (torna a PATTERN)', group: 'NAVIGAZIONE', def: ['Backspace'] },
  { id: 'help', label: 'Aiuto comandi', group: 'SISTEMA', def: ['KeyH', 'F1'] },
  { id: 'zoom', label: 'Zoom display', group: 'SISTEMA', def: ['F2'] },
  { id: 'fullscreen', label: 'Schermo intero', group: 'SISTEMA', def: ['F11'] },
];

/** Combinazioni fisse (non riassegnabili) */
export const FIXED_COMBOS: [string, string][] = [
  ['Shift + Spazio', 'Registrazione ON/OFF'],
  ['Shift + Step', 'Accento sullo step (LIVE: colpo accentato)'],
  ['Tieni Step + +/−', 'Nota dello step (Shift = ottava)'],
  ['Ctrl + S', 'Salva (WRITE nello slot)'],
  ['Ctrl + C / Ctrl + V', 'Copia / incolla pattern'],
  ['Tasti + e − del layout', 'Funzionano anche su tastiera italiana'],
];

const STORAGE = 'tm.keymap.v1';

export type KeyMap = Record<string, string[]>;

export function defaultKeymap(): KeyMap {
  const m: KeyMap = {};
  for (const a of ACTIONS) m[a.id] = [...a.def];
  return m;
}

let keymap: KeyMap = (() => {
  const saved = loadJSON<KeyMap>(STORAGE);
  const m = defaultKeymap();
  if (saved) for (const k of Object.keys(m)) if (Array.isArray(saved[k])) m[k] = saved[k].filter((c) => typeof c === 'string');
  return m;
})();

let reverse = buildReverse();
const listeners = new Set<() => void>();

function buildReverse() {
  const r = new Map<string, ActionId>();
  for (const [id, codes] of Object.entries(keymap)) for (const c of codes) r.set(c, id as ActionId);
  return r;
}

export const getKeymap = () => keymap;
export const actionForCode = (code: string) => reverse.get(code);
export const codesFor = (id: ActionId) => keymap[id] ?? [];

export function subscribeKeymap(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function commit(m: KeyMap) {
  keymap = m;
  reverse = buildReverse();
  saveJSON(STORAGE, keymap);
  listeners.forEach((f) => f());
}

/** Assegna un tasto a un'azione, togliendolo da eventuali altre azioni (niente conflitti) */
export function rebind(id: ActionId, code: string) {
  const m: KeyMap = {};
  for (const [k, v] of Object.entries(keymap)) m[k] = v.filter((c) => c !== code);
  m[id] = [code];
  commit(m);
}

export function resetKeymap() {
  commit(defaultKeymap());
}

// ---------------------------------------------------------------------------
// etichette dei tasti secondo il layout reale (Chrome/Edge espongono la mappa)
// ---------------------------------------------------------------------------

let layout: Map<string, string> | null = null;
export async function loadLayoutMap() {
  try {
    const kb = (navigator as any).keyboard;
    if (kb?.getLayoutMap) {
      layout = await kb.getLayoutMap();
      listeners.forEach((f) => f());
    }
  } catch { /* non supportato */ }
}

const NAMES: Record<string, string> = {
  Space: 'SPAZIO', Escape: 'ESC', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Tab: 'TAB', Enter: 'ENTER', NumpadEnter: 'NUM ENT', Backspace: '⌫', Delete: 'CANC',
  PageUp: 'PAG↑', PageDown: 'PAG↓', NumpadAdd: 'NUM +', NumpadSubtract: 'NUM −', Equal: '=', Minus: '-',
  Comma: ',', Period: '.',
};

const LAYOUT_DEPENDENT = new Set(['Equal', 'Minus', 'Comma', 'Period']);

export function keyLabel(code: string): string {
  const l = layout?.get(code)?.trim();
  if (NAMES[code] && !(LAYOUT_DEPENDENT.has(code) && l)) return NAMES[code];
  if (l) return l.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.toUpperCase();
}
