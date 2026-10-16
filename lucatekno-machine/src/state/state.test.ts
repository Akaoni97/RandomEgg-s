import { describe, expect, it } from 'vitest';
import { makeProject, sanitizeProject } from './factory';
import { PRESETS } from './presets';
import { parseProject, serialize } from './storage';
import { fromNorm, formatParam, KNOB_MAP, paramDef, paramsFor, toNorm } from './params';
import { MAX_STEPS, NUM_PARTS, NUM_PATTERNS, PART_TYPES } from './types';
import { ACTIONS, defaultKeymap } from '../input/keymap';

describe('progetto e salvataggi', () => {
  it('un progetto nuovo ha la struttura completa', () => {
    const p = makeProject();
    expect(p.patterns).toHaveLength(NUM_PATTERNS);
    for (const pt of p.patterns) {
      expect(pt.parts).toHaveLength(NUM_PARTS);
      for (const part of pt.parts) expect(part.steps).toHaveLength(MAX_STEPS);
    }
  });

  it('salvataggio e riapertura restituiscono lo stesso progetto', () => {
    for (const pr of PRESETS) {
      const p = pr.build();
      const back = parseProject(serialize(p));
      expect(back).toEqual(p);
    }
  });

  it('file corrotti o estranei vengono rifiutati o riparati', () => {
    expect(() => sanitizeProject({ foo: 1 })).toThrow();
    const p = sanitizeProject({
      format: 'tribe-machine',
      patterns: [{ bpm: 9999, swing: -3, length: 17, parts: [{ type: 'nope', params: { tune: 'x' }, steps: [{ on: 1, note: 99 }] }] }],
    });
    expect(p.patterns[0].bpm).toBe(260);
    expect(p.patterns[0].swing).toBe(50);
    expect(p.patterns[0].length).toBe(16);
    expect(p.patterns[0].parts[0].type).toBe('kick');
    expect(p.patterns[0].parts[0].steps[0].note).toBe(24);
    expect(p.patterns[0].parts[0].steps[0].on).toBe(true);
  });
});

describe('preset', () => {
  it('ogni preset ha almeno due pattern suonabili e parametri validi', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    for (const pr of PRESETS) {
      const p = pr.build();
      for (const pt of p.patterns.slice(0, 2)) {
        expect(pt.bpm).toBeGreaterThanOrEqual(100);
        expect(pt.parts.some((x) => x.steps.some((s) => s.on))).toBe(true);
        for (const part of pt.parts) {
          for (const d of paramsFor(part.type)) {
            const v = part.params[d.id];
            expect(v, `${pr.name}/${part.name}/${d.id}`).toBeGreaterThanOrEqual(d.min);
            expect(v, `${pr.name}/${part.name}/${d.id}`).toBeLessThanOrEqual(d.max);
          }
        }
      }
    }
  });
});

describe('parametri', () => {
  it('conversione normalizzata reversibile', () => {
    for (const t of PART_TYPES) {
      for (const d of paramsFor(t)) {
        const v = fromNorm(d, toNorm(d, d.def));
        if (d.step) expect(v).toBe(d.def);
        else expect(v).toBeCloseTo(d.def, 6);
        expect(formatParam(d, d.def)).not.toBe('');
      }
    }
  });

  it('le manopole puntano a parametri esistenti', () => {
    for (const t of PART_TYPES) for (const id of KNOB_MAP[t]) if (id) expect(paramDef(t, id), `${t}.${id}`).toBeDefined();
  });
});

describe('tastiera', () => {
  it('nessun tasto è assegnato a due comandi', () => {
    const seen = new Map<string, string>();
    for (const [id, codes] of Object.entries(defaultKeymap())) {
      for (const c of codes) {
        expect(seen.get(c), `${c} usato da ${seen.get(c)} e ${id}`).toBeUndefined();
        seen.set(c, id);
      }
    }
    expect(ACTIONS.filter((a) => a.id.startsWith('step'))).toHaveLength(16);
  });
});
