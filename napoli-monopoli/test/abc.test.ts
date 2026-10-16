import { describe, expect, it } from 'vitest';
import { parseAbc } from '../src/audio/abc';
import tarantella from '../src/audio/tunes/tarantella.abc?raw';

describe('lettore ABC', () => {
  it('legge note, ottave, durate e pause', () => {
    const t = parseAbc('X:1\nM:4/4\nL:1/4\nK:C\nC D2 c/ z/ C,2 c\'');
    expect(t.notes.map((n) => n.midi)).toEqual([60, 62, 72, null, 48, 84]);
    expect(t.notes.map((n) => n.len)).toEqual([1, 2, 0.5, 0.5, 2, 1]);
    expect(t.bar).toBe(4);
  });

  it('applica armatura e alterazioni fino alla stanghetta', () => {
    const t = parseAbc('X:1\nL:1/8\nK:F\nB ^F F | F =B B');
    expect(t.notes.map((n) => n.midi)).toEqual([70, 66, 66, 65, 71, 71]);
  });

  it('le legature allungano la nota', () => {
    const t = parseAbc('X:1\nL:1/8\nK:C\nc3-c3 d');
    expect(t.notes.map((n) => [n.midi, n.len])).toEqual([
      [72, 6],
      [74, 1],
    ]);
  });

  it('accordi per il basso e tempo in 6/8', () => {
    const t = parseAbc('X:1\nM:6/8\nL:1/8\nQ:3/8=100\nK:Am\n"Am"A3 "E"^G3');
    expect(t.chords).toEqual([
      { start: 0, root: 45 },
      { start: 3, root: 40 },
    ]);
    expect(t.unit).toBeCloseTo(0.2);
    expect(t.bar).toBe(6);
  });

  it('la tarantella del gioco dura 12 battute giuste', () => {
    const t = parseAbc(tarantella);
    expect(t.total).toBe(12 * 6);
    expect(t.chords).toHaveLength(12);
    expect(t.notes[0].midi).toBe(76);
  });
});
