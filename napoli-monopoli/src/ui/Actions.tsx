import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx';
import { BOARD, CORNO_PRICE, GROUP_COLORS, JAIL_FINE } from '../engine/board';
import { ALL_CARDS } from '../engine/cards';
import { actor, auctionActor, canPresepe, describeOffer, rentFor } from '../engine/engine';
import { PAWNS } from '../engine/pawns';
import { censor } from '../engine/phrases';
import type { Action, GameState } from '../engine/types';
import { useStore } from '../store';

function useAct() {
  const dispatch = useStore((s) => s.dispatch);
  return (a: Action) => {
    sfx.click();
    dispatch(a);
  };
}

const Who = ({ g, id }: { g: GameState; id: number }) => {
  const p = g.players[id];
  return (
    <span className="who" style={{ color: PAWNS[p.pawn].color }}>
      {PAWNS[p.pawn].emoji} {p.name}
    </span>
  );
};

function TileMini({ tile }: { tile: number }) {
  const def = BOARD[tile];
  const g = useStore((s) => s.game)!;
  return (
    <div className="tile-mini">
      <div className="tile-mini-band" style={{ background: def.group ? GROUP_COLORS[def.group] : '#444' }}>
        {def.name}
      </div>
      <div className="tile-mini-body">
        <div>
          Prezzo <b>{def.price} ₵</b>
        </div>
        {def.rent && (
          <div className="muted">
            Affitto {def.rent[0]} ₵ · col palazzo {def.rent[5]} ₵
          </div>
        )}
        {def.kind === 'station' && <div className="muted">Affitto 25/50/100/200 ₵ con 1-4 funicolari</div>}
        {def.kind === 'utility' && <div className="muted">Affitto 4× i dadi (10× se le hai tutte e due)</div>}
        {g.tiles[tile].owner !== null && <div>Affitto ora: {rentFor(g, tile)} ₵</div>}
        <div className="flavor">{def.flavor}</div>
      </div>
    </div>
  );
}

function CardModal({ g }: { g: GameState }) {
  const act = useAct();
  const nonna = useStore((s) => s.settings.nonna);
  const pend = g.pending as Extract<GameState['pending'], { kind: 'card' }>;
  const card = ALL_CARDS[pend.cardId];
  const isBot = g.players[g.current].isBot;
  return (
    <div className="modal-back">
      <div className={`game-card ${card.deck}`}>
        <div className="game-card-deck">{card.deck === 'smorfia' ? "🎫 'A SMORFIA" : '🧿 MALOCCHIO'}</div>
        <div className="game-card-num">{card.deck === 'smorfia' ? (Object.keys(ALL_CARDS).indexOf(card.id) % 90) + 1 : '☠'}</div>
        <h3>{censor(card.title, nonna)}</h3>
        <p>{censor(card.text, nonna)}</p>
        <div className="muted">
          per <Who g={g} id={g.current} />
        </div>
        {!isBot && (
          <button className="btn primary" onClick={() => act({ type: 'CARD_OK' })} autoFocus>
            {card.negative ? 'Mannaggia… va bene' : 'Grazie, San Gennaro!'}
          </button>
        )}
      </div>
    </div>
  );
}

const AUCTION_SECONDS = 15;

function AuctionPanel({ g }: { g: GameState }) {
  const act = useAct();
  const a = g.auction!;
  const who = auctionActor(g)!;
  const bidder = g.players[who];
  const [custom, setCustom] = useState('');
  const price = BOARD[a.tile].price!;
  // the auctioneer's patience: 15 seconds, then it's a pass
  const [left, setLeft] = useState(AUCTION_SECONDS);
  const dispatch = useStore((s) => s.dispatch);
  useEffect(() => {
    setLeft(AUCTION_SECONDS);
    if (bidder.isBot) return;
    const id = window.setInterval(() => setLeft((x) => x - 1), 1000);
    return () => window.clearInterval(id);
  }, [who, a.bid, bidder.isBot]);
  useEffect(() => {
    if (left <= 0 && !bidder.isBot) dispatch({ type: 'PASS_BID', player: who });
  }, [left, bidder.isBot, dispatch, who]);
  const conoscoHolders = g.players.filter((p) => !p.bankrupt && !p.isBot && p.conosco > 0 && p.money >= Math.floor(price / 2));
  return (
    <div className="panel-box">
      <h3>🔨 All'asta! "Chi offre di più? Signò, non toccate la merce!"</h3>
      <TileMini tile={a.tile} />
      <div className="auction-state">
        Offerta: <b>{a.bid} ₵</b> {a.leader !== null ? <>da <Who g={g} id={a.leader} /></> : '(nessuno)'} · in gara:{' '}
        {a.active.map((id) => (
          <span key={id} className="chip-mini" style={{ background: PAWNS[g.players[id].pawn].color }}>
            {PAWNS[g.players[id].pawn].emoji}
          </span>
        ))}
      </div>
      {bidder.isBot ? (
        <div className="thinking">
          <Who g={g} id={who} /> ci sta pensando…
        </div>
      ) : (
        <>
          <div className="muted">
            Tocca a <Who g={g} id={who} /> ({bidder.money} ₵) · ⏳ <b className={left <= 5 ? 'hurry' : ''}>{left}s</b>{' '}
            {left <= 5 ? '"Aggiudicato… aggiudicato…"' : ''}
          </div>
          <div className="timer-bar">
            <div style={{ width: `${(left / AUCTION_SECONDS) * 100}%` }} />
          </div>
          <div className="row">
            {[10, 50, 100].map((inc) => (
              <button key={inc} className="btn" disabled={a.bid + inc > bidder.money} onClick={() => act({ type: 'BID', player: who, amount: a.bid + inc })}>
                +{inc} → {a.bid + inc} ₵
              </button>
            ))}
            <input className="num" type="number" min={a.bid + 1} max={bidder.money} placeholder="Offerta" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button
              className="btn"
              disabled={!(Number(custom) > a.bid && Number(custom) <= bidder.money)}
              onClick={() => {
                act({ type: 'BID', player: who, amount: Number(custom) });
                setCustom('');
              }}
            >
              Offri
            </button>
            <button className="btn ghost" onClick={() => act({ type: 'PASS_BID', player: who })}>
              Passo
            </button>
          </div>
        </>
      )}
      {conoscoHolders.length > 0 && (
        <div className="row">
          {conoscoHolders.map((p) => (
            <button key={p.id} className="btn gold" onClick={() => act({ type: 'CONOSCO_AUCTION', player: p.id })}>
              🤫 {p.name}: "Conosco a uno" (te la pigli a {Math.floor(price / 2)} ₵)
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TradeResponse({ g }: { g: GameState }) {
  const act = useAct();
  const t = g.trade!;
  const nonna = useStore((s) => s.settings.nonna);
  const isBot = g.players[t.to].isBot;
  return (
    <div className="panel-box">
      <h3>
        {t.pacco ? '📦 ' : '🤝 '}
        <Who g={g} id={t.from} /> propone un affare a <Who g={g} id={t.to} />
      </h3>
      {t.pacco ? (
        <p>
          {censor(
            `Ti dà una SCATOLA CHIUSA, ben incartata. Dice che dentro c'è: «${describeOffer(t.give)}». Vuole in cambio: «${describeOffer(t.get)}». Ti fidi? Se apri e controlli e la roba è vera, gli devi 50 ₵ per l'offesa.`,
            nonna,
          )}
        </p>
      ) : (
        <p>
          Ti dà: <b>{describeOffer(t.give)}</b>. Vuole: <b>{describeOffer(t.get)}</b>.
        </p>
      )}
      {isBot ? (
        <div className="thinking">
          <Who g={g} id={t.to} /> ci sta pensando…
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" onClick={() => act({ type: 'TRADE_RESPOND', response: 'accept' })}>
            {t.pacco ? 'Accetto a scatola chiusa' : 'Affare fatto!'}
          </button>
          {t.pacco && (
            <button className="btn gold" onClick={() => act({ type: 'TRADE_RESPOND', response: 'check' })}>
              🔍 Apro e controllo
            </button>
          )}
          <button className="btn ghost" onClick={() => act({ type: 'TRADE_RESPOND', response: 'refuse' })}>
            {censor("Ma va' fa' 'n culo", nonna)}
          </button>
        </div>
      )}
    </div>
  );
}

function PendingPanel({ g }: { g: GameState }) {
  const act = useAct();
  const p = g.pending!;
  const me = g.players[g.current];
  switch (p.kind) {
    case 'buy': {
      const price = BOARD[p.tile].price!;
      return (
        <div className="panel-box">
          <h3>
            <Who g={g} id={g.current} /> è arrivato a {BOARD[p.tile].name}
          </h3>
          <TileMini tile={p.tile} />
          <div className="row">
            <button className="btn primary" disabled={me.money < price} onClick={() => act({ type: 'BUY' })}>
              🏠 Compra per {price} ₵
            </button>
            <button className="btn ghost" onClick={() => act({ type: 'DECLINE' })}>
              🔨 Lascia all'asta
            </button>
          </div>
        </div>
      );
    }
    case 'auction':
      return <AuctionPanel g={g} />;
    case 'trade':
      return <TradeResponse g={g} />;
    case 'scippo':
      return (
        <div className="panel-box">
          <h3>👜 Sulla stessa casella c'è qualcuno… tentiamo lo scippo?</h3>
          <p className="muted">Dado contro dado: chi vince prende 50 ₵ all'altro.{me.pawn === 'ciro' ? ' Ciro ha +1, è del mestiere.' : ''}</p>
          <div className="row">
            {p.targets.map((id) => (
              <button key={id} className="btn danger" onClick={() => act({ type: 'SCIPPO', target: id })}>
                Scippa <Who g={g} id={id} />
              </button>
            ))}
            <button className="btn ghost" onClick={() => act({ type: 'SCIPPO', target: null })}>
              Lascia stare, so' brava gente
            </button>
          </div>
        </div>
      );
    case 'ciroPick':
      return (
        <div className="panel-box">
          <h3>🛵 Senza casco! Quale dado butti via?</h3>
          <div className="row">
            {p.dice.map((d, i) => (
              <button key={i} className="btn die-btn" onClick={() => act({ type: 'CIRO_PICK', drop: i as 0 | 1 | 2 })}>
                <span className="die-face">{'⚀⚁⚂⚃⚄⚅'[d - 1]}</span>
                <span>
                  butta il {d} → fai {p.dice.reduce((a, b) => a + b, 0) - d}
                </span>
              </button>
            ))}
          </div>
          <p className="muted">Attento: c'è il 30% che ti ferma la Municipale.</p>
        </div>
      );
    case 'malocchioTarget':
      return (
        <div className="panel-box">
          <h3>🧿 A chi lanci il malocchio?</h3>
          <div className="row">
            {g.players
              .filter((x) => !x.bankrupt && x.id !== g.current)
              .map((x) => (
                <button key={x.id} className="btn danger" onClick={() => act({ type: 'MALOCCHIO_TARGET', target: x.id })}>
                  <Who g={g} id={x.id} /> {x.corni > 0 ? `(ha ${x.corni} 🌶️)` : ''}
                </button>
              ))}
          </div>
        </div>
      );
    case 'miracle':
      return (
        <div className="panel-box">
          <h3>🙏 San Gennaro, fai il miracolo?</h3>
          <p>{p.reason}</p>
          <p className="muted">Si tira un dado: con 1 l'ampolla non si scioglie ed è tragedia (succede tutto e paghi 100 ₵). Poi l'ampolla si ricarica ogni 3 passaggi dal VIA.</p>
          <div className="row">
            <button className="btn gold" onClick={() => act({ type: 'MIRACLE', use: true })}>
              ✨ Fai il miracolo
            </button>
            <button className="btn ghost" onClick={() => act({ type: 'MIRACLE', use: false })}>
              Lo tengo per dopo
            </button>
          </div>
        </div>
      );
    case 'conoscoRent':
      return (
        <div className="panel-box">
          <h3>
            Devi {p.amount} ₵ di affitto a <Who g={g} id={p.owner} />
          </h3>
          <div className="row">
            <button className="btn gold" onClick={() => act({ type: 'CONOSCO_RENT', use: true })}>
              🤫 "Conosco a uno" (non paghi)
            </button>
            <button className="btn" onClick={() => act({ type: 'CONOSCO_RENT', use: false })}>
              Pago, va bene
            </button>
          </div>
        </div>
      );
    case 'card':
      return <CardModal g={g} />;
  }
}

function RollPanel({ g }: { g: GameState }) {
  const act = useAct();
  const openPanel = useStore((s) => s.openPanel);
  const me = g.players[g.current];
  if (g.phase === 'roll') {
    return (
      <div className="panel-box compact">
        <h3>
          Tocca a <Who g={g} id={g.current} /> {me.inJail ? '— a Poggioreale' : ''}
        </h3>
        <div className="row">
          {me.inJail ? (
            <>
              <button className="btn primary" onClick={() => act({ type: 'ROLL' })}>
                🎲 Tenta il doppio ({me.jailTurns}/3)
              </button>
              <button className="btn" disabled={me.money < JAIL_FINE} onClick={() => act({ type: 'PAY_JAIL' })}>
                💼 Paga {JAIL_FINE} ₵ all'avvocato cugino
              </button>
              {me.conosco > 0 && (
                <button className="btn gold" onClick={() => act({ type: 'USE_CONOSCO_JAIL' })}>
                  🤫 Conosco a uno
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn primary big" onClick={() => act({ type: 'ROLL' })}>
                🎲 Tira i dadi
              </button>
              {me.pawn === 'ciro' && !me.cascoUsedLap && (
                <button className="btn danger" onClick={() => act({ type: 'ROLL', senzaCasco: true })}>
                  🛵 Senza casco (3 dadi)
                </button>
              )}
            </>
          )}
          <button className="btn ghost" onClick={() => openPanel('props')}>
            🏘️ Proprietà
          </button>
          <button className="btn ghost" onClick={() => openPanel('trade')}>
            🤝 Scambio / Pacco
          </button>
        </div>
      </div>
    );
  }
  // manage
  const presepe = canPresepe(g, g.current);
  return (
    <div className="panel-box compact">
      <h3>
        <Who g={g} id={g.current} />: {g.rollAgain ? 'doppio! Tira ancora.' : 'costruisci, scambia o passa.'}
      </h3>
      <div className="row">
        {g.rollAgain ? (
          <button className="btn primary big" onClick={() => act({ type: 'ROLL' })}>
            🎲 Tira ancora
          </button>
        ) : (
          <button className="btn primary big" onClick={() => act({ type: 'END_TURN' })}>
            ➜ Passa il turno
          </button>
        )}
        <button className="btn" onClick={() => openPanel('props')}>
          🏘️ Proprietà & bassi
        </button>
        <button className="btn" onClick={() => openPanel('trade')}>
          🤝 Scambio / Pacco
        </button>
        <button className="btn" disabled={me.money < CORNO_PRICE || me.corni >= 3} onClick={() => act({ type: 'BUY_CORNO' })}>
          🌶️ Corno ({CORNO_PRICE} ₵)
        </button>
        {presepe && <PresepeButton g={g} />}
      </div>
    </div>
  );
}

function PresepeButton({ g }: { g: GameState }) {
  const act = useAct();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="btn gold" onClick={() => setOpen(true)}>
        🎄 Presepe vivente
      </button>
    );
  return (
    <span className="row">
      {g.players
        .filter((p) => !p.bankrupt && p.id !== g.current)
        .map((p) => (
          <button key={p.id} className="btn gold" onClick={() => act({ type: 'PRESEPE', target: p.id })}>
            🎄 Metti {p.name} in posa
          </button>
        ))}
    </span>
  );
}

export function ActionPanel() {
  const g = useStore((s) => s.game);
  const busy = useStore((s) => s.busy);
  if (!g || g.winner !== null) return null;
  const who = actor(g);
  if (busy) {
    return (
      <div className="action-dock">
        <div className="panel-box compact ghosty">⏳ Aspetta, sta succedendo qualcosa…</div>
      </div>
    );
  }
  if (g.pending?.kind === 'card') return <PendingPanel g={g} />;
  if (who !== null && g.players[who].isBot && g.pending?.kind !== 'auction' && g.pending?.kind !== 'trade') {
    return (
      <div className="action-dock">
        <div className="panel-box compact thinking">
          🤖 <Who g={g} id={who} /> sta facendo i suoi calcoli… ({g.players[who].botLevel === 'boss' ? "Boss d'o Rione" : g.players[who].botLevel})
        </div>
      </div>
    );
  }
  return <div className="action-dock">{g.pending ? <PendingPanel g={g} /> : <RollPanel g={g} />}</div>;
}
