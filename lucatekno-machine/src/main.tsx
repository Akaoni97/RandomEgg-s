import { createRoot } from 'react-dom/client';
import '@fontsource/vt323/400.css';
import '@fontsource/share-tech-mono/400.css';
import '@fontsource/dotgothic16/400.css';
import '@fontsource/syne-mono/400.css';
import '@fontsource/black-ops-one/400.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/monoton/400.css';
import '@fontsource/bungee/400.css';
import '@fontsource/silkscreen/400.css';
import './ui/panel.css';
import './ui/skins.css';
import { App } from './ui/App';
import { boot } from './machine';
import { installKeyboard } from './input/keyboard';
import { loadLayoutMap } from './input/keymap';
import { autoMidi } from './input/midi';
import { useStore } from './state/store';
import { analyze, renderPattern, renderSong } from './audio/offline';
import { PRESETS } from './state/presets';
import { setDeckSource, useDeck, useFx } from './deckControl';
import { getEngine, getSequencer } from './machine';
import { hasSample } from './audio/samples';

boot();
installKeyboard();
void loadLayoutMap();
const unsub = useStore.subscribe((s) => {
  if (s.powered) { unsub(); autoMidi(); }
});

createRoot(document.getElementById('root')!).render(<App />);

// Hook di diagnostica (usato dai test end-to-end per verificare il motore con render offline)
(window as any).__tm = { renderPattern, renderSong, analyze, PRESETS, store: useStore, deck: useDeck, fx: useFx, engine: getEngine, seq: getSequencer, setDeckSource, hasSample };
