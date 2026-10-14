import { describe, expect, it } from 'vitest';
import { nearestStep, stepDuration, swingOffset, tapTempo } from './timing';

describe('timing', () => {
  it('durata di uno step da 1/16', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125);
    expect(stepDuration(172)).toBeCloseTo(60 / 172 / 4);
  });

  it('swing sposta solo gli step dispari', () => {
    const d = stepDuration(160);
    expect(swingOffset(0, 66, d)).toBe(0);
    expect(swingOffset(2, 75, d)).toBe(0);
    expect(swingOffset(1, 50, d)).toBe(0);
    expect(swingOffset(1, 75, d)).toBeCloseTo(d / 2);
    expect(swingOffset(3, 66.666, d)).toBeCloseTo(d / 3, 3);
    // valori fuori range vengono limitati
    expect(swingOffset(1, 99, d)).toBeCloseTo(d / 2);
  });

  it('quantizzazione allo step più vicino', () => {
    const c = [
      { step: 3, time: 1.0, pending: false },
      { step: 4, time: 1.1, pending: false },
      { step: 5, time: 1.2, pending: true },
    ];
    expect(nearestStep(c, 1.04)?.step).toBe(3);
    expect(nearestStep(c, 1.06)?.step).toBe(4);
    expect(nearestStep(c, 1.19)?.step).toBe(5);
    expect(nearestStep([], 1)).toBeNull();
  });

  it('tap tempo', () => {
    expect(tapTempo([0])).toBeNull();
    expect(tapTempo([0, 0.35, 0.7, 1.05])).toBeCloseTo(171.4, 1);
    expect(tapTempo([0, 5])).toBeNull();
  });
});
