import { describe, it, expect } from 'vitest';
import {
  gradeAdjustedDistance,
  gradeAdjustedDistanceSegments,
  gradeFactor,
  minettiCost,
} from '../src/grade/index';

describe('minettiCost / gradeFactor', () => {
  it('flach ≈ 3.6, bergauf teurer, bergab günstiger', () => {
    expect(minettiCost(0)).toBeCloseTo(3.6, 5);
    expect(minettiCost(0.1)).toBeGreaterThan(5.8); // ~6.0
    expect(minettiCost(-0.1)).toBeLessThan(2.3); // ~2.16
  });
  it('bergauf-Faktor ~1.6–1.7 bei +10 %', () => {
    const f = gradeFactor(0.1);
    expect(f).toBeGreaterThan(1.6);
    expect(f).toBeLessThan(1.72);
  });
  it('deckelt den Bergab-Credit bei 0,88', () => {
    // rohes Minetti bei −10 % ~0.60 -> gedeckelt auf 0.88
    expect(gradeFactor(-0.1)).toBe(0.88);
    expect(gradeFactor(-0.2)).toBeGreaterThanOrEqual(0.88);
  });
});

describe('gradeAdjustedDistance (totals-only)', () => {
  it('addiert 7 flache Meter je Höhenmeter', () => {
    expect(gradeAdjustedDistance(5000, 0)).toBe(5000);
    expect(gradeAdjustedDistance(5000, 100)).toBe(5700);
  });
  it('ignoriert fehlenden/negativen Anstieg', () => {
    expect(gradeAdjustedDistance(5000, -50)).toBe(5000);
    // @ts-expect-error absichtlich undefined
    expect(gradeAdjustedDistance(5000, undefined)).toBe(5000);
  });
});

describe('gradeAdjustedDistanceSegments', () => {
  it('kollabiert bei Netto-Null NICHT (1 km +10 % / 1 km −10 %)', () => {
    const eq = gradeAdjustedDistanceSegments([
      { meters: 1000, grade: 0.1 },
      { meters: 1000, grade: -0.1 },
    ]);
    // flach wäre 2000; hügelig muss deutlich mehr sein
    expect(eq).toBeGreaterThan(2200);
  });
});
