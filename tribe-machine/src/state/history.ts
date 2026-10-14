// Undo / redo dei contenuti del progetto (pattern, song, nomi, campioni).
// Le modifiche ravvicinate (es. una manopola trascinata) diventano un solo passo.

import { flash, useStore } from './store';
import type { Project } from './types';

const MAX = 100;
const COALESCE_MS = 600;
const undoStack: Project[] = [];
const redoStack: Project[] = [];
let lastChange = -Infinity;
let applying = false;

const contentChanged = (a: Project, b: Project) =>
  a.patterns !== b.patterns || a.song !== b.song || a.name !== b.name || a.samples !== b.samples;

function flags() {
  useStore.setState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
}

export function installHistory() {
  useStore.subscribe((s, prev) => {
    if (applying || s.project === prev.project || !contentChanged(s.project, prev.project)) return;
    const now = performance.now();
    if (now - lastChange > COALESCE_MS) {
      undoStack.push(prev.project);
      if (undoStack.length > MAX) undoStack.shift();
    }
    lastChange = now;
    redoStack.length = 0;
    flags();
  });
}

function apply(p: Project) {
  const cur = useStore.getState().project;
  applying = true;
  // il pattern in riproduzione non cambia: si ripristinano solo i contenuti
  useStore.setState({ project: { ...p, current: cur.current }, dirty: true });
  applying = false;
  lastChange = -Infinity;
  flags();
}

export function undo() {
  const p = undoStack.pop();
  if (!p) { flash('NOTHING TO UNDO'); return; }
  redoStack.push(useStore.getState().project);
  apply(p);
  flash('UNDO');
}

export function redo() {
  const p = redoStack.pop();
  if (!p) { flash('NOTHING TO REDO'); return; }
  undoStack.push(useStore.getState().project);
  apply(p);
  flash('REDO');
}
