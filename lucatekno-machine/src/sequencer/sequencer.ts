// Step sequencer con scheduling anticipato sull'orologio audio.
//
// Un timer (in un Web Worker, così non viene rallentato dal rendering della UI)
// sveglia il sequencer ogni ~20 ms; il sequencer programma nel motore audio
// tutti gli step che cadono nei prossimi LOOKAHEAD secondi, con tempi assoluti
// dell'AudioContext. Il timer JavaScript non suona mai le note direttamente:
// il suo jitter non arriva all'audio.

import type { AudioEngine } from '../audio/engine';
import { isMelodic } from '../state/params';
import { NUM_PARTS, type Pattern } from '../state/types';
import { nearestStep, stepDuration, swingOffset, type StepTime } from './timing';
import { motionAt } from '../state/motion';

export const LOOKAHEAD = 0.12;
const TICK_MS = 20;

export interface StepEvent {
  time: number;
  step: number;
  patternIndex: number;
  triggers: number[];
  /** inizio di una battuta (anche durante RIPETI): serve al piatto per gli scratch a tempo */
  bar?: boolean;
}

export interface SeqHost {
  getPattern(): { pattern: Pattern; index: number };
  /**
   * Chiamata a ogni inizio battuta (step 0, 16, 32, 48) prima di programmarla.
   * Ritorna il pattern su cui passare (cambio in coda o song mode) oppure null.
   * `first` = prima battuta dopo PLAY.
   */
  atBar(step: number, first: boolean): { pattern: Pattern; index: number } | null;
  onStep(ev: StepEvent): void;
}

export class Sequencer {
  playing = false;
  /** prossimo step da programmare */
  step = 0;
  /**
   * RIPETI (effetto al volo del Mattone): finché non è null il sequencer continua a suonare
   * sempre questo step, mentre il conteggio va avanti; al rilascio si riparte a tempo.
   */
  repeat: number | null = null;
  private nextTime = 0;
  private held: boolean[] = new Array(NUM_PARTS).fill(false);
  private suppress = new Set<string>();
  private history: StepTime[] = [];
  private first = true;
  private worker: Worker | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private engine: AudioEngine;
  private host: SeqHost;

  constructor(engine: AudioEngine, host: SeqHost) {
    this.engine = engine;
    this.host = host;
  }

  private startClock() {
    if (this.worker || this.interval) return;
    try {
      const src = `let id=null;onmessage=e=>{if(e.data==='start'){clearInterval(id);id=setInterval(()=>postMessage(0),${TICK_MS});}else{clearInterval(id);id=null;}}`;
      const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);
      this.worker.onmessage = () => this.tick();
      this.worker.postMessage('start');
    } catch {
      this.interval = setInterval(() => this.tick(), TICK_MS);
    }
  }

  private stopClock() {
    this.worker?.postMessage('stop');
    this.worker?.terminate();
    this.worker = null;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.nextTime = this.engine.ctx.currentTime + 0.05;
    this.history = [];
    this.first = true;
    this.startClock();
    this.tick();
  }

  /** Pausa: mantiene la posizione */
  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.stopClock();
    this.releaseHeld();
    this.engine.allNotesOff();
  }

  stop() {
    this.pause();
    this.step = 0;
    this.suppress.clear();
  }

  releaseHeld(time = this.engine.ctx.currentTime) {
    for (let i = 0; i < NUM_PARTS; i++) {
      if (this.held[i]) this.engine.noteOff(i, time);
      this.held[i] = false;
    }
  }

  tick() {
    if (!this.playing) return;
    const now = this.engine.ctx.currentTime;
    // Se il thread è rimasto bloccato (es. finestra minimizzata) salta gli step persi
    // invece di suonarli tutti insieme.
    if (this.nextTime < now - 0.03) {
      const { pattern } = this.host.getPattern();
      const dur = stepDuration(pattern.bpm);
      while (this.nextTime < now) {
        this.nextTime += dur;
        this.step = (this.step + 1) % pattern.length;
      }
      this.releaseHeld(now);
    }
    const horizon = now + LOOKAHEAD;
    while (this.nextTime < horizon) {
      let cur = this.host.getPattern();
      if (this.step % 16 === 0) {
        const sw = this.host.atBar(this.step, this.first);
        this.first = false;
        if (sw) {
          this.releaseHeld(this.nextTime);
          cur = sw;
          this.step = 0;
        }
      }
      const pattern = cur.pattern;
      if (this.step >= pattern.length) this.step = 0;
      const dur = stepDuration(pattern.bpm);
      const t = this.nextTime + swingOffset(this.step, pattern.swing, dur);
      const play = this.repeat !== null ? this.repeat % pattern.length : this.step;
      const triggers = this.scheduleStep(pattern, play, t);
      this.history.push({ step: play, time: t, pending: false });
      if (this.history.length > 8) this.history.shift();
      this.host.onStep({ time: t, step: play, patternIndex: cur.index, triggers, bar: this.step % 16 === 0 });
      this.nextTime += dur;
      this.step = (this.step + 1) % pattern.length;
    }
  }

  /** Programma tutte le parti di uno step all'istante audio `time`. */
  scheduleStep(pattern: Pattern, step: number, time: number): number[] {
    const e = this.engine;
    e.applyFx(pattern.fx, pattern.bpm);
    const dur = stepDuration(pattern.bpm);
    const anySolo = pattern.parts.some((p) => p.solo);
    const triggers: number[] = [];
    for (let i = 0; i < pattern.parts.length; i++) {
      const part = pattern.parts[i];
      const s = part.steps[step];
      const audible = !part.mute && (!anySolo || part.solo);
      const suppressed = this.suppress.delete(i + ':' + step);
      const eff = motionAt(part, step);
      e.stepParams(i, part, eff, time);
      const params = eff ?? part.params;
      const vel = s.acc ? 1 : 0.72;
      if (isMelodic(part.type)) {
        if (!audible || !s.on) {
          if (this.held[i]) e.noteOff(i, time);
          this.held[i] = false;
          continue;
        }
        if (suppressed) continue;
        e.trigger(i, part, { time, vel, note: s.note, accent: s.acc }, this.held[i], params);
        const next = part.steps[(step + 1) % pattern.length];
        if (s.slide && next.on) {
          this.held[i] = true; // la nota prosegue in legato nello step successivo
        } else {
          e.noteOff(i, time + Math.max(0.012, s.gate * dur));
          this.held[i] = false;
        }
        triggers.push(i);
      } else if (audible && s.on && !suppressed) {
        e.trigger(i, part, { time, vel, note: s.note, accent: s.acc }, false, params);
        triggers.push(i);
      }
    }
    return triggers;
  }

  /**
   * Registrazione live: a quale step appartiene un colpo suonato adesso?
   * Considera la latenza d'uscita (l'utente reagisce a ciò che sente).
   * Se lo step scelto non è ancora stato programmato viene "soppresso" una volta,
   * per non risuonare il colpo appena suonato dal vivo.
   */
  quantizeLive(part: number, outputLatency: number): number | null {
    if (!this.playing) return null;
    const { pattern } = this.host.getPattern();
    const dur = stepDuration(pattern.bpm);
    const nextStep = this.step % pattern.length;
    const cands: StepTime[] = [
      ...this.history,
      { step: nextStep, time: this.nextTime + swingOffset(nextStep, pattern.swing, dur), pending: true },
    ];
    const t = this.engine.ctx.currentTime - outputLatency;
    const best = nearestStep(cands, t);
    if (!best) return null;
    if (best.pending) this.suppress.add(part + ':' + best.step);
    return best.step;
  }

  /** Rilascia le note in legato (fine di un render o di una sezione di song) */
  releaseAll(time: number) {
    this.releaseHeld(time);
    for (let i = 0; i < NUM_PARTS; i++) this.engine.noteOff(i, time);
  }

}
