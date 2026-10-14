// Sistema di menu del display LCD. Ogni pagina è una lista di voci;
// le frecce sinistra/destra scorrono le voci, la rotella VALUE e +/- le modificano,
// ENTER esegue le voci-azione.

import { DELAY_DIVS, PART_TYPES } from '../state/types';
import { formatParam, nudge, paramsFor, toNorm, TYPE_LABEL, type LcdPage } from '../state/params';
import { actions, curPattern, flash, useStore, type AppState, type PageId } from '../state/store';
import { PRESETS } from '../state/presets';
import { NUM_SLOTS, slotName } from '../state/storage';
import * as M from '../machine';

export interface LcdItem {
  label: string;
  value: string;
  norm?: number;
  bipolar?: boolean;
  hint?: string;
  nudge?: (dir: number, fine: boolean) => void;
  enter?: () => void;
}

export interface LcdPageView {
  title: string;
  items: LcdItem[];
}

export const PAGE_TITLE: Record<PageId, string> = {
  pattern: 'PATTERN',
  osc: 'SOUND/OSC',
  filter: 'FILTER',
  env: 'ENVELOPE',
  mod: 'MODULATION',
  partfx: 'PART FX/MIX',
  master: 'MASTER FX',
  step: 'STEP EDIT',
  song: 'SONG',
  global: 'GLOBAL',
  file: 'SAVE/LOAD',
};

const set = useStore.setState;
const cycle = (v: number, d: number, n: number) => (v + d + n) % n;
const onOff = (b: boolean) => (b ? 'ON' : 'OFF');

/** Azione distruttiva: va confermata premendo ENTER una seconda volta */
function confirmed(id: string, label: string, fn: () => void) {
  return () => {
    if (useStore.getState().confirm === id) {
      set({ confirm: null });
      fn();
    } else {
      set({ confirm: id });
      flash(`${label}? ENTER=OK`, 2500);
    }
  };
}

function partParamItems(s: AppState, page: LcdPage): LcdItem[] {
  const pi = s.selectedPart;
  const part = curPattern(s).parts[pi];
  return paramsFor(part.type)
    .filter((d) => d.page === page)
    .map((d) => ({
      label: d.label,
      value: formatParam(d, part.params[d.id]),
      norm: toNorm(d, part.params[d.id]),
      bipolar: d.min < 0,
      hint: d.hint,
      nudge: (dir, fine) => actions.setParam(pi, d.id, nudge(d, part.params[d.id], dir, fine)),
    }));
}

export function buildPage(s: AppState): LcdPageView {
  const pt = curPattern(s);
  const title = PAGE_TITLE[s.page];
  const fx = pt.fx;
  switch (s.page) {
    case 'pattern':
      return {
        title,
        items: [
          {
            label: 'PATTERN', value: String(s.project.current + 1).padStart(2, '0') + ' ' + pt.name,
            nudge: (d) => actions.selectPattern(s.project.current + d), hint: 'Cambio sincronizzato a fine battuta in riproduzione',
          },
          {
            label: 'TEMPO', value: pt.bpm.toFixed(1) + ' BPM', norm: (pt.bpm - 60) / 200,
            nudge: (d, fine) => actions.setBpm(pt.bpm + d * (fine ? 0.1 : 1)),
          },
          { label: 'SWING', value: pt.swing + '%', norm: (pt.swing - 50) / 25, nudge: (d) => actions.setSwing(pt.swing + d) },
          {
            label: 'LENGTH', value: pt.length + ' STEPS', norm: pt.length / 64,
            nudge: (d) => actions.setLength(Math.min(64, Math.max(16, pt.length + d * 16))),
          },
          { label: 'KBD MODE', value: s.kbdMode.toUpperCase(), nudge: () => set({ kbdMode: s.kbdMode === 'step' ? 'live' : 'step' }) },
        ],
      };
    case 'osc': {
      const part = pt.parts[s.selectedPart];
      return {
        title,
        items: [
          {
            label: 'PART TYPE', value: TYPE_LABEL[part.type], hint: 'Cambia il motore sonoro della parte (i parametri tornano ai valori base)',
            nudge: (d) => actions.setPartType(s.selectedPart, PART_TYPES[cycle(PART_TYPES.indexOf(part.type), d, PART_TYPES.length)]),
          },
          ...partParamItems(s, 'osc'),
        ],
      };
    }
    case 'filter':
    case 'env':
    case 'mod': {
      const items = partParamItems(s, s.page);
      return { title, items: items.length ? items : [{ label: '--', value: 'NO PARAMS' }] };
    }
    case 'partfx':
      return { title, items: partParamItems(s, 'fx') };
    case 'master':
      return {
        title,
        items: [
          {
            label: 'M.FILTER', value: fx.filter === 0 ? 'OFF' : (fx.filter < 0 ? 'LPF ' : 'HPF ') + Math.round(Math.abs(fx.filter) * 100),
            norm: (fx.filter + 1) / 2, bipolar: true, nudge: (d, f) => actions.setFx({ filter: clamp(fx.filter + d * (f ? 0.005 : 0.02), -1, 1) }),
          },
          { label: 'BITCRUSH', value: pct(fx.crush), norm: fx.crush, nudge: (d, f) => actions.setFx({ crush: clamp(fx.crush + d * (f ? 0.005 : 0.02), 0, 1) }) },
          {
            label: 'DLY TIME', value: DELAY_DIVS[fx.delayDiv].label, norm: fx.delayDiv / 8,
            nudge: (d) => actions.setFx({ delayDiv: clamp(fx.delayDiv + d, 0, DELAY_DIVS.length - 1) }),
          },
          { label: 'DLY FDBK', value: pct(fx.delayFb), norm: fx.delayFb / 0.9, nudge: (d, f) => actions.setFx({ delayFb: clamp(fx.delayFb + d * (f ? 0.005 : 0.02), 0, 0.9) }) },
          { label: 'REV SIZE', value: pct(fx.revSize), norm: fx.revSize, nudge: (d, f) => actions.setFx({ revSize: clamp(fx.revSize + d * (f ? 0.005 : 0.02), 0, 1) }) },
          { label: 'MASTER', value: pct(fx.volume), norm: fx.volume, nudge: (d, f) => actions.setFx({ volume: clamp(fx.volume + d * (f ? 0.005 : 0.02), 0, 1) }) },
        ],
      };
    case 'step': {
      const pi = s.selectedPart;
      const si = Math.min(s.selectedStep, pt.length - 1);
      const st = pt.parts[pi].steps[si];
      return {
        title,
        items: [
          { label: 'STEP', value: String(si + 1).padStart(2, '0') + '/' + pt.length, nudge: (d) => set({ selectedStep: cycle(si, d, pt.length) }) },
          { label: 'TRIG', value: onOff(st.on), nudge: () => actions.setStepField(pi, si, { on: !st.on }) },
          {
            label: 'NOTE', value: noteName(st.note), norm: (st.note + 24) / 48, bipolar: true,
            nudge: (d) => actions.setStepField(pi, si, { note: st.note + d, on: true }),
          },
          { label: 'GATE', value: Math.round(st.gate * 100) + '%', norm: st.gate, nudge: (d, f) => actions.setStepField(pi, si, { gate: st.gate + d * (f ? 0.01 : 0.05) }) },
          { label: 'ACCENT', value: onOff(st.acc), nudge: () => actions.setStepField(pi, si, { acc: !st.acc }) },
          { label: 'SLIDE', value: onOff(st.slide), nudge: () => actions.setStepField(pi, si, { slide: !st.slide }) },
        ],
      };
    }
    case 'song':
      return {
        title,
        items: [
          { label: 'SONG MODE', value: 'FASE 3', hint: 'Song mode / pattern chain non ancora implementati: usa il cambio pattern in coda (PAT +/-)' },
        ],
      };
    case 'global':
      return {
        title,
        items: [
          { label: 'KBD MODE', value: s.kbdMode.toUpperCase(), nudge: () => set({ kbdMode: s.kbdMode === 'step' ? 'live' : 'step' }) },
          { label: 'LED FOLLOW', value: onOff(s.follow), nudge: () => set({ follow: !s.follow }), hint: 'I tasti step seguono il banco in riproduzione (pattern > 16 step)' },
          { label: 'LCD ZOOM', value: onOff(s.lcdZoom), nudge: () => set({ lcdZoom: !s.lcdZoom }), enter: () => set({ lcdZoom: !s.lcdZoom }) },
          { label: 'KEY MAP', value: 'ENTER', enter: () => set({ keymapOpen: true }), hint: 'Riassegna i tasti della tastiera' },
          { label: 'HELP', value: 'ENTER', enter: () => set({ help: true }) },
          { label: 'LATENCY', value: s.latencyMs + ' ms', hint: 'Latenza d\'uscita stimata dal sistema audio (compensata nei LED e nella registrazione)' },
        ],
      };
    case 'file': {
      const slotLabel = slotName(s.slot);
      return {
        title,
        items: [
          { label: 'SLOT', value: `${s.slot + 1} ${slotLabel ?? '(EMPTY)'}`, nudge: (d) => set({ slot: cycle(s.slot, d, NUM_SLOTS) }) },
          { label: 'WRITE', value: 'ENTER', enter: slotLabel ? confirmed('write' + s.slot, 'OVERWRITE', M.writeProject) : M.writeProject, hint: 'Salva il progetto nello slot (anche Ctrl+S)' },
          { label: 'LOAD', value: 'ENTER', enter: confirmed('load' + s.slot, 'LOAD SLOT', M.readSlot) },
          { label: 'PRESET', value: PRESETS[s.presetSel].name, nudge: (d) => set({ presetSel: cycle(s.presetSel, d, PRESETS.length) }) },
          { label: 'LOAD PRESET', value: 'ENTER', enter: confirmed('preset' + s.presetSel, 'LOAD PRESET', () => M.loadPreset(useStore.getState().presetSel)) },
          { label: 'EXPORT FILE', value: 'ENTER', enter: M.exportFile, hint: 'Scarica il progetto come .tribe.json' },
          { label: 'IMPORT FILE', value: 'ENTER', enter: confirmed('import', 'IMPORT', () => void M.importFile()) },
          { label: 'WAV BARS', value: String(s.wavBars), nudge: (d) => set({ wavBars: clamp(s.wavBars + d * 4, 4, 64) }) },
          { label: 'EXPORT WAV', value: 'ENTER', enter: () => void M.exportWav(), hint: 'Renderizza il pattern corrente in WAV 16 bit' },
          { label: 'NEW PROJECT', value: 'ENTER', enter: confirmed('new', 'NEW PROJECT', M.newProject) },
        ],
      };
    }
  }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pct = (v: number) => Math.round(v * 100) + '%';

const NOTE_NAMES = ['F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'];
/** Nome della nota relativa alla tonica F delle parti melodiche */
export function noteName(n: number) {
  const idx = ((n % 12) + 12) % 12;
  return `${NOTE_NAMES[idx]} ${n > 0 ? '+' : ''}${n}`;
}

export function currentItems(): LcdItem[] {
  return buildPage(useStore.getState()).items;
}

export function lcdNudge(dir: number, fine = false) {
  const s = useStore.getState();
  const items = buildPage(s).items;
  const it = items[Math.min(s.cursor, items.length - 1)];
  if (it?.nudge) it.nudge(dir, fine);
}

export function lcdEnter() {
  const s = useStore.getState();
  const items = buildPage(s).items;
  const it = items[Math.min(s.cursor, items.length - 1)];
  if (it?.enter) it.enter();
  else if (it?.nudge) it.nudge(1, false);
}

export function lcdCursor(dir: number) {
  const s = useStore.getState();
  const n = buildPage(s).items.length;
  set({ cursor: cycle(Math.min(s.cursor, n - 1), dir, n), confirm: null });
}

