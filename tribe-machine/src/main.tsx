import { createRoot } from 'react-dom/client';
import '@fontsource/vt323/400.css';
import './ui/panel.css';
import { App } from './ui/App';
import { boot } from './machine';
import { installKeyboard } from './input/keyboard';
import { loadLayoutMap } from './input/keymap';

boot();
installKeyboard();
void loadLayoutMap();

createRoot(document.getElementById('root')!).render(<App />);

// Hook di diagnostica (usato dai test end-to-end per verificare il motore con render offline)
import { analyze, renderPattern } from './audio/offline';
import { PRESETS } from './state/presets';
import { useStore } from './state/store';
(window as any).__tm = { renderPattern, analyze, PRESETS, store: useStore };
