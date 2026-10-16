// Motore audio: bus per parte, mixer, effetti master, limiter di sicurezza.
// Funziona sia con un AudioContext (tempo reale) sia con un OfflineAudioContext
// (export WAV e test automatici), perché non dipende da timer o dal DOM.

import { CRUSHER_WORKLET, driveCurve, masterClipCurve, reverbIR } from './dsp';
import { chokeVoice, playDrum, type Voice } from './drums';
import { MonoSynth } from './monosynth';
import { getSampleBuffer } from './samples';
import { DELAY_DIVS, NUM_PARTS, type MasterFx, type PartState, type PartType } from '../state/types';
import { isMelodic } from '../state/params';

interface PartBus {
  input: GainNode;
  shaper: WaveShaperNode;
  makeup: GainNode;
  pan: StereoPannerNode;
  level: GainNode;
  dly: GainNode;
  rev: GainNode;
  type: PartType | null;
  mono: MonoSynth | null;
  voices: Voice[];
  driveQ: number;
  /** i nodi stanno usando valori della motion sequence (vanno riallineati quando finisce) */
  motionActive: boolean;
  /** ultimo stato applicato (per evitare lavoro inutile) */
  applied: PartState | null;
}

export interface TriggerOpts {
  time: number;
  vel: number;
  note: number;
  accent: boolean;
}

/** Effetti "al volo" del Mattone: attivi finché si tiene premuto il pad */
export type PerfFx = 'lp' | 'hp' | 'eco' | 'rip' | 'lofi';

export class AudioEngine {
  readonly ctx: BaseAudioContext;
  readonly analyser: AnalyserNode;
  /** analizzatori separati per i VU meter analogici (canale sinistro e destro) */
  readonly meterL: AnalyserNode;
  readonly meterR: AnalyserNode;
  /** ingresso del piatto scratch: passa dagli effetti master come le parti */
  readonly deckIn: GainNode;
  private buses: PartBus[] = [];
  /** somma "asciutta" di parti e piatto (prima dei ritorni di delay e riverbero) */
  private dry: GainNode;
  private throwSend: GainNode;
  private perf = new Set<PerfFx>();
  private sum: GainNode;
  private hp: BiquadFilterNode;
  private lp: BiquadFilterNode;
  private crusher: AudioWorkletNode | null = null;
  private crushIn: GainNode;
  private volume: GainNode;
  private delay: DelayNode;
  private delayFb: GainNode;
  private delayIn: GainNode;
  private reverb: ConvolverNode;
  private revIn: GainNode;
  private revSize = -1;
  private revTimer: ReturnType<typeof setTimeout> | null = null;
  private bpm = 160;
  private fx: MasterFx | null = null;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const c = ctx;

    this.sum = c.createGain();
    this.hp = c.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 10;
    this.hp.Q.value = 0.7;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 20000;
    this.lp.Q.value = 0.7;
    this.crushIn = c.createGain();
    this.volume = c.createGain();

    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 2;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const clip = c.createWaveShaper();
    clip.curve = masterClipCurve();
    clip.oversample = '2x';
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.55;

    this.dry = c.createGain();
    this.dry.connect(this.sum);
    this.deckIn = c.createGain();
    this.deckIn.connect(this.dry);
    this.sum.connect(this.hp).connect(this.lp).connect(this.crushIn);
    this.crushIn.connect(this.volume);
    this.volume.connect(limiter).connect(clip);
    clip.connect(this.analyser);
    clip.connect(c.destination);
    const split = c.createChannelSplitter(2);
    this.meterL = c.createAnalyser();
    this.meterR = c.createAnalyser();
    this.meterL.fftSize = this.meterR.fftSize = 1024;
    clip.connect(split);
    split.connect(this.meterL, 0);
    split.connect(this.meterR, 1);

    // Delay sincronizzato con feedback filtrato (ripetizioni sempre più scure, stile dub)
    this.delayIn = c.createGain();
    this.delay = c.createDelay(4);
    this.delayFb = c.createGain();
    const fbHp = c.createBiquadFilter();
    fbHp.type = 'highpass';
    fbHp.frequency.value = 180;
    const fbLp = c.createBiquadFilter();
    fbLp.type = 'lowpass';
    fbLp.frequency.value = 4200;
    this.delayIn.connect(this.delay);
    // ECO: lancia tutto il mix asciutto nel delay (dub throw) finché il pad è premuto
    this.throwSend = c.createGain();
    this.throwSend.gain.value = 0;
    this.dry.connect(this.throwSend).connect(this.delayIn);
    this.delay.connect(fbHp).connect(fbLp).connect(this.delayFb).connect(this.delay);
    const dlyOut = c.createGain();
    dlyOut.gain.value = 0.8;
    fbLp.connect(dlyOut).connect(this.sum);

    // Riverbero a convoluzione con IR generata (niente file esterni)
    this.revIn = c.createGain();
    const revHp = c.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 280;
    this.reverb = c.createConvolver();
    const revOut = c.createGain();
    revOut.gain.value = 0.7;
    this.revIn.connect(revHp).connect(this.reverb).connect(revOut).connect(this.sum);

    for (let i = 0; i < NUM_PARTS; i++) this.buses.push(this.makeBus());
  }

  /** Carica l'AudioWorklet del bitcrusher. Se non disponibile il crush resta disattivato. */
  async init() {
    try {
      const url = URL.createObjectURL(new Blob([CRUSHER_WORKLET], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.crusher = new AudioWorkletNode(this.ctx, 'tm-crusher', { outputChannelCount: [2] });
      this.crushIn.disconnect();
      this.crushIn.connect(this.crusher).connect(this.volume);
    } catch (e) {
      console.warn('Bitcrusher non disponibile', e);
    }
    this.setRevSize(0.45, true);
  }

  get hasCrusher() {
    return this.crusher !== null;
  }

  private makeBus(): PartBus {
    const c = this.ctx;
    const input = c.createGain();
    const shaper = c.createWaveShaper();
    shaper.oversample = '2x';
    const makeup = c.createGain();
    const pan = c.createStereoPanner();
    const level = c.createGain();
    const dly = c.createGain();
    const rev = c.createGain();
    dly.gain.value = 0;
    rev.gain.value = 0;
    input.connect(shaper).connect(makeup).connect(pan).connect(level);
    level.connect(this.dry);
    level.connect(dly).connect(this.delayIn);
    level.connect(rev).connect(this.revIn);
    return { input, shaper, makeup, pan, level, dly, rev, type: null, mono: null, voices: [], driveQ: -1, applied: null, motionActive: false };
  }

  /** Allinea i nodi persistenti allo stato di una parte (manopole mixer, synth mono). */
  applyPart(i: number, part: PartState) {
    const b = this.buses[i];
    if (b.applied === part) return;
    b.applied = part;
    const P = part.params;
    const now = this.ctx.currentTime;

    if (b.type !== part.type) {
      b.mono?.dispose();
      b.mono = null;
      for (const v of b.voices) chokeVoice(v, now);
      b.voices = [];
      b.type = part.type;
      if (isMelodic(part.type)) b.mono = new MonoSynth(this.ctx, part.type as 'bass' | 'acid', b.input);
    }
    this.setBusParams(b, P, now);
  }

  private setBusParams(b: PartBus, P: Record<string, number>, time: number) {
    b.mono?.setParams(P, this.bpm, time);
    const dq = Math.round(P.drive * 50) / 50;
    if (dq !== b.driveQ) {
      b.driveQ = dq;
      b.shaper.curve = dq > 0 ? driveCurve(dq) : null;
    }
    // la saturazione alza il volume percepito: compensazione parziale
    b.makeup.gain.setTargetAtTime(1 / (1 + dq * 1.3), time, 0.01);
    b.pan.pan.setTargetAtTime(P.pan, time, 0.01);
    // curva quadratica: la manopola LEVEL si comporta in modo più musicale
    b.level.gain.setTargetAtTime(P.level * P.level, time, 0.01);
    b.dly.gain.setTargetAtTime(P.dly, time, 0.01);
    b.rev.gain.setTargetAtTime(P.rev, time, 0.01);
  }

  /**
   * Motion sequence: applica allo step `time` i parametri effettivi (manopole + valori registrati).
   * `eff` null = la parte non ha motion: se prima ne aveva, torna ai valori delle manopole.
   */
  stepParams(i: number, part: PartState, eff: Record<string, number> | null, time: number) {
    const b = this.buses[i];
    if (b.applied !== part) this.applyPart(i, part);
    if (eff) {
      this.setBusParams(b, eff, time);
      b.motionActive = true;
    } else if (b.motionActive) {
      this.setBusParams(b, part.params, time);
      b.motionActive = false;
    }
  }

  applyFx(fx: MasterFx, bpm: number) {
    const now = this.ctx.currentTime;
    const bpmChanged = bpm !== this.bpm;
    this.bpm = bpm;
    if (bpmChanged) {
      // gli LFO dei synth sono sincronizzati al tempo
      for (const b of this.buses) if (b.mono && b.applied) b.mono.setParams(b.applied.params, bpm, now);
    }
    if (this.fx === fx && !bpmChanged) return;
    this.fx = fx;
    const P = this.perf;

    // Filtro master performativo: sinistra = passa-basso, destra = passa-alto
    const f = fx.filter;
    let lpF = f < 0 ? 20000 * Math.pow(90 / 20000, -f) : 20000;
    let hpF = f > 0 ? 15 * Math.pow(7000 / 15, f) : 10;
    const q = Math.abs(f) > 0.02 ? 4 : 0.7;
    let lpQ = f < -0.02 ? q : 0.7;
    let hpQ = f > 0.02 ? q : 0.7;
    // pad del Mattone: OVATTA chiude tutto, RADIO lascia solo le medie-alte, LO-FI scurisce
    if (P.has('lofi')) lpF = Math.min(lpF, 3800);
    if (P.has('lp')) { lpF = Math.min(lpF, 520); lpQ = 7; }
    if (P.has('hp')) { hpF = Math.max(hpF, 1600); hpQ = 4; }
    const glide = P.has('lp') ? 0.06 : 0.015;
    this.lp.frequency.setTargetAtTime(lpF, now, glide);
    this.hp.frequency.setTargetAtTime(hpF, now, 0.015);
    this.lp.Q.setTargetAtTime(lpQ, now, 0.02);
    this.hp.Q.setTargetAtTime(hpQ, now, 0.02);

    if (this.crusher) {
      const p = this.crusher.parameters;
      const c = P.has('lofi') ? Math.max(fx.crush, 0.62) : fx.crush;
      p.get('mix')!.setValueAtTime(c > 0.01 ? Math.min(1, c * 3) : 0, now);
      p.get('bits')!.setValueAtTime(16 - c * 12.5, now);
      p.get('hold')!.setValueAtTime(1 + Math.round(c * c * 28), now);
    }

    const div = DELAY_DIVS[fx.delayDiv] ?? DELAY_DIVS[5];
    // ECO: tempo dub fisso a 3/16 e ripetizioni lunghe, qualunque sia il delay del pattern
    const beats = P.has('eco') ? 0.75 : div.beats;
    this.delay.delayTime.setTargetAtTime(Math.min(3.9, (beats * 60) / bpm), now, 0.03);
    this.delayFb.gain.setTargetAtTime(P.has('eco') ? 0.66 : Math.min(0.88, fx.delayFb), now, P.has('eco') ? 0.02 : 0.05);
    this.throwSend.gain.setTargetAtTime(P.has('eco') ? 0.75 : 0, now, 0.02);
    this.setRevSize(fx.revSize);
    // il volume master ha una curva quadratica e un trim per lasciare margine al limiter
    this.volume.gain.setTargetAtTime(fx.volume * fx.volume * 1.4, now, 0.02);
  }

  /** Attiva/disattiva un effetto al volo (pad tenuti premuti). RIPETI è gestito dal sequencer. */
  setPerf(id: PerfFx, on: boolean, bpm = this.bpm) {
    if (on === this.perf.has(id)) return;
    if (on) this.perf.add(id);
    else this.perf.delete(id);
    const fx = this.fx;
    if (fx) { this.fx = null; this.applyFx(fx, bpm); }
  }

  hasPerf(id: PerfFx) {
    return this.perf.has(id);
  }

  /** Ascolto di un buffer (anteprima della cassa dei dischi) */
  preview(buf: AudioBuffer, semis = 0) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, semis / 12);
    const g = this.ctx.createGain();
    g.gain.value = 0.8;
    src.connect(g).connect(this.dry);
    src.start();
    src.stop(this.ctx.currentTime + Math.min(6, buf.duration));
    return src;
  }

  private setRevSize(size: number, immediate = false) {
    if (Math.abs(size - this.revSize) < 0.02) return;
    this.revSize = size;
    // generare l'IR costa qualche millisecondo: lo facciamo solo a manopola ferma
    if (this.revTimer) clearTimeout(this.revTimer);
    const apply = () => { this.reverb.buffer = reverbIR(this.ctx, this.revSize); };
    // in render offline non ci sono pause: applica subito
    if (immediate || 'startRendering' in this.ctx) apply();
    else this.revTimer = setTimeout(apply, 180);
  }

  /** Colpo di una parte (percussioni) o nota (synth). Ritorna false se la parte non suona. */
  trigger(i: number, part: PartState, o: TriggerOpts, legato = false, params: Record<string, number> = part.params) {
    const b = this.buses[i];
    if (b.applied !== part) this.applyPart(i, part);
    if (b.mono) {
      b.mono.noteOn({ time: o.time, note: o.note, vel: o.vel, accent: o.accent, legato });
      return;
    }
    // le parti di batteria sono monofoniche come sull'hardware: il nuovo colpo strozza il precedente
    this.cleanup(b);
    for (const v of b.voices) chokeVoice(v, o.time);
    if (part.type === 'hat') this.chokeType('ohat', o.time);
    const v = playDrum(this.ctx, part.type, b.input, {
      time: o.time, vel: o.vel, pitch: o.note, params, buffer: getSampleBuffer(part.sampleId),
    });
    if (v) b.voices.push(v);
  }

  noteOff(i: number, time: number) {
    this.buses[i].mono?.noteOff(time);
  }

  private chokeType(type: PartType, t: number) {
    for (const b of this.buses) {
      if (b.type === type) for (const v of b.voices) chokeVoice(v, t);
    }
  }

  private cleanup(b: PartBus) {
    const now = this.ctx.currentTime;
    if (!b.voices.length) return;
    b.voices = b.voices.filter((v) => {
      if (v.end > now) return true;
      // scollega subito le voci finite: un grafo che cresce costa CPU (soprattutto offline)
      try { v.choke.disconnect(); } catch { /* già scollegata */ }
      return false;
    });
  }

  /** Pulizia periodica delle voci terminate */
  gc() {
    for (const b of this.buses) this.cleanup(b);
  }

  /** Spegne tutte le note sostenute (stop, panic) */
  allNotesOff() {
    const now = this.ctx.currentTime;
    for (const b of this.buses) {
      b.mono?.noteOff(now);
    }
  }

  /** Panic: silenzia anche le code percussive */
  panic() {
    const now = this.ctx.currentTime;
    for (const b of this.buses) {
      b.mono?.kill();
      for (const v of b.voices) chokeVoice(v, now);
      b.voices = [];
    }
  }

  /** Livello RMS master corrente (0..1) per i VU / valvole */
  private meterBuf: Float32Array<ArrayBuffer> | null = null;
  level(): number {
    if (!this.meterBuf) this.meterBuf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(this.meterBuf);
    let s = 0;
    for (let i = 0; i < this.meterBuf.length; i++) s += this.meterBuf[i] * this.meterBuf[i];
    return Math.sqrt(s / this.meterBuf.length);
  }
}
