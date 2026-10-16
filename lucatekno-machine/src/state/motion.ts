// Motion sequence: valori dei parametri registrati per step.

import type { PartState } from './types';

/**
 * Parametri effettivi di una parte a un dato step.
 * Ritorna null se la parte non ha motion (si usano le manopole così come sono).
 */
export function motionAt(part: PartState, step: number): Record<string, number> | null {
  const keys = Object.keys(part.motion);
  if (!keys.length) return null;
  let out: Record<string, number> | null = null;
  for (const k of keys) {
    const v = part.motion[k][step];
    if (v === null || v === undefined) continue;
    if (!out) out = { ...part.params };
    out[k] = v;
  }
  // la parte ha motion ma non su questo step: valori delle manopole
  return out ?? part.params;
}

export const hasMotion = (part: PartState, id?: string) =>
  id ? !!part.motion[id] : Object.keys(part.motion).length > 0;
