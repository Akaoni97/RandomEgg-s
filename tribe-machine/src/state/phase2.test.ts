import { beforeEach, describe, expect, it } from 'vitest';
import { makePart, makeProject, sanitizeProject } from './factory';
import { motionAt } from './motion';
import { actions, curPattern, useStore } from './store';
import { installHistory, redo, undo } from './history';
import { PRESETS } from './presets';

describe('motion sequence', () => {
  it('senza motion si usano le manopole', () => {
    const p = makePart('acid');
    expect(motionAt(p, 0)).toBeNull();
  });

  it('i valori registrati sostituiscono la manopola solo sui loro step', () => {
    const p = makePart('acid');
    p.motion.cutoff = new Array(64).fill(null);
    p.motion.cutoff[3] = 2000;
    expect(motionAt(p, 3)?.cutoff).toBe(2000);
    expect(motionAt(p, 3)?.reso).toBe(p.params.reso);
    expect(motionAt(p, 4)?.cutoff).toBe(p.params.cutoff);
  });

  it('i file con motion o song non validi vengono riparati', () => {
    const raw = JSON.parse(JSON.stringify(makeProject()));
    raw.patterns[0].parts[7].motion = { cutoff: [99999, 'x', null], bogus: [1] };
    raw.song = [{ pattern: 99, repeats: 0 }, { pattern: 2, repeats: 50 }];
    const p = sanitizeProject(raw);
    const lane = p.patterns[0].parts[7].motion.cutoff;
    expect(lane[0]).toBe(8000);
    expect(lane[1]).toBeNull();
    expect(p.patterns[0].parts[7].motion.bogus).toBeUndefined();
    expect(p.song).toEqual([{ pattern: 15, repeats: 1 }, { pattern: 2, repeats: 16 }]);
  });
});

describe('song e undo', () => {
  beforeEach(() => {
    actions.loadProject(PRESETS[0].build());
  });

  it('i preset hanno una song dimostrativa', () => {
    expect(useStore.getState().project.song.length).toBeGreaterThanOrEqual(2);
  });

  it('inserisci, modifica ed elimina voci di song', () => {
    const n = useStore.getState().project.song.length;
    actions.songInsert(0);
    expect(useStore.getState().project.song.length).toBe(n + 1);
    actions.songEdit(1, { repeats: 40, pattern: -1 });
    expect(useStore.getState().project.song[1]).toEqual({ pattern: 15, repeats: 16 });
    actions.songDelete(1);
    expect(useStore.getState().project.song.length).toBe(n);
  });

  it('undo e redo ripristinano i contenuti', async () => {
    installHistory();
    const before = curPattern().parts[0].steps[1].on;
    actions.toggleStep(0, 1);
    expect(curPattern().parts[0].steps[1].on).toBe(!before);
    undo();
    expect(curPattern().parts[0].steps[1].on).toBe(before);
    redo();
    expect(curPattern().parts[0].steps[1].on).toBe(!before);
  });

  it('rinomina pattern e parte', () => {
    actions.rename('pattern', 'acid rain!');
    expect(curPattern().name).toBe('ACID RAIN!');
    actions.rename('part', 'superlongname');
    expect(curPattern().parts[useStore.getState().selectedPart].name).toBe('SUPERLON');
  });
});
