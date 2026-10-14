// Salvataggi locali (localStorage) e file di progetto (.tribe.json).
// Nessun server, nessun account: tutto resta sul PC.

import { sanitizeProject } from './factory';
import type { Project } from './types';

const AUTOSAVE = 'tm.autosave';
const SLOT = (n: number) => `tm.slot.${n}`;
export const NUM_SLOTS = 8;

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const serialize = (p: Project) => JSON.stringify(p);

export function parseProject(text: string): Project {
  return sanitizeProject(JSON.parse(text));
}

export const autosave = (p: Project) => safeSet(AUTOSAVE, serialize(p));

export function loadAutosave(): Project | null {
  const t = safeGet(AUTOSAVE);
  if (!t) return null;
  try { return parseProject(t); } catch { return null; }
}

export const saveSlot = (n: number, p: Project) => safeSet(SLOT(n), serialize(p));

export function loadSlot(n: number): Project | null {
  const t = safeGet(SLOT(n));
  if (!t) return null;
  try { return parseProject(t); } catch { return null; }
}

export function slotName(n: number): string | null {
  const t = safeGet(SLOT(n));
  if (!t) return null;
  try { return (JSON.parse(t).name as string) ?? '???'; } catch { return 'CORROTTO'; }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fileSafe = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').toLowerCase() || 'progetto';

export function pickFile(accept: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) resolve(f);
      else reject(new Error('Nessun file'));
    };
    input.click();
  });
}

export function loadJSON<T>(key: string): T | null {
  const t = safeGet(key);
  if (!t) return null;
  try { return JSON.parse(t) as T; } catch { return null; }
}

export const saveJSON = (key: string, v: unknown) => safeSet(key, JSON.stringify(v));
