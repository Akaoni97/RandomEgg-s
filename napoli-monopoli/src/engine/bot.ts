import { BOARD, CORNO_PRICE, GROUP_TILES, JAIL_FINE, isOwnable } from './board';
import {
  actor,
  alive,
  auctionActor,
  canBuild,
  canBuildAbusivo,
  canPresepe,
  houseCost,
  netWorth,
  ownsGroup,
  rentFor,
  validTrade,
} from './engine';
import type { Action, BotLevel, GameState, Trade, TradeOffer } from './types';

interface Profile {
  reserve: number;
  buyChance: number;
  auctionFactor: number;
  build: boolean;
  abusivo: boolean;
  checkPacco: number;
  scippo: number;
  trades: boolean;
  /** offer = price × markup when buying the missing tile of a group */
  markup: number;
  pacco: boolean;
  paccoFake: number;
}

const PROFILES: Record<BotLevel, Profile> = {
  turista: { reserve: 50, buyChance: 0.6, auctionFactor: 0.6, build: false, abusivo: false, checkPacco: 0.1, scippo: 0.4, trades: false, markup: 0, pacco: false, paccoFake: 0 },
  guaglione: { reserve: 150, buyChance: 0.9, auctionFactor: 1.0, build: true, abusivo: false, checkPacco: 0.4, scippo: 0.8, trades: true, markup: 1.4, pacco: false, paccoFake: 0 },
  boss: { reserve: 120, buyChance: 1, auctionFactor: 1.25, build: true, abusivo: true, checkPacco: 0.6, scippo: 1, trades: true, markup: 1.6, pacco: true, paccoFake: 0.3 },
};

/** bot-side memory: one trade proposal per turn */
const proposedOnTurn = new Map<number, number>();

let rnd: () => number = Math.random;

function tileValue(s: GameState, pid: number, tile: number): number {
  const def = BOARD[tile];
  let v = def.price ?? 0;
  if (def.group) {
    const mates = GROUP_TILES[def.group];
    const mine = mates.filter((i) => i !== tile && s.tiles[i].owner === pid).length;
    if (mine === mates.length - 1) v *= 2;
    else if (mine > 0) v *= 1.3;
  }
  return v;
}

function offerValue(s: GameState, pid: number, o: TradeOffer) {
  return o.money + o.conosco * 60 + o.tiles.reduce((n, i) => n + tileValue(s, pid, i), 0);
}

function landingScore(s: GameState, pid: number, steps: number): number {
  const tile = (s.players[pid].pos + steps) % 40;
  const def = BOARD[tile];
  const t = s.tiles[tile];
  if (def.kind === 'gotojail') return -150;
  if (def.kind === 'tax') return -(def.tax ?? 0);
  if (def.kind === 'caffe') return s.pot;
  if (isOwnable(def)) {
    if (t.owner === null) return s.players[pid].money > (def.price ?? 0) ? tileValue(s, pid, tile) / 4 : 0;
    if (t.owner !== pid) return -rentFor(s, tile, steps);
  }
  return 0;
}

function richestOther(s: GameState, pid: number) {
  return alive(s)
    .filter((p) => p.id !== pid)
    .sort((a, b) => netWorth(s, b.id) - netWorth(s, a.id))[0];
}

function manage(s: GameState, pid: number, prof: Profile, level: BotLevel): Action | null {
  const p = s.players[pid];

  // unmortgage when rich
  const mortgaged = s.tiles.findIndex((t, i) => t.owner === pid && t.mortgaged && p.money > (BOARD[i].price ?? 0) + 400);
  if (mortgaged >= 0) return { type: 'UNMORTGAGE', tile: mortgaged };

  if (prof.build) {
    const buildable = s.tiles
      .map((_, i) => i)
      .filter((i) => canBuild(s, pid, i) && p.money - houseCost(i, false) >= prof.reserve + 100)
      .sort((a, b) => s.tiles[a].houses - s.tiles[b].houses);
    if (buildable.length) return { type: 'BUILD', tile: buildable[0] };
  }
  if (prof.abusivo) {
    const target = s.tiles
      .map((_, i) => i)
      .filter(
        (i) =>
          !ownsGroup(s, pid, i) &&
          canBuildAbusivo(s, pid, i) &&
          s.tiles[i].houses < 3 &&
          p.money - houseCost(i, true) >= prof.reserve + 250,
      )
      .sort((a, b) => (BOARD[b].price ?? 0) - (BOARD[a].price ?? 0))[0];
    if (target !== undefined && rnd() < 0.5) return { type: 'BUILD_ABUSIVO', tile: target };
  }
  if (level !== 'turista' && p.corni === 0 && p.money > 500 + CORNO_PRICE) return { type: 'BUY_CORNO' };

  if (canPresepe(s, pid)) {
    const victim = richestOther(s, pid);
    if (victim) return { type: 'PRESEPE', target: victim.id };
  }

  if (prof.trades && proposedOnTurn.get(pid) !== s.turn) {
    proposedOnTurn.set(pid, s.turn);
    const trade = groupTrade(s, pid, prof);
    if (trade) return { type: 'PROPOSE_TRADE', trade };
  }

  return s.rollAgain ? { type: 'ROLL' } : { type: 'END_TURN' };
}

function groupTrade(s: GameState, pid: number, prof: Profile): Trade | null {
  const p = s.players[pid];
  for (const tiles of Object.values(GROUP_TILES)) {
    const missing = tiles.filter((i) => s.tiles[i].owner !== pid);
    if (missing.length !== 1) continue;
    const tile = missing[0];
    const owner = s.tiles[tile].owner;
    if (owner === null || s.tiles[tile].houses > 0 || s.players[owner].bankrupt) continue;
    const offer = Math.round(((BOARD[tile].price ?? 0) * prof.markup) / 10) * 10;
    if (p.money - offer < prof.reserve) continue;
    const pacco = prof.pacco && rnd() < 0.5;
    const trade: Trade = {
      from: pid,
      to: owner,
      give: { money: offer, tiles: [], conosco: 0 },
      get: { money: 0, tiles: [tile], conosco: 0 },
      pacco,
      fake: pacco && rnd() < prof.paccoFake / 0.5,
    };
    if (validTrade(s, trade)) return trade;
  }
  return null;
}

/** Returns the bot's next action, or null if it's not a bot's turn to act. `random` makes bots reproducible in tests. */
export function botDecide(s: GameState, random: () => number = Math.random): Action | null {
  rnd = random;
  const pid = actor(s);
  if (pid === null) return null;
  const me = s.players[pid];
  if (!me.isBot || me.bankrupt) return null;
  const level = me.botLevel;
  const prof = PROFILES[level];
  const pend = s.pending;

  if (!pend) {
    if (s.phase === 'roll') {
      if (me.inJail) {
        if (me.conosco > 0) return { type: 'USE_CONOSCO_JAIL' };
        if (me.money > JAIL_FINE + 400 && level !== 'turista') return { type: 'PAY_JAIL' };
        return { type: 'ROLL' };
      }
      const casco = me.pawn === 'ciro' && !me.cascoUsedLap && level !== 'turista';
      return { type: 'ROLL', senzaCasco: casco };
    }
    return manage(s, pid, prof, level);
  }

  switch (pend.kind) {
    case 'buy': {
      const price = BOARD[pend.tile].price!;
      const completes = tileValue(s, pid, pend.tile) > price * 1.5;
      const affordable = me.money - price >= (completes ? 0 : prof.reserve);
      return affordable && rnd() < prof.buyChance ? { type: 'BUY' } : { type: 'DECLINE' };
    }
    case 'auction': {
      const a = s.auction!;
      const who = auctionActor(s)!;
      const bidder = s.players[who];
      const max = Math.min(bidder.money - prof.reserve, tileValue(s, who, a.tile) * prof.auctionFactor);
      if (bidder.conosco > 0 && bidder.money > (BOARD[a.tile].price ?? 0) / 2 && level === 'boss') {
        return { type: 'CONOSCO_AUCTION', player: who };
      }
      const next = a.bid + (a.bid < 100 ? 10 : 20);
      return next <= max ? { type: 'BID', player: who, amount: next } : { type: 'PASS_BID', player: who };
    }
    case 'scippo': {
      if (rnd() >= prof.scippo) return { type: 'SCIPPO', target: null };
      const victim = pend.targets.map((i) => s.players[i]).sort((a, b) => b.money - a.money)[0];
      return { type: 'SCIPPO', target: victim.id };
    }
    case 'ciroPick': {
      const d = pend.dice;
      const options: (0 | 1 | 2)[] = [0, 1, 2];
      const score = (drop: 0 | 1 | 2) => {
        const kept = d.filter((_, i) => i !== drop);
        return landingScore(s, pid, kept[0] + kept[1]) + (kept[0] === kept[1] ? 30 : 0);
      };
      return { type: 'CIRO_PICK', drop: options.sort((a, b) => score(b) - score(a))[0] };
    }
    case 'malocchioTarget': {
      const victim = level === 'turista' ? alive(s).filter((p) => p.id !== pid)[0] : richestOther(s, pid);
      return { type: 'MALOCCHIO_TARGET', target: victim.id };
    }
    case 'miracle':
      return { type: 'MIRACLE', use: true };
    case 'conoscoRent':
      return { type: 'CONOSCO_RENT', use: pend.amount >= 100 || level === 'turista' };
    case 'card':
      return { type: 'CARD_OK' };
    case 'trade': {
      const t = s.trade!;
      const gain = offerValue(s, pid, t.give) - offerValue(s, pid, t.get);
      if (gain < 0 && level !== 'turista') return { type: 'TRADE_RESPOND', response: 'refuse' };
      if (gain < -100) return { type: 'TRADE_RESPOND', response: 'refuse' };
      if (t.pacco && rnd() < prof.checkPacco) return { type: 'TRADE_RESPOND', response: 'check' };
      return { type: 'TRADE_RESPOND', response: 'accept' };
    }
  }
  return null;
}
