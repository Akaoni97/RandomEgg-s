// Test delle parti arrivate dal Mattone Groovebox: catalogo della cassa, nucleo DSP del piatto,
// preset che usano i campioni e compatibilità con i progetti TRIBE MACHINE.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CRATE, CRATE_CATS, crateSound, libId, shortName, tuneToF } from './crate';
import { hasSynth } from './mattone';
import { makeDeckCore } from './deck';
import { PRESETS } from '../state/presets';
import { sanitizeProject } from '../state/factory';
import { ACTIONS } from '../input/keymap';

describe('cassa dei dischi', () => {
  it('ha 240 suoni, tutti con il loro file o generatore', () => {
    expect(CRATE.length).toBe(240);
    const dir = path.resolve(__dirname, '../../crate');
    for (const s of CRATE) {
      if (s.synth) expect(hasSynth(s.id), s.id).toBe(true);
      else expect(fs.existsSync(path.join(dir, s.id + '.mp3')), s.id).toBe(true);
      expect(CRATE_CATS).toContain(s.cat);
    }
    expect(new Set(CRATE.map((s) => s.id)).size).toBe(CRATE.length);
  });

  it('nomi corti per il pannello e intonazione verso la tonica F', () => {
    for (const s of CRATE) {
      const n = shortName(s);
      expect(n.length).toBeGreaterThan(0);
      expect(n.length).toBeLessThanOrEqual(8);
      expect(Math.abs(tuneToF(s))).toBeLessThanOrEqual(6);
    }
    expect(crateSound(libId('mr_ta'))?.name).toContain('Mridangam');
    expect(tuneToF(crateSound('vc_piano')!)).toBe(5); // Do4 → Fa4, il Fa più vicino
  });
});

describe('piatto scratch (nucleo DSP)', () => {
  const sr = 48000;
  const sine = new Float32Array(sr).map((_, i) => Math.sin((2 * Math.PI * 220 * i) / sr) * 0.8);
  const run = (core: ReturnType<typeof makeDeckCore>, blocks: number, t0 = 0) => {
    const out = new Float32Array(128);
    let peak = 0;
    for (let b = 0; b < blocks; b++) {
      core.render(out, out.length, t0 + (b * 128) / sr);
      for (const v of out) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
    }
    return peak;
  };

  it('fermo = silenzio, con il motore acceso suona', () => {
    const core = makeDeckCore(sr);
    core.msg({ buf: sine.slice(), sr });
    expect(run(core, 50)).toBeLessThan(0.01);
    core.msg({ set: { motor: true } });
    expect(run(core, 400)).toBeGreaterThan(0.2);
  });

  it('il disco segue la mano e il TAGLIO chiude il fader', () => {
    const core = makeDeckCore(sr);
    core.msg({ buf: sine.slice(), sr });
    core.msg({ touch: true });
    core.msg({ move: 0.2 });
    expect(run(core, 60)).toBeGreaterThan(0.2);
    core.msg({ set: { cut: true, xf: 1 } });
    core.msg({ move: 0.2 });
    run(core, 20);
    expect(run(core, 40)).toBeLessThan(0.02);
  });

  it('le tecniche automatiche suonano a tempo', () => {
    for (const mode of ['baby', 'chirp', 'flare', 'tear', 'trans', 'scribble']) {
      const core = makeDeckCore(sr);
      core.msg({ buf: sine.slice(), sr });
      core.msg({ auto: mode, origin: 0, set: { six: 60 / 175 / 4 } });
      expect(run(core, 300), mode).toBeGreaterThan(0.05);
    }
  });
});

describe('progetti e preset', () => {
  it('i preset LucaTekno usano i suoni della cassa e passano la validazione', () => {
    const lt = PRESETS[0].build();
    expect(lt.format).toBe('lucatekno-machine');
    const ids = lt.patterns.flatMap((p) => p.parts.map((x) => x.sampleId)).filter(Boolean) as string[];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(crateSound(id), id).toBeTruthy();
    expect(lt.samples.map((s) => s.id).sort()).toEqual([...new Set(ids)].sort());
    const again = sanitizeProject(JSON.parse(JSON.stringify(lt)));
    expect(again.patterns[0].parts[1].sampleId).toBe('lib:mr_ta');
  });

  it('apre anche i progetti della TRIBE MACHINE', () => {
    const old = { ...PRESETS[2].build(), format: 'tribe-machine' };
    expect(sanitizeProject(JSON.parse(JSON.stringify(old))).patterns[0].bpm).toBe(172);
    expect(() => sanitizeProject({ format: 'altro' })).toThrow();
  });

  it('i nuovi tasti del piatto non si sovrappongono agli altri', () => {
    const codes = ACTIONS.flatMap((a) => a.def);
    expect(new Set(codes).size).toBe(codes.length);
    for (const id of ['fx0', 'fx1', 'fx2', 'fx3', 'fx4', 'cut', 'motor', 'crate', 'deckSrc']) {
      expect(ACTIONS.some((a) => a.id === id), id).toBe(true);
    }
  });
});
