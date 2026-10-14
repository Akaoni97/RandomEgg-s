import { useEffect, useRef, useSyncExternalStore } from 'react';
import { HwButton, Led, ParamKnob, RangeKnob } from './Controls';
import { Lcd } from './Lcd';
import { actions, curPattern, usePlayhead, useStore, type PageId } from '../state/store';
import { KNOB_MAP, TYPE_LABEL, isMelodic } from '../state/params';
import { DELAY_DIVS } from '../state/types';
import { codesFor, keyLabel, STEP_CODES, subscribeKeymap } from '../input/keymap';
import { dispatch, padPress, stepPress, stepRelease } from '../input/keyboard';
import { lcdCursor, lcdEnter, lcdNudge } from '../lcd/menu';
import * as M from '../machine';

let keymapVersion = 0;
subscribeKeymap(() => { keymapVersion++; });
const useKeymapVersion = () => useSyncExternalStore(subscribeKeymap, () => keymapVersion);

const set = useStore.setState;

// ---------------------------------------------------------------------------
// Valvole: il bagliore segue il livello master reale
// ---------------------------------------------------------------------------
export function Tubes() {
  const ref = useRef<HTMLDivElement>(null);
  const powered = useStore((s) => s.powered);
  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const e = M.getEngine();
      const lvl = e ? e.level() : 0;
      smooth = Math.max(lvl, smooth * 0.9);
      const flicker = 0.92 + Math.random() * 0.08;
      const g = powered ? Math.min(1, 0.35 + smooth * 2.2) * flicker : 0;
      ref.current?.style.setProperty('--glow', g.toFixed(3));
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [powered]);
  return (
    <div className="tubes" ref={ref}>
      {[0, 1].map((i) => (
        <div className="tube" key={i}>
          <div className="tube-glass">
            <div className="tube-plate" />
            <div className="tube-filament" />
            <div className="tube-getter" />
          </div>
          <div className="tube-base" />
        </div>
      ))}
      <div className="tubes-label">VALVE DRIVE · 12AX7</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sezione display + navigazione
// ---------------------------------------------------------------------------

const MODE_BUTTONS: { label: string; pages: PageId[]; title: string }[] = [
  { label: 'PATTERN', pages: ['pattern'], title: 'Pattern: tempo, swing, lunghezza' },
  { label: 'PART EDIT', pages: ['osc', 'filter', 'env', 'mod', 'partfx'], title: 'Edit della parte (premi più volte: OSC → FILTER → ENV → MOD → MIX)' },
  { label: 'MASTER FX', pages: ['master'], title: 'Effetti master: filtro, bitcrusher, delay, riverbero' },
  { label: 'STEP EDIT', pages: ['step'], title: 'Nota, gate, accento e slide dello step selezionato' },
  { label: 'SONG', pages: ['song'], title: 'Song mode (fase 3: non ancora implementato)' },
  { label: 'GLOBAL', pages: ['global'], title: 'Impostazioni globali, mappa tasti, aiuto' },
  { label: 'SAVE/LOAD', pages: ['file'], title: 'Slot, preset, file, export WAV' },
];

export function DisplaySection() {
  const page = useStore((s) => s.page);
  const dirty = useStore((s) => s.dirty);
  const zoom = useStore((s) => s.lcdZoom);
  const help = useStore((s) => s.help);
  const wheelRef = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const drag = useRef<{ y: number; acc: number } | null>(null);

  const turn = (dir: number, fine: boolean) => {
    angle.current += dir * 12;
    if (wheelRef.current) wheelRef.current.style.setProperty('--rot', angle.current + 'deg');
    lcdNudge(dir, fine);
  };

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      turn(e.deltaY < 0 ? 1 : -1, e.shiftKey);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <section className="sec display-sec">
      <div className="lcd-bezel">
        <Lcd />
        <div className="lcd-caption">
          <span>EMBEDDED OS v0.1</span>
          <button tabIndex={-1} className="zoom-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => set({ lcdZoom: !zoom })} title="Ingrandisci il display (F2)">
            ZOOM
          </button>
        </div>
      </div>
      <div className="nav-cluster">
        <div className="nav-row">
          <HwButton size="sm" label="PAGE" sub="◀" onPress={() => actions.movePage(-1)} title="Pagina precedente ( , )" />
          <HwButton size="sm" label={'\u00a0'} sub="▶" onPress={() => actions.movePage(1)} title="Pagina successiva ( . )" />
          <HwButton size="sm" label="CURSOR" sub="◀" onPress={() => lcdCursor(-1)} title="Voce precedente (←)" />
          <HwButton size="sm" label={'\u00a0'} sub="▶" onPress={() => lcdCursor(1)} title="Voce successiva (→)" />
        </div>
        <div className="nav-row">
          <HwButton size="sm" label="EXIT" onPress={() => dispatch('exit', false)} title="Torna alla pagina PATTERN (Backspace)" />
          <HwButton size="sm" label="ENTER" tone="orange" onPress={() => lcdEnter()} title="Esegue la voce selezionata (Enter)" />
          <HwButton size="sm" label="WRITE" tone="red" led="red" ledOn={dirty} onPress={() => M.writeProject()} title="Salva nello slot selezionato (Ctrl+S). LED acceso = modifiche non salvate" />
        </div>
      </div>
      <div className="value-wheel-wrap">
        <div className="silk">VALUE</div>
        <div
          className="value-wheel"
          ref={wheelRef}
          title="VALUE: trascina o usa la rotellina (Shift = fine)"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, acc: 0 };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            d.acc += d.y - e.clientY;
            d.y = e.clientY;
            const th = e.shiftKey ? 14 : 7;
            while (Math.abs(d.acc) >= th) {
              const dir = Math.sign(d.acc);
              d.acc -= dir * th;
              turn(dir, e.shiftKey);
            }
          }}
          onPointerUp={() => { drag.current = null; }}
        >
          <div className="value-wheel-dimple" />
        </div>
        <div className="wheel-pm">
          <HwButton size="sm" sub="−" onPress={(e) => turn(-1, e.shiftKey)} title="Valore − (tasto −)" />
          <HwButton size="sm" sub="+" onPress={(e) => turn(1, e.shiftKey)} title="Valore + (tasto +)" />
        </div>
      </div>
      <div className="mode-grid">
        {MODE_BUTTONS.map((b) => {
          const active = b.pages.includes(page);
          return (
            <HwButton
              key={b.label}
              size="sm"
              label={b.label}
              led="orange"
              ledOn={active}
              title={b.title}
              onPress={() => {
                if (active && b.pages.length > 1) {
                  const i = b.pages.indexOf(page);
                  actions.setPage(b.pages[(i + 1) % b.pages.length]);
                } else actions.setPage(b.pages[0]);
              }}
            />
          );
        })}
        <HwButton size="sm" label="HELP" led="green" ledOn={help} onPress={() => set({ help: true })} title="Mappa dei comandi (H / F1)" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Master
// ---------------------------------------------------------------------------
export function MasterSection() {
  const pt = useStore((s) => curPattern(s));
  const fx = pt.fx;
  const setFx = actions.setFx;
  return (
    <section className="sec master-sec">
      <div className="sec-title">MASTER · PERFORMANCE</div>
      <div className="knob-row">
        <RangeKnob label="FILTER" value={fx.filter} min={-1} max={1} def={0} bipolar cap="orange"
          fmt={(v) => (Math.abs(v) < 0.01 ? 'OFF' : (v < 0 ? 'LP ' : 'HP ') + Math.round(Math.abs(v) * 100))}
          onSet={(v) => setFx({ filter: Math.abs(v) < 0.015 ? 0 : v })} hint="Filtro master performativo: sinistra passa-basso, destra passa-alto" />
        <RangeKnob label="CRUSH" value={fx.crush} min={0} max={1} def={0} fmt={(v) => Math.round(v * 100) + ''} onSet={(v) => setFx({ crush: v })} hint="Bitcrusher master (riduzione bit e campionamento)" />
        <RangeKnob label="DLY TIME" value={fx.delayDiv} min={0} max={DELAY_DIVS.length - 1} step={1} def={5} fmt={(v) => DELAY_DIVS[Math.round(v)].label} onSet={(v) => setFx({ delayDiv: Math.round(v) })} hint="Tempo del delay, sincronizzato al BPM" />
        <RangeKnob label="DLY FDBK" value={fx.delayFb} min={0} max={0.9} def={0.35} fmt={(v) => Math.round(v * 100) + ''} onSet={(v) => setFx({ delayFb: v })} hint="Ripetizioni del delay" />
        <RangeKnob label="REV SIZE" value={fx.revSize} min={0} max={1} def={0.45} fmt={(v) => Math.round(v * 100) + ''} onSet={(v) => setFx({ revSize: v })} hint="Dimensione del riverbero" />
        <RangeKnob label="SWING" value={pt.swing} min={50} max={75} step={1} def={50} fmt={(v) => Math.round(v) + '%'} onSet={(v) => actions.setSwing(v)} hint="Swing sui sedicesimi in levare" />
        <RangeKnob label="TEMPO" value={pt.bpm} min={60} max={260} step={0.5} def={165} cap="silver" fmt={(v) => v.toFixed(1)} onSet={(v) => actions.setBpm(v)} hint="BPM (Shift per regolazione fine, doppio click per valore esatto)" />
        <RangeKnob label="MASTER" value={fx.volume} min={0} max={1} def={0.85} cap="silver" fmt={(v) => Math.round(v * 100) + ''} onSet={(v) => setFx({ volume: v })} hint="Volume master (limiter di sicurezza sempre attivo)" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sound + mix della parte selezionata
// ---------------------------------------------------------------------------
export function SoundSection() {
  const part = useStore((s) => curPattern(s).parts[s.selectedPart]);
  const pi = useStore((s) => s.selectedPart);
  const map = KNOB_MAP[part.type];
  return (
    <section className="sec sound-sec">
      <div className="sec-title">
        SOUND · PART {pi + 1} <span className="silk-orange">{TYPE_LABEL[part.type]}</span>
        <span className="sec-note">le serigrafie seguono il tipo di parte</span>
      </div>
      <div className="knob-row">
        {map.map((id, i) => <ParamKnob key={part.type + i} id={id} />)}
      </div>
    </section>
  );
}

export function MixSection() {
  return (
    <section className="sec mix-sec">
      <div className="sec-title">PART MIX / FX SEND</div>
      <div className="knob-row">
        <ParamKnob id="drive" />
        <ParamKnob id="dly" />
        <ParamKnob id="rev" />
        <ParamKnob id="pan" />
        <ParamKnob id="level" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Parti: selezione, mute, solo, LED di trigger
// ---------------------------------------------------------------------------
function PartFlash({ i }: { i: number }) {
  const t = usePlayhead((p) => p.flash[i]);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !t) return;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }, [t]);
  return <span ref={ref} className="part-flash" />;
}

export function PartsSection() {
  const parts = useStore((s) => curPattern(s).parts);
  const sel = useStore((s) => s.selectedPart);
  const live = useStore((s) => s.kbdMode === 'live');
  const anySolo = parts.some((p) => p.solo);
  return (
    <section className="sec parts-sec">
      <div className="sec-title">PART SELECT · MUTE · SOLO</div>
      <div className="parts-row">
        {parts.map((p, i) => (
          <div className={`part-cell ${i === sel ? 'sel' : ''}`} key={i}>
            <div className="part-name">{i + 1} {p.name}</div>
            <HwButton
              size="lg"
              tone={isMelodic(p.type) ? 'orange' : 'black'}
              led="orange"
              ledOn={i === sel}
              title={`Seleziona ${p.name} (↑/↓). In LIVE MODE il clic la suona.`}
              onPress={(e) => {
                actions.selectPart(i);
                if (live) padPress(i, e.shiftKey, 'mouse:part' + i);
              }}
              onRelease={() => M.liveRelease('mouse:part' + i)}
            >
              <PartFlash i={i} />
            </HwButton>
            <div className="part-ms">
              <HwButton size="sm" led="red" ledOn={p.mute || (anySolo && !p.solo)} ledBlink={anySolo && !p.solo && !p.mute} sub="MUTE" onPress={() => actions.toggleMute(i)} title="Mute (M)" />
              <HwButton size="sm" led="green" ledOn={p.solo} sub="SOLO" onPress={() => actions.toggleSolo(i)} title="Solo (N)" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trasporto e funzioni pattern
// ---------------------------------------------------------------------------
export function TransportSection() {
  const playing = useStore((s) => s.playing);
  const rec = useStore((s) => s.recording);
  const mode = useStore((s) => s.kbdMode);
  const cur = useStore((s) => s.project.current);
  const queued = useStore((s) => s.queuedPattern);
  const step = usePlayhead((p) => p.step);
  const beat = playing && step >= 0 && step % 4 === 0;
  return (
    <section className="sec transport-sec">
      <div className="sec-title">PATTERN · TRANSPORT</div>
      <div className="transport-grid">
        <div className="pat-block">
          <div className="seg-display" title="Pattern corrente (lampeggia il prossimo in coda)">
            <span className="seg-ghost">88</span>
            <span className="seg-on">{String((queued ?? cur) + 1).padStart(2, '0')}</span>
            {queued !== null && <span className="seg-q">NEXT</span>}
          </div>
          <div className="pat-btns">
            <HwButton size="sm" sub="PAT −" onPress={() => actions.selectPattern(cur - 1)} title="Pattern precedente (Pag↓)" />
            <HwButton size="sm" sub="PAT +" onPress={() => actions.selectPattern(cur + 1)} title="Pattern successivo (Pag↑)" />
          </div>
          <div className="pat-btns">
            <HwButton size="sm" sub="COPY" onPress={() => actions.copyPattern()} title="Copia pattern (Ctrl+C)" />
            <HwButton size="sm" sub="PASTE" onPress={() => actions.pastePattern()} title="Incolla pattern (Ctrl+V)" />
            <HwButton size="sm" sub="CLEAR" onPress={(e) => (e.shiftKey ? actions.clearPattern() : actions.clearPart(useStore.getState().selectedPart))} title="Cancella la parte selezionata (Canc). Shift+clic = tutto il pattern" />
          </div>
        </div>
        <div className="kbd-mode">
          <div className="silk">KEYBOARD</div>
          <HwButton size="md" onPress={() => dispatch('mode', false)} title="Modalità tastiera STEP / LIVE (Tab)">
            <span className="mode-leds">
              <Led color="red" on={mode === 'step'} small /> STEP
              <br />
              <Led color="green" on={mode === 'live'} small /> LIVE
            </span>
          </HwButton>
          <HwButton size="sm" sub="TAP" led="red" ledOn={beat} onPress={() => M.tap()} title="Tap tempo (T)" />
        </div>
        <div className="transport-btns">
          <HwButton size="lg" tone="red" led="red" ledOn={rec} ledBlink={rec && playing} sub="REC" onPress={() => M.toggleRec()} title="Registrazione LIVE quantizzata (Shift+Spazio)" />
          <HwButton size="lg" tone="black" sub="STOP" onPress={() => M.stop()} title="Stop (Esc). Due volte = silenzia tutto" />
          <HwButton size="lg" tone="black" led="green" ledOn={playing} sub="PLAY/PAUSE" onPress={() => M.playPause()} title="Play / Pausa (Spazio)" />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// I 16 tasti step
// ---------------------------------------------------------------------------
function StepKey({ k }: { k: number }) {
  useKeymapVersion();
  const s = useStore();
  const ph = usePlayhead((p) => p.step);
  const pt = curPattern(s);
  const part = pt.parts[s.selectedPart];
  const idx = s.stepPage * 16 + k;
  const st = part.steps[idx];
  const inRange = idx < pt.length;
  const live = s.kbdMode === 'live';
  const playhead = s.playing && ph === idx;
  const code = codesFor(`step${k}`)[0] ?? STEP_CODES[k];
  const held = !!s.held[code];
  const selected = !live && s.page === 'step' && s.selectedStep === idx;
  const lit = !live && inRange && st.on;
  const padLabel = live ? (k < 8 ? pt.parts[k].name : `${part.name} ${M.LIVE_SCALE[k - 8] ? '+' + M.LIVE_SCALE[k - 8] : 'ROOT'}`) : null;
  const key = 'mouse:step' + k;
  return (
    <div className={`step-wrap ${k % 4 === 0 ? 'group-start' : ''}`}>
      <div className="step-num">{idx + 1}</div>
      <button
        tabIndex={-1}
        className={`step-key ${lit ? 'on' : ''} ${lit && st.acc ? 'acc' : ''} ${playhead ? 'ph' : ''} ${held ? 'held' : ''} ${!inRange && !live ? 'out' : ''} ${selected ? 'selected' : ''} ${live ? 'live' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button === 2) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          if (e.altKey && !live) { actions.toggleSlide(s.selectedPart, idx); return; }
          stepPress(k, e.shiftKey, key);
        }}
        onPointerUp={() => stepRelease(k, key)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!live && inRange) actions.toggleAccent(s.selectedPart, idx);
        }}
        title={live ? 'Pad: suona (Shift = accento)' : 'Clic: on/off · Shift+clic o tasto destro: accento · Alt+clic: slide · tieni premuto e usa +/−: nota'}
      >
        <span className="step-led" />
        {lit && st.slide && <span className="step-slide">⌒</span>}
        {padLabel && <span className="pad-label">{padLabel}</span>}
        {!live && lit && isMelodic(part.type) && <span className="step-note">{st.note > 0 ? '+' + st.note : st.note}</span>}
      </button>
      <div className={`step-keycap ${held ? 'held' : ''}`}>{keyLabel(code)}</div>
    </div>
  );
}

export function StepSection() {
  const page = useStore((s) => s.stepPage);
  const len = useStore((s) => curPattern(s).length);
  const follow = useStore((s) => s.follow);
  const ph = usePlayhead((p) => p.step);
  const playing = useStore((s) => s.playing);
  const live = useStore((s) => s.kbdMode === 'live');
  const banks = len / 16;
  return (
    <section className="sec step-sec">
      <div className="bank-block">
        <div className="silk">STEP BANK</div>
        <div className="bank-leds">
          {[0, 1, 2, 3].map((b) => (
            <button
              key={b}
              tabIndex={-1}
              className={`bank-btn ${b >= banks ? 'dis' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => b < banks && set({ stepPage: b, follow: false })}
              title={`Step ${b * 16 + 1}-${b * 16 + 16} (O / P)`}
            >
              <Led color="orange" on={page === b} small />
              <Led color="green" on={playing && Math.floor(ph / 16) === b && b < banks} small />
              <span>{b * 16 + 1}</span>
            </button>
          ))}
        </div>
        <HwButton size="sm" led="green" ledOn={follow} sub="FOLLOW" onPress={() => set({ follow: !follow })} title="I LED seguono il banco in riproduzione" />
      </div>
      <div className="steps-row">
        <div className="steps-legend">
          {live ? 'LIVE MODE · riga 1-8 = parti · riga 9-16 = note della parte selezionata' : 'STEP MODE · tasti 1-16 = on/off · Shift = accento · G = slide'}
        </div>
        {Array.from({ length: 16 }, (_, k) => <StepKey key={k} k={k} />)}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Griglia 4×4: specchio dei 16 step disposti come sulla tastiera del PC
// ---------------------------------------------------------------------------
export function KeyGrid() {
  useKeymapVersion();
  const s = useStore();
  const ph = usePlayhead((p) => p.step);
  const pt = curPattern(s);
  const part = pt.parts[s.selectedPart];
  const live = s.kbdMode === 'live';
  return (
    <section className="sec keygrid-sec" title="La griglia 4×4 corrisponde alla posizione dei tasti sulla tastiera">
      <div className="silk">KEY GRID 4×4</div>
      <div className="keygrid">
        {Array.from({ length: 16 }, (_, k) => {
          const idx = s.stepPage * 16 + k;
          const code = codesFor(`step${k}`)[0] ?? STEP_CODES[k];
          const on = !live && part.steps[idx]?.on && idx < pt.length;
          return (
            <div key={k} className={`kg-cell ${on ? 'on' : ''} ${s.playing && ph === idx ? 'ph' : ''} ${s.held[code] ? 'held' : ''} ${live ? (k < 8 ? 'live-part' : 'live-note') : ''}`}>
              {keyLabel(code)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
