// CASSA DEI DISCHI: la libreria del Mattone Groovebox dentro la LucaTekno_Machine.
// 199 campioni veri (VCSL, FluidR3 GM, Salamander, mridangam) + 41 suoni sintetizzati dal vivo.
// I campioni sono inclusi nella build (un piccolo modulo per file, caricato solo quando serve):
// funzionano offline, nell'app desktop e nel browser, senza server.

import { CRATE_FILES, CRATE_SYNTH, type CrateRow } from './crateRows';
import { finish, synthBuffer } from './mattone';

export const LIB_PREFIX = 'lib:';
export const isLibId = (id: string | null | undefined): id is string => !!id && id.startsWith(LIB_PREFIX);
export const libId = (id: string) => LIB_PREFIX + id;

export const SOURCES = ['VCSL · CC0', 'FluidR3 GM · CC BY 3.0', 'Salamander · CC BY 3.0', 'Mridangam · CC BY-SA 4.0', 'Sintetizzato dal vivo'];

/** Categorie in ordine di priorità tekno: prima ciò che serve su un sound system */
export const CRATE_CATS = [
  'Percussioni', 'Batteria', 'Effetti', 'Voci', 'Bassi', 'Synth', 'Accordi',
  'Percussioni intonate', 'Tastiere', 'Corde', 'Archi', 'Fiati',
];

export interface CrateSound {
  id: string;
  name: string;
  cat: string;
  /** nota MIDI della registrazione (null = suono non intonato) */
  root: number | null;
  src: string;
  synth: boolean;
}

const toSound = ([id, name, cat, root, s]: CrateRow): CrateSound => ({ id, name, cat, root, src: SOURCES[s], synth: s === 4 });

export const CRATE: CrateSound[] = [...CRATE_SYNTH.map(toSound), ...CRATE_FILES.map(toSound)];
const byId = new Map(CRATE.map((s) => [s.id, s]));
export const crateSound = (id: string) => byId.get(id.startsWith(LIB_PREFIX) ? id.slice(LIB_PREFIX.length) : id);

/** Nome corto (max 8 caratteri, maiuscolo) per la parte del pannello */
export function shortName(s: CrateSound): string {
  const clean = s.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim();
  const words = clean.split(/\s+/);
  const out = words[0].length >= 5 || words.length === 1 ? words[0] : words.slice(0, 2).join(' ');
  return out.slice(0, 8);
}

// ogni mp3 diventa un modulo separato con il file in base64: niente fetch, quindi funziona anche da file://
const FILES = import.meta.glob('../../crate/*.mp3', { query: '?inline', import: 'default' }) as Record<string, () => Promise<string>>;
const fileLoader = (id: string) => FILES[`../../crate/${id}.mp3`];

function dataUrlToBuffer(url: string): ArrayBuffer {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

/** Toglie il silenzio iniziale (ritardo dell'encoder mp3) e porta a mono normalizzato, come nel Mattone */
function trimLead(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const d0 = buf.getChannelData(0);
  let i = 0;
  while (i < d0.length && Math.abs(d0[i]) < 0.003) i++;
  i = Math.max(0, i - 16);
  const n = Math.max(1, buf.length - i);
  const out = ctx.createBuffer(1, n, buf.sampleRate);
  const o = out.getChannelData(0);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const s = buf.getChannelData(c);
    for (let k = 0; k < n; k++) o[k] += (s[k + i] ?? 0) / buf.numberOfChannels;
  }
  return finish(out, 0.85);
}

const cache = new Map<string, Promise<AudioBuffer>>();

/** AudioBuffer di un suono della cassa (id con o senza prefisso lib:) */
export function loadCrate(ctx: BaseAudioContext, id: string): Promise<AudioBuffer> {
  const s = crateSound(id);
  if (!s) return Promise.reject(new Error('Suono sconosciuto: ' + id));
  let p = cache.get(s.id);
  if (p) return p;
  if (s.synth) {
    p = Promise.resolve().then(() => synthBuffer(ctx, s.id)!);
  } else {
    const load = fileLoader(s.id);
    if (!load) return Promise.reject(new Error('File mancante: ' + s.id));
    p = load().then((url) => ctx.decodeAudioData(dataUrlToBuffer(url))).then((b) => trimLead(ctx, b));
  }
  p = p.catch((e) => { cache.delete(s.id); throw e; });
  cache.set(s.id, p);
  return p;
}

/** Trasposizione (semitoni) che porta un suono intonato sulla tonica delle parti melodiche (F) */
export function tuneToF(s: CrateSound): number {
  if (s.root == null) return 0;
  // F più vicino alla nota registrata, così il suono non viene stirato troppo
  const f = Math.round((s.root - 53) / 12) * 12 + 53;
  return Math.max(-24, Math.min(24, f - s.root));
}
