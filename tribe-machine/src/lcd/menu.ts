// Sistema di menu del display LCD. Ogni pagina è una lista di voci;
// le frecce sinistra/destra scorrono le voci, la rotella VALUE e +/- le modificano,
// ENTER esegue le voci-azione.

import { DELAY_DIVS, PART_TYPES } from '../state/types';
import { formatParam, nudge, paramsFor, toNorm, TYPE_LABEL, type LcdPage } from '../state/params';
import { actions, curPattern, flash, useStore, type AppState, type PageId } from '../state/store';
import { PRESETS } from '../state/presets';
import { NUM_SLOTS, slotName } from '../state/storage';
import * as M from '../machine';
import { songSeconds } from '../audio/offline';
import { hasSample } from '../audio/samples';
import { enableMidi } from '../input/midi';
import { cycleSkin, skinById, toggleView, usePrefs } from '../ui/skins';

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
      nudge: (dir, fine) => M.tweakParam(pi, d.id, nudge(d, part.params[d.id], dir, fine)),
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
          { label: 'NAME', value: pt.name, enter: () => set({ rename: { target: 'pattern', value: pt.name } }), hint: 'ENTER per rinominare il pattern' },
        ],
      };
    case 'osc': {
      const part = pt.parts[s.selectedPart];
      const smp = part.sampleId ? s.project.samples.find((x) => x.id === part.sampleId) : null;
      const sampleItem: LcdItem = {
        label: 'SAMPLE',
        value: part.type === 'sample' ? (smp?.name ?? (part.sampleId ? 'MISSING' : 'EMPTY')) + (hasSample(part.sampleId) ? '' : ' ?') : 'ENTER=LOAD',
        enter: () => void M.pickSample(s.selectedPart),
        hint: 'ENTER: carica un file WAV/MP3/OGG nella parte (o trascina il file sul pannello)',
      };
      return {
        title,
        items: [
          {
            label: 'PART TYPE', value: TYPE_LABEL[part.type], hint: 'Cambia il motore sonoro della parte (i parametri tornano ai valori base)',
            nudge: (d) => actions.setPartType(s.selectedPart, PART_TYPES[cycle(PART_TYPES.indexOf(part.type), d, PART_TYPES.length)]),
          },
          ...(part.type === 'sample' ? [sampleItem] : []),
          ...partParamItems(s, 'osc'),
          ...(part.type !== 'sample' ? [sampleItem] : []),
        ],
      };
    }
    case 'filter':
    case 'env':
    case 'mod': {
      const items = partParamItems(s, s.page);
      return { title, items: items.length ? items : [{ label: '--', value: 'NO PARAMS' }] };
    }
    case 'partfx': {
      const part = pt.parts[s.selectedPart];
      const lanes = Object.keys(part.motion);
      return {
        title,
        items: [
          ...partParamItems(s, 'fx'),
          { label: 'PART NAME', value: part.name, enter: () => set({ rename: { target: 'part', value: part.name } }) },
          {
            label: 'MOTION', value: lanes.length ? lanes.length + ' PARAM' : 'NONE',
            hint: 'Motion sequence: con REC attivo in riproduzione, muovi le manopole. ENTER (2 volte) = cancella',
            enter: lanes.length ? confirmed('motion' + s.selectedPart, 'CLEAR MOTION', () => actions.clearMotion(s.selectedPart)) : undefined,
          },
        ],
      };
    }
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
    case 'song': {
      const song = s.project.song;
      const pos = Math.min(s.songPos, song.length - 1);
      const e = song[pos];
      const secs = Math.round(songSeconds(s.project));
      return {
        title,
        items: [
          { label: 'SONG MODE', value: onOff(s.songMode), nudge: () => M.toggleSongMode(), enter: () => M.toggleSongMode(), hint: 'ON: PLAY suona la catena di pattern (tasto L)' },
          {
            label: 'POSITION', value: `${pos + 1}/${song.length}` + (s.songMode && s.playing ? ` R${s.songRep + 1}` : ''), norm: song.length > 1 ? pos / (song.length - 1) : 0,
            nudge: (d) => { const np = cycle(pos, d, song.length); if (s.songMode && !s.playing) M.startSongAt(np); else set({ songPos: np }); },
          },
          {
            label: 'PATTERN', value: String(e.pattern + 1).padStart(2, '0') + ' ' + s.project.patterns[e.pattern].name,
            nudge: (d) => actions.songEdit(pos, { pattern: e.pattern + d }),
          },
          { label: 'REPEATS', value: 'x' + e.repeats, norm: e.repeats / 16, nudge: (d) => actions.songEdit(pos, { repeats: e.repeats + d }) },
          { label: 'INSERT', value: 'ENTER', enter: () => actions.songInsert(pos), hint: 'Duplica la voce dopo la posizione corrente' },
          { label: 'DELETE', value: 'ENTER', enter: () => actions.songDelete(pos) },
          { label: 'LENGTH', value: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, hint: 'Durata totale della song' },
        ],
      };
    }
    case 'global':
      return {
        title,
        items: [
          { label: 'KBD MODE', value: s.kbdMode.toUpperCase(), nudge: () => set({ kbdMode: s.kbdMode === 'step' ? 'live' : 'step' }) },
          {
            label: 'SHELL', value: skinById(usePrefs.getState().skin).name,
            nudge: (d) => cycleSkin(d), enter: () => cycleSkin(1), hint: 'Scocca intercambiabile: colori, LCD, font e luci (F4)',
          },
          {
            label: 'VIEW', value: usePrefs.getState().view === '3d' ? '3D CONSOLE' : 'FLAT', nudge: () => toggleView(), enter: () => toggleView(),
            hint: 'Console inclinata in 3D o vista frontale (F3)',
          },
          { label: 'LED FOLLOW', value: onOff(s.follow), nudge: () => set({ follow: !s.follow }), hint: 'I tasti step seguono il banco in riproduzione (pattern > 16 step)' },
          { label: 'LCD ZOOM', value: onOff(s.lcdZoom), nudge: () => set({ lcdZoom: !s.lcdZoom }), enter: () => set({ lcdZoom: !s.lcdZoom }) },
          { label: 'KEY MAP', value: 'ENTER', enter: () => set({ keymapOpen: true }), hint: 'Riassegna i tasti della tastiera' },
          { label: 'HELP', value: 'ENTER', enter: () => set({ help: true }) },
          {
            label: 'MIDI IN', value: s.midi.enabled ? (s.midi.inputs.length ? s.midi.inputs.length + ' DEVICE' : 'NO DEVICE') : 'ENTER=ON',
            enter: () => void enableMidi(),
            hint: s.midi.inputs.join(', ') || 'Canale 10 = batteria GM, altri canali = parte selezionata, CC 70-77 = manopole SOUND',
          },
          { label: 'LATENCY', value: s.latencyMs + ' ms', hint: 'Latenza d\'uscita stimata dal sistema audio (compensata nei LED e nella registrazione)' },
        ],
      };
    case 'file': {
      const slotLabel = slotName(s.slot);
      return {
        title,
        items: [
          { label: 'PROJECT', value: s.project.name, enter: () => set({ rename: { target: 'project', value: s.project.name } }), hint: 'ENTER per rinominare il progetto' },
          { label: 'SLOT', value: `${s.slot + 1} ${slotLabel ?? '(EMPTY)'}`, nudge: (d) => set({ slot: cycle(s.slot, d, NUM_SLOTS) }) },
          { label: 'WRITE', value: 'ENTER', enter: slotLabel ? confirmed('write' + s.slot, 'OVERWRITE', M.writeProject) : M.writeProject, hint: 'Salva il progetto nello slot (anche Ctrl+S)' },
          { label: 'LOAD', value: 'ENTER', enter: confirmed('load' + s.slot, 'LOAD SLOT', M.readSlot) },
          { label: 'PRESET', value: PRESETS[s.presetSel].name, nudge: (d) => set({ presetSel: cycle(s.presetSel, d, PRESETS.length) }) },
          { label: 'LOAD PRESET', value: 'ENTER', enter: confirmed('preset' + s.presetSel, 'LOAD PRESET', () => M.loadPreset(useStore.getState().presetSel)) },
          { label: 'EXPORT FILE', value: 'ENTER', enter: () => void M.exportFile(), hint: 'Scarica il progetto come .tribe.json (campioni inclusi)' },
          { label: 'IMPORT FILE', value: 'ENTER', enter: confirmed('import', 'IMPORT', () => void M.importFile()) },
          { label: 'WAV BARS', value: String(s.wavBars), nudge: (d) => set({ wavBars: clamp(s.wavBars + d * 4, 4, 64) }) },
          { label: 'EXPORT WAV', value: s.songMode ? 'SONG' : 'PATTERN', enter: () => void M.exportWav(), hint: 'ENTER: render WAV 16 bit del pattern corrente (WAV BARS battute) o della song intera in SONG MODE' },
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

