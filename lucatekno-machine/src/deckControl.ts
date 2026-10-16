// Comandi del LT DECK (piatto scratch), degli effetti al volo e della cassa dei dischi.
// Lo stato dei controlli sta in piccoli store separati: il progetto (pattern, suoni) non cambia
// quando si scratcha, quindi undo/redo e autosave restano puliti.

import { create } from 'zustand';
import { Deck, buildPhrase, type AutoScratch } from './audio/deck';
import { crateSound, libId, loadCrate, shortName, tuneToF } from './audio/crate';
import { renderPattern } from './audio/offline';
import { ensureSamples } from './audio/samples';
import type { PerfFx } from './audio/engine';
import { stepDuration } from './sequencer/timing';
import { loadJSON, saveJSON } from './state/storage';
import { actions, curPattern, flash, useStore } from './state/store';
import * as M from './machine';

export interface DeckSource { id: string; label: string }

/** Cosa si può mettere sul disco. "crate" = l'ultimo suono mandato sul piatto dalla cassa. */
export const DECK_SOURCES: DeckSource[] = [
  { id: 'phrase', label: 'FRASE SCRATCH' },
  { id: 'sy_ahh', label: 'VOCE "AAAH"' },
  { id: 'sy_yeah', label: 'VOCE "YEAH"' },
  { id: 'sy_hey', label: 'VOCE "HEY"' },
  { id: 'gm_orchhit', label: 'ORCHESTRA HIT' },
  { id: 'gm_choir', label: 'CORO "AAH"' },
  { id: 'sy_chord_m9', label: 'ACCORDO MIN 9' },
  { id: 'sy_kick808', label: 'CASSA 808' },
  { id: 'loop', label: 'LOOP DEL PATTERN' },
  { id: 'part', label: 'PARTE SELEZIONATA' },
];

interface DeckUi {
  ready: boolean;
  motor: boolean;
  auto: AutoScratch;
  cut: boolean;
  touching: boolean;
  /** crossfader del piatto 0..1 */
  xf: number;
  /** pitch ±16 % */
  pitch: number;
  tone: number;
  dirt: number;
  level: number;
  src: string;
  label: string;
  /** suono della cassa da usare come sorgente "crate" */
  crateId: string | null;
  busy: boolean;
}

const KEY = 'ltm.deck.v1';
const saved = loadJSON<Partial<DeckUi>>(KEY) ?? {};
const num = (v: unknown, d: number, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

export const useDeck = create<DeckUi>(() => ({
  ready: false,
  motor: false,
  auto: '',
  cut: false,
  touching: false,
  xf: num(saved.xf, 1, 0, 1),
  pitch: num(saved.pitch, 0, -16, 16),
  tone: num(saved.tone, 0.62, 0, 1),
  dirt: num(saved.dirt, 0.25, 0, 1),
  level: num(saved.level, 0.8, 0, 1),
  src: 'phrase',
  label: 'FRASE SCRATCH',
  crateId: null,
  busy: false,
}));
useDeck.subscribe((s, p) => {
  if (s.xf !== p.xf || s.pitch !== p.pitch || s.tone !== p.tone || s.dirt !== p.dirt || s.level !== p.level) {
    saveJSON(KEY, { xf: s.xf, pitch: s.pitch, tone: s.tone, dirt: s.dirt, level: s.level });
  }
});

export const useFx = create<Record<PerfFx, boolean>>(() => ({ lp: false, hp: false, eco: false, rip: false, lofi: false }));

export const PERF_PADS: { id: PerfFx; name: string; hint: string }[] = [
  { id: 'lp', name: 'OVATTA', hint: 'passa-basso' },
  { id: 'hp', name: 'RADIO', hint: 'passa-alto' },
  { id: 'eco', name: 'ECO', hint: 'delay dub' },
  { id: 'rip', name: 'RIPETI', hint: 'blocca lo step' },
  { id: 'lofi', name: 'LO-FI', hint: 'bit ridotti' },
];

let deck: Deck | null = null;
export const getDeck = () => deck;

const setUi = (p: Partial<DeckUi>) => useDeck.setState(p);

/** Chiamata all'accensione, dopo il motore audio */
export async function initDeck(ctx: AudioContext, out: AudioNode) {
  deck = new Deck(ctx, out);
  await deck.init();
  const s = useDeck.getState();
  deck.set({ xf: s.xf, pitch: s.pitch, six: currentSix() });
  deck.color(s.tone, s.dirt);
  deck.setLevel(s.level);
  setUi({ ready: true });
  await setDeckSource('phrase', true);
}

function currentSix() {
  return stepDuration(curPattern().bpm);
}

/** il BPM è cambiato: le tecniche automatiche restano a tempo */
export function syncDeckTempo() {
  deck?.set({ six: currentSix() });
}

async function sourceBuffer(id: string): Promise<AudioBuffer | { data: Float32Array; sr: number }> {
  const ctx = deck!.ctx;
  if (id === 'phrase') {
    const parts = await Promise.all(['sy_ahh', 'gm_orchhit', 'sy_yeah', 'sy_hey', 'sy_ooh'].map((x) => loadCrate(ctx, x)));
    return buildPhrase(ctx, parts);
  }
  if (id === 'loop' || id === 'part') {
    const s = useStore.getState();
    const pt = curPattern(s);
    const pattern = id === 'part'
      ? { ...pt, parts: pt.parts.map((p, i) => ({ ...p, mute: false, solo: i === s.selectedPart })) }
      : pt;
    const buf = await renderPattern(pattern, 1, ctx.sampleRate);
    // una battuta esatta: il disco gira in loop senza buchi
    const n = Math.min(buf.length, Math.round(16 * stepDuration(pt.bpm) * buf.sampleRate) + Math.round(0.05 * buf.sampleRate));
    const data = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) data[i] += d[i] / buf.numberOfChannels;
    }
    return { data, sr: buf.sampleRate };
  }
  if (id === 'crate') {
    const c = useDeck.getState().crateId;
    if (!c) throw new Error('nessun suono dalla cassa');
    return loadCrate(ctx, c);
  }
  return loadCrate(ctx, id);
}

export function sourceLabel(id: string): string {
  if (id === 'crate') {
    const c = useDeck.getState().crateId;
    return c ? (crateSound(c)?.name ?? 'CASSA').toUpperCase() : 'CASSA';
  }
  return DECK_SOURCES.find((s) => s.id === id)?.label ?? id.toUpperCase();
}

export async function setDeckSource(id: string, quiet = false) {
  if (!deck) return;
  setUi({ busy: true, src: id, label: sourceLabel(id) });
  try {
    const buf = await sourceBuffer(id);
    deck.load(buf);
    // una tecnica automatica in corso riparte dall'inizio del nuovo disco
    const s = useDeck.getState();
    if (s.auto) deck.auto(s.auto, M.barOrigin(), currentSix());
    if (!quiet) flash('SUL PIATTO: ' + sourceLabel(id), 1600);
  } catch (e) {
    console.warn(e);
    flash('PIATTO: SUONO NON DISPONIBILE', 2000);
  } finally {
    setUi({ busy: false });
  }
}

export function cycleDeckSource(dir: number) {
  const ids = [...DECK_SOURCES.map((s) => s.id), ...(useDeck.getState().crateId ? ['crate'] : [])];
  const i = ids.indexOf(useDeck.getState().src);
  void setDeckSource(ids[(i + dir + ids.length) % ids.length]);
}

const AUTO_NAMES: Record<string, string> = { baby: 'BABY SCRATCH', chirp: 'CHIRP', flare: 'FLARE', tear: 'TEAR', trans: 'TRANSFORMER', scribble: 'SCRIBBLE' };

export function setAuto(mode: AutoScratch) {
  if (!deck) return;
  setUi({ auto: mode });
  deck.auto(mode, M.barOrigin(), currentSix());
  flash(mode ? AUTO_NAMES[mode] + ' A TEMPO' : 'SCRATCH A MANO', 1400);
}

export function toggleMotor() {
  if (!deck) return;
  const motor = !useDeck.getState().motor;
  setUi({ motor });
  deck.set({ motor });
  flash(motor ? 'IL DISCO GIRA' : 'DISCO FERMO', 1000);
}

export function cutOn() {
  if (!deck || useDeck.getState().cut) return;
  setUi({ cut: true });
  deck.set({ cut: true });
}

export function cutOff() {
  if (!deck || !useDeck.getState().cut) return;
  setUi({ cut: false });
  deck.set({ cut: false });
}

export function setDeckParam(p: Partial<Pick<DeckUi, 'xf' | 'pitch' | 'tone' | 'dirt' | 'level'>>) {
  setUi(p);
  if (!deck) return;
  const s = useDeck.getState();
  if (p.xf !== undefined) deck.set({ xf: s.xf });
  if (p.pitch !== undefined) deck.set({ pitch: s.pitch });
  if (p.tone !== undefined || p.dirt !== undefined) deck.color(s.tone, s.dirt);
  if (p.level !== undefined) deck.setLevel(s.level);
}

// --- mano sul disco ---------------------------------------------------------

export function deckTouch() {
  if (!deck) return;
  if (useDeck.getState().auto) setAuto('');
  setUi({ touching: true });
  deck.touch();
}
export function deckMove(sec: number) { deck?.move(sec); }
export function deckRelease(rate: number) {
  if (!deck) return;
  setUi({ touching: false });
  deck.release(rate);
}

// --- effetti al volo ----------------------------------------------------------

export function fxOn(id: PerfFx) {
  if (useFx.getState()[id]) return;
  useFx.setState({ [id]: true });
  M.setPerf(id, true);
}

export function fxOff(id: PerfFx) {
  if (!useFx.getState()[id]) return;
  useFx.setState({ [id]: false });
  M.setPerf(id, false);
}

export function allFxOff() {
  PERF_PADS.forEach((p) => fxOff(p.id));
  cutOff();
}

// --- cassa dei dischi -----------------------------------------------------------

/** Anteprima di un suono della cassa */
export async function crateListen(id: string) {
  const e = M.getEngine();
  if (!e) return;
  try {
    e.preview(await loadCrate(e.ctx, id));
  } catch {
    flash('SUONO NON DISPONIBILE', 1500);
  }
}

/** Mette un suono della cassa nella parte selezionata (diventa una parte SAMPLE) */
export async function crateToPart(id: string, part = useStore.getState().selectedPart) {
  const s = crateSound(id);
  if (!s) return;
  const lid = libId(s.id);
  await ensureSamples([lid]);
  actions.setPartSample(part, lid, shortName(s));
  // gli strumenti intonati vengono portati sulla tonica F, come BASS e ACID
  const tune = tuneToF(s);
  if (tune) actions.setParam(part, 'tune', tune);
  flash(`P${part + 1} ← ${shortName(s)}`, 1600);
  M.audition(part, 0);
}

/** Mette un suono della cassa sul piatto */
export async function crateToDeck(id: string) {
  setUi({ crateId: id });
  await setDeckSource('crate');
}
