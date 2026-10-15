import { create } from 'zustand';
import { ALL_CARDS } from './engine/cards';
import { apply, createGame } from './engine/engine';
import { PHRASES, censor } from './engine/phrases';
import type { Action, BannerKind, GameEvent, GameState, PlayerConfig } from './engine/types';
import { babble, configureAudio, setMusic, setSfx, sfx, speak } from './audio/sfx';
import { pawnSpot } from './three/layout';

const SAVE_KEY = 'napoli-monopoli-save-v1';
const SETTINGS_KEY = 'napoli-monopoli-settings-v1';
const SAVED_AT_KEY = 'napoli-monopoli-saved-at-v1';

export interface UISettings {
  nonna: boolean;
  music: boolean;
  sfx: boolean;
  tts: boolean;
  cinematic: boolean;
  quality: 'alta' | 'bassa';
  botSpeed: 'lenta' | 'normale' | 'veloce';
}

const DEFAULT_SETTINGS: UISettings = {
  nonna: false,
  music: true,
  sfx: true,
  tts: false,
  cinematic: true,
  quality: 'alta',
  botSpeed: 'normale',
};

export interface PawnAnim {
  path: number[];
  t0: number;
  stepDur: number;
  teleport: boolean;
}

export interface Bubble {
  id: number;
  player: number;
  text: string;
  until: number;
}

export interface FloatText {
  id: number;
  player: number;
  text: string;
  color: string;
  t0: number;
}

export interface BannerShow {
  id: number;
  kind: BannerKind;
  text: string;
  big: boolean;
}

export interface DiceShow {
  values: number[];
  extra?: number;
  t0: number;
  seed: number;
  smorfia: number;
  player: number;
}

export interface Effects {
  fireworks: number;
  lapilli: number;
  shake: number;
  ruspa: { tile: number; t0: number } | null;
  train: { player: number; tile: number; t0: number } | null;
  paccoReveal: { brick: boolean; t0: number } | null;
  aura: { player: number; kind: 'malocchio' | 'corno' | 'miracolo'; t0: number } | null;
}

export interface CamFocus {
  target: [number, number, number];
  dist: number;
  until: number;
  /** fixed camera position for scripted shots */
  pos?: [number, number, number];
}

interface Store {
  screen: 'start' | 'game';
  game: GameState | null;
  settings: UISettings;
  queue: GameEvent[];
  busy: boolean;
  lastEventId: number;
  displayPos: number[];
  displayJail: boolean[];
  pawnAnim: (PawnAnim | null)[];
  mood: ({ kind: 'happy' | 'sad'; until: number } | null)[];
  bubbles: Bubble[];
  floats: FloatText[];
  banners: BannerShow[];
  dice: DiceShow | null;
  camFocus: CamFocus | null;
  effects: Effects;
  selectedTile: number | null;
  panel: null | 'trade' | 'log' | 'settings' | 'rules' | 'props';
  hasSave: boolean;

  newGame(players: PlayerConfig[], timeLimit: number): void;
  resume(): void;
  quit(): void;
  dispatch(a: Action): void;
  setSettings(p: Partial<UISettings>): void;
  selectTile(i: number | null): void;
  openPanel(p: Store['panel']): void;
}

function loadSettings(): UISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function saveGame(g: GameState | null) {
  try {
    if (g && g.winner === null) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(g));
      localStorage.setItem(SAVED_AT_KEY, String(Date.now()));
    } else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    return g.version === 1 && Array.isArray(g.players) ? g : null;
  } catch {
    return null;
  }
}

const initialEffects = (): Effects => ({
  fireworks: 0,
  lapilli: 0,
  shake: 0,
  ruspa: null,
  train: null,
  paccoReveal: null,
  aura: null,
});

let uid = 1;
const now = () => performance.now();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useStore = create<Store>((set, get) => ({
  screen: 'start',
  game: null,
  settings: loadSettings(),
  queue: [],
  busy: false,
  lastEventId: 0,
  displayPos: [],
  displayJail: [],
  pawnAnim: [],
  mood: [],
  bubbles: [],
  floats: [],
  banners: [],
  dice: null,
  camFocus: null,
  effects: initialEffects(),
  selectedTile: null,
  panel: null,
  hasSave: loadGame() !== null,

  newGame(players, timeLimit) {
    const s = get().settings;
    const game = createGame(players, Date.now(), { nonna: s.nonna, timeLimit });
    start(game);
  },

  resume() {
    const g = loadGame();
    if (!g) return;
    // the clock doesn't run while the game is closed
    try {
      const savedAt = Number(localStorage.getItem(SAVED_AT_KEY));
      if (savedAt > 0) g.startedAt += Math.max(0, Date.now() - savedAt);
    } catch {
      /* ignore */
    }
    start(g);
  },

  quit() {
    set({ screen: 'start', game: null, queue: [], busy: false, hasSave: loadGame() !== null, panel: null, selectedTile: null });
  },

  dispatch(a) {
    const g = get().game;
    if (!g) return;
    const next = apply(g, a);
    if (next === g) return;
    const fresh = next.events.filter((e) => e.id > get().lastEventId);
    set({
      game: next,
      queue: [...get().queue, ...fresh],
      lastEventId: next.eventSeq,
    });
    saveGame(next);
    if (next.winner !== null) set({ hasSave: false });
    void runDirector();
  },

  setSettings(p) {
    const settings = { ...get().settings, ...p };
    set({ settings });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    setSfx(settings.sfx);
    if ('music' in p) setMusic(settings.music);
  },

  selectTile(i) {
    set({ selectedTile: i });
  },

  openPanel(p) {
    set({ panel: p });
  },
}));

function start(game: GameState) {
  useStore.setState({
    screen: 'game',
    game,
    queue: [],
    busy: false,
    lastEventId: game.eventSeq,
    displayPos: game.players.map((p) => p.pos),
    displayJail: game.players.map((p) => p.inJail),
    pawnAnim: game.players.map(() => null),
    mood: game.players.map(() => null),
    bubbles: [],
    floats: [],
    banners: [],
    dice: null,
    camFocus: null,
    effects: initialEffects(),
    selectedTile: null,
    panel: null,
  });
  saveGame(game);
}

// ───────────────────────── director ─────────────────────────

let running = false;

const setFx = (p: Partial<Effects>) => useStore.setState((st) => ({ effects: { ...st.effects, ...p } }));

function focusOn(player: number, tile: number, dist = 9, ms = 2500) {
  const [x, y, z] = pawnSpot(tile, player);
  useStore.setState({ camFocus: { target: [x, y, z], dist, until: now() + ms } });
}

export function say(player: number, text: string) {
  const st = useStore.getState();
  const g = st.game;
  if (!g) return;
  const clean = censor(text, st.settings.nonna);
  if (clean !== text) sfx.bip();
  const pawn = g.players[player].pawn;
  const bubble: Bubble = { id: uid++, player, text: clean, until: now() + 4200 };
  useStore.setState({ bubbles: [...st.bubbles.filter((b) => b.player !== player && b.until > now()), bubble] });
  if (st.settings.tts) speak(pawn, clean);
  else babble(pawn, clean);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const BIG: BannerKind[] = ['eruzione', 'napoliSegna', 'ruspa', 'paccoScoperto', 'pacco', 'paccoVero', 'miracolo', 'miracoloFallito', 'jail', 'presepe'];

function showBanner(kind: BannerKind, text: string, ms: number) {
  const st = useStore.getState();
  const b: BannerShow = { id: uid++, kind, text: censor(text, st.settings.nonna), big: BIG.includes(kind) };
  useStore.setState({ banners: [...st.banners, b].slice(-4) });
  setTimeout(() => useStore.setState((s) => ({ banners: s.banners.filter((x) => x.id !== b.id) })), ms);
}

function setMood(player: number, kind: 'happy' | 'sad', ms = 1800) {
  useStore.setState((st) => {
    const mood = [...st.mood];
    mood[player] = { kind, until: now() + ms };
    return { mood };
  });
}

async function play(e: GameEvent) {
  const st = useStore.getState();
  const g = st.game!;
  const fast = st.settings.botSpeed === 'veloce' && g.players.every((p) => p.isBot);
  switch (e.type) {
    case 'dice': {
      sfx.dice();
      useStore.setState({
        dice: { values: e.dice, extra: e.extra, t0: now(), seed: Math.random(), smorfia: e.smorfia, player: e.player },
        camFocus: { target: [0, 0.4, 0], dist: 12, until: now() + 1400 },
      });
      await wait(fast ? 700 : 1500);
      return;
    }
    case 'move': {
      const from = e.from;
      const path: number[] = [];
      if (!e.teleport) {
        const dir = Math.sign(e.steps);
        for (let k = 1; k <= Math.abs(e.steps); k++) path.push((((from + dir * k) % 40) + 40) % 40);
      } else path.push(e.to);
      const stepDur = e.teleport ? 700 : Math.max(110, Math.min(230, 2400 / Math.max(1, path.length)));
      useStore.setState((s) => {
        const pawnAnim = [...s.pawnAnim];
        pawnAnim[e.player] = { path: [from, ...path], t0: now(), stepDur, teleport: e.teleport };
        return { pawnAnim };
      });
      const total = stepDur * path.length;
      const t0 = now();
      if (!e.teleport) {
        for (let k = 0; k < path.length; k++) {
          setTimeout(() => sfx.hop(), k * stepDur);
        }
      } else sfx.pop();
      // follow the pawn
      const follow = async () => {
        while (now() - t0 < total) {
          const k = Math.min(path.length - 1, Math.floor((now() - t0) / stepDur));
          focusOn(e.player, path[k], 8.5, 600);
          await wait(120);
        }
      };
      await Promise.all([follow(), wait(total + 80)]);
      useStore.setState((s) => {
        const displayPos = [...s.displayPos];
        displayPos[e.player] = e.to;
        const displayJail = [...s.displayJail];
        displayJail[e.player] = useStore.getState().game!.players[e.player].inJail && e.to === 10;
        const pawnAnim = [...s.pawnAnim];
        pawnAnim[e.player] = null;
        return { displayPos, displayJail, pawnAnim };
      });
      focusOn(e.player, e.to, 9, 1500);
      return;
    }
    case 'card': {
      sfx.card();
      const card = ALL_CARDS[e.cardId];
      if (card && Math.random() < 0.5) say(e.player, pick(PHRASES[g.players[e.player].pawn].card));
      await wait(250);
      return;
    }
    case 'speech': {
      const lines = PHRASES[g.players[e.player].pawn][e.cat];
      if (lines?.length && (e.cat !== 'roll' || Math.random() < 0.45)) say(e.player, pick(lines));
      if (['win', 'collectRent', 'scippa', 'buy'].includes(e.cat)) setMood(e.player, 'happy');
      if (['bankrupt', 'payRent', 'scippato', 'jail'].includes(e.cat)) setMood(e.player, 'sad');
      return;
    }
    case 'money': {
      const f: FloatText = {
        id: uid++,
        player: e.player,
        text: `${e.delta > 0 ? '+' : ''}${e.delta} ₵`,
        color: e.delta > 0 ? '#3ddc84' : '#ff5252',
        t0: now(),
      };
      useStore.setState((s) => ({ floats: [...s.floats.filter((x) => now() - x.t0 < 1800), f] }));
      if (e.delta > 0) sfx.coinIn();
      else sfx.coinOut();
      await wait(fast ? 60 : 140);
      return;
    }
    case 'banner':
      await playBanner(e);
      return;
    case 'bankrupt': {
      sfx.fail();
      const tile = useStore.getState().displayPos[e.player];
      setFx({ train: { player: e.player, tile, t0: now() } });
      focusOn(e.player, tile, 10, 3500);
      showBanner('info', `🚄 ${g.players[e.player].name} se ne va a Milano col Frecciarossa. Piange pure il controllore.`, 4000);
      await wait(3600);
      setFx({ train: null });
      return;
    }
    case 'win': {
      sfx.win();
      sfx.firework();
      setFx({ fireworks: now() });
      setMood(e.player, 'happy', 60000);
      await wait(1500);
      return;
    }
  }
}

async function playBanner(e: Extract<GameEvent, { type: 'banner' }>) {
  const ms = BIG.includes(e.kind) ? 3200 : 2600;
  switch (e.kind) {
    case 'eruzione':
      sfx.rumble();
      useStore.setState({ camFocus: { target: [14, -10, -86], pos: [0, 6, 13.5], dist: 0, until: now() + 3800 } });
      setFx({ lapilli: now(), shake: now() });
      showBanner(e.kind, e.text, 4200);
      await wait(4000);
      return;
    case 'napoliSegna':
      sfx.clacson();
      sfx.firework();
      setFx({ fireworks: now() });
      useStore.getState().game!.players.forEach((p) => !p.bankrupt && setMood(p.id, 'happy', 3000));
      showBanner(e.kind, e.text, 4200);
      await wait(3600);
      return;
    case 'ruspa':
      sfx.ruspa();
      if (e.tile !== undefined) {
        setFx({ ruspa: { tile: e.tile, t0: now() } });
        const [x, , z] = pawnSpot(e.tile, 0);
        useStore.setState({ camFocus: { target: [x, 0.4, z], dist: 7, until: now() + 3000 } });
      }
      showBanner(e.kind, e.text, 3800);
      await wait(3200);
      setFx({ ruspa: null });
      return;
    case 'jail':
      sfx.siren();
      showBanner(e.kind, e.text, ms);
      await wait(900);
      return;
    case 'malocchio':
    case 'corno':
    case 'miracolo':
    case 'miracoloFallito':
      if (e.kind === 'malocchio' || e.kind === 'miracoloFallito') sfx.curse();
      else sfx.magic();
      if (e.player !== undefined) {
        setFx({ aura: { player: e.player, kind: e.kind === 'corno' ? 'corno' : e.kind === 'malocchio' || e.kind === 'miracoloFallito' ? 'malocchio' : 'miracolo', t0: now() } });
      }
      showBanner(e.kind, e.text, ms);
      await wait(1600);
      return;
    case 'pacco':
    case 'paccoScoperto':
    case 'paccoVero':
      setFx({ paccoReveal: { brick: e.kind !== 'paccoVero', t0: now() } });
      if (e.kind === 'paccoScoperto') sfx.siren();
      else sfx.pop();
      showBanner(e.kind, e.text, 3800);
      await wait(2600);
      setFx({ paccoReveal: null });
      return;
    case 'municipale':
      sfx.siren();
      showBanner(e.kind, e.text, ms);
      await wait(1000);
      return;
    case 'scippo':
      sfx.pop();
      showBanner(e.kind, e.text, ms);
      await wait(900);
      return;
    default:
      if (e.kind === 'presepe' || e.kind === 'smorfia') sfx.magic();
      showBanner(e.kind, e.text, ms);
      await wait(BIG.includes(e.kind) ? 1500 : 500);
  }
}

async function runDirector() {
  if (running) return;
  running = true;
  useStore.setState({ busy: true });
  try {
    while (useStore.getState().queue.length) {
      const [e, ...rest] = useStore.getState().queue;
      useStore.setState({ queue: rest });
      try {
        await play(e);
      } catch (err) {
        console.error('animazione fallita', err);
      }
    }
  } finally {
    // resync in case something got skipped
    const g = useStore.getState().game;
    if (g) {
      useStore.setState({
        displayPos: g.players.map((p) => p.pos),
        displayJail: g.players.map((p) => p.inJail),
        pawnAnim: g.players.map(() => null),
      });
    }
    running = false;
    useStore.setState({ busy: false });
  }
}

// apply persisted audio prefs at startup
const initial = useStore.getState().settings;
configureAudio({ sfx: initial.sfx, music: initial.music });
