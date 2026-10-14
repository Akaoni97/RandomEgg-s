// Banca campioni: i dati originali (WAV/MP3/OGG) sono salvati in IndexedDB sul PC,
// decodificati una volta in AudioBuffer e condivisi da motore live e render offline.

export interface StoredSample {
  id: string;
  name: string;
  data: ArrayBuffer;
}

const DB = 'tribe-machine';
const STORE = 'samples';
export const MAX_SAMPLE_BYTES = 12 * 1024 * 1024;
export const MAX_SAMPLE_SECONDS = 30;

const bank = new Map<string, AudioBuffer>();
const listeners = new Set<() => void>();

export const getSampleBuffer = (id: string | null) => (id ? bank.get(id) ?? null : null);
export const hasSample = (id: string | null) => !!id && bank.has(id);
export function onBankChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const putStored = (s: StoredSample) => tx('readwrite', (st) => st.put(s));
export const getStored = (id: string) => tx<StoredSample | undefined>('readonly', (st) => st.get(id));

let decoder: BaseAudioContext | null = null;
export function setDecoder(ctx: BaseAudioContext) {
  decoder = ctx;
}

async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  // decodeAudioData consuma il buffer: passiamo una copia
  const ctx = decoder ?? new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(data.slice(0));
  if (buf.duration > MAX_SAMPLE_SECONDS) throw new Error(`Campione troppo lungo (max ${MAX_SAMPLE_SECONDS} s)`);
  return buf;
}

/** Id stabile dal contenuto: lo stesso file importato due volte non si duplica */
async function contentId(data: ArrayBuffer): Promise<string> {
  try {
    const h = await crypto.subtle.digest('SHA-1', data);
    return 'smp_' + Array.from(new Uint8Array(h).slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'smp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/** Importa un file audio: decodifica, salva in IndexedDB, lo rende disponibile al motore */
export async function importSampleFile(file: File): Promise<{ id: string; name: string }> {
  if (file.size > MAX_SAMPLE_BYTES) throw new Error('File troppo grande (max 12 MB)');
  const data = await file.arrayBuffer();
  const buf = await decode(data);
  const id = await contentId(data);
  const name = file.name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 12) || 'SAMPLE';
  await putStored({ id, name, data });
  bank.set(id, buf);
  listeners.forEach((f) => f());
  return { id, name };
}

/** Carica dalla memoria locale i campioni richiesti dal progetto. Ritorna gli id mancanti. */
export async function ensureSamples(ids: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const id of ids) {
    if (bank.has(id)) continue;
    try {
      const s = await getStored(id);
      if (!s) { missing.push(id); continue; }
      bank.set(id, await decode(s.data));
    } catch {
      missing.push(id);
    }
  }
  if (ids.length) listeners.forEach((f) => f());
  return missing;
}

// --- incorporazione nei file di progetto esportati (base64) ---

function toB64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromB64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

export async function packSamples(ids: string[]): Promise<Record<string, { name: string; data: string }>> {
  const out: Record<string, { name: string; data: string }> = {};
  for (const id of ids) {
    try {
      const s = await getStored(id);
      if (s) out[id] = { name: s.name, data: toB64(s.data) };
    } catch { /* campione non disponibile: il file sarà senza audio per quella parte */ }
  }
  return out;
}

export async function unpackSamples(packed: unknown): Promise<number> {
  if (!packed || typeof packed !== 'object') return 0;
  let n = 0;
  for (const [id, v] of Object.entries(packed as Record<string, any>)) {
    if (typeof v?.data !== 'string' || !id.startsWith('smp_')) continue;
    try {
      const data = fromB64(v.data);
      if (data.byteLength > MAX_SAMPLE_BYTES) continue;
      const buf = await decode(data);
      await putStored({ id, name: String(v.name ?? 'SAMPLE').slice(0, 12), data });
      bank.set(id, buf);
      n++;
    } catch { /* ignora campioni corrotti */ }
  }
  if (n) listeners.forEach((f) => f());
  return n;
}
