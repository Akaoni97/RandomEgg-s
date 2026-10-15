import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { BOARD, GROUP_COLORS, isOwnable } from '../engine/board';
import { canBuild, canBuildAbusivo, houseCost, ownsGroup, rentFor } from '../engine/engine';
import { PAWNS } from '../engine/pawns';
import { censor } from '../engine/phrases';
import type { GameState, Trade, TradeOffer } from '../engine/types';
import { useStore } from '../store';

const HOUSE_LABEL = ['niente', '1 basso', '2 bassi', '3 bassi', '4 bassi', 'PALAZZO'];

function managing(g: GameState) {
  const me = g.players[g.current];
  return !me.isBot && (g.phase === 'manage' || g.phase === 'roll') && !g.pending && g.winner === null;
}

export function TileModal() {
  const sel = useStore((s) => s.selectedTile);
  const g = useStore((s) => s.game);
  const select = useStore((s) => s.selectTile);
  const dispatch = useStore((s) => s.dispatch);
  const busy = useStore((s) => s.busy);
  const nonna = useStore((s) => s.settings.nonna);
  if (sel === null || !g) return null;
  const def = BOARD[sel];
  const t = g.tiles[sel];
  const owner = t.owner !== null ? g.players[t.owner] : null;
  const mine = t.owner === g.current && managing(g) && !busy;
  const act = (a: Parameters<typeof dispatch>[0]) => {
    sfx.click();
    dispatch(a);
  };
  const cost = houseCost(sel, false);
  const abCost = houseCost(sel, true);
  return (
    <div className="modal-back" onClick={() => select(null)}>
      <div className="deed" onClick={(e) => e.stopPropagation()}>
        <div className="deed-band" style={{ background: def.group ? GROUP_COLORS[def.group] : '#2b1d12' }}>
          <div className="deed-kind">{def.kind === 'station' ? 'FUNICOLARE' : def.kind === 'utility' ? 'SERVIZIO "PUBBLICO"' : def.group ? 'TITOLO DI PROPRIETÀ' : ''}</div>
          <div className="deed-name">{def.name}</div>
        </div>
        <div className="deed-body">
          <p className="flavor">{censor(def.flavor ?? '', nonna)}</p>
          {def.rent && (
            <table className="rent">
              <tbody>
                {def.rent.map((r, k) => (
                  <tr key={k} className={t.houses === k && t.owner !== null ? 'cur' : ''}>
                    <td>{k === 0 ? 'Affitto (doppio col gruppo)' : HOUSE_LABEL[k]}</td>
                    <td>{r} ₵</td>
                  </tr>
                ))}
                <tr>
                  <td>Basso / palazzo</td>
                  <td>{cost} ₵</td>
                </tr>
                <tr>
                  <td>🧱 Abusivo (metà prezzo, rischi la ruspa)</td>
                  <td>{abCost} ₵</td>
                </tr>
              </tbody>
            </table>
          )}
          {def.kind === 'station' && <p>Affitto: 25 · 50 · 100 · 200 ₵ con 1-4 funicolari. Durante lo sciopero ANM non incassa.</p>}
          {def.kind === 'utility' && <p>Affitto: 4× i dadi, 10× se possiedi ENEL abusivo e Acqua del Serino.</p>}
          {isOwnable(def) && (
            <p>
              Prezzo {def.price} ₵ · Ipoteca {def.price! / 2} ₵ ·{' '}
              {owner ? (
                <>
                  Di{' '}
                  <b style={{ color: PAWNS[owner.pawn].color }}>
                    {PAWNS[owner.pawn].emoji} {owner.name}
                  </b>
                  {t.mortgaged ? ' (ipotecata)' : ''} — affitto ora {rentFor(g, sel)} ₵
                  {t.abusivo ? ' · 🧱 ABUSIVO' : ''}
                  {g.turn < t.cuginoUntil ? " · 🧔 c'è 'o cugino" : ''}
                </>
              ) : (
                'Libera'
              )}
            </p>
          )}
          {mine && def.kind === 'property' && (
            <div className="row">
              <button className="btn primary" disabled={!canBuild(g, g.current, sel)} onClick={() => act({ type: 'BUILD', tile: sel })} title={!ownsGroup(g, g.current, sel) ? 'Serve tutto il gruppo di colore' : ''}>
                🏗️ {t.houses === 4 ? 'Palazzo' : 'Basso'} ({cost} ₵)
              </button>
              <button className="btn danger" disabled={!canBuildAbusivo(g, g.current, sel)} onClick={() => act({ type: 'BUILD_ABUSIVO', tile: sel })}>
                🧱 Abusivo ({abCost} ₵)
              </button>
              <button className="btn ghost" disabled={t.houses === 0} onClick={() => act({ type: 'SELL_HOUSE', tile: sel })}>
                Vendi un basso
              </button>
            </div>
          )}
          {mine && (
            <div className="row">
              {t.mortgaged ? (
                <button className="btn" onClick={() => act({ type: 'UNMORTGAGE', tile: sel })}>
                  Riscatta ({Math.ceil((def.price! / 2) * 1.1)} ₵)
                </button>
              ) : (
                <button className="btn ghost" disabled={t.houses > 0} onClick={() => act({ type: 'MORTGAGE', tile: sel })}>
                  🏦 Ipoteca al Monte dei Pegni (+{def.price! / 2} ₵)
                </button>
              )}
            </div>
          )}
          <button className="btn ghost close" onClick={() => select(null)}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

export function PropsPanel() {
  const g = useStore((s) => s.game);
  const panel = useStore((s) => s.panel);
  const open = useStore((s) => s.openPanel);
  const select = useStore((s) => s.selectTile);
  const [who, setWho] = useState<number | null>(null);
  if (!g || panel !== 'props') return null;
  const pid = who ?? g.current;
  const owned = g.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.owner === pid);
  return (
    <div className="side-panel">
      <div className="side-head">
        <h3>🏘️ Proprietà</h3>
        <button className="btn ghost" onClick={() => open(null)}>
          ✕
        </button>
      </div>
      <div className="seg">
        {g.players.map((p) => (
          <button key={p.id} className={p.id === pid ? 'on' : ''} disabled={p.bankrupt} onClick={() => setWho(p.id)}>
            {PAWNS[p.pawn].emoji}
          </button>
        ))}
      </div>
      <div className="fan">
        {owned.length === 0 && <p className="muted">Niente di niente. Manco un basso a Scampia.</p>}
        {owned.map(({ t, i }, k) => {
          const def = BOARD[i];
          return (
            <button
              key={i}
              className={`fan-card ${t.mortgaged ? 'mortgaged' : ''}`}
              style={{ ['--band' as string]: def.group ? GROUP_COLORS[def.group] : '#555', ['--k' as string]: k }}
              onClick={() => select(i)}
            >
              <span className="fan-band">{def.short}</span>
              <span className="fan-info">
                {t.houses === 5 ? '🏢 Palazzo' : t.houses > 0 ? '🏠'.repeat(t.houses) : def.kind === 'station' ? '🚡' : def.kind === 'utility' ? '⚡' : ''}
                {t.abusivo ? ' 🧱' : ''}
                {t.mortgaged ? ' 🏦' : ''}
              </span>
              <span className="fan-rent">{rentFor(g, i)} ₵</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const emptyOffer = (): TradeOffer => ({ money: 0, tiles: [], conosco: 0 });

function OfferEditor({ g, pid, offer, onChange, title }: { g: GameState; pid: number; offer: TradeOffer; onChange: (o: TradeOffer) => void; title: string }) {
  const p = g.players[pid];
  const tiles = g.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.owner === pid && t.houses === 0);
  return (
    <div className="offer">
      <h4>
        {title} <span style={{ color: PAWNS[p.pawn].color }}>{PAWNS[p.pawn].emoji} {p.name}</span>
      </h4>
      <label className="inline">
        Cucuzze
        <input className="num" type="number" min={0} max={p.money} value={offer.money} onChange={(e) => onChange({ ...offer, money: Math.max(0, Math.min(p.money, Number(e.target.value) || 0)) })} />
        <span className="muted">/ {p.money}</span>
      </label>
      {p.conosco > 0 && (
        <label className="inline">
          "Conosco a uno"
          <input className="num" type="number" min={0} max={p.conosco} value={offer.conosco} onChange={(e) => onChange({ ...offer, conosco: Math.max(0, Math.min(p.conosco, Number(e.target.value) || 0)) })} />
        </label>
      )}
      <div className="tile-checks">
        {tiles.length === 0 && <span className="muted">Nessuna proprietà scambiabile (senza bassi).</span>}
        {tiles.map(({ i }) => {
          const def = BOARD[i];
          const on = offer.tiles.includes(i);
          return (
            <button
              key={i}
              className={`tile-chip ${on ? 'on' : ''}`}
              style={{ ['--band' as string]: def.group ? GROUP_COLORS[def.group] : '#555' }}
              onClick={() => onChange({ ...offer, tiles: on ? offer.tiles.filter((x) => x !== i) : [...offer.tiles, i] })}
            >
              {def.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TradeDialog() {
  const g = useStore((s) => s.game);
  const panel = useStore((s) => s.panel);
  const open = useStore((s) => s.openPanel);
  const dispatch = useStore((s) => s.dispatch);
  const nonna = useStore((s) => s.settings.nonna);
  const [to, setTo] = useState<number | null>(null);
  const [give, setGive] = useState<TradeOffer>(emptyOffer());
  const [get, setGet] = useState<TradeOffer>(emptyOffer());
  const [pacco, setPacco] = useState(false);
  const [fake, setFake] = useState(false);
  if (!g || panel !== 'trade') return null;
  const me = g.current;
  const others = g.players.filter((p) => !p.bankrupt && p.id !== me);
  const target = to ?? others[0]?.id ?? null;
  const canSend = managing(g) && target !== null && (give.money || give.tiles.length || give.conosco || get.money || get.tiles.length || get.conosco);
  const send = () => {
    if (target === null) return;
    const trade: Trade = { from: me, to: target, give, get, pacco, fake: pacco && fake };
    dispatch({ type: 'PROPOSE_TRADE', trade });
    sfx.card();
    setGive(emptyOffer());
    setGet(emptyOffer());
    setPacco(false);
    setFake(false);
    open(null);
  };
  return (
    <div className="modal-back" onClick={() => open(null)}>
      <div className="trade" onClick={(e) => e.stopPropagation()}>
        <h3>🤝 Facciamo un affare</h3>
        {!managing(g) && <p className="warn">Gli scambi si propongono nel proprio turno, prima o dopo aver tirato.</p>}
        <div className="seg">
          {others.map((p) => (
            <button
              key={p.id}
              className={p.id === target ? 'on' : ''}
              onClick={() => {
                setTo(p.id);
                setGet(emptyOffer());
              }}
            >
              {PAWNS[p.pawn].emoji} {p.name}
            </button>
          ))}
        </div>
        <div className="trade-cols">
          <OfferEditor g={g} pid={me} offer={give} onChange={setGive} title="Dai tu:" />
          {target !== null && <OfferEditor g={g} pid={target} offer={get} onChange={setGet} title="Vuoi da:" />}
        </div>
        <div className="pacco-box">
          <label className="toggle">
            <input type="checkbox" checked={pacco} onChange={(e) => setPacco(e.target.checked)} />
            <span>📦 Consegna in SCATOLA CHIUSA ('o pacco)</span>
          </label>
          {pacco && (
            <label className="toggle danger">
              <input type="checkbox" checked={fake} onChange={(e) => setFake(e.target.checked)} />
              <span>
                {censor(
                  `🧱 Dentro ci metto un MATTONE (pacco finto). Se ti scoprono vai a Poggioreale: ${g.players[me].pawn === 'toto' ? 'Totò lo scoprono solo il 35% delle volte' : 'ti scoprono il 50% delle volte'}.`,
                  nonna,
                )}
              </span>
            </label>
          )}
          {pacco && <p className="muted">Gira lo schermo: l'altro non deve vedere se c'è il mattone!</p>}
        </div>
        <div className="row">
          <button className="btn primary" disabled={!canSend} onClick={send}>
            Proponi
          </button>
          <button className="btn ghost" onClick={() => open(null)}>
            Lascia perdere
          </button>
        </div>
      </div>
    </div>
  );
}
