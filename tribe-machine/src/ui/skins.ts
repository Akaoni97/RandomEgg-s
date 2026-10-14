// Scocche intercambiabili. I colori/font/LED stanno in skins.css (variabili CSS per [data-skin]);
// qui ci sono nomi, testi serigrafati e stile del visualizzatore.

import { create } from 'zustand';
import { loadJSON, saveJSON } from '../state/storage';

export type SkinId = 'blue' | 'underground' | 'acid' | 'chrome';
export type VizStyle = 'segments' | 'blocks' | 'scope' | 'mirror';

export interface Skin {
  id: SkinId;
  name: string;
  /** sottotitolo serigrafato sotto il marchio */
  tagline: string;
  stencil: string;
  sticker: string;
  /** colore del campione nel selettore SHELL */
  swatch: string;
  viz: VizStyle;
}

export const SKINS: Skin[] = [
  {
    id: 'blue', name: 'TRIBE BLUE', tagline: 'TM-1 · RHYTHM SYNTHESIZER · REAL-TIME DSP ENGINE',
    stencil: 'FREE TEKNO SOUND SYSTEM', sticker: 'NO SYSTEM · NO BORDER',
    swatch: 'linear-gradient(135deg, #3b74f0, #0f2f8c)', viz: 'segments',
  },
  {
    id: 'underground', name: 'UNDERGROUND', tagline: 'TM-1/UG · RIG CONTROLLER · 23 MINUTES TO MIDNIGHT',
    stencil: 'TEKNO IS NOT A CRIME', sticker: '23 · SOUND SYSTEM · 23',
    swatch: 'repeating-linear-gradient(45deg, #ffd000 0 5px, #111 5px 10px)', viz: 'blocks',
  },
  {
    id: 'acid', name: 'ACID', tagline: 'TM-1/AC · BASSLINE MUTATION UNIT · RESONANCE ∞',
    stencil: 'ACID TEKNO MENTAL', sticker: 'SMILE · ACID · SMILE',
    swatch: 'linear-gradient(135deg, #f4ff2a, #8fd400)', viz: 'scope',
  },
  {
    id: 'chrome', name: 'MILLENNIUM CHROME', tagline: 'TM-1/Y2K · DIGITAL FREE PARTY EDITION',
    stencil: 'DIGITAL FREE PARTY · Y2K', sticker: 'HANDLE WITH CARE',
    swatch: 'linear-gradient(135deg, #ffffff, #9aa2ad 60%, #00b4ff)', viz: 'mirror',
  },
];

export const skinById = (id: SkinId) => SKINS.find((s) => s.id === id) ?? SKINS[0];

export type ViewMode = '3d' | 'flat';

interface Prefs {
  skin: SkinId;
  view: ViewMode;
  /** animazione di cambio scocca in corso */
  swapping: boolean;
}

const KEY = 'tm.prefs.v1';
const saved = loadJSON<Partial<Prefs>>(KEY) ?? {};

export const usePrefs = create<Prefs>(() => ({
  skin: SKINS.some((s) => s.id === saved.skin) ? (saved.skin as SkinId) : 'blue',
  view: saved.view === 'flat' ? 'flat' : '3d',
  swapping: false,
}));

usePrefs.subscribe((p) => saveJSON(KEY, { skin: p.skin, view: p.view }));

let swapTimer: ReturnType<typeof setTimeout> | null = null;

/** Cambio scocca con animazione: la console si solleva, gira e torna giù con la nuova scocca */
export function setSkin(id: SkinId) {
  const p = usePrefs.getState();
  if (p.skin === id || p.swapping) return;
  usePrefs.setState({ swapping: true });
  if (swapTimer) clearTimeout(swapTimer);
  swapTimer = setTimeout(() => {
    usePrefs.setState({ skin: id });
    swapTimer = setTimeout(() => usePrefs.setState({ swapping: false }), 420);
  }, 380);
}

export function cycleSkin(dir = 1) {
  const i = SKINS.findIndex((s) => s.id === usePrefs.getState().skin);
  setSkin(SKINS[(i + dir + SKINS.length) % SKINS.length].id);
}

export function toggleView() {
  usePrefs.setState({ view: usePrefs.getState().view === '3d' ? 'flat' : '3d' });
}
