import { useEffect } from 'react';
import { unlockAudio } from './audio/sfx';
import { botDecide } from './engine/bot';
import { actor } from './engine/engine';
import { useStore } from './store';
import { Scene } from './three/Scene';
import { Hud } from './ui/Hud';
import { StartScreen } from './ui/StartScreen';

const BOT_DELAY = { lenta: 1400, normale: 750, veloce: 250 };

/** lets bots play whenever it's their turn to decide and no animation is running */
function useBots() {
  const game = useStore((s) => s.game);
  const busy = useStore((s) => s.busy);
  const speed = useStore((s) => s.settings.botSpeed);
  const paused = useStore((s) => s.panel === 'settings' || s.panel === 'rules');
  useEffect(() => {
    if (!game || busy || paused || game.winner !== null) return;
    const who = actor(game);
    if (who === null || !game.players[who].isBot) return;
    // give humans time to read the bots' cards and trade offers
    const slow = game.pending?.kind === 'card' || game.pending?.kind === 'trade' ? 3 : 1;
    const timer = window.setTimeout(() => {
      const st = useStore.getState();
      if (st.game !== game || st.busy) return;
      const a = botDecide(game);
      if (a) st.dispatch(a);
    }, BOT_DELAY[speed] * slow);
    return () => window.clearTimeout(timer);
  }, [game, busy, speed, paused]);
}

function useTimeLimit() {
  const game = useStore((s) => s.game);
  useEffect(() => {
    if (!game || !game.settings.timeLimit || game.winner !== null) return;
    const id = window.setInterval(() => {
      const g = useStore.getState().game;
      if (!g || g.winner !== null) return;
      if (Date.now() - g.startedAt > g.settings.timeLimit * 60000 && !useStore.getState().busy && !g.pending) {
        useStore.getState().dispatch({ type: 'TIME_UP' });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [game]);
}

export function App() {
  const screen = useStore((s) => s.screen);
  useBots();
  useTimeLimit();
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  return (
    <div className="app">
      <div className="scene">
        <Scene />
      </div>
      {screen === 'start' ? <StartScreen /> : <Hud />}
    </div>
  );
}
