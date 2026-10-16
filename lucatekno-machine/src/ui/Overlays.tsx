import { useEffect, useState, useSyncExternalStore } from 'react';
import { useStore } from '../state/store';
import { ACTIONS, FIXED_COMBOS, codesFor, keyLabel, rebind, resetKeymap, STEP_CODES, subscribeKeymap, type ActionId } from '../input/keymap';
import { setCapture } from '../input/keyboard';

let ver = 0;
subscribeKeymap(() => { ver++; });
const useKm = () => useSyncExternalStore(subscribeKeymap, () => ver);

const close = () => useStore.setState({ help: false, keymapOpen: false });

function Grid4() {
  useKm();
  return (
    <div className="help-grid">
      {Array.from({ length: 16 }, (_, k) => {
        const code = codesFor(`step${k}` as ActionId)[0] ?? STEP_CODES[k];
        return (
          <div key={k} className="help-key">
            <b>{keyLabel(code)}</b>
            <span>STEP {k + 1}</span>
            <span className="hk-live">{k < 8 ? `LIVE: PARTE ${k + 1}` : `LIVE: NOTA ${k - 7}`}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HelpOverlay() {
  useKm();
  const open = useStore((s) => s.help);
  if (!open) return null;
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  return (
    <div className="overlay" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>LUCATEKNO_MACHINE LT-1 · COMANDI RAPIDI</h2>
          <button tabIndex={-1} onClick={close}>CHIUDI (ESC)</button>
        </div>
        <div className="help-cols">
          <div>
            <h3>I 16 STEP SULLA TASTIERA (griglia 4×4)</h3>
            <Grid4 />
            <h3>FARE UN BEAT IN 30 SECONDI</h3>
            <ol className="howto">
              <li><b>Spazio</b> per partire. Il kick è la parte 1.</li>
              <li><b>↑ / ↓</b> scelgono la parte, i tasti <b>1-4 Q-R A-F Z-V</b> accendono gli step.</li>
              <li>Su BASS/ACID tieni premuto uno step e usa <b>+ / −</b> per cambiare nota, <b>G</b> per lo slide, <b>Shift</b>+step per l'accento.</li>
              <li>Gira CUTOFF e RESO sull'ACID mentre suona: è lì che nasce l'acid.</li>
              <li><b>Tab</b> = LIVE MODE: suona i pad a mano. <b>Shift+Spazio</b> arma la registrazione quantizzata.</li>
              <li>Con <b>REC</b> acceso e la macchina in play, muovi una manopola: viene registrata la <b>motion</b>.</li>
              <li><b>L</b> = SONG MODE: la pagina SONG costruisce la catena di pattern.</li>
              <li>Trascina un <b>file WAV</b> sul pannello: diventa un suono della parte selezionata.</li>
              <li><b>Ctrl+S</b> salva, <b>Ctrl+Z</b> annulla. Il progetto è anche salvato automaticamente.</li>
            </ol>
            <h3>LT DECK · DAL MATTONE GROOVEBOX</h3>
            <ol className="howto">
              <li><b>Trascina il disco</b> avanti e indietro: la velocità della mano è la velocità del suono. Tenerlo fermo fa silenzio.</li>
              <li><b>BABY, CHIRP, FLARE, TEAR, TRANS, SCRIBBLE</b>: il piatto scratcha da solo, a tempo col sequencer. Tocca il disco per riprenderlo.</li>
              <li><b>B</b> (tieni) = TAGLIO del fader · <b>J</b> = start/stop · <b>U</b> = disco successivo. <b>LOOP DEL PATTERN</b> registra una battuta della macchina sul disco.</li>
              <li><b>6 7 8 9 0</b> (tieni premuto) = OVATTA, RADIO, ECO, RIPETI, LO-FI: effetti al volo su tutto il mix, piatto compreso.</li>
              <li><b>Y</b> = CASSA DEI DISCHI: 240 suoni (conghe, mridangam, voci, piani, fiati…). Uno clic e il suono va nella parte selezionata, con step, motion e manopole tekno.</li>
            </ol>
          </div>
          <div>
            {groups.map((g) => (
              <div key={g}>
                <h3>{g}</h3>
                <table className="keys">
                  <tbody>
                    {ACTIONS.filter((a) => a.group === g && !a.id.startsWith('step')).map((a) => (
                      <tr key={a.id}>
                        <td className="kc">{codesFor(a.id).map(keyLabel).join(' / ') || '—'}</td>
                        <td>{a.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <h3>COMBINAZIONI</h3>
            <table className="keys">
              <tbody>
                {FIXED_COMBOS.map(([k, l]) => (
                  <tr key={k}><td className="kc">{k}</td><td>{l}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>MOUSE</h3>
            <p className="small">Manopole: trascina in verticale (Shift = fine), rotellina, doppio clic = valore numerico, tasto destro = valore iniziale.
              Step: clic = on/off, tasto destro o Shift+clic = accento, Alt+clic = slide. Display: rotellina = VALUE.</p>
            <button tabIndex={-1} className="sheet-btn" onClick={() => useStore.setState({ help: false, keymapOpen: true })}>RIASSEGNA I TASTI…</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KeymapOverlay() {
  useKm();
  const open = useStore((s) => s.keymapOpen);
  const [waiting, setWaiting] = useState<ActionId | null>(null);
  useEffect(() => {
    if (!waiting) return;
    setCapture((code) => {
      rebind(waiting, code);
      setWaiting(null);
      setCapture(null);
    });
    return () => setCapture(null);
  }, [waiting]);
  if (!open) return null;
  return (
    <div className="overlay" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>KEY MAP · RIASSEGNAZIONE</h2>
          <div>
            <button tabIndex={-1} onClick={() => resetKeymap()}>RIPRISTINA DEFAULT</button>
            <button tabIndex={-1} onClick={close}>CHIUDI (ESC)</button>
          </div>
        </div>
        <p className="small">Clicca un comando e premi il nuovo tasto (Esc annulla). Un tasto già usato viene tolto dal comando precedente: niente conflitti.
          Vengono memorizzati i codici fisici, quindi la posizione resta valida con ogni layout.</p>
        <div className="km-list">
          {ACTIONS.map((a) => (
            <button tabIndex={-1} key={a.id} className={`km-row ${waiting === a.id ? 'waiting' : ''}`} onClick={() => setWaiting(a.id)}>
              <span className="km-label">{a.label}</span>
              <span className="kc">{waiting === a.id ? 'PREMI UN TASTO…' : codesFor(a.id).map(keyLabel).join(' / ') || '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
