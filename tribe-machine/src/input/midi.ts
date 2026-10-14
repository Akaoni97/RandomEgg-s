// Ingresso MIDI (Web MIDI API): note → pad/parti, CC → manopole.
//
// Canale 10: mappa General MIDI drum (36 kick, 38 snare, 39 clap, 42 hat, 46 open hat…)
// sulle parti 1-8. Altri canali: suonano la parte selezionata (F3 = nota base).
// CC 70-77 = le 8 manopole SOUND, CC 7 = LEVEL, CC 10 = PAN, CC 91/93 = REV/DLY SEND,
// CC 1 (mod wheel) = filtro master.

import { actions, curPattern, flash, useStore } from '../state/store';
import { fromNorm, KNOB_MAP, paramDef } from '../state/params';
import * as M from '../machine';

const GM_DRUMS: Record<number, number> = {
  35: 0, 36: 0, 37: 1, 38: 1, 40: 1, 39: 2, 42: 3, 44: 3, 46: 4,
  41: 5, 43: 5, 45: 5, 47: 5, 48: 5, 50: 5, 49: 4, 51: 3,
};
const BASE_NOTE = 53; // F3

const CC_COMMON: Record<number, string> = { 7: 'level', 10: 'pan', 91: 'rev', 93: 'dly', 94: 'drive' };

let access: MIDIAccess | null = null;

function updateInputs() {
  const inputs = access ? [...access.inputs.values()].map((i) => i.name ?? 'MIDI IN') : [];
  useStore.setState({ midi: { enabled: !!access, inputs } });
}

function handle(e: MIDIMessageEvent) {
  const d = e.data;
  if (!d || d.length < 2) return;
  const s = useStore.getState();
  if (!s.powered) return;
  const status = d[0] & 0xf0;
  const ch = d[0] & 0x0f;
  const a = d[1];
  const b = d[2] ?? 0;
  const key = `midi:${ch}:${a}`;
  if (status === 0x90 && b > 0) {
    const accent = b >= 100;
    if (ch === 9) {
      const part = GM_DRUMS[a];
      if (part !== undefined) M.livePlay(part, 0, accent, key);
    } else {
      M.livePlay(s.selectedPart, Math.max(-24, Math.min(24, a - BASE_NOTE)), accent, key);
    }
  } else if (status === 0x80 || (status === 0x90 && b === 0)) {
    M.liveRelease(key);
  } else if (status === 0xb0) {
    const n = b / 127;
    if (a === 1) { actions.setFx({ filter: n < 0.02 ? 0 : -n }); return; }
    const part = curPattern(s).parts[s.selectedPart];
    const id = a >= 70 && a <= 77 ? KNOB_MAP[part.type][a - 70] : CC_COMMON[a];
    const def = id ? paramDef(part.type, id) : undefined;
    if (def) M.tweakParam(s.selectedPart, def.id, fromNorm(def, n));
  }
}

function attach() {
  if (!access) return;
  for (const input of access.inputs.values()) input.onmidimessage = handle;
  updateInputs();
}

/** Attiva il MIDI (il browser chiede il permesso la prima volta) */
export async function enableMidi() {
  if (access) { attach(); flash(`MIDI: ${access.inputs.size} IN`); return; }
  if (!('requestMIDIAccess' in navigator)) { flash('MIDI NON SUPPORTATO', 2500); return; }
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = attach;
    attach();
    try { localStorage.setItem('tm.midi', '1'); } catch { /* ok */ }
    flash(`MIDI ON: ${access.inputs.size} IN`);
  } catch {
    flash('MIDI NEGATO', 2500);
  }
}

/** Riattiva il MIDI all'accensione se era stato attivato in passato */
export function autoMidi() {
  let on = false;
  try { on = localStorage.getItem('tm.midi') === '1'; } catch { /* ok */ }
  if (on) void enableMidi();
}
