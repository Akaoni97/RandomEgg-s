import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { PAWNS, PAWN_ORDER } from '../engine/pawns';
import { censor } from '../engine/phrases';
import type { BotLevel, PlayerConfig } from '../engine/types';
import { useStore } from '../store';

const LEVELS: { id: BotLevel; label: string; hint: string }[] = [
  { id: 'turista', label: 'Turista', hint: 'Compra a caso, si fa fregare da tutti' },
  { id: 'guaglione', label: 'Guaglione', hint: 'Furbo il giusto, costruisce quando può' },
  { id: 'boss', label: "Boss d'o Rione", hint: 'Abusivo, ti fa il pacco, ti scippa' },
];

const TIMES = [0, 30, 45, 60, 90];

export function StartScreen() {
  const newGame = useStore((s) => s.newGame);
  const resume = useStore((s) => s.resume);
  const hasSave = useStore((s) => s.hasSave);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [players, setPlayers] = useState<PlayerConfig[]>(
    PAWN_ORDER.map((pawn, i) => ({ pawn, isBot: i > 0, botLevel: 'guaglione' })),
  );
  const [time, setTime] = useState(60);

  const update = (i: number, p: Partial<PlayerConfig>) => {
    sfx.click();
    setPlayers((ps) => ps.map((x, k) => (k === i ? { ...x, ...p } : x)));
  };

  return (
    <div className="start">
      <div className="start-card">
        <header className="start-head">
          <h1 className="neon-title">Napolì</h1>
          <p className="tagline">{censor("Il Monopoli che te fa' 'o pacco", settings.nonna)}</p>
          <p className="disclaimer">
            {censor(
              `🔞 Gioco per adulti: parolacce, stereotipi e cazzimma a volontà. Ridiamo CON Napoli, non contro Napoli. ${
                settings.nonna ? 'Modalità Nonna attiva: si parla come in chiesa.' : "Se c'è nonna in salotto, attiva la Modalità Nonna."
              }`,
              settings.nonna,
            )}
          </p>
        </header>

        <div className="players-grid">
          {players.map((p, i) => {
            const def = PAWNS[p.pawn];
            return (
              <div key={p.pawn} className="pawn-card" style={{ ['--pc' as string]: def.color }}>
                <div className="pawn-emoji">{def.emoji}</div>
                <div className="pawn-name">{def.name}</div>
                <div className="pawn-power">
                  <b>{def.power}:</b> {def.powerText}
                </div>
                <div className="pawn-bio">{censor(def.bio, settings.nonna)}</div>
                <div className="seg">
                  <button className={!p.isBot ? 'on' : ''} onClick={() => update(i, { isBot: false })}>
                    🧑 Umano
                  </button>
                  <button className={p.isBot ? 'on' : ''} onClick={() => update(i, { isBot: true })}>
                    🤖 Bot
                  </button>
                </div>
                {p.isBot && (
                  <select value={p.botLevel} onChange={(e) => update(i, { botLevel: e.target.value as BotLevel })} title="Livello di furbizia">
                    {LEVELS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label} — {l.hint}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div className="start-options">
          <label className="toggle">
            <input type="checkbox" checked={settings.nonna} onChange={(e) => setSettings({ nonna: e.target.checked })} />
            <span>👵 Modalità Nonna (censura con il bip)</span>
          </label>
          <label className="inline">
            ⏰ Durata:
            <select value={time} onChange={(e) => setTime(Number(e.target.value))}>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t ? `${t} minuti, poi vince il più ricco` : 'Senza limite, fino all\'ultimo sangue'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="start-actions">
          {hasSave && (
            <button className="btn ghost big" onClick={() => resume()}>
              ↩️ Riprendi la partita
            </button>
          )}
          <button
            className="btn primary big"
            onClick={() => {
              sfx.win();
              newGame(players, time);
            }}
          >
            🎲 Accumminciammo!
          </button>
        </div>
      </div>
    </div>
  );
}
