import {
  BOARD,
  CORNO_PRICE,
  GO_SALARY,
  GROUP_TILES,
  JAIL_FINE,
  JAIL_INDEX,
  SMORFIA,
  START_MONEY,
  STATION_TILES,
  UTILITY_TILES,
  VESUVIO_SIDE,
  isOwnable,
} from './board';
import { ALL_CARDS, deckCards, type Card } from './cards';
import { PAWNS } from './pawns';
import type {
  Action,
  BannerKind,
  Deck,
  GameEvent,
  GameState,
  Pending,
  Player,
  PlayerConfig,
  Settings,
  SpeechCat,
  Trade,
  TradeOffer,
} from './types';

export const VESUVIO_PER_LAP = 7;
export const RUSPA_CHANCE = 0.1;
export const NAPOLI_SEGNA_CHANCE = 0.01;
export const PACCO_DISCOVERY = 0.5;
export const PACCO_DISCOVERY_TOTO = 0.3;
export const SCIPPO_AMOUNT = 50;
export const PACCO_OFFESA = 50;
export const MAX_CORNI = 3;

/** tunables, adjusted with the bot simulations */
export const BALANCE = {
  gigiBonus: 30,
  /** Gennaro's ampolla recharges every N laps (0 = once per game) */
  miracleEvery: 3,
  rentMult: 1,
  /** share of taxes and fines that ends up in the Caffè Sospeso (the rest goes to the Comune) */
  potShare: 0.5,
  houseMult: 1,
  /** Totò haggles every rent down: "siamo uomini o caporali?" */
  totoDiscount: 0.1,
  municipale: 0.35,
};

// ───────────────────────── randomness ─────────────────────────

export function rand(s: GameState): number {
  if (s.forcedRandom.length) return s.forcedRandom.shift()!;
  // mulberry32
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rollDie(s: GameState): number {
  if (s.forcedRolls.length) return s.forcedRolls.shift()!;
  return 1 + Math.floor(rand(s) * 6);
}

function shuffle<T>(s: GameState, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────────────────────── creation ─────────────────────────

export function createGame(configs: PlayerConfig[], seed = Date.now(), settings: Partial<Settings> = {}): GameState {
  const players: Player[] = configs.map((c, id) => ({
    id,
    pawn: c.pawn,
    name: PAWNS[c.pawn].name,
    money: START_MONEY,
    pos: 0,
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
    conosco: 0,
    corni: 0,
    malocchio: false,
    miracleUsed: false,
    skipTurns: 0,
    cascoUsedLap: false,
    laps: 0,
    isBot: c.isBot,
    botLevel: c.botLevel,
    presepeRound: -1,
  }));
  const s: GameState = {
    version: 1,
    players,
    tiles: BOARD.map(() => ({ owner: null, houses: 0, abusivo: false, mortgaged: false, cuginoUntil: 0 })),
    current: 0,
    phase: 'roll',
    pending: null,
    queue: [],
    lastDice: [],
    lastSum: 0,
    doublesCount: 0,
    rollAgain: false,
    pot: 0,
    vesuvio: 0,
    scioperoUntil: 0,
    round: 1,
    turn: 1,
    decks: { smorfia: [], malocchio: [] },
    auction: null,
    trade: null,
    winner: null,
    rng: seed | 0,
    forcedRolls: [],
    forcedRandom: [],
    log: [],
    events: [],
    eventSeq: 0,
    settings: { nonna: false, timeLimit: 0, ...settings },
    startedAt: Date.now(),
  };
  s.decks.smorfia = shuffle(s, deckCards('smorfia').map((c) => c.id));
  s.decks.malocchio = shuffle(s, deckCards('malocchio').map((c) => c.id));
  log(s, "Si comincia! Chi perde paga 'o ccafè a tutti.");
  return s;
}

// ───────────────────────── helpers ─────────────────────────

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function emit(s: GameState, ev: EventInput) {
  s.eventSeq += 1;
  s.events.push({ ...ev, id: s.eventSeq } as GameEvent);
}

export function log(s: GameState, text: string) {
  s.log.push(text);
  if (s.log.length > 150) s.log.splice(0, s.log.length - 150);
}

const banner = (s: GameState, kind: BannerKind, text: string, extra: { player?: number; tile?: number } = {}) => {
  emit(s, { type: 'banner', kind, text, ...extra });
  log(s, text);
};

const speech = (s: GameState, player: number, cat: SpeechCat) => emit(s, { type: 'speech', player, cat });

export const alive = (s: GameState) => s.players.filter((p) => !p.bankrupt);
export const cur = (s: GameState) => s.players[s.current];
const nameOf = (s: GameState, id: number) => s.players[id].name;

function pushPending(s: GameState, p: Pending) {
  if (!s.pending) s.pending = p;
  else s.queue.push(p);
}

/** a queued scippo is moot once its victims have left the tile, gone to jail or to Milan */
function stale(s: GameState, p: Pending) {
  if (p.kind !== 'scippo') return false;
  const me = cur(s);
  p.targets = p.targets.filter((id) => {
    const o = s.players[id];
    return !o.bankrupt && !o.inJail && o.pos === me.pos;
  });
  return p.targets.length === 0 || me.bankrupt || me.inJail;
}

function settle(s: GameState) {
  if (s.pending && stale(s, s.pending)) s.pending = null;
  while (!s.pending && s.queue.length) {
    const next = s.queue.shift()!;
    if (!stale(s, next)) s.pending = next;
  }
  if (s.winner !== null) s.phase = 'over';
  else if (s.pending) s.phase = 'pending';
  else if (s.phase === 'pending') s.phase = 'manage';
}

export function ownsGroup(s: GameState, pid: number, tile: number): boolean {
  const g = BOARD[tile].group;
  if (!g) return false;
  return GROUP_TILES[g].every((i) => s.tiles[i].owner === pid);
}

export function buildingsOf(s: GameState, pid: number) {
  let bassi = 0;
  let palazzi = 0;
  s.tiles.forEach((t) => {
    if (t.owner !== pid) return;
    if (t.houses === 5) palazzi += 1;
    else bassi += t.houses;
  });
  return { bassi, palazzi };
}

export function netWorth(s: GameState, pid: number): number {
  const p = s.players[pid];
  if (p.bankrupt) return 0;
  let worth = p.money;
  s.tiles.forEach((t, i) => {
    if (t.owner !== pid) return;
    const def = BOARD[i];
    worth += t.mortgaged ? (def.price ?? 0) / 2 : def.price ?? 0;
    worth += t.houses * (t.abusivo ? Math.ceil((def.houseCost ?? 0) / 2) : def.houseCost ?? 0);
  });
  return worth;
}

export function scioperoActive(s: GameState) {
  return s.turn < s.scioperoUntil;
}

export function rentFor(s: GameState, tile: number, diceSum = s.lastSum): number {
  const t = s.tiles[tile];
  const def = BOARD[tile];
  if (t.owner === null || t.mortgaged) return 0;
  if (s.turn < t.cuginoUntil) return 0;
  if (def.kind === 'property') {
    const rent = def.rent!;
    if (t.houses > 0) return Math.round(rent[t.houses] * BALANCE.rentMult);
    return Math.round((ownsGroup(s, t.owner, tile) ? rent[0] * 2 : rent[0]) * BALANCE.rentMult);
  }
  if (def.kind === 'station') {
    if (scioperoActive(s)) return 0;
    const n = STATION_TILES.filter((i) => s.tiles[i].owner === t.owner).length;
    return 25 * 2 ** (n - 1);
  }
  if (def.kind === 'utility') {
    const n = UTILITY_TILES.filter((i) => s.tiles[i].owner === t.owner).length;
    return diceSum * (n === 2 ? 10 : 4);
  }
  return 0;
}

export function houseCost(tile: number, abusivo: boolean) {
  const c = Math.round((BOARD[tile].houseCost ?? 0) * BALANCE.houseMult);
  return abusivo ? Math.ceil(c / 2) : c;
}

// ───────────────────────── money ─────────────────────────

type Creditor = number | 'pot' | 'bank';

function gain(s: GameState, pid: number, amount: number) {
  if (amount <= 0) return;
  s.players[pid].money += amount;
  emit(s, { type: 'money', player: pid, delta: amount });
}

/** Sells buildings and mortgages until the player has `need` money. */
function raiseFunds(s: GameState, pid: number, need: number) {
  const p = s.players[pid];
  const owned = () => s.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.owner === pid);
  while (p.money < need) {
    const withHouses = owned()
      .filter(({ t }) => t.houses > 0)
      .sort((a, b) => b.t.houses - a.t.houses);
    if (withHouses.length) {
      const { t, i } = withHouses[0];
      p.money += Math.floor(houseCost(i, t.abusivo) / 2);
      t.houses -= 1;
      if (t.houses === 0) t.abusivo = false;
      continue;
    }
    const mortgageable = owned()
      .filter(({ t }) => !t.mortgaged)
      .sort((a, b) => (BOARD[a.i].price ?? 0) - (BOARD[b.i].price ?? 0));
    if (mortgageable.length) {
      const { t, i } = mortgageable[0];
      t.mortgaged = true;
      p.money += (BOARD[i].price ?? 0) / 2;
      continue;
    }
    break;
  }
}

/** Pays `amount`; liquidates or bankrupts the payer when needed. Returns the amount actually paid. */
export function pay(s: GameState, from: number, to: Creditor, amount: number): number {
  if (amount <= 0) return 0;
  const p = s.players[from];
  if (p.bankrupt) return 0;
  if (p.money < amount) {
    raiseFunds(s, from, amount);
    if (p.money > amount) log(s, `${p.name} ha dovuto vendere e ipotecare per pagare. Mannaggia.`);
  }
  const paid = Math.min(p.money, amount);
  p.money -= paid;
  emit(s, { type: 'money', player: from, delta: -paid });
  if (typeof to === 'number') gain(s, to, paid);
  else if (to === 'pot') s.pot += Math.floor(paid * BALANCE.potShare);
  if (paid < amount) bankrupt(s, from, to);
  return paid;
}

function bankrupt(s: GameState, pid: number, creditor: Creditor) {
  const p = s.players[pid];
  if (p.bankrupt) return;
  p.bankrupt = true;
  const heir = typeof creditor === 'number' && !s.players[creditor].bankrupt ? creditor : null;
  if (heir !== null && p.money > 0) gain(s, heir, p.money);
  p.money = 0;
  s.tiles.forEach((t) => {
    if (t.owner !== pid) return;
    if (heir !== null) {
      t.owner = heir;
    } else {
      t.owner = null;
      t.houses = 0;
      t.abusivo = false;
      t.mortgaged = false;
    }
  });
  if (heir !== null) {
    s.players[heir].conosco += p.conosco;
    s.players[heir].corni = Math.min(MAX_CORNI, s.players[heir].corni + p.corni);
  }
  p.conosco = 0;
  p.corni = 0;
  p.inJail = false;
  emit(s, { type: 'bankrupt', player: pid });
  speech(s, pid, 'bankrupt');
  log(s, `💸 ${p.name} è fallito e se ne va a Milano col Frecciarossa. Piange pure il controllore.`);
  // drop decisions that belonged to the bankrupt player
  s.queue = s.queue.filter((q) => !(q.kind === 'miracle' && q.player === pid));
  if (s.pending?.kind === 'miracle' && s.pending.player === pid) s.pending = null;
  if (s.auction) {
    s.auction.active = s.auction.active.filter((a) => a !== pid);
  }
  if (s.trade && (s.trade.from === pid || s.trade.to === pid)) {
    s.trade = null;
    if (s.pending?.kind === 'trade') s.pending = null;
  }
  checkWinner(s);
}

function checkWinner(s: GameState) {
  const left = alive(s);
  if (left.length === 1 && s.winner === null) declareWinner(s, left[0].id);
}

function declareWinner(s: GameState, pid: number) {
  s.winner = pid;
  s.phase = 'over';
  s.pending = null;
  s.queue = [];
  emit(s, { type: 'win', player: pid });
  speech(s, pid, 'win');
  log(s, `🏆 ${nameOf(s, pid)} vince lo SCUDETTO! Caroselli fino a domattina.`);
}

// ───────────────────────── movement ─────────────────────────

function passGo(s: GameState, pid: number) {
  const p = s.players[pid];
  p.laps += 1;
  p.cascoUsedLap = false;
  let salary = GO_SALARY;
  if (p.pawn === 'gigi') salary += BALANCE.gigiBonus;
  if (p.pawn === 'gennaro' && p.miracleUsed && BALANCE.miracleEvery && p.laps % BALANCE.miracleEvery === 0) {
    p.miracleUsed = false;
    banner(s, 'miracolo', `✨ L'ampolla di ${p.name} si è sciolta di nuovo: il miracolo è pronto!`, { player: pid });
  }
  gain(s, pid, salary);
  log(
    s,
    p.pawn === 'gigi'
      ? `${p.name} passa dal VIA: ${salary} ₵ (${BALANCE.gigiBonus} in più, perché la pizza la mangiano tutti).`
      : `${p.name} passa dal VIA e ritira ${salary} ₵.`,
  );
  bumpVesuvio(s, VESUVIO_PER_LAP);
}

function moveSteps(s: GameState, pid: number, steps: number, collectGo = true) {
  const p = s.players[pid];
  const from = p.pos;
  const raw = from + steps;
  const to = ((raw % 40) + 40) % 40;
  p.pos = to;
  emit(s, { type: 'move', player: pid, from, to, steps, teleport: false });
  if (steps > 0 && raw >= 40 && collectGo) passGo(s, pid);
}

function teleport(s: GameState, pid: number, to: number) {
  const p = s.players[pid];
  emit(s, { type: 'move', player: pid, from: p.pos, to, steps: 0, teleport: true });
  p.pos = to;
}

export function sendToJail(s: GameState, pid: number) {
  const p = s.players[pid];
  teleport(s, pid, JAIL_INDEX);
  p.inJail = true;
  p.jailTurns = 0;
  if (pid === s.current) {
    s.rollAgain = false;
    s.doublesCount = 0;
  }
  speech(s, pid, 'jail');
  banner(s, 'jail', `🚔 ${p.name} se ne va a Poggioreale. "Io so' innocente!"`, { player: pid });
}

// ───────────────────────── landing ─────────────────────────

function land(s: GameState, pid: number) {
  const p = s.players[pid];
  const tileIdx = p.pos;
  const def = BOARD[tileIdx];
  const t = s.tiles[tileIdx];

  if (isOwnable(def)) {
    if (t.owner === null) {
      pushPending(s, { kind: 'buy', tile: tileIdx });
    } else if (t.owner !== pid && !t.mortgaged && !s.players[t.owner].bankrupt) {
      if (s.turn < t.cuginoUntil) {
        banner(s, 'cugino', `🧔 A ${def.name} c'è 'o cugino d'America sul divano: niente affitto, è famiglia.`, { tile: tileIdx });
      } else if (def.kind === 'station' && scioperoActive(s)) {
        banner(s, 'sciopero', `🚧 Sciopero ANM: ${def.name} è chiusa. Niente affitto.`, { tile: tileIdx });
      } else {
        const amount = rentFor(s, tileIdx);
        if (amount > 0) {
          if (p.conosco > 0) pushPending(s, { kind: 'conoscoRent', tile: tileIdx, amount, owner: t.owner });
          else payRent(s, pid, t.owner, tileIdx, amount);
        }
      }
    }
  } else if (def.kind === 'tax') {
    log(s, `${p.name} paga ${def.tax} ₵ per "${def.name}". Vanno nel Caffè Sospeso.`);
    pay(s, pid, 'pot', def.tax!);
  } else if (def.kind === 'smorfia' || def.kind === 'malocchio') {
    drawCard(s, pid, def.kind);
  } else if (def.kind === 'gotojail') {
    sendToJail(s, pid);
  } else if (def.kind === 'caffe') {
    if (s.pot > 0) {
      const pot = s.pot;
      s.pot = 0;
      gain(s, pid, pot);
      log(s, `☕ ${p.name} si prende tutto il Caffè Sospeso: ${pot} ₵!`);
    } else {
      log(s, `☕ ${p.name} arriva al Caffè Sospeso, ma il piatto è vuoto. Si beve un caffè e basta.`);
    }
  }

  if (!p.bankrupt && !p.inJail) {
    const targets = s.players
      .filter((o) => o.id !== pid && !o.bankrupt && o.pos === p.pos && !o.inJail)
      .map((o) => o.id);
    if (targets.length) pushPending(s, { kind: 'scippo', targets });
  }
}

function payRent(s: GameState, pid: number, owner: number, tileIdx: number, amount: number) {
  const o = s.players[owner];
  if (o.bankrupt) return;
  let due = amount;
  if (o.malocchio) {
    due = Math.floor(amount / 2);
    o.malocchio = false;
    banner(s, 'malocchio', `🧿 ${o.name} ha il malocchio: incassa solo metà affitto (${due} ₵).`, { player: owner });
  }
  if (s.players[pid].pawn === 'toto' && BALANCE.totoDiscount > 0) {
    const off = Math.round(due * BALANCE.totoDiscount);
    due -= off;
    if (off > 0) log(s, `🎩 Totò tratta: "Siamo uomini o caporali?" e si fa fare lo sconto di ${off} ₵.`);
  }
  log(s, `${nameOf(s, pid)} paga ${due} ₵ di affitto a ${o.name} per ${BOARD[tileIdx].name}.`);
  speech(s, pid, 'payRent');
  speech(s, owner, 'collectRent');
  pay(s, pid, owner, due);
}

function drawCard(s: GameState, pid: number, deck: Deck) {
  if (!s.decks[deck].length) s.decks[deck] = shuffle(s, deckCards(deck).map((c) => c.id));
  const cardId = s.decks[deck].shift()!;
  emit(s, { type: 'card', player: pid, deck, cardId });
  pushPending(s, { kind: 'card', deck, cardId });
}

// ───────────────────────── card effects ─────────────────────────

function applyCard(s: GameState, pid: number, card: Card) {
  const p = s.players[pid];
  const e = card.effect;
  log(s, `🎴 ${p.name}: "${card.title}"`);
  switch (e.kind) {
    case 'money':
      if (e.amount > 0) gain(s, pid, e.amount);
      else pay(s, pid, 'pot', -e.amount);
      break;
    case 'payEach':
      for (const o of alive(s)) if (o.id !== pid && !p.bankrupt) pay(s, pid, o.id, e.amount);
      break;
    case 'collectEach':
      for (const o of alive(s)) if (o.id !== pid) pay(s, o.id, pid, e.amount);
      break;
    case 'moveTo': {
      if (!e.collectGo) {
        teleport(s, pid, e.to);
      } else {
        const steps = (e.to - p.pos + 40) % 40;
        moveSteps(s, pid, steps === 0 ? 40 : steps);
      }
      land(s, pid);
      break;
    }
    case 'moveRel':
      moveSteps(s, pid, e.steps);
      land(s, pid);
      break;
    case 'nearestStation': {
      const next = STATION_TILES.find((i) => i > p.pos) ?? STATION_TILES[0];
      moveSteps(s, pid, (next - p.pos + 40) % 40);
      land(s, pid);
      break;
    }
    case 'jail':
      sendToJail(s, pid);
      break;
    case 'skip':
      p.skipTurns += e.turns;
      break;
    case 'conosco':
      p.conosco += 1;
      break;
    case 'corno':
      p.corni = Math.min(MAX_CORNI, p.corni + 1);
      break;
    case 'throwMalocchio':
      if (alive(s).length > 1) pushPending(s, { kind: 'malocchioTarget', cardId: card.id });
      break;
    case 'selfMalocchio':
      curse(s, pid);
      break;
    case 'cugino': {
      const best = s.tiles
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.owner === pid && !t.mortgaged)
        .sort((a, b) => b.t.houses - a.t.houses || (BOARD[b.i].price ?? 0) - (BOARD[a.i].price ?? 0))[0];
      if (best) {
        best.t.cuginoUntil = s.turn + alive(s).length;
        banner(s, 'cugino', `🧔 'O cugino d'America si piazza a ${BOARD[best.i].name}. Per un giro non si incassa.`, {
          tile: best.i,
          player: pid,
        });
      } else {
        log(s, "'O cugino vede che non hai manco una casa e se ne torna in America.");
      }
      break;
    }
    case 'sciopero':
      s.scioperoUntil = s.turn + alive(s).length;
      banner(s, 'sciopero', '🚧 Sciopero ANM! Per un giro le funicolari non incassano.');
      break;
    case 'vesuvio':
      bumpVesuvio(s, e.amount);
      break;
    case 'repairs': {
      const { bassi, palazzi } = buildingsOf(s, pid);
      const due = bassi * e.perBasso + palazzi * e.perPalazzo;
      if (due > 0) pay(s, pid, 'pot', due);
      else log(s, `${p.name} non ha costruito niente. Per una volta l'abusivismo non conviene.`);
      break;
    }
    case 'richestPays': {
      const rich = alive(s)
        .filter((o) => o.id !== pid)
        .sort((a, b) => b.money - a.money)[0];
      if (rich) {
        log(s, `${rich.name} è il più ricco del tavolo e paga la "protezione".`);
        pay(s, rich.id, pid, e.amount);
      }
      break;
    }
    case 'everyonePot':
      for (const o of alive(s)) pay(s, o.id, 'pot', e.amount);
      break;
    case 'freeAbusivo': {
      const spot = s.tiles
        .map((t, i) => ({ t, i }))
        .filter(({ t, i }) => t.owner === pid && !t.mortgaged && t.houses < 5 && BOARD[i].kind === 'property')
        .sort((a, b) => (BOARD[a.i].price ?? 0) - (BOARD[b.i].price ?? 0))[0];
      if (spot) {
        spot.t.houses += 1;
        spot.t.abusivo = true;
        log(s, `🧱 Spunta un basso abusivo a ${BOARD[spot.i].short}. Nessuno ha visto niente.`);
      } else {
        log(s, "Il geometra cerca un terreno tuo, non lo trova, e se ne va a prendere il caffè.");
      }
      break;
    }
    case 'napoliSegna':
      napoliSegna(s);
      break;
    case 'ruspa':
      if (!ruspa(s)) log(s, '🚜 La ruspa gira tutto il rione ma non trova manco un abusivo. Miracolo.');
      break;
    case 'potToMe': {
      const pot = s.pot;
      s.pot = 0;
      gain(s, pid, pot);
      break;
    }
  }
}

function curse(s: GameState, target: number) {
  const t = s.players[target];
  if (t.corni > 0) {
    t.corni -= 1;
    banner(s, 'corno', `🌶️ ${t.name} tira fuori 'o curniciello: il malocchio esplode come un tric-trac!`, { player: target });
  } else {
    t.malocchio = true;
    banner(s, 'malocchio', `🧿 Malocchio su ${t.name}! Il prossimo affitto che incassa sarà dimezzato.`, { player: target });
  }
}

// ───────────────────────── Vesuvio & events ─────────────────────────

function bumpVesuvio(s: GameState, amount: number) {
  s.vesuvio = Math.max(0, Math.min(100, s.vesuvio + amount));
  if (amount < 0) log(s, `🌋 Il Vesuvio si calma un poco: ${s.vesuvio}/100.`);
  if (s.vesuvio >= 100) erupt(s);
}

function vesuvioTargets(s: GameState) {
  return VESUVIO_SIDE.filter((i) => s.tiles[i].houses > 0);
}

function erupt(s: GameState) {
  s.vesuvio = 0;
  banner(s, 'eruzione', "🌋 'O VESUVIO ERUTTA! Lapilli su tutto il lato di Piazza Garibaldi e del Vomero!");
  const gennaro = s.players.find((p) => p.pawn === 'gennaro' && !p.bankrupt && !p.miracleUsed);
  if (gennaro && vesuvioTargets(s).some((i) => s.tiles[i].owner === gennaro.id)) {
    pushPending(s, {
      kind: 'miracle',
      player: gennaro.id,
      reason: "L'eruzione sta per distruggere i tuoi bassi. Fai il miracolo?",
      effect: { kind: 'eruption' },
    });
    return;
  }
  resolveEruption(s, null);
}

function resolveEruption(s: GameState, saved: number | null) {
  const hit = vesuvioTargets(s).filter((i) => i !== saved);
  for (const i of hit) {
    s.tiles[i].houses = 0;
    s.tiles[i].abusivo = false;
  }
  if (hit.length) log(s, `🔥 Distrutti tutti i bassi su: ${hit.map((i) => BOARD[i].short).join(', ')}.`);
  else log(s, 'Per fortuna su quel lato non c\'era niente di costruito. Solo cenere sui panni stesi.');
}

function napoliSegna(s: GameState) {
  banner(s, 'napoliSegna', '⚽ IL NAPOLI SEGNA!!! Tutti si abbracciano, clacson, fuochi: 50 ₵ a tutti, malocchi e galere perdonati!');
  for (const p of alive(s)) {
    gain(s, p.id, 50);
    p.malocchio = false;
    if (p.inJail) {
      p.inJail = false;
      p.jailTurns = 0;
    }
  }
}

function ruspa(s: GameState): boolean {
  const abusivi = s.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.abusivo && t.houses > 0);
  if (!abusivi.length) return false;
  const { t, i } = abusivi[Math.floor(rand(s) * abusivi.length)];
  const owner = t.owner !== null ? nameOf(s, t.owner) : 'nessuno';
  t.houses = 0;
  t.abusivo = false;
  banner(s, 'ruspa', `🚜 Arriva la RUSPA DEL COMUNE a ${BOARD[i].name}! Abbattuto l'abusivo di ${owner}.`, { tile: i });
  return true;
}

// ───────────────────────── turns ─────────────────────────

function nextTurn(s: GameState) {
  s.rollAgain = false;
  s.doublesCount = 0;
  s.lastDice = [];
  if (s.winner !== null) return;
  if (rand(s) < NAPOLI_SEGNA_CHANCE) napoliSegna(s);
  let idx = s.current;
  for (let guard = 0; guard < 64; guard++) {
    const next = (idx + 1) % s.players.length;
    if (next <= idx) {
      s.round += 1;
      if (rand(s) < RUSPA_CHANCE) ruspa(s);
    }
    idx = next;
    const p = s.players[idx];
    if (p.bankrupt) continue;
    if (p.skipTurns > 0) {
      p.skipTurns -= 1;
      log(s, `${p.name} salta il turno. Sta facendo altro, non disturbare.`);
      continue;
    }
    break;
  }
  s.current = idx;
  s.turn += 1;
  s.phase = 'roll';
}

function afterRollMove(s: GameState, d1: number, d2: number, extra?: number) {
  const pid = s.current;
  const p = cur(s);
  const sum = d1 + d2;
  const doubles = d1 === d2;
  s.lastDice = extra !== undefined ? [d1, d2, extra] : [d1, d2];
  s.lastSum = sum;
  emit(s, { type: 'dice', player: pid, dice: [d1, d2], sum, smorfia: sum, extra });
  speech(s, pid, 'roll');
  log(s, `🎲 ${p.name} tira ${d1}+${d2} = ${sum} — ${SMORFIA[sum]}.`);

  if (doubles) {
    s.doublesCount += 1;
    if (s.doublesCount >= 3) {
      log(s, 'Tre doppi di fila? Troppa fortuna: è sospetto.');
      sendToJail(s, pid);
      s.phase = 'manage';
      return;
    }
  }
  smorfiaBonus(s, pid, sum);
  if (p.bankrupt) return;
  moveSteps(s, pid, sum);
  land(s, pid);
  s.rollAgain = doubles && !p.inJail && !p.bankrupt;
  s.phase = 'manage';
}

function smorfiaBonus(s: GameState, pid: number, sum: number) {
  const p = s.players[pid];
  if (sum === 8) {
    gain(s, pid, 20);
    banner(s, 'smorfia', `🙏 8, 'A Maronna! Benedizione per ${p.name}: +20 ₵.`, { player: pid });
  } else if (sum === 4) {
    banner(s, 'smorfia', `🐷 4, 'O puorco! ${p.name} offre il caffè a tutti: 10 ₵ a testa.`, { player: pid });
    for (const o of alive(s)) if (o.id !== pid && !p.bankrupt) pay(s, pid, o.id, 10);
  } else if (sum === 11) {
    const { bassi, palazzi } = buildingsOf(s, pid);
    const n = bassi + palazzi;
    if (n > 0) {
      banner(s, 'smorfia', `🐭 11, 'E suricille! I topi si mangiano ${n} ₵ dai bassi di ${p.name}.`, { player: pid });
      pay(s, pid, 'pot', n);
    }
  }
}

function rollFromJail(s: GameState) {
  const pid = s.current;
  const p = cur(s);
  const d1 = rollDie(s);
  const d2 = rollDie(s);
  s.lastDice = [d1, d2];
  s.lastSum = d1 + d2;
  emit(s, { type: 'dice', player: pid, dice: [d1, d2], sum: d1 + d2, smorfia: d1 + d2 });
  if (d1 === d2) {
    p.inJail = false;
    p.jailTurns = 0;
    log(s, `🎲 ${p.name} fa doppio ${d1}+${d2} e scappa da Poggioreale!`);
    moveSteps(s, pid, d1 + d2);
    land(s, pid);
    s.phase = 'manage';
    return;
  }
  p.jailTurns += 1;
  if (p.jailTurns >= 3) {
    log(s, `${p.name} ha scontato la pena: paga ${JAIL_FINE} ₵ all'avvocato cugino ed esce.`);
    pay(s, pid, 'pot', JAIL_FINE);
    if (p.bankrupt) return;
    p.inJail = false;
    p.jailTurns = 0;
    moveSteps(s, pid, d1 + d2);
    land(s, pid);
  } else {
    log(s, `🎲 ${p.name} tira ${d1}+${d2}: niente doppio, resta a Poggioreale (${p.jailTurns}/3).`);
  }
  s.phase = 'manage';
}

// ───────────────────────── trade ─────────────────────────

function validOffer(s: GameState, pid: number, o: TradeOffer) {
  const p = s.players[pid];
  if (o.money < 0 || o.money > p.money) return false;
  if (o.conosco < 0 || o.conosco > p.conosco) return false;
  return o.tiles.every((i) => s.tiles[i]?.owner === pid && s.tiles[i].houses === 0);
}

export function validTrade(s: GameState, t: Trade) {
  if (t.from === t.to) return false;
  const a = s.players[t.from];
  const b = s.players[t.to];
  if (!a || !b || a.bankrupt || b.bankrupt) return false;
  if (!validOffer(s, t.from, t.give) || !validOffer(s, t.to, t.get)) return false;
  const empty = (o: TradeOffer) => o.money === 0 && o.tiles.length === 0 && o.conosco === 0;
  return !(empty(t.give) && empty(t.get));
}

function transfer(s: GameState, from: number, to: number, o: TradeOffer) {
  if (o.money > 0) {
    s.players[from].money -= o.money;
    emit(s, { type: 'money', player: from, delta: -o.money });
    gain(s, to, o.money);
  }
  for (const i of o.tiles) s.tiles[i].owner = to;
  s.players[from].conosco -= o.conosco;
  s.players[to].conosco += o.conosco;
}

function describe(o: TradeOffer) {
  const parts: string[] = [];
  if (o.money) parts.push(`${o.money} ₵`);
  for (const i of o.tiles) parts.push(BOARD[i].short);
  if (o.conosco) parts.push(`${o.conosco}× Conosco a uno`);
  return parts.join(', ') || 'niente';
}

function respondTrade(s: GameState, response: 'accept' | 'refuse' | 'check') {
  const t = s.trade!;
  const from = s.players[t.from];
  const to = s.players[t.to];
  s.trade = null;
  if (response === 'refuse') {
    log(s, `${to.name} rifiuta lo scambio di ${from.name}. "Ma pe' chi m'hai pigliato?"`);
    return;
  }
  if (!validTrade(s, t)) {
    log(s, 'Scambio saltato: qualcuno non ha più la roba promessa.');
    return;
  }
  if (response === 'check') {
    if (!t.pacco) return;
    if (t.fake) {
      banner(s, 'paccoScoperto', `📦 ${to.name} apre il pacco: c'è un MATTONE! ${from.name} finisce a Poggioreale, truffatore!`, {
        player: t.from,
      });
      sendToJail(s, t.from);
    } else {
      banner(s, 'paccoVero', `📦 ${to.name} apre il pacco: era tutto vero! Per l'offesa paga ${PACCO_OFFESA} ₵ a ${from.name}.`, {
        player: t.to,
      });
      transfer(s, t.from, t.to, t.give);
      transfer(s, t.to, t.from, t.get);
      pay(s, t.to, t.from, PACCO_OFFESA);
    }
    return;
  }
  // accept
  if (t.pacco && t.fake) {
    transfer(s, t.to, t.from, t.get);
    speech(s, t.from, 'pacco');
    const chance = from.pawn === 'toto' ? PACCO_DISCOVERY_TOTO : PACCO_DISCOVERY;
    if (rand(s) < chance) {
      transfer(s, t.from, t.to, t.get);
      banner(s, 'paccoScoperto', `📦 'O pacco! Dentro c'era un mattone, ma il quartiere ha visto tutto: ${from.name} restituisce e va a Poggioreale!`, {
        player: t.from,
      });
      sendToJail(s, t.from);
    } else {
      banner(s, 'pacco', `📦 'O PACCO! ${to.name} apre la scatola: un mattone incartato. ${from.name} se la ride con ${describe(t.get)}.`, {
        player: t.from,
      });
    }
    return;
  }
  transfer(s, t.from, t.to, t.give);
  transfer(s, t.to, t.from, t.get);
  log(s, `🤝 Affare fatto: ${from.name} dà ${describe(t.give)} e riceve ${describe(t.get)} da ${to.name}.`);
}

// ───────────────────────── auction ─────────────────────────

function startAuction(s: GameState, tile: number) {
  const order: number[] = [];
  for (let k = 1; k <= s.players.length; k++) {
    const p = s.players[(s.current + k) % s.players.length];
    if (!p.bankrupt) order.push(p.id);
  }
  s.auction = { tile, bid: 0, leader: null, active: order, turnIdx: 0 };
  log(s, `🔨 All'asta: ${BOARD[tile].name}! "Chi offre di più? Signò, non toccate la merce!"`);
  pushPending(s, { kind: 'auction' });
}

function closeAuction(s: GameState) {
  const a = s.auction!;
  s.auction = null;
  s.pending = null;
  if (a.leader !== null && !s.players[a.leader].bankrupt) {
    const winner = s.players[a.leader];
    pay(s, winner.id, 'bank', a.bid);
    s.tiles[a.tile].owner = winner.id;
    speech(s, winner.id, 'buy');
    log(s, `🔨 Aggiudicato! ${BOARD[a.tile].name} va a ${winner.name} per ${a.bid} ₵.`);
  } else {
    log(s, `🔨 Nessuno vuole ${BOARD[a.tile].name}. Resta al Comune, cioè a nessuno.`);
  }
}

function auctionStep(s: GameState) {
  const a = s.auction!;
  if (a.active.length === 0 || (a.active.length === 1 && a.leader === a.active[0])) {
    closeAuction(s);
    return;
  }
  a.turnIdx %= a.active.length;
  if (a.active[a.turnIdx] === a.leader) {
    // everyone else passed already
    if (a.active.length === 1) closeAuction(s);
  }
}

export function auctionActor(s: GameState): number | null {
  const a = s.auction;
  if (!a || !a.active.length) return null;
  return a.active[a.turnIdx % a.active.length];
}

// ───────────────────────── queries for UI / bots ─────────────────────────

/** The player who must act right now. */
export function actor(s: GameState): number | null {
  if (s.winner !== null) return null;
  const p = s.pending;
  if (!p) return s.current;
  if (p.kind === 'auction') return auctionActor(s);
  if (p.kind === 'trade') return s.trade?.to ?? null;
  if (p.kind === 'miracle') return p.player;
  return s.current;
}

export function canBuild(s: GameState, pid: number, tile: number) {
  const t = s.tiles[tile];
  const def = BOARD[tile];
  if (def.kind !== 'property' || t.owner !== pid || t.houses >= 5) return false;
  if (!ownsGroup(s, pid, tile)) return false;
  if (GROUP_TILES[def.group!].some((i) => s.tiles[i].mortgaged)) return false;
  return s.players[pid].money >= houseCost(tile, false);
}

export function canBuildAbusivo(s: GameState, pid: number, tile: number) {
  const t = s.tiles[tile];
  const def = BOARD[tile];
  if (def.kind !== 'property' || t.owner !== pid || t.houses >= 5 || t.mortgaged) return false;
  return s.players[pid].money >= houseCost(tile, true);
}

export function canPresepe(s: GameState, pid: number) {
  return GROUP_TILES.arancione.every((i) => s.tiles[i].owner === pid) && s.players[pid].presepeRound !== s.round;
}

const isManaging = (s: GameState) =>
  (s.phase === 'manage' || s.phase === 'roll') && !s.pending && s.winner === null;

// ───────────────────────── reducer ─────────────────────────

export function apply(state: GameState, action: Action): GameState {
  if (state.winner !== null && action.type !== 'TIME_UP') return state;
  const s: GameState = structuredClone(state);
  s.events = s.events.slice(-60);
  const ok = step(s, action);
  if (!ok) return state;
  settle(s);
  // a current player who went bankrupt during their turn drops their own decisions and passes the hand
  if (s.winner === null && cur(s).bankrupt) {
    const others = (p: Pending) => p.kind === 'auction' || p.kind === 'trade' || (p.kind === 'miracle' && p.player !== s.current);
    if (s.pending && !others(s.pending)) s.pending = null;
    s.queue = s.queue.filter(others);
    settle(s);
    if (!s.pending) nextTurn(s);
  }
  return s;
}

function step(s: GameState, a: Action): boolean {
  const p = cur(s);
  const pend = s.pending;

  switch (a.type) {
    case 'ROLL': {
      const canRoll = (s.phase === 'roll' || (s.phase === 'manage' && s.rollAgain)) && !pend;
      if (!canRoll) return false;
      s.rollAgain = false;
      if (p.inJail) {
        rollFromJail(s);
        return true;
      }
      if (a.senzaCasco) {
        if (p.pawn !== 'ciro' || p.cascoUsedLap) return false;
        p.cascoUsedLap = true;
        const dice: [number, number, number] = [rollDie(s), rollDie(s), rollDie(s)];
        log(s, `🛵 ${p.name} va SENZA CASCO e tira tre dadi: ${dice.join(', ')}.`);
        pushPending(s, { kind: 'ciroPick', dice });
        s.phase = 'pending';
        return true;
      }
      afterRollMove(s, rollDie(s), rollDie(s));
      return true;
    }

    case 'CIRO_PICK': {
      if (pend?.kind !== 'ciroPick') return false;
      s.pending = null;
      const kept = pend.dice.filter((_, i) => i !== a.drop);
      const dropped = pend.dice[a.drop];
      if (rand(s) < BALANCE.municipale) {
        banner(s, 'municipale', `👮 La Municipale ferma ${p.name} senza casco! Multa di 50 ₵ nel Caffè Sospeso.`, { player: p.id });
        pay(s, p.id, 'pot', 50);
        if (p.bankrupt) return true;
      }
      afterRollMove(s, kept[0], kept[1], dropped);
      return true;
    }

    case 'PAY_JAIL':
    case 'USE_CONOSCO_JAIL': {
      if (s.phase !== 'roll' || pend || !p.inJail) return false;
      if (a.type === 'PAY_JAIL') {
        if (p.money < JAIL_FINE) return false;
        pay(s, p.id, 'pot', JAIL_FINE);
        log(s, `${p.name} paga ${JAIL_FINE} ₵ all'avvocato cugino ed esce da Poggioreale.`);
      } else {
        if (p.conosco < 1) return false;
        p.conosco -= 1;
        log(s, `${p.name}: "Conosco a uno". E la porta di Poggioreale si apre come per magia.`);
      }
      p.inJail = false;
      p.jailTurns = 0;
      return true;
    }

    case 'BUY': {
      if (pend?.kind !== 'buy') return false;
      const price = BOARD[pend.tile].price!;
      if (p.money < price) return false;
      s.pending = null;
      p.money -= price;
      emit(s, { type: 'money', player: p.id, delta: -price });
      s.tiles[pend.tile].owner = p.id;
      speech(s, p.id, 'buy');
      log(s, `🏠 ${p.name} compra ${BOARD[pend.tile].name} per ${price} ₵.`);
      return true;
    }

    case 'DECLINE': {
      if (pend?.kind !== 'buy') return false;
      s.pending = null;
      startAuction(s, pend.tile);
      return true;
    }

    case 'BID': {
      if (pend?.kind !== 'auction' || !s.auction) return false;
      const au = s.auction;
      if (auctionActor(s) !== a.player) return false;
      if (a.amount <= au.bid || a.amount > s.players[a.player].money) return false;
      au.bid = a.amount;
      au.leader = a.player;
      au.turnIdx = (au.turnIdx + 1) % au.active.length;
      auctionStep(s);
      return true;
    }

    case 'PASS_BID': {
      if (pend?.kind !== 'auction' || !s.auction) return false;
      const au = s.auction;
      if (auctionActor(s) !== a.player) return false;
      au.active.splice(au.turnIdx % au.active.length, 1);
      if (au.active.length) au.turnIdx %= au.active.length;
      auctionStep(s);
      return true;
    }

    case 'CONOSCO_AUCTION': {
      if (pend?.kind !== 'auction' || !s.auction) return false;
      const who = s.players[a.player];
      const price = Math.floor(BOARD[s.auction.tile].price! / 2);
      if (who.bankrupt || who.conosco < 1 || who.money < price) return false;
      who.conosco -= 1;
      log(s, `🤫 ${who.name}: "Conosco a uno al Comune." L'asta è bloccata.`);
      s.auction.leader = who.id;
      s.auction.bid = price;
      closeAuction(s);
      return true;
    }

    case 'SCIPPO': {
      if (pend?.kind !== 'scippo') return false;
      s.pending = null;
      if (a.target === null) return true;
      if (!pend.targets.includes(a.target)) return false;
      const victim = s.players[a.target];
      const atk = rollDie(s) + (p.pawn === 'ciro' ? 1 : 0);
      const def = rollDie(s);
      if (atk > def) {
        const amount = Math.min(SCIPPO_AMOUNT, victim.money);
        banner(s, 'scippo', `👜 SCIPPO! ${p.name} (${atk}) frega ${amount} ₵ a ${victim.name} (${def}). "Uè, 'o borsello!"`, {
          player: p.id,
        });
        speech(s, p.id, 'scippa');
        speech(s, victim.id, 'scippato');
        pay(s, victim.id, p.id, amount);
      } else {
        const amount = Math.min(SCIPPO_AMOUNT, p.money);
        banner(s, 'scippo', `👜 Scippo fallito! ${victim.name} (${def}) se ne accorge e si riprende ${amount} ₵ da ${p.name} (${atk}).`, {
          player: victim.id,
        });
        speech(s, victim.id, 'scippa');
        speech(s, p.id, 'scippato');
        pay(s, p.id, victim.id, amount);
      }
      return true;
    }

    case 'MALOCCHIO_TARGET': {
      if (pend?.kind !== 'malocchioTarget') return false;
      const target = s.players[a.target];
      if (!target || target.bankrupt || target.id === p.id) return false;
      s.pending = null;
      curse(s, target.id);
      return true;
    }

    case 'CARD_OK': {
      if (pend?.kind !== 'card') return false;
      s.pending = null;
      const card = ALL_CARDS[pend.cardId];
      if (card.negative && p.pawn === 'gennaro' && !p.miracleUsed) {
        pushPending(s, {
          kind: 'miracle',
          player: p.id,
          reason: `"${card.title}": fai il miracolo per evitarlo?`,
          effect: { kind: 'card', deck: pend.deck, cardId: card.id },
        });
        return true;
      }
      applyCard(s, p.id, card);
      return true;
    }

    case 'MIRACLE': {
      if (pend?.kind !== 'miracle') return false;
      s.pending = null;
      const g = s.players[pend.player];
      const eff = pend.effect;
      let cancelled = false;
      let tragedy = false;
      if (a.use) {
        g.miracleUsed = true;
        const d = rollDie(s);
        if (d === 1) {
          tragedy = true;
          banner(s, 'miracoloFallito', `🩸 L'ampolla NON si scioglie (${d})! Tragedia per ${g.name}: succede tutto, e paga pure 100 ₵.`, {
            player: g.id,
          });
        } else {
          cancelled = true;
          banner(s, 'miracolo', `✨ MIRACOLO! L'ampolla si scioglie (${d}): ${g.name} è salvo!`, { player: g.id });
        }
      }
      if (eff.kind === 'card') {
        if (!cancelled) applyCard(s, g.id, ALL_CARDS[eff.cardId]);
      } else {
        let saved: number | null = null;
        if (cancelled) {
          saved =
            vesuvioTargets(s)
              .filter((i) => s.tiles[i].owner === g.id)
              .sort((x, y) => s.tiles[y].houses - s.tiles[x].houses)[0] ?? null;
          if (saved !== null) log(s, `✨ San Gennaro ferma la lava davanti a ${BOARD[saved].name}.`);
        }
        resolveEruption(s, saved);
      }
      if (tragedy) pay(s, g.id, 'pot', 100);
      return true;
    }

    case 'CONOSCO_RENT': {
      if (pend?.kind !== 'conoscoRent') return false;
      s.pending = null;
      if (a.use) {
        p.conosco -= 1;
        log(s, `🤫 ${p.name}: "Conosco a uno". ${nameOf(s, pend.owner)} non vede manco un centesimo.`);
      } else {
        payRent(s, p.id, pend.owner, pend.tile, pend.amount);
      }
      return true;
    }

    case 'BUILD':
    case 'BUILD_ABUSIVO': {
      if (!isManaging(s)) return false;
      const abusivo = a.type === 'BUILD_ABUSIVO';
      if (abusivo ? !canBuildAbusivo(s, p.id, a.tile) : !canBuild(s, p.id, a.tile)) return false;
      const t = s.tiles[a.tile];
      const cost = houseCost(a.tile, abusivo || t.abusivo);
      p.money -= cost;
      emit(s, { type: 'money', player: p.id, delta: -cost });
      t.houses += 1;
      if (abusivo) t.abusivo = true;
      const what = t.houses === 5 ? 'un PALAZZO' : 'un basso';
      log(
        s,
        abusivo || t.abusivo
          ? `🧱 ${p.name} tira su ${what} ABUSIVO a ${BOARD[a.tile].short} (${cost} ₵). Il geometra non ha visto niente.`
          : `🏗️ ${p.name} costruisce ${what} a ${BOARD[a.tile].short} (${cost} ₵).`,
      );
      return true;
    }

    case 'SELL_HOUSE': {
      if (!isManaging(s)) return false;
      const t = s.tiles[a.tile];
      if (t.owner !== p.id || t.houses === 0) return false;
      const refund = Math.floor(houseCost(a.tile, t.abusivo) / 2);
      t.houses -= 1;
      if (t.houses === 0) t.abusivo = false;
      gain(s, p.id, refund);
      return true;
    }

    case 'MORTGAGE': {
      if (!isManaging(s)) return false;
      const t = s.tiles[a.tile];
      if (t.owner !== p.id || t.mortgaged || t.houses > 0) return false;
      const def = BOARD[a.tile];
      if (def.group && GROUP_TILES[def.group].some((i) => s.tiles[i].houses > 0)) return false;
      t.mortgaged = true;
      gain(s, p.id, def.price! / 2);
      log(s, `${p.name} ipoteca ${def.short} al Monte dei Pegni.`);
      return true;
    }

    case 'UNMORTGAGE': {
      if (!isManaging(s)) return false;
      const t = s.tiles[a.tile];
      const cost = Math.ceil((BOARD[a.tile].price! / 2) * 1.1);
      if (t.owner !== p.id || !t.mortgaged || p.money < cost) return false;
      t.mortgaged = false;
      pay(s, p.id, 'bank', cost);
      return true;
    }

    case 'BUY_CORNO': {
      if (!isManaging(s) || p.money < CORNO_PRICE || p.corni >= MAX_CORNI) return false;
      p.corni += 1;
      pay(s, p.id, 'bank', CORNO_PRICE);
      log(s, `🌶️ ${p.name} compra un corno rosso a San Gregorio Armeno. Non è vero, ma ci credo.`);
      return true;
    }

    case 'PRESEPE': {
      if (!isManaging(s) || !canPresepe(s, p.id)) return false;
      const target = s.players[a.target];
      if (!target || target.bankrupt || target.id === p.id) return false;
      p.presepeRound = s.round;
      target.skipTurns += 1;
      banner(s, 'presepe', `🎄 ${p.name} mette ${target.name} nel presepe di San Gregorio: salta un turno "perché sta in posa".`, {
        player: target.id,
      });
      return true;
    }

    case 'PROPOSE_TRADE': {
      if (!isManaging(s) || a.trade.from !== p.id || !validTrade(s, a.trade)) return false;
      s.trade = { ...a.trade, fake: a.trade.pacco && a.trade.fake };
      log(
        s,
        a.trade.pacco
          ? `📦 ${p.name} propone a ${nameOf(s, a.trade.to)} uno scambio… con una scatola chiusa.`
          : `🤝 ${p.name} propone uno scambio a ${nameOf(s, a.trade.to)}.`,
      );
      pushPending(s, { kind: 'trade' });
      return true;
    }

    case 'TRADE_RESPOND': {
      if (pend?.kind !== 'trade' || !s.trade) return false;
      if (a.response === 'check' && !s.trade.pacco) return false;
      s.pending = null;
      respondTrade(s, a.response);
      return true;
    }

    case 'END_TURN': {
      if (s.phase !== 'manage' || pend || s.rollAgain) return false;
      nextTurn(s);
      return true;
    }

    case 'TIME_UP': {
      if (s.winner !== null) return false;
      const ranking = alive(s).sort((x, y) => netWorth(s, y.id) - netWorth(s, x.id));
      log(s, '⏰ Tempo scaduto! Vince chi tiene più cucuzze (e mattoni).');
      declareWinner(s, ranking[0].id);
      return true;
    }
  }
  return false;
}

export { describe as describeOffer };
