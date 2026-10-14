import { useStore, actions } from '../state/store';

const LABEL = { pattern: 'NOME PATTERN', project: 'NOME PROGETTO', part: 'NOME PARTE' } as const;
const MAX = { pattern: 16, project: 24, part: 8 } as const;

/** Campo di testo stile LCD per rinominare pattern, progetto e parti */
export function RenameOverlay() {
  const r = useStore((s) => s.rename);
  if (!r) return null;
  const close = () => useStore.setState({ rename: null });
  return (
    <div className="rename-box" onClick={close}>
      <div className="lcd" onClick={(e) => e.stopPropagation()}>
        <label>{LABEL[r.target]}</label>
        <input
          autoFocus
          maxLength={MAX[r.target]}
          defaultValue={r.value}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { actions.rename(r.target, e.currentTarget.value); close(); }
            if (e.key === 'Escape') close();
          }}
        />
        <small>ENTER = CONFERMA · ESC = ANNULLA</small>
        <div className="lcd-glass" />
      </div>
    </div>
  );
}
