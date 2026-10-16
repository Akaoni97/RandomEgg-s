import { useEffect, useRef, useState } from 'react';
import { flash, useStore } from '../state/store';
import { RenameOverlay } from './Rename';
import * as M from '../machine';
import { toggleFullscreen } from '../input/keyboard';
import { HwButton, Led } from './Controls';
import { LcdZoom } from './Lcd';
import { HelpOverlay, KeymapOverlay } from './Overlays';
import { CrateOverlay } from './Crate';
import { CrateSection, DeckSection, FxPadsSection } from './DeckWing';
import {
  DisplaySection, KeyGrid, MasterSection, MixSection, PartsSection, SoundSection, StepSection, TransportSection,
} from './Sections';
import { Visualizer } from './Visualizer';
import { SKINS, setSkin, skinById, toggleView, usePrefs } from './skins';

/** pannello tekno (1600) + ala LT DECK del Mattone (410) */
const W = 2010;
const H = 940;

function useScale(view: string) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    // in 3D la console inclinata occupa un po' più di spazio (spessore, prospettiva)
    const k = view === '3d' ? 0.9 : 1;
    const f = () => setScale(k * Math.min(window.innerWidth / (W + 24), window.innerHeight / (H + 24)));
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [view]);
  return scale;
}

/** Selettore delle scocche intercambiabili + vista 3D/piatta */
function ShellSelector() {
  const skin = usePrefs((p) => p.skin);
  const view = usePrefs((p) => p.view);
  return (
    <div className="shell-block">
      <div className="silk">SHELL</div>
      <div className="shell-swatches">
        {SKINS.map((s) => (
          <button
            key={s.id}
            tabIndex={-1}
            className={`shell-swatch ${skin === s.id ? 'on' : ''}`}
            style={{ background: s.swatch }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSkin(s.id)}
            title={`Scocca ${s.name} (F4 = scocca successiva)`}
          />
        ))}
      </div>
      <div className="shell-row">
        <span className="shell-name">{skinById(skin).name}</span>
        <HwButton size="sm" sub={view === '3d' ? '3D' : 'FLAT'} onPress={() => toggleView()} title="Vista 3D / frontale (F3)" />
      </div>
    </div>
  );
}

/** Spirale "free tekno" disegnata a mano */
function Spiral({ size = 46 }: { size?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 260; i++) {
    const a = i * 0.11;
    const r = 1.2 + a * 1.55;
    pts.push(`${(25 + r * Math.cos(a)).toFixed(2)},${(25 + r * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <svg className="spiral" width={size} height={size} viewBox="0 0 50 50">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Strisce del Mattone (amber, arancio, mattone, verde acqua) */
const Stripes = () => (
  <div className="brand-stripes" aria-hidden="true"><i /><i /><i /><i /></div>
);

/** Faccina acid (disegnata qui, nessun logo di terzi) */
const Smiley = () => (
  <svg width="18" height="18" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9" fill="#ffe600" stroke="#0d0d0d" strokeWidth="1.6" />
    <circle cx="7" cy="8" r="1.4" fill="#0d0d0d" />
    <circle cx="13" cy="8" r="1.4" fill="#0d0d0d" />
    <path d="M5.5 11.5 Q10 16.5 14.5 11.5" fill="none" stroke="#0d0d0d" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const Screw = ({ x, y }: { x: string; y: string }) => <div className="screw" style={{ left: x, top: y }} />;

export function App() {
  const skinId = usePrefs((p) => p.skin);
  const view = usePrefs((p) => p.view);
  const swapping = usePrefs((p) => p.swapping);
  const skin = skinById(skinId);
  const scale = useScale(view);
  const powered = useStore((s) => s.powered);
  const tiltRef = useRef<HTMLDivElement>(null);

  // parallasse: la console segue leggermente il mouse (non mentre si trascina una manopola)
  const onMove = (e: React.PointerEvent) => {
    const el = tiltRef.current;
    if (!el || view !== '3d' || e.buttons) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    el.style.setProperty('--yaw', (nx * 5).toFixed(2) + 'deg');
    el.style.setProperty('--tilt-add', (ny * -3).toFixed(2) + 'deg');
  };
  useEffect(() => {
    if (view === 'flat') {
      tiltRef.current?.style.setProperty('--yaw', '0deg');
      tiltRef.current?.style.setProperty('--tilt-add', '0deg');
    }
  }, [view]);
  const [booting, setBooting] = useState(false);
  const [dragging, setDragging] = useState(false);

  // trascina un file audio sul pannello = campione nella parte selezionata; un .json = progetto
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!useStore.getState().powered) await power();
    if (/\.json$/i.test(f.name)) {
      try { await M.loadProjectText(await f.text()); } catch { flash('IMPORT ERROR', 2500); }
    } else {
      await M.loadSampleFile(useStore.getState().selectedPart, f);
    }
  };

  const power = async () => {
    if (powered || booting) return;
    setBooting(true);
    await M.powerOn();
    setBooting(false);
  };

  return (
    <div
      className={`stage view-${view}`}
      data-skin={skinId}
      onPointerMove={onMove}
      onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={onDrop}
    >
      <div className="machine-holder" style={{ width: W * scale, height: H * scale }}>
       <div className="console" style={{ transform: `scale(${scale})` }}>
        <div className="console-tilt" ref={tiltRef}>
         <div className={`console-body ${swapping ? 'swapping' : ''}`}>
          <div className="console-floor" />
          <div className="console-back" />
          <div className="console-side left" />
          <div className="console-side right" />
          <div className="console-front" />
        <div className={`machine ${powered ? 'powered' : 'unpowered'}`}>
          <div className="panel-texture" />
          <Screw x="14px" y="14px" /><Screw x="calc(100% - 30px)" y="14px" />
          <Screw x="14px" y="calc(100% - 30px)" /><Screw x="calc(100% - 30px)" y="calc(100% - 30px)" />
          <Screw x="50%" y="14px" /><Screw x="50%" y="calc(100% - 30px)" />

          <div className="main-col">
          <header className="top-row">
            <div className="brand">
              <Spiral />
              <div>
                <div className="brand-name">LUCATEKNO<span>_MACHINE</span></div>
                <div className="brand-sub">{skin.tagline}</div>
                <Stripes />
              </div>
            </div>
            <div className="sticker" title="adesivo consumato">
              {skinId === 'acid' ? <Smiley /> : <Spiral size={20} />} {skin.sticker}
            </div>
            <Visualizer />
            <div className="grill-area">
              <div className="grill" />
              <div className="stencil">{skin.stencil}</div>
            </div>
            <ShellSelector />
            <div className="power-block">
              <div className="silk">POWER</div>
              <button tabIndex={-1} className={`power-switch ${powered ? 'on' : ''}`} onClick={power} title="Accensione (avvia il motore audio)">
                <span />
              </button>
              <Led color="red" on={powered} />
              <HwButton size="sm" sub="FULL SCR" onPress={() => void toggleFullscreen()} title="Schermo intero (F11)" />
            </div>
          </header>

          <div className="row-2">
            <DisplaySection />
            <MasterSection />
          </div>
          <div className="row-3">
            <SoundSection />
            <MixSection />
            <KeyGrid />
          </div>
          <div className="row-4">
            <PartsSection />
            <TransportSection />
          </div>
          <StepSection />
          </div>
          <aside className="deck-wing">
            <DeckSection />
            <FxPadsSection />
            <CrateSection />
          </aside>

          <div className="engrave engrave-1">TEKNO FIRST · TRIBE MACHINE × MATTONE GROOVEBOX · LOUD &amp; PROUD</div>
          <div className="engrave engrave-2">LT-1 · SER. Nº 23-LT-0088</div>

          {!powered && (
            <div className="power-hint" onClick={power}>
              <div>{booting ? 'BOOT…' : 'CLICCA O PREMI UN TASTO PER ACCENDERE'}</div>
              <small>il motore audio del browser si avvia solo dopo un gesto dell'utente</small>
            </div>
          )}
          {dragging && <div className="drop-hint">RILASCIA: AUDIO → PARTE SELEZIONATA · .JSON → PROGETTO</div>}
        </div>
         </div>
        </div>
       </div>
      </div>
      <LcdZoom />
      <HelpOverlay />
      <KeymapOverlay />
      <CrateOverlay />
      <RenameOverlay />
    </div>
  );
}
