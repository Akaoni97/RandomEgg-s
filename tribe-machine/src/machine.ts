// Il "firmware": collega stato, motore audio, sequencer e animazione dei LED.

import { AudioEngine } from './audio/engine';
import { encodeWav, renderPattern } from './audio/offline';
import { Sequencer, type StepEvent } from './sequencer/sequencer';
import { tapTempo } from './sequencer/timing';
import { makeProject } from './state/factory';
import { isMelodic } from './state/params';
import { PRESETS } from './state/presets';
import {
  autosave, downloadBlob, exportProject, fileSafe, loadAutosave, loadSlot, pickProjectFile, saveSlot,
} from './state/storage';
import { actions, curPattern, flash, usePlayhead, useStore } from './state/store';

/** Scala per la riga bassa dei pad in LIVE MODE (minore pentatonica + ottava) */
export const LIVE_SCALE = [0, 3, 5, 7, 10, 12, 15, 17];

let ctx: AudioContext | null = null;
let engine: AudioEngine | null = null;
let seq: Sequencer | null = null;
const queue: StepEvent[] = [];
let raf = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const taps: number[] = [];

export const getEngine = () => engine;

function latency(): number {
  if (!ctx) return 0;
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
}

/** Primo avvio: carica l'ultimo progetto (autosave) o il primo preset. Non richiede audio. */
export function boot() {
  const saved = loadAutosave();
  actions.loadProject(saved ?? PRESETS[0].build(), saved ? 'PROJECT RESTORED' : PRESETS[0].name);
  useStore.subscribe((s, prev) => {
    if (s.project !== prev.project) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => autosave(useStore.getState().project), 800);
      syncEngine();
    }
  });
  window.addEventListener('beforeunload', () => autosave(useStore.getState().project));
}

/** Accensione: l'AudioContext può nascere solo da un gesto dell'utente */
export async function powerOn() {
  if (ctx) return;
  ctx = new AudioContext({ latencyHint: 'interactive' });
  engine = new AudioEngine(ctx);
  await engine.init();
  if (ctx.state !== 'running') await ctx.resume();
  seq = new Sequencer(engine, {
    getPattern: () => {
      const s = useStore.getState();
      return { pattern: s.project.patterns[s.project.current], index: s.project.current };
    },
    getQueued: () => useStore.getState().queuedPattern,
    commitQueued: () => {
      const idx = actions.commitQueued();
      return { pattern: useStore.getState().project.patterns[idx], index: idx };
    },
    onStep: (ev) => {
      queue.push(ev);
      // finestra in background: l'animazione è ferma, non accumulare eventi
      if (queue.length > 128) queue.shift();
    },
  });
  syncEngine(true);
  useStore.setState({ powered: true, latencyMs: Math.round(latency() * 1000) });
  raf = requestAnimationFrame(frame);
}

let lastPattern: unknown = null;
function syncEngine(force = false) {
  if (!engine) return;
  const pt = curPattern();
  if (!force && pt === lastPattern) return;
  lastPattern = pt;
  pt.parts.forEach((p, i) => engine!.applyPart(i, p));
  engine.applyFx(pt.fx, pt.bpm);
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

export function playPause() {
  if (!seq || !ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  if (seq.playing) {
    seq.pause();
    queue.length = 0;
    useStore.setState({ playing: false });
  } else {
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
  if (rec && s.kbdMode !== 'live') flash('REC: USA LIVE MODE', 1800);
  else flash(rec ? 'REC ARMED' : 'REC OFF');
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

export function exportFile() {
  exportProject(useStore.getState().project);
  flash('FILE EXPORTED');
}

export async function importFile() {
  try {
    const p = await pickProjectFile();
    stopIfPlaying();
    actions.loadProject(p, 'FILE IMPORTED');
  } catch (e) {
    flash('IMPORT ERROR', 2500);
    console.warn(e);
  }
}

export async function exportWav() {
  const s = useStore.getState();
  const pt = curPattern(s);
  flash('RENDERING...', 60000);
  try {
    const buf = await renderPattern(pt, s.wavBars);
    downloadBlob(encodeWav(buf), `${fileSafe(s.project.name)}_${fileSafe(pt.name)}_${Math.round(pt.bpm)}bpm.wav`);
    flash('WAV EXPORTED');
  } catch (e) {
    console.error(e);
    flash('WAV ERROR', 2500);
  }
}
