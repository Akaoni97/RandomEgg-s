// Ala destra della console: LT DECK (piatto scratch del Mattone), VU meter analogici,
// effetti al volo da tenere premuti e accesso alla cassa dei dischi.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { HwButton, RangeKnob } from './Controls';
import { AUTO_SCRATCH, SCRATCH_SEC, SEC_PER_REV } from '../audio/deck';
import {
  cutOff, cutOn, cycleDeckSource, deckMove, deckRelease, deckTouch, fxOff, fxOn, getDeck, PERF_PADS, setAuto,
  setDeckParam, setDeckSource, toggleMotor, useDeck, useFx,
} from '../deckControl';
import * as M from '../machine';
import { curPattern, useStore } from '../state/store';
import { codesFor, keyLabel, subscribeKeymap, type ActionId } from '../input/keymap';
import { usePrefs } from './skins';

let kmv = 0;
subscribeKeymap(() => { kmv++; });
const useKm = () => useSyncExternalStore(subscribeKeymap, () => kmv);
const keyOf = (id: ActionId) => codesFor(id).map(keyLabel)[0] ?? '';

const cssVar = (el: Element, n: string, d: string) => getComputedStyle(el).getPropertyValue(n).trim() || d;

/** Due VU meter ad ago, come sul Mattone: RMS del master, sinistro e destro */
function VuMeters() {
  const ref = useRef<HTMLDivElement>(null);
  const skin = usePrefs((p) => p.skin);
  useEffect(() => {
    const host = ref.current!;
    const cvs = [...host.querySelectorAll('canvas')];
    const level = [0, 0];
    let buf: Float32Array<ArrayBuffer> | null = null;
    let raf = 0;
    let col = { face1: '', face2: '', ink: '', red: '' };
    const readCol = () => {
      col = { face1: cssVar(host, '--vu-1', '#f3e9cf'), face2: cssVar(host, '--vu-2', '#d8cba7'), ink: cssVar(host, '--vu-ink', '#2a241a'), red: cssVar(host, '--vu-red', '#c2392b') };
    };
    readCol();
    const t = setTimeout(readCol, 450);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const e = M.getEngine();
      [e?.meterL, e?.meterR].forEach((an, ch) => {
        let target = 0;
        if (an) {
          if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
          an.getFloatTimeDomainData(buf);
          let s = 0;
          for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
          const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-6) + 12;
          target = Math.max(0, Math.min(1, (db + 20) / 23));
        }
        level[ch] += (target - level[ch]) * (target > level[ch] ? 0.35 : 0.12);
        const c = cvs[ch].getContext('2d')!;
        const W = 264, H = 150;
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, col.face1);
        g.addColorStop(1, col.face2);
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H + 40, R = 140, a0 = -Math.PI / 2 - 0.72, a1 = -Math.PI / 2 + 0.72;
        c.lineWidth = 2;
        c.strokeStyle = col.ink;
        c.beginPath(); c.arc(cx, cy, R, a0, a0 + (a1 - a0) * 0.72); c.stroke();
        c.strokeStyle = col.red;
        c.lineWidth = 6;
        c.beginPath(); c.arc(cx, cy, R - 2, a0 + (a1 - a0) * 0.74, a1); c.stroke();
        c.font = '16px VT323, monospace';
        c.textAlign = 'center';
        for (const m of [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]) {
          const u = (m + 20) / 23, a = a0 + (a1 - a0) * u;
          c.strokeStyle = m >= 0 ? col.red : col.ink;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
          c.lineTo(cx + Math.cos(a) * (R + 13), cy + Math.sin(a) * (R + 13));
          c.stroke();
          if ([-20, -10, -5, 0, 3].includes(m)) {
            c.fillStyle = m >= 0 ? col.red : col.ink;
            c.fillText(String(m), cx + Math.cos(a) * (R + 24), cy + Math.sin(a) * (R + 24) + 5);
          }
        }
        c.fillStyle = col.ink;
        c.font = '20px VT323, monospace';
        c.fillText('VU ' + (ch ? 'R' : 'L'), cx, H - 14);
        const a = a0 + (a1 - a0) * level[ch];
        c.strokeStyle = col.ink;
        c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10)); c.stroke();
        const sh = c.createLinearGradient(0, 0, 0, H);
        sh.addColorStop(0, 'rgba(255,255,255,.35)');
        sh.addColorStop(0.45, 'rgba(255,255,255,0)');
        sh.addColorStop(1, 'rgba(0,0,0,.18)');
        c.fillStyle = sh;
        c.fillRect(0, 0, W, H);
      });
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [skin]);
  return (
    <div className="vu-pair" ref={ref} aria-hidden="true">
      <canvas width={264} height={150} />
      <canvas width={264} height={150} />
    </div>
  );
}

/** Il disco: si trascina lungo il solco (o su e giù vicino al perno), rotellina = scratch fine */
function Platter() {
  const cv = useRef<HTMLCanvasElement>(null);
  const skin = usePrefs((p) => p.skin);
  useEffect(() => {
    const el = cv.current!;
    const S = el.width;
    let raf = 0;
    let base: HTMLCanvasElement | null = null;
    let accent = cssVar(el, '--accent', '#ff8a1f');
    const t = setTimeout(() => { accent = cssVar(el, '--accent', '#ff8a1f'); }, 450);
    const buildBase = () => {
      const b = document.createElement('canvas');
      b.width = b.height = S;
      const c = b.getContext('2d')!, cx = S / 2, R = S * 0.47, rr = R * 0.93;
      const pg = c.createRadialGradient(cx, cx, R * 0.2, cx, cx, R * 1.02);
      pg.addColorStop(0, '#3a3832');
      pg.addColorStop(1, '#1a1916');
      c.fillStyle = pg; c.beginPath(); c.arc(cx, cx, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0c0c0c'; c.beginPath(); c.arc(cx, cx, rr, 0, Math.PI * 2); c.fill();
      for (let r = rr * 0.38; r < rr * 0.985; r += Math.max(1, S / 260)) {
        c.strokeStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.035) + ')';
        c.lineWidth = 0.6;
        c.beginPath(); c.arc(cx, cx, r, 0, Math.PI * 2); c.stroke();
      }
      [0.55, 0.72, 0.86].forEach((f) => { c.strokeStyle = 'rgba(0,0,0,.9)'; c.lineWidth = S / 180; c.beginPath(); c.arc(cx, cx, rr * f, 0, Math.PI * 2); c.stroke(); });
      return b;
    };
    let lastA = NaN;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const d = getDeck();
      const a = d ? d.angle() : 0;
      const touching = useDeck.getState().touching;
      if (Math.abs(a - lastA) < 0.002 && !touching && base) return;
      lastA = a;
      if (!base) base = buildBase();
      const c = el.getContext('2d')!, cx = S / 2, R = S * 0.47, rr = R * 0.93;
      c.clearRect(0, 0, S, S);
      c.drawImage(base, 0, 0);
      c.save();
      c.translate(cx, cx);
      c.rotate(a);
      c.fillStyle = '#8b8577';
      for (let i = 0; i < 90; i++) { const r = (i / 90) * Math.PI * 2; c.fillRect(Math.cos(r) * (R * 0.965) - S / 400, Math.sin(r) * (R * 0.965) - S / 400, S / 200, S / 200); }
      c.fillStyle = accent; c.beginPath(); c.arc(0, 0, rr * 0.34, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(0, 0, rr * 0.34, 0, Math.PI); c.fill();
      c.fillStyle = '#1a140a';
      c.textAlign = 'center';
      c.font = `${Math.round(S * 0.046)}px Bungee, Impact, sans-serif`;
      c.fillText('LUCATEKNO', 0, -rr * 0.12);
      c.font = `${Math.round(S * 0.03)}px Silkscreen, monospace`;
      c.fillText('LATO A · 33⅓', 0, rr * 0.2);
      c.fillStyle = '#ebe1c6'; c.beginPath(); c.arc(rr * 0.27, 0, S / 90, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#cfc6ad'; c.beginPath(); c.arc(0, 0, S / 70, 0, Math.PI * 2); c.fill();
      c.restore();
      const sh = c.createLinearGradient(cx - rr, cx - rr, cx + rr, cx + rr);
      sh.addColorStop(0.3, 'rgba(255,255,255,0)');
      sh.addColorStop(0.47, 'rgba(255,255,255,.07)');
      sh.addColorStop(0.53, 'rgba(255,255,255,.07)');
      sh.addColorStop(0.7, 'rgba(255,255,255,0)');
      c.fillStyle = sh; c.beginPath(); c.arc(cx, cx, rr, 0, Math.PI * 2); c.fill();
      if (touching) { c.strokeStyle = accent; c.lineWidth = S / 120; c.beginPath(); c.arc(cx, cx, rr + S / 100, 0, Math.PI * 2); c.stroke(); }
      // braccio
      c.save();
      c.lineCap = 'round';
      const px = S * 0.9, py = S * 0.1;
      c.fillStyle = '#3a3832'; c.beginPath(); c.arc(px, py, S * 0.055, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8b8577'; c.beginPath(); c.arc(px, py, S * 0.025, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b5ac94'; c.lineWidth = S / 70;
      c.beginPath(); c.moveTo(px, py); c.lineTo(S * 0.82, S * 0.58); c.lineTo(S * 0.7, S * 0.7); c.stroke();
      c.fillStyle = '#1d1c19';
      c.save(); c.translate(S * 0.7, S * 0.7); c.rotate(0.8); c.fillRect(-S * 0.03, -S * 0.02, S * 0.07, S * 0.04); c.restore();
      c.restore();
    };
    raf = requestAnimationFrame(draw);

    // --- mano sul disco ---
    let rect: DOMRect | null = null;
    let lx = 0, ly = 0, travel = 0, down = false;
    let hist: [number, number][] = [];
    let wheelT: ReturnType<typeof setTimeout> | null = null;
    const onMove = (x: number, y: number) => {
      if (!rect) return;
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const r0 = Math.hypot(lx - cx, ly - cy), r1 = Math.hypot(x - cx, y - cy);
      let sec: number;
      if (Math.min(r0, r1) > rect.width * 0.1) {
        let d = Math.atan2(y - cy, x - cx) - Math.atan2(ly - cy, lx - cx);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        sec = (d / (Math.PI * 2)) * SEC_PER_REV; // il disco gira esattamente sotto il dito
      } else sec = ((y - ly) / rect.width) * SCRATCH_SEC; // vicino al perno: su e giù
      lx = x; ly = y;
      if (!sec) return;
      travel += sec;
      deckMove(sec);
      hist.push([performance.now(), travel]);
      while (hist.length > 6) hist.shift();
    };
    const pd = (e: PointerEvent) => {
      if (!getDeck()) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      rect = el.getBoundingClientRect();
      lx = e.clientX; ly = e.clientY; travel = 0; down = true;
      hist = [[performance.now(), 0]];
      deckTouch();
    };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (evs.length) evs.forEach((c) => onMove(c.clientX, c.clientY));
      else onMove(e.clientX, e.clientY);
    };
    const pu = () => {
      if (!down) return;
      down = false;
      const a0 = hist[0], b = hist[hist.length - 1], dt = (b[0] - a0[0]) / 1000;
      // lancio: se la mano si stava muovendo al rilascio, il disco prosegue con quella velocità
      const rate = dt > 0 && performance.now() - b[0] < 60 ? Math.max(-4, Math.min(4, (b[1] - a0[1]) / dt)) : 0;
      deckRelease(rate);
    };
    const wh = (e: WheelEvent) => {
      if (!getDeck()) return;
      e.preventDefault();
      if (!wheelT) deckTouch();
      else clearTimeout(wheelT);
      deckMove(e.deltaY * 0.0012);
      wheelT = setTimeout(() => { wheelT = null; deckRelease(0); }, 90);
    };
    el.addEventListener('pointerdown', pd);
    el.addEventListener('pointermove', pm);
    el.addEventListener('pointerup', pu);
    el.addEventListener('pointercancel', pu);
    el.addEventListener('lostpointercapture', pu);
    el.addEventListener('wheel', wh, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      el.removeEventListener('pointerdown', pd);
      el.removeEventListener('pointermove', pm);
      el.removeEventListener('pointerup', pu);
      el.removeEventListener('pointercancel', pu);
      el.removeEventListener('lostpointercapture', pu);
      el.removeEventListener('wheel', wh);
    };
  }, [skin]);
  return <canvas ref={cv} className="platter" width={560} height={560} title="Disco: trascina avanti e indietro per scratchare. Tenerlo fermo fa silenzio, come su un vinile vero." />;
}

export function DeckSection() {
  useKm();
  const d = useDeck();
  const powered = useStore((s) => s.powered);
  const bpm = useStore((s) => curPattern(s).bpm);
  return (
    <section className="sec deck-sec">
      <div className="sec-title">LT DECK · PIATTO SCRATCH</div>
      <VuMeters />
      <div className="deck-body">
        <div className="platter-well">
          <Platter />
          {!d.ready && powered && <div className="platter-msg">CARICO IL DISCO…</div>}
        </div>
        <div className="pitch-fader" title="Pitch del piatto (±16 %)">
          <div className="silk">PITCH</div>
          <input
            type="range" min={-16} max={16} step={1} value={d.pitch} tabIndex={-1}
            onChange={(e) => setDeckParam({ pitch: +e.target.value })}
            onDoubleClick={() => setDeckParam({ pitch: 0 })}
          />
          <div className="pitch-val">{d.pitch > 0 ? '+' : ''}{d.pitch}%</div>
        </div>
      </div>
      <div className="auto-row" title={`Tecniche classiche eseguite a tempo (${bpm.toFixed(0)} BPM). Tocca il disco per riprenderlo.`}>
        {AUTO_SCRATCH.map((a) => (
          <button key={a.id} tabIndex={-1} className={`chip-btn ${d.auto === a.id ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setAuto(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="deck-src">
        <HwButton size="sm" sub="◀" onPress={() => cycleDeckSource(-1)} title={`Disco precedente (Shift+${keyOf('deckSrc')})`} />
        <div className={`deck-lcd ${d.busy ? 'busy' : ''}`} title="Cosa c'è sul disco. LOOP DEL PATTERN e PARTE SELEZIONATA registrano una battuta della macchina.">
          <span className="deck-lcd-k">DISCO</span>
          <span className="deck-lcd-v">{d.busy ? 'CARICO…' : d.label}</span>
        </div>
        <HwButton size="sm" sub="▶" onPress={() => cycleDeckSource(1)} title={`Disco successivo (${keyOf('deckSrc')})`} />
        <HwButton size="sm" sub="↻" onPress={() => void setDeckSource(d.src)} title="Ricarica il disco (per LOOP: ri-registra il pattern dopo averlo cambiato)" />
      </div>
      <div className="deck-ctl">
        <HwButton size="md" tone="black" led="green" ledOn={d.motor} sub={`START/STOP · ${keyOf('motor')}`} onPress={() => toggleMotor()} title="Fa girare il disco a 33⅓; il pitch lo accelera o lo rallenta" />
        <div className="xfader">
          <div className="silk">FADER</div>
          <input type="range" min={0} max={100} value={Math.round(d.xf * 100)} tabIndex={-1} onChange={(e) => setDeckParam({ xf: +e.target.value / 100 })} title="Crossfader del piatto" />
        </div>
        <HwButton size="md" tone="red" led="red" ledOn={d.cut} sub={`TAGLIO · ${keyOf('cut')}`} onPress={() => cutOn()} onRelease={() => cutOff()} title="Tieni premuto: apre e chiude il fader al volo, come un crossfader" />
      </div>
      <div className="knob-row deck-knobs">
        <RangeKnob label="CUPO↔CHIARO" size={46} value={d.tone} min={0} max={1} def={0.62} fmt={(v) => Math.round((380 * Math.pow(2, v * 4.4)) / 10) * 10 + 'Hz'} onSet={(v) => setDeckParam({ tone: v })} hint="Colore dello scratch: tutto a sinistra è scuro" />
        <RangeKnob label="SPORCO" size={46} value={d.dirt} min={0} max={1} def={0.25} fmt={(v) => Math.round(v * 100) + ''} onSet={(v) => setDeckParam({ dirt: v })} hint="Sporco come un campionatore a 12 bit" />
        <RangeKnob label="LIVELLO" size={46} cap="silver" value={d.level} min={0} max={1} def={0.8} fmt={(v) => Math.round(v * 100) + ''} onSet={(v) => setDeckParam({ level: v })} hint="Volume del piatto nel mix (passa dagli effetti master)" />
      </div>
    </section>
  );
}

export function FxPadsSection() {
  useKm();
  const fx = useFx();
  return (
    <section className="sec fxpads-sec">
      <div className="sec-title">EFFETTI AL VOLO · TIENI PREMUTO</div>
      <div className="fxpads">
        {PERF_PADS.map((p, i) => (
          <button
            key={p.id}
            tabIndex={-1}
            className={`fxpad ${fx[p.id] ? 'on' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => { if (e.button) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); fxOn(p.id); }}
            onPointerUp={() => fxOff(p.id)}
            onPointerCancel={() => fxOff(p.id)}
            onLostPointerCapture={() => fxOff(p.id)}
            title={`${p.name}: ${p.hint} (tasto ${keyOf(`fx${i}` as ActionId)})`}
          >
            <b>{p.name}</b>
            <small>{p.hint} · {keyOf(`fx${i}` as ActionId)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CrateSection() {
  useKm();
  const part = useStore((s) => curPattern(s).parts[s.selectedPart]);
  const pi = useStore((s) => s.selectedPart);
  return (
    <section className="sec crate-sec">
      <button tabIndex={-1} className="crate-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => useStore.setState({ crateOpen: true })} title={`Cassa dei dischi (${keyOf('crate')})`}>
        <span className="crate-title">CASSA DEI DISCHI</span>
        <span className="crate-sub">240 suoni del Mattone · {keyOf('crate')}</span>
      </button>
      <div className="crate-target">
        <span className="silk">VA NELLA PARTE</span>
        <b>{pi + 1} {part.name}</b>
      </div>
    </section>
  );
}
