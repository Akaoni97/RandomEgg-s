// Il "firmware": collega stato, motore audio, sequencer e animazione dei LED.

import { AudioEngine, type PerfFx } from './audio/engine';
import { encodeWav, MAX_RENDER_SECONDS, renderPattern, renderSong, songSeconds } from './audio/offline';
import { ensureSamples, importSampleFile, packSamples, setDecoder, unpackSamples } from './audio/samples';
import { Sequencer, type StepEvent } from './sequencer/sequencer';
import { tapTempo } from './sequencer/timing';
import { makeProject, sanitizeProject } from './state/factory';
import { clampParam, isMelodic, paramDef } from './state/params';
import { installHistory } from './state/history';
import { PRESETS } from './state/presets';
import {
  autosave, downloadBlob, fileSafe, loadAutosave, loadSlot, pickFile, saveSlot,
} from './state/storage';
import type { Project } from './state/types';
import { actions, curPattern, flash, usePlayhead, useStore } from './state/store';
import { initDeck, syncDeckTempo } from './deckControl';

/** Scala per la riga bassa dei pad in LIVE MODE (minore pentatonica + ottava) */
export const LIVE_SCALE = [0, 3, 5, 7, 10, 12, 15, 17];

let ctx: AudioContext | null = null;
let engine: AudioEngine | null = null;
let seq: Sequencer | null = null;
const queue: StepEvent[] = [];
let raf = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const taps: number[] = [];
/** istante audio dell'ultima battuta programmata (per gli scratch automatici a tempo) */
let lastBar = 0;

export const getEngine = () => engine;
export const getSequencer = () => seq;

/** Origine della griglia ritmica per il piatto: inizio dell'ultima battuta, o "adesso" a macchina ferma */
export function barOrigin(): number {
  if (!ctx) return 0;
  return seq?.playing ? lastBar : ctx.currentTime;
}

function latency(): number {
  if (!ctx) return 0;
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
}

/** Primo avvio: carica l'ultimo progetto (autosave) o il primo preset. Non richiede audio. */
export function boot() {
  const saved = loadAutosave();
  actions.loadProject(saved ?? PRESETS[0].build(), saved ? 'PROJECT RESTORED' : PRESETS[0].name);
  void loadProjectSamples(useStore.getState().project);
  installHistory();
  useStore.subscribe((s, prev) => {
    if (s.project !== prev.project) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => autosave(useStore.getState().project), 800);
      syncEngine();
      if (s.project.samples !== prev.project.samples) void loadProjectSamples(s.project);
    }
  });
  window.addEventListener('beforeunload', () => autosave(useStore.getState().project));
}

/** Accensione: l'AudioContext può nascere solo da un gesto dell'utente */
export async function powerOn() {
  if (ctx) return;
  ctx = new AudioContext({ latencyHint: 'interactive' });
  engine = new AudioEngine(ctx);
  setDecoder(ctx);
  await engine.init();
  if (ctx.state !== 'running') await ctx.resume();
  seq = new Sequencer(engine, {
    getPattern: () => {
      const s = useStore.getState();
      return { pattern: s.project.patterns[s.project.current], index: s.project.current };
    },
    atBar: (step, first) => (useStore.getState().songMode ? songAtBar(step, first) : queuedAtBar()),
    onStep: (ev) => {
      if (ev.bar) lastBar = ev.time;
      queue.push(ev);
      // finestra in background: l'animazione è ferma, non accumulare eventi
      if (queue.length > 128) queue.shift();
    },
  });
  syncEngine(true);
  useStore.setState({ powered: true, latencyMs: Math.round(latency() * 1000) });
  raf = requestAnimationFrame(frame);
  // il piatto del Mattone si accende dopo il motore: la macchina suona già mentre carica il disco
  void initDeck(ctx, engine.deckIn);
}

/** Effetti al volo (pad tenuti premuti). RIPETI blocca lo step che si sta ascoltando. */
export function setPerf(id: PerfFx, on: boolean) {
  if (!engine) return;
  if (id === 'rip') {
    if (!seq) return;
    const step = usePlayhead.getState().step;
    seq.repeat = on && seq.playing && step >= 0 ? step : null;
  }
  engine.setPerf(id, on, curPattern().bpm);
}

let lastPattern: unknown = null;
function syncEngine(force = false) {
  if (!engine) return;
  const pt = curPattern();
  if (!force && pt === lastPattern) return;
  const bpmChanged = !lastPattern || (lastPattern as typeof pt).bpm !== pt.bpm;
  lastPattern = pt;
  pt.parts.forEach((p, i) => engine!.applyPart(i, p));
  engine.applyFx(pt.fx, pt.bpm);
  if (bpmChanged) syncDeckTempo();
}

/** Animazione LED: mostra lo step quando è realmente udibile (tempo audio - latenza) */
function frame() {
  raf = requestAnimationFrame(frame);
  if (!ctx) return;
  const t = ctx.currentTime - latency();
  let last: StepEvent | null = null;
  const flashes: number[] = [];
  while (queue.length && queue[0].time <= t) {
    last = queue.shift()!;
    flashes.push(...last.triggers);
  }
  if (last) {
    const ph = usePlayhead.getState();
    const flash = ph.flash.slice();
    const now = performance.now();
    for (const i of flashes) flash[i] = now;
    usePlayhead.setState({ step: last.step, pattern: last.patternIndex, flash });
    const s = useStore.getState();
    const page = Math.floor(last.step / 16);
    if (s.follow && s.playing && page !== s.stepPage) useStore.setState({ stepPage: page });
  }
  const s = useStore.getState();
  if (s.message && performance.now() > s.message.until) useStore.setState({ message: null });
}

export function stopAnimation() {
  cancelAnimationFrame(raf);
}

// ---------------------------------------------------------------------------
// trasporto
// ---------------------------------------------------------------------------

function patternRef(index: number) {
  return { pattern: useStore.getState().project.patterns[index], index };
}

/** Cambio pattern in coda: avviene a inizio battuta */
function queuedAtBar() {
  if (useStore.getState().queuedPattern === null) return null;
  return patternRef(actions.commitQueued());
}

/** Song mode: a fine pattern conta le ripetizioni e passa alla voce successiva */
function songAtBar(step: number, first: boolean) {
  if (step !== 0 || first) return null;
  const s = useStore.getState();
  const song = s.project.song;
  const pos = Math.min(s.songPos, song.length - 1);
  if (s.songRep + 1 < song[pos].repeats) {
    useStore.setState({ songRep: s.songRep + 1 });
    return null;
  }
  let next = pos + 1;
  if (next >= song.length) {
    next = 0;
    flash('SONG LOOP');
  }
  const idx = song[next].pattern;
  useStore.setState({ songPos: next, songRep: 0, queuedPattern: null, stepPage: 0, project: { ...s.project, current: idx } });
  return patternRef(idx);
}

export function toggleSongMode() {
  const s = useStore.getState();
  const on = !s.songMode;
  useStore.setState({ songMode: on, queuedPattern: null });
  flash(on ? 'SONG MODE ON' : 'PATTERN MODE');
  if (on && !s.playing) startSongAt(Math.min(s.songPos, s.project.song.length - 1));
}

/** Posiziona la song su una voce (a macchina ferma) */
export function startSongAt(pos: number) {
  const s = useStore.getState();
  const e = s.project.song[pos];
  if (!e) return;
  if (seq) seq.step = 0;
  useStore.setState({ songPos: pos, songRep: 0, stepPage: 0, project: { ...s.project, current: e.pattern } });
}

export function playPause() {
  if (!seq || !ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  if (seq.playing) {
    seq.pause();
    queue.length = 0;
    useStore.setState({ playing: false });
  } else {
    const s = useStore.getState();
    if (s.songMode && seq.step === 0) startSongAt(Math.min(s.songPos, s.project.song.length - 1));
    seq.start();
    useStore.setState({ playing: true });
  }
}

export function stop() {
  if (!seq || !engine) return;
  const wasPlaying = seq.playing;
  seq.stop();
  queue.length = 0;
  useStore.setState({ playing: false, queuedPattern: null, recording: false });
  usePlayhead.setState({ step: -1 });
  // in song mode lo stop riporta all'inizio della song
  if (useStore.getState().songMode) startSongAt(0);
  // secondo STOP a macchina ferma = panic (silenzia anche le code)
  if (!wasPlaying) {
    engine.panic();
    releaseAllLive();
    flash('ALL SOUND OFF');
  }
}

export function toggleRec() {
  const s = useStore.getState();
  const rec = !s.recording;
  useStore.setState({ recording: rec });
  if (!rec) flash('REC OFF');
  else if (s.kbdMode === 'live') flash('REC: PAD + MANOPOLE', 1800);
  else flash('REC: MOTION MANOPOLE', 1800);
}

/**
 * Modifica di un parametro dalla manopola / MIDI. Con REC attivo in riproduzione
 * il valore viene anche scritto nella motion sequence sullo step che si sta ascoltando.
 */
export function tweakParam(pi: number, id: string, v: number) {
  actions.setParam(pi, id, v);
  const s = useStore.getState();
  if (!s.recording || !s.playing) return;
  const step = usePlayhead.getState().step;
  const pt = curPattern(s);
  const d = paramDef(pt.parts[pi].type, id);
  if (!d || step < 0 || step >= pt.length) return;
  actions.recordMotion(pi, id, step, clampParam(d, v));
}

export function tap() {
  const now = performance.now() / 1000;
  if (taps.length && now - taps[taps.length - 1] > 2) taps.length = 0;
  taps.push(now);
  if (taps.length > 6) taps.shift();
  const bpm = tapTempo(taps);
  if (bpm) {
    actions.setBpm(bpm);
    flash(`TAP ${bpm.toFixed(1)} BPM`);
  } else flash('TAP...');
}

// ---------------------------------------------------------------------------
// suono dal vivo (pad LIVE, ascolto degli step a macchina ferma)
// ---------------------------------------------------------------------------

const liveHeld = new Map<string, { part: number; note: number }>();
const monoStack: number[][] = Array.from({ length: 8 }, () => []);

/** Suona una parte adesso. `key` identifica il tasto/pulsante per il rilascio. */
export function livePlay(part: number, note: number, accent: boolean, key: string) {
  if (!engine || !ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  const s = useStore.getState();
  const pt = curPattern(s);
  const p = pt.parts[part];
  const time = ctx.currentTime + 0.005;
  const vel = accent ? 1 : 0.8;
  const mel = isMelodic(p.type);
  if (mel) {
    const stack = monoStack[part];
    const legato = stack.length > 0;
    stack.push(note);
    engine.trigger(part, p, { time, vel, note, accent }, legato);
    liveHeld.set(key, { part, note });
  } else {
    engine.trigger(part, p, { time, vel, note, accent });
  }
  const ph = usePlayhead.getState();
  const fl = ph.flash.slice();
  fl[part] = performance.now();
  usePlayhead.setState({ flash: fl });

  if (s.recording && s.playing && seq) {
    const step = seq.quantizeLive(part, latency());
    if (step !== null) {
      actions.setStepOn(part, step, true, note);
      if (accent) actions.setStepField(part, step, { acc: true });
    }
  }
}

export function liveRelease(key: string) {
  const h = liveHeld.get(key);
  if (!h || !engine || !ctx) return;
  liveHeld.delete(key);
  const stack = monoStack[h.part];
  const idx = stack.lastIndexOf(h.note);
  if (idx >= 0) stack.splice(idx, 1);
  if (stack.length) {
    // priorità all'ultima nota: torna in glide sulla nota ancora premuta
    const p = curPattern().parts[h.part];
    engine.trigger(h.part, p, { time: ctx.currentTime, vel: 0.8, note: stack[stack.length - 1], accent: false }, true);
  } else {
    engine.noteOff(h.part, ctx.currentTime + 0.005);
  }
}

export function releaseAllLive() {
  for (const k of [...liveHeld.keys()]) liveRelease(k);
  monoStack.forEach((s) => (s.length = 0));
}

/** Breve ascolto di uno step quando lo si attiva a macchina ferma */
export function audition(part: number, note: number) {
  if (!engine || !ctx || seq?.playing) return;
  const p = curPattern().parts[part];
  const t = ctx.currentTime + 0.005;
  engine.trigger(part, p, { time: t, vel: 0.8, note, accent: false });
  if (isMelodic(p.type)) engine.noteOff(part, t + 0.18);
}

// ---------------------------------------------------------------------------
// file
// ---------------------------------------------------------------------------

export function writeProject() {
  const s = useStore.getState();
  autosave(s.project);
  if (saveSlot(s.slot, s.project)) {
    useStore.setState({ dirty: false });
    flash(`WRITE SLOT ${s.slot + 1} OK`);
  } else flash('WRITE ERROR!');
}

export function readSlot() {
  const s = useStore.getState();
  const p = loadSlot(s.slot);
  if (!p) { flash(`SLOT ${s.slot + 1} EMPTY`); return; }
  stopIfPlaying();
  actions.loadProject(p, `SLOT ${s.slot + 1} LOADED`);
}

export function loadPreset(i: number) {
  const pr = PRESETS[i];
  if (!pr) return;
  stopIfPlaying();
  actions.loadProject(pr.build(), pr.name);
}

export function newProject() {
  stopIfPlaying();
  actions.loadProject(makeProject(), 'NEW PROJECT');
}

function stopIfPlaying() {
  if (seq?.playing) stop();
}

function usedSampleIds(p: Project): string[] {
  const ids = new Set(p.samples.map((x) => x.id));
  for (const pt of p.patterns) for (const part of pt.parts) if (part.sampleId) ids.add(part.sampleId);
  return [...ids];
}

async function loadProjectSamples(p: Project) {
  const missing = await ensureSamples(usedSampleIds(p));
  if (missing.length) flash(`${missing.length} SAMPLE MISSING`, 2500);
}

/** Esporta il progetto con i campioni incorporati: il file è completo e portabile */
export async function exportFile() {
  const p = useStore.getState().project;
  const samplesData = await packSamples(usedSampleIds(p));
  const blob = new Blob([JSON.stringify({ ...p, samplesData })], { type: 'application/json' });
  downloadBlob(blob, `${fileSafe(p.name)}.ltm.json`);
  flash('FILE EXPORTED');
}

export async function loadProjectText(text: string, msg = 'FILE IMPORTED') {
  const raw = JSON.parse(text);
  const proj = sanitizeProject(raw);
  await unpackSamples(raw.samplesData);
  stopIfPlaying();
  actions.loadProject(proj, msg);
}

export async function importFile() {
  try {
    const f = await pickFile('.json,application/json');
    await loadProjectText(await f.text());
  } catch (e) {
    flash('IMPORT ERROR', 2500);
    console.warn(e);
  }
}

/** Carica un file audio nella parte indicata (la parte diventa di tipo SAMPLE) */
export async function loadSampleFile(pi: number, file: File) {
  flash('LOADING SAMPLE...', 10000);
  try {
    const { id, name } = await importSampleFile(file);
    actions.setPartSample(pi, id, name);
    flash(`P${pi + 1} SAMPLE ${name}`);
    audition(pi, 0);
  } catch (e) {
    flash('SAMPLE ERROR', 2500);
    console.warn(e);
  }
}

export async function pickSample(pi: number) {
  try {
    await loadSampleFile(pi, await pickFile('audio/*,.wav,.mp3,.ogg,.flac,.aif,.aiff'));
  } catch { /* annullato */ }
}

export async function exportWav() {
  const s = useStore.getState();
  const pt = curPattern(s);
  const song = s.songMode;
  if (song && songSeconds(s.project) > MAX_RENDER_SECONDS) flash('SONG > 15 MIN: TAGLIATA', 2500);
  flash(song ? 'RENDERING SONG...' : 'RENDERING...', 600000);
  try {
    const buf = song ? await renderSong(s.project) : await renderPattern(pt, s.wavBars);
    const name = song ? `${fileSafe(s.project.name)}_song.wav` : `${fileSafe(s.project.name)}_${fileSafe(pt.name)}_${Math.round(pt.bpm)}bpm.wav`;
    downloadBlob(encodeWav(buf), name);
    flash('WAV EXPORTED');
  } catch (e) {
    console.error(e);
    flash('WAV ERROR', 2500);
  }
}
