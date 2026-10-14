import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import * as M from '../machine';
import { toggleFullscreen } from '../input/keyboard';
import { HwButton, Led } from './Controls';
import { LcdZoom } from './Lcd';
import { HelpOverlay, KeymapOverlay } from './Overlays';
import {
  DisplaySection, KeyGrid, MasterSection, MixSection, PartsSection, SoundSection, StepSection, TransportSection, Tubes,
} from './Sections';

const W = 1600;
const H = 940;

function useScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const f = () => setScale(Math.min(window.innerWidth / (W + 24), window.innerHeight / (H + 24)));
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return scale;
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

const Screw = ({ x, y }: { x: string; y: string }) => <div className="screw" style={{ left: x, top: y }} />;

export function App() {
  const scale = useScale();
  const powered = useStore((s) => s.powered);
  const [booting, setBooting] = useState(false);

  const power = async () => {
    if (powered || booting) return;
    setBooting(true);
    await M.powerOn();
    setBooting(false);
  };

  return (
    <div className="stage">
      <div className="machine-holder" style={{ width: W * scale, height: H * scale }}>
        <div className={`machine ${powered ? 'powered' : 'unpowered'}`} style={{ transform: `scale(${scale})` }}>
          <div className="panel-texture" />
          <Screw x="14px" y="14px" /><Screw x="calc(100% - 30px)" y="14px" />
          <Screw x="14px" y="calc(100% - 30px)" /><Screw x="calc(100% - 30px)" y="calc(100% - 30px)" />
          <Screw x="50%" y="14px" /><Screw x="50%" y="calc(100% - 30px)" />

          <header className="top-row">
            <div className="brand">
              <Spiral />
              <div>
                <div className="brand-name">TRIBE<span>MACHINE</span></div>
                <div className="brand-sub">TM-1 · RHYTHM SYNTHESIZER · REAL-TIME DSP ENGINE</div>
              </div>
            </div>
            <div className="sticker" title="adesivo consumato">
              <Spiral size={20} /> NO SYSTEM · NO BORDER
            </div>
            <Tubes />
            <div className="grill-area">
              <div className="grill" />
              <div className="stencil">FREE TEKNO SOUND SYSTEM</div>
            </div>
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

          <div className="engrave engrave-1">DESIGNED FOR FREE PARTIES · 2001 · LOUD &amp; PROUD</div>
          <div className="engrave engrave-2">SER. Nº 23-TK-0417</div>

          {!powered && (
            <div className="power-hint" onClick={power}>
              <div>{booting ? 'BOOT…' : 'CLICCA O PREMI UN TASTO PER ACCENDERE'}</div>
              <small>il motore audio del browser si avvia solo dopo un gesto dell'utente</small>
            </div>
          )}
          <LcdZoom />
        </div>
      </div>
      <HelpOverlay />
      <KeymapOverlay />
    </div>
  );
}
