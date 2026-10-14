// Visualizzatore audio animato: spettro + oscilloscopio dall'AnalyserNode del master,
// impulso sui beat (quarti) e sul kick letti dal playhead del sequencer, quindi a tempo
// con la musica e non con un timer indipendente. Lo stile cambia con la scocca.

import { useEffect, useRef } from 'react';
import * as M from '../machine';
import { usePlayhead, useStore } from '../state/store';
import { skinById, usePrefs, type VizStyle } from './skins';

const W = 736;
const H = 192;
const BANDS = 28;

interface Colors { bg: string; a: string; b: string; line: string }

function readColors(el: HTMLElement): Colors {
  const cs = getComputedStyle(el);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return { bg: v('--viz-bg', '#000'), a: v('--viz-a', '#f80'), b: v('--viz-b', '#f20'), line: v('--viz-line', '#fff') };
}

/** Bande logaritmiche 40 Hz – 16 kHz */
function bandEdges(sampleRate: number, bins: number): number[] {
  const nyq = sampleRate / 2;
  const edges: number[] = [];
  for (let i = 0; i <= BANDS; i++) {
    const f = 40 * Math.pow(16000 / 40, i / BANDS);
    edges.push(Math.min(bins - 1, Math.max(1, Math.round((f / nyq) * bins))));
  }
  return edges;
}

export function Visualizer() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const skin = usePrefs((p) => p.skin);
  const style: VizStyle = skinById(skin).viz;

  useEffect(() => {
    const cv = canvas.current!;
    const g = cv.getContext('2d')!;
    let colors = readColors(wrap.current!);
    // i colori cambiano a metà dell'animazione di cambio scocca
    const t = setTimeout(() => { colors = readColors(wrap.current!); }, 50);
    let raf = 0;
    let freq: Uint8Array<ArrayBuffer> | null = null;
    let wave: Uint8Array<ArrayBuffer> | null = null;
    let edges: number[] = [];
    const levels = new Float32Array(BANDS);
    const peaks = new Float32Array(BANDS);
    let pulse = 0;
    let kick = 0;
    let lastStep = -1;
    let lastKick = 0;
    let idle = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const e = M.getEngine();
      const ph = usePlayhead.getState();
      const st = useStore.getState();

      // --- impulsi a tempo: beat (ogni 4 step) e colpo di kick (parte 1)
      if (st.playing && ph.step !== lastStep && ph.step >= 0) {
        if (ph.step % 4 === 0) pulse = 1;
        lastStep = ph.step;
      }
      if (ph.flash[0] !== lastKick) { lastKick = ph.flash[0]; kick = 1; }
      pulse *= 0.88;
      kick *= 0.82;
      wrap.current?.style.setProperty('--pulse', (Math.max(pulse * 0.8, kick)).toFixed(3));

      // --- dati audio
      let energy = 0;
      if (e) {
        const an = e.analyser;
        if (!freq || freq.length !== an.frequencyBinCount) {
          freq = new Uint8Array(an.frequencyBinCount);
          wave = new Uint8Array(an.fftSize);
          edges = bandEdges(e.ctx.sampleRate, an.frequencyBinCount);
        }
        an.getByteFrequencyData(freq);
        an.getByteTimeDomainData(wave!);
        for (let i = 0; i < BANDS; i++) {
          let m = 0;
          for (let k = edges[i]; k <= Math.max(edges[i], edges[i + 1] - 1); k++) m = Math.max(m, freq[k]);
          // leggera enfasi sugli acuti, altrimenti i bassi della tekno schiacciano tutto
          const v = Math.min(1, (m / 255) * (0.85 + (i / BANDS) * 0.35));
          levels[i] = v > levels[i] ? v : levels[i] * 0.86 + v * 0.14;
          peaks[i] = Math.max(levels[i], peaks[i] - 0.012);
          energy += levels[i];
        }
      }
      energy /= BANDS;
      idle += 0.03;

      // --- disegno
      g.fillStyle = colors.bg;
      g.fillRect(0, 0, W, H);
      // reticolo
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 1;
      for (let y = 24; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

      if (!st.powered) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.font = '28px "VT323", monospace';
        g.textAlign = 'center';
        g.fillText('NO SIGNAL', W / 2, H / 2 + 8);
        return;
      }

      const bump = 1 + kick * 0.12;
      const base = H - 26;
      const bw = W / BANDS;
      const grad = g.createLinearGradient(0, base, 0, 0);
      grad.addColorStop(0, colors.a);
      grad.addColorStop(1, colors.b);

      // livelli di riposo quando la macchina non suona: respiro lento
      const lv = (i: number) => (energy < 0.004 ? 0.04 + 0.03 * Math.sin(idle + i * 0.45) : Math.min(1, levels[i] * bump));

      g.shadowColor = colors.a;
      g.shadowBlur = 6 + pulse * 18;

      if (style === 'segments' || style === 'blocks') {
        const segs = style === 'blocks' ? 9 : 14;
        const sh = (base - 6) / segs;
        for (let i = 0; i < BANDS; i++) {
          const n = Math.round(lv(i) * segs);
          for (let s = 0; s < n; s++) {
            g.fillStyle = s >= segs * 0.75 ? colors.b : colors.a;
            g.globalAlpha = 0.55 + 0.45 * (s / segs);
            g.fillRect(i * bw + 2, base - (s + 1) * sh + 1, bw - 4, sh - (style === 'blocks' ? 4 : 2));
          }
          g.globalAlpha = 1;
          g.fillStyle = colors.line;
          g.fillRect(i * bw + 2, base - Math.round(peaks[i] * segs) * sh - 2, bw - 4, 2);
        }
      } else if (style === 'mirror') {
        const mid = base / 2 + 2;
        for (let i = 0; i < BANDS; i++) {
          const h = lv(i) * (mid - 6);
          g.fillStyle = grad;
          g.fillRect(i * bw + 3, mid - h, bw - 6, h * 2);
          g.fillStyle = colors.line;
          g.globalAlpha = 0.7;
          g.fillRect(i * bw + 3, mid - peaks[i] * (mid - 6) - 2, bw - 6, 2);
          g.fillRect(i * bw + 3, mid + peaks[i] * (mid - 6), bw - 6, 2);
          g.globalAlpha = 1;
        }
      } else {
        // scope: barre tenui dietro, oscilloscopio protagonista
        g.globalAlpha = 0.35;
        for (let i = 0; i < BANDS; i++) {
          const h = lv(i) * (base - 8);
          g.fillStyle = grad;
          g.fillRect(i * bw + 2, base - h, bw - 4, h);
        }
        g.globalAlpha = 1;
      }

      // oscilloscopio (sempre, più spesso sullo stile scope)
      if (wave) {
        const scope = style === 'scope';
        g.strokeStyle = colors.line;
        g.lineWidth = scope ? 3 + pulse * 2 : 1.5;
        g.globalAlpha = scope ? 0.95 : 0.45;
        g.shadowColor = colors.line;
        g.shadowBlur = scope ? 12 + pulse * 16 : 4;
        g.beginPath();
        const n = wave.length;
        const mid = (base - 4) / 2 + 2;
        const amp = (scope ? base * 0.9 : base * 0.5) * bump;
        for (let x = 0; x < W; x += 3) {
          const v = (wave[Math.floor((x / W) * n)] - 128) / 128;
          const y = mid + v * amp * 0.5;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
      g.shadowBlur = 0;

      // riga dei 16 step: la posizione nella battuta, a tempo con il sequencer
      const step = st.playing ? ph.step % 16 : -1;
      const dw = W / 16;
      for (let i = 0; i < 16; i++) {
        const on = i === step;
        g.fillStyle = on ? colors.line : i % 4 === 0 ? colors.a : 'rgba(255,255,255,0.18)';
        g.globalAlpha = on ? 1 : i % 4 === 0 ? 0.6 : 1;
        g.fillRect(i * dw + 5, H - 14, dw - 10, on ? 9 : 5);
      }
      g.globalAlpha = 1;

      // flash del beat
      if (pulse > 0.05) {
        g.fillStyle = colors.a;
        g.globalAlpha = pulse * 0.12;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
    };
    frame();
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [style, skin]);

  return (
    <div className="viz" ref={wrap} title="Visualizzatore audio: spettro e forma d'onda del master, impulsi sui beat del sequencer">
      <canvas ref={canvas} width={W} height={H} />
      <div className="viz-label">SPECTRUM · SCOPE · BEAT SYNC</div>
    </div>
  );
}
