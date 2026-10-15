export type PawnId = 'ciro' | 'toto' | 'gigi' | 'gennaro';
export type BotLevel = 'turista' | 'guaglione' | 'boss';

export type ColorGroup =
  | 'marrone'
  | 'azzurro'
  | 'rosa'
  | 'arancione'
  | 'rosso'
  | 'giallo'
  | 'verde'
  | 'blu';

export type TileKind =
  | 'via'
  | 'property'
  | 'station'
  | 'utility'
  | 'tax'
  | 'smorfia'
  | 'malocchio'
  | 'jail'
  | 'caffe'
  | 'gotojail';

export interface TileDef {
  index: number;
  kind: TileKind;
  name: string;
  short: string;
  group?: ColorGroup;
  price?: number;
  /** property: [base, 1..4 bassi, palazzo] */
  rent?: number[];
  houseCost?: number;
  tax?: number;
  flavor?: string;
  diorama?: string;
}

export interface Player {
  id: number;
  pawn: PawnId;
  name: string;
  money: number;
  pos: number;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  /** "Conosco a uno" cards held */
  conosco: number;
  corni: number;
  /** cursed: next rent received is halved */
  malocchio: boolean;
  miracleUsed: boolean;
  skipTurns: number;
  /** Ciro: "senza casco" used during the current lap */
  cascoUsedLap: boolean;
  laps: number;
  isBot: boolean;
  botLevel: BotLevel;
  presepeRound: number;
}

export interface TileState {
  owner: number | null;
  /** 0..4 bassi, 5 = palazzo */
  houses: number;
  abusivo: boolean;
  mortgaged: boolean;
  /** turn number (exclusive) until which the cugino d'America occupies the tile */
  cuginoUntil: number;
}

export interface TradeOffer {
  money: number;
  tiles: number[];
  conosco: number;
}

export interface Trade {
  from: number;
  to: number;
  give: TradeOffer;
  get: TradeOffer;
  pacco: boolean;
  /** only meaningful if pacco: the box contains a brick */
  fake: boolean;
}

export interface Auction {
  tile: number;
  bid: number;
  leader: number | null;
  active: number[];
  turnIdx: number;
}

export type Pending =
  | { kind: 'buy'; tile: number }
  | { kind: 'auction' }
  | { kind: 'scippo'; targets: number[] }
  | { kind: 'ciroPick'; dice: [number, number, number] }
  | { kind: 'malocchioTarget'; cardId: string }
  | { kind: 'miracle'; player: number; reason: string; effect: DeferredEffect }
  | { kind: 'conoscoRent'; tile: number; amount: number; owner: number }
  | { kind: 'trade' }
  | { kind: 'card'; deck: Deck; cardId: string };

export type DeferredEffect =
  | { kind: 'card'; deck: Deck; cardId: string }
  | { kind: 'eruption' };

export type Deck = 'smorfia' | 'malocchio';

export type Phase = 'roll' | 'manage' | 'pending' | 'over';

export type GameEvent =
  | { id: number; type: 'dice'; player: number; dice: number[]; sum: number; smorfia: number; extra?: number }
  | { id: number; type: 'move'; player: number; from: number; to: number; steps: number; teleport: boolean }
  | { id: number; type: 'card'; player: number; deck: Deck; cardId: string }
  | { id: number; type: 'speech'; player: number; cat: SpeechCat }
  | { id: number; type: 'banner'; kind: BannerKind; text: string; player?: number; tile?: number }
  | { id: number; type: 'money'; player: number; delta: number }
  | { id: number; type: 'bankrupt'; player: number }
  | { id: number; type: 'win'; player: number };

export type BannerKind =
  | 'eruzione'
  | 'napoliSegna'
  | 'ruspa'
  | 'sciopero'
  | 'scippo'
  | 'municipale'
  | 'malocchio'
  | 'corno'
  | 'pacco'
  | 'paccoScoperto'
  | 'paccoVero'
  | 'miracolo'
  | 'miracoloFallito'
  | 'presepe'
  | 'cugino'
  | 'jail'
  | 'smorfia'
  | 'info';

export type SpeechCat =
  | 'roll'
  | 'buy'
  | 'payRent'
  | 'collectRent'
  | 'jail'
  | 'win'
  | 'bankrupt'
  | 'scippato'
  | 'scippa'
  | 'pacco'
  | 'card';

export interface Settings {
  nonna: boolean;
  /** minutes; 0 = no time limit */
  timeLimit: number;
}

export interface GameState {
  version: 1;
  players: Player[];
  tiles: TileState[];
  current: number;
  phase: Phase;
  pending: Pending | null;
  /** queued after the current pending is resolved */
  queue: Pending[];
  lastDice: number[];
  lastSum: number;
  doublesCount: number;
  /** current player may roll again (rolled doubles) */
  rollAgain: boolean;
  pot: number;
  vesuvio: number;
  /** turn number (exclusive) until which the funicolari don't collect */
  scioperoUntil: number;
  round: number;
  turn: number;
  decks: { smorfia: string[]; malocchio: string[] };
  auction: Auction | null;
  trade: Trade | null;
  winner: number | null;
  rng: number;
  forcedRolls: number[];
  forcedRandom: number[];
  log: string[];
  events: GameEvent[];
  eventSeq: number;
  settings: Settings;
  startedAt: number;
}

export interface PlayerConfig {
  pawn: PawnId;
  isBot: boolean;
  botLevel: BotLevel;
}

export type Action =
  | { type: 'ROLL'; senzaCasco?: boolean }
  | { type: 'CIRO_PICK'; drop: 0 | 1 | 2 }
  | { type: 'PAY_JAIL' }
  | { type: 'USE_CONOSCO_JAIL' }
  | { type: 'BUY' }
  | { type: 'DECLINE' }
  | { type: 'BID'; player: number; amount: number }
  | { type: 'PASS_BID'; player: number }
  | { type: 'CONOSCO_AUCTION'; player: number }
  | { type: 'SCIPPO'; target: number | null }
  | { type: 'MALOCCHIO_TARGET'; target: number }
  | { type: 'MIRACLE'; use: boolean }
  | { type: 'CONOSCO_RENT'; use: boolean }
  | { type: 'CARD_OK' }
  | { type: 'BUILD'; tile: number }
  | { type: 'BUILD_ABUSIVO'; tile: number }
  | { type: 'SELL_HOUSE'; tile: number }
  | { type: 'MORTGAGE'; tile: number }
  | { type: 'UNMORTGAGE'; tile: number }
  | { type: 'BUY_CORNO' }
  | { type: 'PRESEPE'; target: number }
  | { type: 'PROPOSE_TRADE'; trade: Trade }
  | { type: 'TRADE_RESPOND'; response: 'accept' | 'refuse' | 'check' }
  | { type: 'END_TURN' }
  | { type: 'TIME_UP' };
