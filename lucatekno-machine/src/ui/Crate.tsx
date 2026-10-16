// CASSA DEI DISCHI: la libreria del Mattone. Ogni suono si ascolta, si mette nella parte
// selezionata (che diventa una parte SAMPLE, con step, motion e manopole come le altre) o sul piatto.

import { useMemo, useState } from 'react';
import { CRATE, CRATE_CATS, crateSound, isLibId } from '../audio/crate';
import { crateListen, crateToDeck, crateToPart } from '../deckControl';
import { actions, curPattern, useStore } from '../state/store';

const NOTE = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const noteName = (m: number) => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const close = () => useStore.setState({ crateOpen: false });

export function CrateOverlay() {
  const open = useStore((s) => s.crateOpen);
  const pi = useStore((s) => s.selectedPart);
  const parts = useStore((s) => curPattern(s).parts);
  const part = parts[pi];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tutti');
  const cur = isLibId(part.sampleId) ? crateSound(part.sampleId)?.id : null;

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return CRATE_CATS.filter((c) => cat === 'Tutti' || c === cat)
      .map((c) => [c, CRATE.filter((s) => s.cat === c && (!term || s.name.toLowerCase().includes(term) || c.toLowerCase().includes(term)))] as const)
      .filter(([, items]) => items.length);
  }, [q, cat]);

  if (!open) return null;
  return (
    <div className="overlay crate-overlay" onClick={close}>
      <div className="sheet crate-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>CASSA DEI DISCHI</h2>
            <div className="crate-for">Il suono scelto va nella <b>parte {pi + 1} ({part.name})</b>, che diventa una parte SAMPLE con step, motion e manopole.</div>
            <div className="crate-parts">
              {parts.map((p, i) => (
                <button key={i} tabIndex={-1} className={i === pi ? 'on' : ''} onClick={() => actions.selectPart(i)}>{i + 1} {p.name}</button>
              ))}
            </div>
          </div>
          <button tabIndex={-1} onClick={close}>FATTO (ESC)</button>
        </div>
        <input
          className="crate-search"
          autoFocus
          type="search"
          placeholder="Cerca: conga, mridangam, voce, piano, basso…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
        />
        <div className="crate-cats">
          {['Tutti', ...CRATE_CATS].map((c) => (
            <button key={c} tabIndex={-1} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="crate-list">
          {groups.map(([c, items]) => (
            <div key={c} className="crate-group">
              <div className="crate-grp">{c} · {items.length}</div>
              {items.map((s) => (
                <div key={s.id} className={`crate-item ${s.id === cur ? 'cur' : ''}`}>
                  <button tabIndex={-1} className="crate-play" onClick={() => void crateListen(s.id)} title={`Ascolta ${s.name}`}>▶</button>
                  <button tabIndex={-1} className="crate-name" onClick={() => void crateToPart(s.id)} title="Metti nella parte selezionata">
                    <b>{s.name}</b>
                    <small>{s.root != null ? `intonato · ${noteName(s.root)} · ` : ''}{s.src}</small>
                  </button>
                  <button tabIndex={-1} className="crate-act" onClick={() => void crateToPart(s.id)}>{s.id === cur ? 'NELLA PARTE' : `→ P${pi + 1}`}</button>
                  <button tabIndex={-1} className="crate-act alt" onClick={() => void crateToDeck(s.id)} title="Metti sul piatto per scratcharlo">→ PIATTO</button>
                </div>
              ))}
            </div>
          ))}
          {!groups.length && <p className="small">Nessun suono per “{q}”.</p>}
        </div>
        <p className="crate-credits">
          Suoni dal Mattone Groovebox: VCSL (Versilian Studios, CC0) · FluidR3 GM (Frank Wen, CC BY 3.0) via midi-js-soundfonts ·
          Salamander Grand Piano (Alexander Holm, CC BY 3.0) · mridangam di Arthur Carabott suonato da Harishankar V Menon (CC BY-SA 4.0) ·
          i suoni “sintetizzati dal vivo” sono generati dal codice.
        </p>
      </div>
    </div>
  );
}
