import { describe, expect, it } from 'vitest';
import { BOARD, SMORFIA } from '../src/engine/board';
import { MALOCCHIO_CARDS, SMORFIA_CARDS } from '../src/engine/cards';
import { actor, apply, createGame, netWorth, rentFor } from '../src/engine/engine';
import { botDecide } from '../src/engine/bot';
import { PAWN_ORDER } from '../src/engine/pawns';
import { censor, phraseCount } from '../src/engine/phrases';
import type { Action, GameState, PawnId } from '../src/engine/types';

const humans = () => PAWN_ORDER.map((pawn) => ({ pawn, isBot: false, botLevel: 'guaglione' as const }));

function game(seed = 42): GameState {
  const s = createGame(humans(), seed);
  return s;
}

function act(s: GameState, ...actions: Action[]): GameState {
  for (const a of actions) {
    const next = apply(s, a);
    if (next === s) throw new Error(`Azione rifiutata: ${JSON.stringify(a)} in fase ${s.phase} / ${s.pending?.kind}`);
    s = next;
  }
  return s;
}

/** forces the next dice and "no random events" */
function rig(s: GameState, rolls: number[], randoms: number[] = []) {
  s.forcedRolls.push(...rolls);
  s.forcedRandom.push(...randoms);
  return s;
}

const byPawn = (s: GameState, pawn: PawnId) => s.players.find((p) => p.pawn === pawn)!;

describe('contenuti', () => {
  it('ha 40 caselle con indice coerente', () => {
    expect(BOARD).toHaveLength(40);
    BOARD.forEach((t, i) => expect(t.index).toBe(i));
  });
  it('ha almeno 20 carte per mazzo e 30 frasi per pedina', () => {
    expect(SMORFIA_CARDS.length).toBeGreaterThanOrEqual(20);
    expect(MALOCCHIO_CARDS.length).toBeGreaterThanOrEqual(20);
    for (const p of PAWN_ORDER) expect(phraseCount(p)).toBeGreaterThanOrEqual(30);
  });
  it('la Smorfia copre ogni somma dei dadi', () => {
    for (let n = 2; n <= 12; n++) expect(SMORFIA[n]).toBeTruthy();
  });
  it('la Modalità Nonna censura le parolacce', () => {
    expect(censor('Sfaccimma, che talento', true)).toBe('sfogliatella, che talento');
    expect(censor('Sfaccimma', false)).toBe('Sfaccimma');
  });
});

describe('regole base', () => {
  it('movimento, acquisto e affitto', () => {
    let s = rig(game(), [1, 2]); // Ciro → 3 Secondigliano
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].pos).toBe(3);
    expect(s.pending?.kind).toBe('buy');
    s = act(s, { type: 'BUY' });
    expect(s.tiles[3].owner).toBe(0);
    expect(s.players[0].money).toBe(1500 - 60);
    s = rig(s, [], [0.99, 0.99]);
    s = act(s, { type: 'END_TURN' });
    expect(s.current).toBe(1);
    s = rig(s, [2, 1]);
    s = act(s, { type: 'ROLL' });
    // Totò lands on Secondigliano (6 ₵, ma lui tratta: -10%); Ciro is there too → scippo option after rent
    expect(s.players[1].money).toBe(1500 - 5);
    expect(s.players[0].money).toBe(1440 + 5);
    expect(s.pending?.kind).toBe('scippo');
  });

  it('il gruppo completo raddoppia l\'affitto e i bassi lo alzano', () => {
    const s = game();
    s.tiles[1].owner = 0;
    s.tiles[3].owner = 0;
    expect(rentFor(s, 1)).toBe(6);
    s.tiles[1].houses = 2;
    expect(rentFor(s, 1)).toBe(45);
    s.tiles[1].houses = 5;
    expect(rentFor(s, 1)).toBe(375);
  });

  it('funicolari e società', () => {
    const s = game();
    s.tiles[5].owner = 0;
    s.tiles[15].owner = 0;
    expect(rentFor(s, 5)).toBe(50);
    s.tiles[12].owner = 1;
    expect(rentFor(s, 12, 7)).toBe(28);
    s.tiles[28].owner = 1;
    expect(rentFor(s, 12, 7)).toBe(70);
  });

  it('passando dal VIA si ritirano 200 e Luigi Gigi ne prende 225', () => {
    let s = game();
    s.players[0].pos = 38;
    s = rig(s, [1, 2]); // → 1 Scampia
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].money).toBe(1700);
    const g = byPawn(s, 'gigi');
    s.current = g.id;
    s.phase = 'roll';
    s.pending = null;
    s.queue = [];
    s.players[g.id].pos = 38;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' });
    expect(s.players[g.id].money).toBe(1725);
  });

  it('tre doppi di fila portano a Poggioreale', () => {
    let s = rig(game(), [1, 1, 2, 2, 3, 3]);
    s = act(s, { type: 'ROLL' });
    s = act(s, { type: 'CARD_OK' }); // 2 = 'A Smorfia
    while (s.pending) s = act(s, resolveAny(s));
    s = act(s, { type: 'ROLL' });
    while (s.pending) s = act(s, resolveAny(s));
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].pos).toBe(10);
    expect(s.rollAgain).toBe(false);
  });

  it('da Poggioreale si esce col doppio, pagando o col "Conosco a uno"', () => {
    let s = game();
    s.players[0].inJail = true;
    s.players[0].pos = 10;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].inJail).toBe(true);

    s = game();
    s.players[0].inJail = true;
    s.players[0].pos = 10;
    s = act(s, { type: 'PAY_JAIL' });
    expect(s.players[0].inJail).toBe(false);
    expect(s.pot).toBe(25); // metà all'avvocato, metà nel Caffè Sospeso

    s = game();
    s.players[0].inJail = true;
    s.players[0].conosco = 1;
    s = act(s, { type: 'USE_CONOSCO_JAIL' });
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].conosco).toBe(0);

    s = game();
    s.players[0].inJail = true;
    s.players[0].pos = 10;
    s = rig(s, [4, 4]);
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].pos).toBe(18);
    expect(s.rollAgain).toBe(false);
  });

  it('chi non può pagare fallisce e il creditore eredita', () => {
    let s = game();
    s.tiles[39].owner = 1;
    s.tiles[39].houses = 5;
    s.players[0].money = 100;
    s.tiles[1].owner = 0;
    s.players[0].pos = 30; // +9 → Stadio
    s = rig(s, [4, 5], [0.99, 0.99]);
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.tiles[1].owner).toBe(1);
    expect(s.current).toBe(1);
    expect(s.events.some((e) => e.type === 'bankrupt')).toBe(true);
  });

  it("asta quando nessuno compra", () => {
    let s = rig(game(), [1, 2]);
    s = act(s, { type: 'ROLL' }, { type: 'DECLINE' });
    expect(s.pending?.kind).toBe('auction');
    expect(actor(s)).toBe(1);
    s = act(
      s,
      { type: 'BID', player: 1, amount: 30 },
      { type: 'PASS_BID', player: 2 },
      { type: 'PASS_BID', player: 3 },
      { type: 'BID', player: 0, amount: 40 },
      { type: 'PASS_BID', player: 1 },
    );
    expect(s.tiles[3].owner).toBe(0);
    expect(s.players[0].money).toBe(1460);
    expect(s.auction).toBeNull();
  });

  it('chi fallisce con uno scippo in coda passa la mano senza bloccare la partita', () => {
    let s = game();
    s.players[1].pos = 17;
    s.players[0].pos = 15;
    s.players[0].money = 20;
    s.decks.smorfia.unshift('smorfia-milano');
    s = rig(s, [1, 1], [0.99, 0.99]); // → 17: carta + scippo in coda
    s = act(s, { type: 'ROLL' });
    expect(s.pending?.kind).toBe('card');
    expect(s.queue.map((q) => q.kind)).toEqual(['scippo']);
    s = act(s, { type: 'CARD_OK' });
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.pending).toBeNull();
    expect(s.current).toBe(1);
    expect(s.phase).toBe('roll');
  });

  it('lo scippo salta se la vittima nel frattempo è andata via', () => {
    let s = game();
    s.players[1].pos = 17;
    s.players[0].pos = 15;
    s.decks.smorfia.unshift('smorfia-avanti');
    s = rig(s, [1, 1]);
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' }); // la carta lo sposta 3 avanti
    expect(s.players[0].pos).toBe(20);
    expect(s.pending).toBeNull();
  });

  it('il Caffè Sospeso raccoglie tasse e multe', () => {
    let s = game();
    s.players[0].pos = 2;
    s = rig(s, [1, 1]); // → 4 Il Pizzo
    s = act(s, { type: 'ROLL' });
    expect(s.pot).toBe(100); // metà del Pizzo nel piatto, l'altra metà al Comune
    s = game();
    s.pot = 333;
    s.players[0].pos = 17;
    s = rig(s, [1, 2]); // → 20
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].money).toBe(1833);
    expect(s.pot).toBe(0);
  });

  it('vince chi resta o il più ricco allo scadere del tempo', () => {
    let s = game();
    s.players[2].money = 5000;
    s = act(s, { type: 'TIME_UP' });
    expect(s.winner).toBe(2);
    expect(s.phase).toBe('over');
  });
});

describe('dadi della Smorfia', () => {
  it("8 = 'A Maronna: +20", () => {
    let s = rig(game(), [3, 5]); // → 8 Rione Sanità
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].money).toBe(1520);
  });
  it("4 = 'O puorco: caffè a tutti", () => {
    let s = rig(game(), [1, 3]); // → 4 Il Pizzo too
    s = act(s, { type: 'ROLL' });
    expect(s.players[1].money).toBe(1510);
    expect(s.players[0].money).toBe(1500 - 30 - 200);
  });
  it("11 = 'E suricille: 1 ₵ per basso", () => {
    let s = game();
    s.tiles[37].owner = 0;
    s.tiles[37].houses = 3;
    s.players[0].pos = 15;
    s = rig(s, [5, 6]); // → 26 Vomero
    s = act(s, { type: 'ROLL' });
    expect(s.players[0].money).toBe(1497);
    expect(s.pot).toBe(2);
  });
});

describe('dinamiche speciali', () => {
  it('Malocchio dimezza il prossimo affitto, il Corno lo blocca', () => {
    let s = game();
    s.tiles[3].owner = 1;
    s.players[1].malocchio = true;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' });
    expect(s.players[1].money).toBe(1503);
    expect(s.players[1].malocchio).toBe(false);

    s = game();
    s.players[0].pos = 2;
    s.decks.malocchio.unshift('malocchio-lancia1');
    s.players[2].corni = 1;
    s = rig(s, [2, 3]); // → 7 Malocchio
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' });
    expect(s.pending?.kind).toBe('malocchioTarget');
    s = act(s, { type: 'MALOCCHIO_TARGET', target: 2 });
    expect(s.players[2].corni).toBe(0);
    expect(s.players[2].malocchio).toBe(false);
  });

  it('si compra il corno a 30', () => {
    let s = game();
    s.phase = 'manage';
    s = act(s, { type: 'BUY_CORNO' });
    expect(s.players[0].corni).toBe(1);
    expect(s.players[0].money).toBe(1470);
  });

  describe("'O Pacco", () => {
    const setup = () => {
      const s = game();
      s.phase = 'manage';
      s.tiles[39].owner = 2;
      return s;
    };
    const trade = (fake: boolean, from = 0) => ({
      from,
      to: 2,
      give: { money: 500, tiles: [], conosco: 0 },
      get: { money: 0, tiles: [39], conosco: 0 },
      pacco: true,
      fake,
    });

    it('pacco finto accettato e non scoperto', () => {
      let s = setup();
      s = act(s, { type: 'PROPOSE_TRADE', trade: trade(true) });
      expect(actor(s)).toBe(2);
      s = rig(s, [], [0.9]);
      s = act(s, { type: 'TRADE_RESPOND', response: 'accept' });
      expect(s.tiles[39].owner).toBe(0);
      expect(s.players[0].money).toBe(1500);
      expect(s.players[2].money).toBe(1500);
    });

    it('pacco finto scoperto: restituisce e va a Poggioreale', () => {
      let s = setup();
      s = act(s, { type: 'PROPOSE_TRADE', trade: trade(true) });
      s = rig(s, [], [0.1]);
      s = act(s, { type: 'TRADE_RESPOND', response: 'accept' });
      expect(s.tiles[39].owner).toBe(2);
      expect(s.players[0].inJail).toBe(true);
    });

    it('Totò Tredita viene scoperto meno spesso', () => {
      let s = setup();
      s.current = 1;
      s = act(s, { type: 'PROPOSE_TRADE', trade: trade(true, 1) });
      s = rig(s, [], [0.4]); // 0.4 ≥ 0.35: Totò la fa franca, Ciro no
      s = act(s, { type: 'TRADE_RESPOND', response: 'accept' });
      expect(s.tiles[39].owner).toBe(1);
      expect(s.players[1].inJail).toBe(false);
    });

    it('controllare un pacco vero costa l\'offesa', () => {
      let s = setup();
      s = act(s, { type: 'PROPOSE_TRADE', trade: trade(false) });
      s = act(s, { type: 'TRADE_RESPOND', response: 'check' });
      expect(s.tiles[39].owner).toBe(0);
      expect(s.players[2].money).toBe(1500 + 500 - 50);
      expect(s.players[0].money).toBe(1000 + 50);
    });

    it('controllare un pacco finto smaschera il truffatore', () => {
      let s = setup();
      s = act(s, { type: 'PROPOSE_TRADE', trade: trade(true) });
      s = act(s, { type: 'TRADE_RESPOND', response: 'check' });
      expect(s.tiles[39].owner).toBe(2);
      expect(s.players[0].inJail).toBe(true);
    });

    it('scambio normale', () => {
      let s = setup();
      s = act(s, { type: 'PROPOSE_TRADE', trade: { ...trade(false), pacco: false } });
      s = act(s, { type: 'TRADE_RESPOND', response: 'accept' });
      expect(s.tiles[39].owner).toBe(0);
      expect(s.players[0].money).toBe(1000);
    });
  });

  it('abusivismo: metà prezzo senza gruppo, la ruspa lo abbatte', () => {
    let s = game();
    s.phase = 'manage';
    s.tiles[39].owner = 0;
    expect(apply(s, { type: 'BUILD', tile: 39 })).toBe(s);
    s = act(s, { type: 'BUILD_ABUSIVO', tile: 39 }, { type: 'BUILD_ABUSIVO', tile: 39 });
    expect(s.tiles[39].houses).toBe(2);
    expect(s.tiles[39].abusivo).toBe(true);
    expect(s.players[0].money).toBe(1350);
    // fine giro: niente Napoli segna, ruspa sì
    s.current = 3;
    s = rig(s, [], [0.99, 0.01, 0]);
    s = act(s, { type: 'END_TURN' });
    expect(s.tiles[39].houses).toBe(0);
    expect(s.tiles[39].abusivo).toBe(false);
  });

  it('costruzione regolare con gruppo completo', () => {
    let s = game();
    s.phase = 'manage';
    s.tiles[37].owner = 0;
    s.tiles[39].owner = 0;
    s = act(s, { type: 'BUILD', tile: 39 });
    expect(s.tiles[39].houses).toBe(1);
    expect(s.tiles[39].abusivo).toBe(false);
    expect(s.players[0].money).toBe(1350);
  });

  it("il Vesuvio erutta a 100 e distrugge il lato verso il vulcano", () => {
    let s = game();
    s.tiles[21].owner = 1;
    s.tiles[21].houses = 3;
    s.tiles[11].owner = 1;
    s.tiles[11].houses = 2;
    s.vesuvio = 95;
    s.players[0].pos = 38;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' });
    expect(s.vesuvio).toBe(0);
    expect(s.tiles[21].houses).toBe(0);
    expect(s.tiles[11].houses).toBe(2);
  });

  it('Gennaro San salva un basso col miracolo', () => {
    let s = game();
    const g = byPawn(s, 'gennaro').id;
    s.tiles[24].owner = g;
    s.tiles[24].houses = 4;
    s.tiles[21].owner = 1;
    s.tiles[21].houses = 1;
    s.vesuvio = 95;
    s.players[0].pos = 38;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' });
    expect(s.pending?.kind).toBe('miracle');
    expect(actor(s)).toBe(g);
    s = rig(s, [5]);
    s = act(s, { type: 'MIRACLE', use: true });
    expect(s.tiles[24].houses).toBe(4);
    expect(s.tiles[21].houses).toBe(0);
    expect(s.players[g].miracleUsed).toBe(true);
  });

  it("miracolo fallito: l'ampolla non si scioglie", () => {
    let s = game();
    const g = byPawn(s, 'gennaro').id;
    s.current = g;
    s.players[g].pos = 2;
    s.decks.malocchio.unshift('malocchio-suocera');
    s = rig(s, [2, 3, 1]);
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' });
    expect(s.pending?.kind).toBe('miracle');
    s = act(s, { type: 'MIRACLE', use: true });
    expect(s.players[g].money).toBe(1500 - 50 - 100);
  });

  it('il miracolo annulla una carta negativa', () => {
    let s = game();
    const g = byPawn(s, 'gennaro').id;
    s.current = g;
    s.players[g].pos = 2;
    s.decks.malocchio.unshift('malocchio-suocera');
    s = rig(s, [2, 3, 6]);
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' }, { type: 'MIRACLE', use: true });
    expect(s.players[g].money).toBe(1500);
  });

  it("l'ampolla di Gennaro si ricarica ogni 3 giri", () => {
    let s = game();
    const g = byPawn(s, 'gennaro').id;
    s.current = g;
    s.players[g].miracleUsed = true;
    s.players[g].laps = 1;
    s.players[g].pos = 38;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' }); // secondo giro: niente
    expect(s.players[g].miracleUsed).toBe(true);
    s.players[g].pos = 38;
    s.phase = 'roll';
    s.pending = null;
    s.queue = [];
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' }); // terzo giro: l'ampolla si scioglie
    expect(s.players[g].laps).toBe(3);
    expect(s.players[g].miracleUsed).toBe(false);
  });

  it('Totò si fa fare lo sconto sugli affitti', () => {
    let s = game();
    s.current = 1;
    s.tiles[39].owner = 0;
    s.tiles[39].houses = 1;
    s.players[1].pos = 30;
    s = rig(s, [4, 5]);
    s = act(s, { type: 'ROLL' });
    expect(s.players[1].money).toBe(1500 - 270);
    expect(s.players[0].money).toBe(1500 + 270);
  });

  it('il Napoli segna: 50 a tutti e amnistia', () => {
    let s = game();
    s.phase = 'manage';
    s.players[2].inJail = true;
    s.players[3].malocchio = true;
    s = rig(s, [], [0.001, 0.99]);
    s = act(s, { type: 'END_TURN' });
    expect(s.players.every((p) => p.money === 1550)).toBe(true);
    expect(s.players[2].inJail).toBe(false);
    expect(s.players[3].malocchio).toBe(false);
  });

  it('lo scippo: Ciro ha +1', () => {
    let s = game();
    s.players[1].pos = 5;
    s.tiles[5].owner = 0;
    s = rig(s, [2, 3]); // Ciro → 5, his own station, Totò there
    s = act(s, { type: 'ROLL' });
    expect(s.pending?.kind).toBe('scippo');
    s = rig(s, [3, 4]); // 3+1 vs 4 → tie, defender wins
    s = act(s, { type: 'SCIPPO', target: 1 });
    expect(s.players[0].money).toBe(1450);
    expect(s.players[1].money).toBe(1550);

    s = game();
    s.players[1].pos = 5;
    s.tiles[5].owner = 0;
    s = rig(s, [2, 3, 4, 4]);
    s = act(s, { type: 'ROLL' }, { type: 'SCIPPO', target: 1 });
    expect(s.players[0].money).toBe(1550);
  });

  it('"Conosco a uno" evita un affitto', () => {
    let s = game();
    s.tiles[3].owner = 1;
    s.players[0].conosco = 1;
    s = rig(s, [1, 2]);
    s = act(s, { type: 'ROLL' });
    expect(s.pending?.kind).toBe('conoscoRent');
    s = act(s, { type: 'CONOSCO_RENT', use: true });
    expect(s.players[0].money).toBe(1500);
    expect(s.players[0].conosco).toBe(0);
  });

  it('"Conosco a uno" blocca un\'asta', () => {
    let s = rig(game(), [1, 2]);
    s.players[2].conosco = 1;
    s = act(s, { type: 'ROLL' }, { type: 'DECLINE' }, { type: 'CONOSCO_AUCTION', player: 2 });
    expect(s.tiles[3].owner).toBe(2);
    expect(s.players[2].money).toBe(1470);
    expect(s.pending).toBeNull();
  });

  it('Presepe vivente: chi ha tutto l\'arancione fa saltare un turno', () => {
    let s = game();
    s.phase = 'manage';
    for (const i of [16, 18, 19]) s.tiles[i].owner = 0;
    s = act(s, { type: 'PRESEPE', target: 1 });
    expect(s.players[1].skipTurns).toBe(1);
    expect(apply(s, { type: 'PRESEPE', target: 2 })).toBe(s);
    s = rig(s, [], [0.99]);
    s = act(s, { type: 'END_TURN' });
    expect(s.current).toBe(2);
  });

  it("'o cugino d'America blocca l'affitto per un giro", () => {
    let s = game();
    s.tiles[1].owner = 0;
    s.players[0].pos = 15;
    s.decks.smorfia.unshift('smorfia-cugino');
    s = rig(s, [1, 1]); // → 17 Smorfia
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' });
    expect(s.tiles[1].cuginoUntil).toBeGreaterThan(s.turn);
    expect(rentFor(s, 1)).toBe(0);
    s.turn = s.tiles[1].cuginoUntil;
    expect(rentFor(s, 1)).toBe(3);
  });

  it('sciopero ANM: funicolari chiuse', () => {
    const s = game();
    s.tiles[5].owner = 1;
    s.scioperoUntil = s.turn + 4;
    expect(rentFor(s, 5)).toBe(0);
  });

  it('Ciro senza casco: tre dadi, ne scarta uno, rischia la Municipale', () => {
    let s = game();
    s = rig(s, [6, 1, 2], [0.5]);
    s = act(s, { type: 'ROLL', senzaCasco: true });
    expect(s.pending?.kind).toBe('ciroPick');
    s = act(s, { type: 'CIRO_PICK', drop: 0 }); // 1+2 = 3
    expect(s.players[0].pos).toBe(3);
    expect(s.players[0].cascoUsedLap).toBe(true);
    expect(s.pot).toBe(0);

    s = game();
    s = rig(s, [6, 1, 2], [0.1]);
    s = act(s, { type: 'ROLL', senzaCasco: true }, { type: 'CIRO_PICK', drop: 0 });
    expect(s.pot).toBe(25);
    // non si può riusare nello stesso giro
    s.phase = 'roll';
    s.pending = null;
    s.queue = [];
    expect(apply(s, { type: 'ROLL', senzaCasco: true })).toBe(s);
  });

  it('le carte applicano i loro effetti', () => {
    let s = game();
    s.players[0].pos = 15;
    s.decks.smorfia.unshift('smorfia-milano');
    s = rig(s, [1, 1]);
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' });
    expect(s.players[0].money).toBe(1350);
    expect(s.players[1].money).toBe(1550);

    s = game();
    s.players[0].pos = 15;
    s.decks.smorfia.unshift('smorfia-mammà');
    s = rig(s, [1, 1]);
    s = act(s, { type: 'ROLL' }, { type: 'CARD_OK' });
    expect(s.players[0].pos).toBe(0);
    expect(s.players[0].money).toBe(1500);
  });
});

function resolveAny(s: GameState): Action {
  const p = s.pending!;
  switch (p.kind) {
    case 'buy':
      return { type: 'DECLINE' };
    case 'auction':
      return { type: 'PASS_BID', player: actor(s)! };
    case 'card':
      return { type: 'CARD_OK' };
    case 'scippo':
      return { type: 'SCIPPO', target: null };
    case 'malocchioTarget':
      return { type: 'MALOCCHIO_TARGET', target: s.players.find((x) => x.id !== s.current && !x.bankrupt)!.id };
    case 'miracle':
      return { type: 'MIRACLE', use: false };
    case 'conoscoRent':
      return { type: 'CONOSCO_RENT', use: false };
    case 'ciroPick':
      return { type: 'CIRO_PICK', drop: 0 };
    case 'trade':
      return { type: 'TRADE_RESPOND', response: 'refuse' };
  }
}

function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('partite simulate con i bot', () => {
  for (const level of ['turista', 'guaglione', 'boss'] as const) {
    it(`4 bot "${level}" giocano senza bloccarsi`, { timeout: 60000 }, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const rng = seeded(seed * 104729);
        let s = createGame(
          PAWN_ORDER.map((pawn) => ({ pawn, isBot: true, botLevel: level })),
          seed * 7919,
        );
        let steps = 0;
        while (s.winner === null && steps < 6000) {
          const a = botDecide(s, rng);
          expect(a).not.toBeNull();
          const next = apply(s, a!);
          if (next === s) throw new Error(`bot bloccato: ${JSON.stringify(a)} @ ${s.phase}/${s.pending?.kind}`);
          s = next;
          steps++;
          const money = s.players.reduce((n, p) => n + p.money, 0);
          expect(Number.isFinite(money)).toBe(true);
          expect(s.players.every((p) => p.money >= 0)).toBe(true);
        }
        if (s.winner === null) s = apply(s, { type: 'TIME_UP' });
        expect(s.winner).not.toBeNull();
        expect(netWorth(s, s.winner!)).toBeGreaterThan(0);
      }
    });
  }

  it('bot misti contro bot misti arrivano alla fine', { timeout: 60000 }, () => {
    const rng = seeded(77);
    let s = createGame(
      [
        { pawn: 'ciro', isBot: true, botLevel: 'boss' },
        { pawn: 'toto', isBot: true, botLevel: 'turista' },
        { pawn: 'gigi', isBot: true, botLevel: 'guaglione' },
        { pawn: 'gennaro', isBot: true, botLevel: 'boss' },
      ],
      2024,
    );
    let steps = 0;
    while (s.winner === null && steps < 20000) {
      s = apply(s, botDecide(s, rng)!);
      steps++;
    }
    expect(steps).toBeGreaterThan(50);
  });
});

import { tileAt, tileCenter } from '../src/three/layout';

describe('layout del tabellone', () => {
  it('tileAt è l\'inverso di tileCenter', () => {
    for (let i = 0; i < 40; i++) {
      const [x, z] = tileCenter(i);
      expect(tileAt(x, z)).toBe(i);
    }
    expect(tileAt(0, 0)).toBeNull();
  });
});
