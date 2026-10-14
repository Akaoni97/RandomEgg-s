// Gestione tastiera e logica condivisa dei tasti step/pad (anche per il mouse).

import { actions, curPart, curPattern, flash, useStore } from '../state/store';
import { actionForCode, STEP_CODES } from './keymap';
import * as M from '../machine';
import { redo, undo } from '../state/history';
import { cycleSkin, toggleView } from '../ui/skins';
import { lcdCursor, lcdEnter, lcdNudge } from '../lcd/menu';

const set = useStore.setState;

// ---------------------------------------------------------------------------
// step: pressione e rilascio
// Premere uno step spento lo accende subito. Premere uno step acceso lo spegne
// al rilascio, a meno che nel frattempo non sia stato modificato (nota/slide):
// così si può "tenere premuto lo step e cambiarne la nota" come sull'hardware.
// ---------------------------------------------------------------------------

const pressedSteps = new Map<number, { wasOn: boolean; edited: boolean }>();
let lastHeld: number | null = null;

export function stepPress(k: number, shift: boolean, key: string) {
  const s = useStore.getState();
  if (s.kbdMode === 'live') {
    padPress(k, shift, key);
    return;
  }
  const pt = curPattern(s);
  const idx = s.stepPage * 16 + k;
  if (idx >= pt.length) {
    flash(`STEP ${idx + 1} > LENGTH`);
    return;
  }
  const pi = s.selectedPart;
  const st = pt.parts[pi].steps[idx];
  set({ selectedStep: idx });
  if (shift) {
    actions.toggleAccent(pi, idx);
    return;
  }
  if (!st.on) {
    actions.setStepOn(pi, idx, true);
    M.audition(pi, st.note);
    pressedSteps.set(idx, { wasOn: false, edited: false });
  } else {
    pressedSteps.set(idx, { wasOn: true, edited: false });
  }
  lastHeld = idx;
}

export function stepRelease(k: number, key: string) {
  const s = useStore.getState();
  M.liveRelease(key);
  const idx = s.stepPage * 16 + k;
  const p = pressedSteps.get(idx);
  pressedSteps.delete(idx);
  if (lastHeld === idx) lastHeld = null;
  if (p && p.wasOn && !p.edited) actions.setStepOn(s.selectedPart, idx, false);
}

function heldStep(): number | null {
  if (lastHeld !== null && pressedSteps.has(lastHeld)) return lastHeld;
  return null;
}

function editHeld(fn: (idx: number) => void): boolean {
  const idx = heldStep();
  if (idx === null) return false;
  pressedSteps.get(idx)!.edited = true;
  fn(idx);
  return true;
}

/** LIVE MODE: riga alta = parti 1-8, riga bassa = note della parte selezionata */
export function padPress(k: number, accent: boolean, key: string) {
  const s = useStore.getState();
  if (k < 8) M.livePlay(k, 0, accent, key);
  else M.livePlay(s.selectedPart, M.LIVE_SCALE[k - 8], accent, key);
}

// ---------------------------------------------------------------------------

const REPEATABLE = new Set(['valUp', 'valDown', 'paramPrev', 'paramNext', 'partPrev', 'partNext']);

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Durante la riassegnazione dei tasti il prossimo tasto viene catturato qui */
let capture: ((code: string) => void) | null = null;
export const setCapture = (fn: ((code: string) => void) | null) => { capture = fn; };

function setHeld(code: string, on: boolean) {
  const h = { ...useStore.getState().held };
  if (on) h[code] = true;
  else delete h[code];
  set({ held: h });
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* negato dal browser */ }
}

function onKeyDown(e: KeyboardEvent) {
  if (isTyping(e.target)) return;
  if (capture) {
    e.preventDefault();
    if (e.code !== 'Escape') capture(e.code);
    else capture = null;
    return;
  }
  const s = useStore.getState();
  if (e.key === 'Shift') set({ shift: true });
  if (!s.powered) {
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      e.preventDefault();
      void M.powerOn();
    }
    return;
  }
  if ((s.help || s.keymapOpen) && (e.code === 'Escape' || (s.help && e.code === 'KeyH'))) {
    e.preventDefault();
    set({ help: false, keymapOpen: false });
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    const map: Record<string, () => void> = {
      KeyS: M.writeProject,
      KeyC: actions.copyPattern,
      KeyV: actions.pastePattern,
      KeyZ: e.shiftKey ? redo : undo,
      KeyY: redo,
    };
    const fn = map[e.code];
    if (fn && !e.repeat) {
      e.preventDefault();
      fn();
    }
    return; // le altre scorciatoie di sistema restano al browser
  }
  if (e.altKey) return;

  if (e.code === 'Space' && e.shiftKey) {
    e.preventDefault();
    if (!e.repeat) M.toggleRec();
    return;
  }

  // '+' e '-' riconosciuti dal carattere: funzionano su ogni layout (es. italiano)
  let action = e.key === '+' ? 'valUp' : e.key === '-' && e.code !== 'Minus' ? 'valDown' : actionForCode(e.code);
  if (!action) return;
  e.preventDefault();
  setHeld(e.code, true);
  if (e.repeat && !REPEATABLE.has(action)) return;
  dispatch(action, e.shiftKey, e.code);
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Shift') set({ shift: false });
  if (useStore.getState().held[e.code]) setHeld(e.code, false);
  const action = actionForCode(e.code);
  if (action?.startsWith('step')) {
    stepRelease(+action.slice(4), 'kb:' + e.code);
  }
}

function onBlur() {
  // finestra che perde il fuoco: nessun tasto deve restare "incastrato"
  set({ held: {}, shift: false });
  M.releaseAllLive();
  pressedSteps.clear();
  lastHeld = null;
}

export function dispatch(action: string, shift: boolean, code = '') {
  const s = useStore.getState();
  if (action.startsWith('step')) {
    stepPress(+action.slice(4), shift, 'kb:' + code);
    return;
  }
  switch (action) {
    case 'play': M.playPause(); break;
    case 'stop': M.stop(); break;
    case 'tap': M.tap(); break;
    case 'song': M.toggleSongMode(); break;
    case 'patPrev': actions.selectPattern(s.project.current - 1); break;
    case 'patNext': actions.selectPattern(s.project.current + 1); break;
    case 'mode':
      set({ kbdMode: s.kbdMode === 'step' ? 'live' : 'step' });
      flash(s.kbdMode === 'step' ? 'LIVE MODE: PAD' : 'STEP MODE');
      break;
    case 'bankPrev':
    case 'bankNext': {
      const banks = curPattern(s).length / 16;
      const page = (s.stepPage + (action === 'bankNext' ? 1 : -1) + banks) % banks;
      set({ stepPage: page, follow: false });
      flash(`STEPS ${page * 16 + 1}-${page * 16 + 16}`);
      break;
    }
    case 'slide':
      if (!editHeld((idx) => actions.toggleSlide(s.selectedPart, idx))) actions.toggleSlide(s.selectedPart, s.selectedStep);
      break;
    case 'clear':
      if (shift) actions.clearPattern();
      else actions.clearPart(s.selectedPart);
      break;
    case 'partPrev': actions.selectPart(s.selectedPart - 1); break;
    case 'partNext': actions.selectPart(s.selectedPart + 1); break;
    case 'mute': actions.toggleMute(s.selectedPart); break;
    case 'solo': actions.toggleSolo(s.selectedPart); break;
    case 'paramPrev': lcdCursor(-1); break;
    case 'paramNext': lcdCursor(1); break;
    case 'valUp':
    case 'valDown': {
      const dir = action === 'valUp' ? 1 : -1;
      const edited = s.kbdMode === 'step' && editHeld((idx) => {
        const st = curPart().steps[idx];
        actions.setStepField(s.selectedPart, idx, { note: st.note + dir * (shift ? 12 : 1) });
        const nn = Math.max(-24, Math.min(24, st.note + dir * (shift ? 12 : 1)));
        M.audition(s.selectedPart, nn);
        flash(`STEP ${idx + 1} NOTE ${nn > 0 ? '+' : ''}${nn}`, 900);
      });
      if (!edited) lcdNudge(dir, shift);
      break;
    }
    case 'pagePrev': actions.movePage(-1); break;
    case 'pageNext': actions.movePage(1); break;
    case 'enter': lcdEnter(); break;
    case 'exit': set({ page: 'pattern', cursor: 0, confirm: null, lcdZoom: false }); break;
    case 'help': set({ help: !s.help }); break;
    case 'zoom': set({ lcdZoom: !s.lcdZoom }); break;
    case 'view': toggleView(); break;
    case 'shell': cycleSkin(shift ? -1 : 1); break;
    case 'fullscreen': void toggleFullscreen(); break;
  }
}

export { toggleFullscreen };

export function installKeyboard() {
  window.addEventListener('keydown', onKeyDown, { capture: true });
  window.addEventListener('keyup', onKeyUp, { capture: true });
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', () => { if (document.hidden) onBlur(); });
}

export { STEP_CODES };
