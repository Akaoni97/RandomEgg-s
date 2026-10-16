import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../audio/sfx';
import { netWorth } from '../engine/engine';
import { PAWNS } from '../engine/pawns';
import { censor } from '../engine/phrases';
import type { GameState } from '../engine/types';
import { useStore } from '../store';
import { ActionPanel } from './Actions';
import { PropsPanel, TileModal, TradeDialog } from './Property';

function AnimatedMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const from = ref.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / 600);
      const v = Math.round(from + (value - from) * f);
      setShown(v);
      ref.current = v;
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

function Players({ g }: { g: GameState }) {
  return (
    <div className="players">
      {g.players.map((p) => {
        const def = PAWNS[p.pawn];
        const cur = g.current === p.id && g.winner === null;
        return (
          <div key={p.id} className={`player ${cur ? 'cur' : ''} ${p.bankrupt ? 'out' : ''}`} style={{ ['--pc' as string]: def.color }}>
            <div className="player-emoji">{def.emoji}</div>
            <div className="player-main">
              <div className="player-name">
                {p.name} {p.isBot && <span className="bot-tag">🤖</span>}
              </div>
              <div className="player-money">{p.bankrupt ? 'a Milano 🚄' : <><AnimatedMoney value={p.money} /> ₵</>}</div>
              <div className="player-icons">
                {p.inJail && <span title="A Poggioreale">🚔</span>}
                {p.malocchio && <span title="Ha il malocchio: il prossimo affitto è dimezzato">🧿</span>}
                {p.corni > 0 && <span title="Corni rossi">🌶️{p.corni > 1 ? `×${p.corni}` : ''}</span>}
                {p.conosco > 0 && <span title='"Conosco a uno"'>🤫{p.conosco > 1 ? `×${p.conosco}` : ''}</span>}
                {p.skipTurns > 0 && <span title="Salta il turno">⏭️</span>}
                {p.pawn === 'gennaro' && !p.miracleUsed && <span title="Miracolo disponibile">✨</span>}
                {p.pawn === 'ciro' && !p.cascoUsedLap && <span title="Senza casco disponibile">🛵</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Clock({ g }: { g: GameState }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!g.settings.timeLimit) return null;
  const left = Math.max(0, g.settings.timeLimit * 60 - (Date.now() - g.startedAt) / 1000);
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  return (
    <div className={`stat ${left < 300 ? 'hot' : ''}`} title="Tempo rimasto: poi vince il più ricco">
      ⏰ {m}:{String(s).padStart(2, '0')}
    </div>
  );
}

function TopRight({ g }: { g: GameState }) {
  const open = useStore((s) => s.openPanel);
  const v = g.vesuvio;
  return (
    <div className="top-right">
      <div className="vesuvio" title={`Il Vesuvio: a 100 erutta! (${v}/100)`}>
        <span>🌋</span>
        <div className="vesuvio-bar">
          <div className="vesuvio-fill" style={{ width: `${v}%` }} />
        </div>
        <b>{v}</b>
      </div>
      <div className="stat" title="Il Caffè Sospeso: metà di tasse e multe. Chi arriva sulla casella si prende tutto.">
        ☕ {g.pot} ₵
      </div>
      <div className="stat" title="Giro">
        🔁 {g.round}
      </div>
      <Clock g={g} />
      <div className="top-buttons">
        <button className="icon-btn" title="Registro" onClick={() => open('log')}>
          📜
        </button>
        <button className="icon-btn" title="Regole" onClick={() => open('rules')}>
          📖
        </button>
        <button className="icon-btn" title="Impostazioni" onClick={() => open('settings')}>
          ⚙️
        </button>
      </div>
    </div>
  );
}

function Banners() {
  const banners = useStore((s) => s.banners);
  return (
    <div className="banners">
      {banners.map((b) => (
        <div key={b.id} className={`banner ${b.big ? 'big' : ''} k-${b.kind}`}>
          {b.text}
        </div>
      ))}
    </div>
  );
}

function LogPanel({ g }: { g: GameState }) {
  const open = useStore((s) => s.openPanel);
  const nonna = useStore((s) => s.settings.nonna);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [g.log.length]);
  return (
    <div className="side-panel">
      <div className="side-head">
        <h3>📜 Cronaca del rione</h3>
        <button className="btn ghost" onClick={() => open(null)}>
          ✕
        </button>
      </div>
      <div className="log" ref={ref}>
        {g.log.map((l, k) => (
          <p key={k}>{censor(l, nonna)}</p>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.setSettings);
  const open = useStore((s) => s.openPanel);
  const quit = useStore((s) => s.quit);
  const toggle = (k: 'nonna' | 'music' | 'sfx' | 'tts' | 'cinematic', label: string) => (
    <label className="toggle">
      <input
        type="checkbox"
        checked={settings[k]}
        onChange={(e) => {
          unlockAudio();
          set({ [k]: e.target.checked });
        }}
      />
      <span>{label}</span>
    </label>
  );
  return (
    <div className="modal-back" onClick={() => open(null)}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <h3>⚙️ Impostazioni</h3>
        {toggle('nonna', '👵 Modalità Nonna (bip sulle parolacce)')}
        {toggle('music', '🪕 Mandolino')}
        {toggle('sfx', '🔊 Effetti sonori')}
        {toggle('tts', '🗣️ Voce sintetica del browser (al posto del borbottio)')}
        {toggle('cinematic', '🎥 Camera cinematica')}
        <label className="inline">
          🖥️ Grafica
          <select value={settings.quality} onChange={(e) => set({ quality: e.target.value as 'alta' | 'bassa' })}>
            <option value="alta">Alta (ombre, bloom)</option>
            <option value="bassa">Bassa (tablet vecchi)</option>
          </select>
        </label>
        <label className="inline">
          🤖 Velocità bot
          <select value={settings.botSpeed} onChange={(e) => set({ botSpeed: e.target.value as 'lenta' | 'normale' | 'veloce' })}>
            <option value="lenta">Lenta</option>
            <option value="normale">Normale</option>
            <option value="veloce">Veloce</option>
          </select>
        </label>
        <div className="row">
          <button className="btn primary" onClick={() => open(null)}>
            Chiudi
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              open(null);
              quit();
            }}
          >
            🏠 Menu (la partita resta salvata)
          </button>
        </div>
      </div>
    </div>
  );
}

function RulesPanel() {
  const open = useStore((s) => s.openPanel);
  const nonna = useStore((s) => s.settings.nonna);
  const rules: [string, string][] = [
    ['🎲 Si gioca', 'Come al Monopoli: tiri, ti muovi, compri, incassi gli affitti, costruisci bassi (case) e palazzi (alberghi). Chi fallisce se ne va a Milano. Vince l\'ultimo che resta, o il più ricco allo scadere del tempo.'],
    ["🔢 Dadi della Smorfia", "Ogni somma ha il suo significato. 8 'A Maronna: +20 ₵. 4 'O puorco: offri il caffè a tutti (10 ₵ a testa). 11 'E suricille: 1 ₵ per ogni basso. Tre doppi di fila: Poggioreale."],
    ['🧿 Malocchio e Corno', 'Chi lancia il malocchio dimezza il prossimo affitto della vittima. Il corno rosso (30 ₵) lo fa esplodere.'],
    ["📦 'O Pacco", 'Negli scambi puoi consegnare una scatola chiusa. Dentro può esserci la roba promessa… o un mattone. Chi riceve può accettare alla cieca o aprire: se trova il mattone il truffatore va in galera, se era tutto vero paga 50 ₵ per l\'offesa. Un mattone accettato alla cieca viene scoperto il 50% delle volte (Totò solo il 30%).'],
    ['🧱 Abusivismo', 'Costruisci anche senza il gruppo completo, a metà prezzo. A ogni giro c\'è il 10% che arriva la Ruspa del Comune e ti abbatte tutto.'],
    ['🌋 Il Vesuvio', 'Sale di 7 ogni volta che qualcuno passa dal VIA (e con certe carte). A 100 erutta: distrutti tutti i bassi sul lato di Piazza Garibaldi e del Vomero.'],
    ['⚽ Il Napoli segna!', 'Evento raro: 50 ₵ a tutti, malocchi tolti, amnistia per chi sta a Poggioreale.'],
    ['👜 Scippo', 'Se arrivi dove c\'è un altro, puoi tentare lo scippo: dado contro dado, chi vince prende 50 ₵.'],
    ['☕ Caffè Sospeso', 'Metà di tasse e multe finisce nel piatto (l\'altra metà se la prende il Comune): chi arriva sulla casella si prende tutto.'],
    ['🤫 Conosco a uno', 'Carta jolly: esci da Poggioreale, eviti un affitto o blocchi un\'asta prendendo la proprietà a metà prezzo.'],
    ['🎄 Presepe vivente', 'Chi possiede tutto l\'arancione può, una volta per giro, mettere un avversario nel presepe: salta un turno.'],
    ["🧔 'O cugino d'America", 'Si piazza in casa tua: per un giro quella proprietà non incassa.'],
    ['🚧 Sciopero ANM', 'Per un giro le funicolari non incassano.'],
    ['🛵 Poteri', 'Ciro: una volta per giro tira 3 dadi e ne scarta uno (35% di multa). Totò: il pacco gli riesce meglio e paga il 10% in meno di affitto. Luigi Gigi: +30 ₵ al VIA. Gennaro San: il miracolo contro carte negative o eruzioni, l\'ampolla si ricarica ogni 3 giri.'],
  ];
  return (
    <div className="modal-back" onClick={() => open(null)}>
      <div className="rules" onClick={(e) => e.stopPropagation()}>
        <h3>📖 Le regole del rione</h3>
        {rules.map(([h, t]) => (
          <div key={h} className="rule">
            <b>{h}</b>
            <p>{censor(t, nonna)}</p>
          </div>
        ))}
        <button className="btn primary" onClick={() => open(null)}>
          Ho capito, jamme
        </button>
      </div>
    </div>
  );
}

function GameOver({ g }: { g: GameState }) {
  const quit = useStore((s) => s.quit);
  const busy = useStore((s) => s.busy);
  if (g.winner === null || busy) return null;
  const ranking = [...g.players].sort((a, b) => netWorth(g, b.id) - netWorth(g, a.id) || Number(a.bankrupt) - Number(b.bankrupt));
  const w = g.players[g.winner];
  return (
    <div className="gameover">
      <h2 className="neon-title small">Scudetto!</h2>
      <p className="winner" style={{ color: PAWNS[w.pawn].color }}>
        {PAWNS[w.pawn].emoji} {w.name}
      </p>
      <p className="muted">è 'o padrone 'e Napule. Caroselli fino a domattina.</p>
      <ol>
        {ranking.map((p) => (
          <li key={p.id}>
            {PAWNS[p.pawn].emoji} {p.name} — {p.bankrupt ? 'a Milano 🚄' : `${netWorth(g, p.id)} ₵ di patrimonio`}
          </li>
        ))}
      </ol>
      <button className="btn primary big" onClick={() => quit()}>
        🎲 Un'altra partita
      </button>
    </div>
  );
}

export function Hud() {
  const g = useStore((s) => s.game);
  const panel = useStore((s) => s.panel);
  if (!g) return null;
  return (
    <div className="hud">
      <Players g={g} />
      <TopRight g={g} />
      <Banners />
      <ActionPanel />
      <TileModal />
      <PropsPanel />
      <TradeDialog />
      {panel === 'log' && <LogPanel g={g} />}
      {panel === 'settings' && <SettingsPanel />}
      {panel === 'rules' && <RulesPanel />}
      <GameOver g={g} />
    </div>
  );
}
