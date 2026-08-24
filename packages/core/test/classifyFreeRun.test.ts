import { describe, it, expect } from 'vitest';
import type { CompletedActivity } from '../src/domain/activity';
import { allZones } from '../src/vdot/zones';
import { classifyFreeRun } from '../src/adaptation/classifyFreeRun';

function activity(paceMps: number): CompletedActivity {
  const totalDurationSeconds = 1800;
  return {
    id: 'free-1',
    source: 'api',
    startTime: '2026-03-01T07:00:00.000Z',
    totalDistanceMeters: paceMps * totalDurationSeconds,
    totalDurationSeconds,
    avgPaceMps: paceMps,
  };
}

describe('classifyFreeRun', () => {
  const vdot = 50;
  const zones = allZones(vdot);

  it('ordnet eine Pace in der Easy-Zone als "easy" ein', () => {
    const mid = (zones.easy.lowMps + zones.easy.highMps) / 2;
    expect(classifyFreeRun(activity(mid), vdot).zone).toBe('easy');
  });

  it('ordnet eine Pace in der Threshold-Zone als "threshold" ein', () => {
    const mid = (zones.threshold.lowMps + zones.threshold.highMps) / 2;
    expect(classifyFreeRun(activity(mid), vdot).zone).toBe('threshold');
  });

  it('ordnet eine Pace in der Lücke zwischen threshold und interval der nächstniedrigeren Zone zu', () => {
    const gapPace = (zones.threshold.highMps + zones.interval.lowMps) / 2;
    expect(classifyFreeRun(activity(gapPace), vdot).zone).toBe('threshold');
  });

  it('ordnet eine sehr langsame Pace als "below-easy" ein', () => {
    const slow = zones.easy.lowMps * 0.8;
    expect(classifyFreeRun(activity(slow), vdot).zone).toBe('below-easy');
  });

  it('ordnet eine sehr schnelle Pace als "above-repetition" ein', () => {
    const fast = zones.repetition.highMps * 1.2;
    expect(classifyFreeRun(activity(fast), vdot).zone).toBe('above-repetition');
  });

  it('nutzt die höhenkorrigierte Distanz, falls vorhanden', () => {
    const base = activity(zones.easy.lowMps * 0.8); // wäre below-easy ohne Korrektur
    const hilly: CompletedActivity = { ...base, gradeAdjustedDistanceMeters: base.totalDistanceMeters * 1.3 };
    expect(classifyFreeRun(hilly, vdot).zone).not.toBe('below-easy');
  });
});
