import { createRoot } from 'react-dom/client';
import '@fontsource/vt323/400.css';
import './ui/panel.css';
import { App } from './ui/App';
import { boot } from './machine';
import { installKeyboard } from './input/keyboard';
import { loadLayoutMap } from './input/keymap';
import { autoMidi } from './input/midi';
import { useStore } from './state/store';
import { analyze, renderPattern, renderSong } from './audio/offline';
import { PRESETS } from './state/presets';

boot();
installKeyboard();
void loadLayoutMap();
const unsub = useStore.subscribe((s) => {
  if (s.powered) { unsub(); autoMidi(); }
});

createRoot(document.getElementById('root')!).render(<App />);

// Hook di diagnostica (usato dai test end-to-end per verificare il motore con render offline)
(window as any).__tm = { renderPattern, renderSong, analyze, PRESETS, store: useStore };
