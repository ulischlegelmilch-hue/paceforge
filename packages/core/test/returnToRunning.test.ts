import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import type { CompletedActivity } from '../src/domain/activity';
import { generatePlan } from '../src/planner/generatePlan';
import { assessReturnRamp, applyReturnRamp } from '../src/adaptation/returnToRunning';

const FIXED_START = new Date(2026, 0, 5); // Montag

function profile(): AthleteProfile {
  return {
    id: 'athlete-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: 'marathon', weeks: 16 },
    fitness: { estimatedVdot: 50 },
    currentVdot: 50,
    daysPerWeek: 4,
    units: 'metric',
  };
}

function run(startTime: string): CompletedActivity {
  return {
    id: `a-${startTime}`,
    source: 'manual',
    startTime,
    totalDistanceMeters: 8000,
    totalDurationSeconds: 2400,
    avgPaceMps: 8000 / 2400,
  };
}

const REF = new Date(2026, 2, 20); // "heute": 20. März 2026

describe('assessReturnRamp', () => {
  it('gibt null ohne jede Aktivität zurück', () => {
    expect(assessReturnRamp([], REF)).toBeNull();
  });

  it('gibt null bei kurzer Pause (<14 Tage) zurück', () => {
    const lastRun = new Date(REF.getTime() - 10 * 86_400_000).toISOString();
    expect(assessReturnRamp([run(lastRun)], REF)).toBeNull();
  });

  it('Ramp-Länge skaliert mit der Pause', () => {
    const lastRun = new Date(REF.getTime() - 20 * 86_400_000).toISOString();
    const res = assessReturnRamp([run(lastRun)], REF)!;
    expect(res.gapDays).toBe(20);
    expect(res.rampDays).toBe(10); // round(20 * 0.5)
  });

  it('deckelt die Ramp-Länge bei 14 Tagen (auch bei sehr langer Pause)', () => {
    const lastRun = new Date(REF.getTime() - 40 * 86_400_000).toISOString();
    const res = assessReturnRamp([run(lastRun)], REF)!;
    expect(res.rampDays).toBe(14); // round(40 * 0.5) = 20, gedeckelt auf 14
  });
});

describe('applyReturnRamp', () => {
  const plan = generatePlan(profile(), { startDate: FIXED_START });
  const lastRun = new Date(REF.getTime() - 20 * 86_400_000).toISOString();
  const assessment = assessReturnRamp([run(lastRun)], REF)!;
  const originalByDate = new Map(plan.weeks.flatMap((w) => w.workouts).map((sw) => [sw.date, sw]));

  it('entfernt Qualitäts-/Long-Run-Einheiten im Rampen-Fenster (werden zu "easy")', () => {
    const result = applyReturnRamp(plan, assessment, 50, REF);
    for (const sw of result.weeks.flatMap((w) => w.workouts)) {
      if (sw.date < assessment.rampFrom || sw.date > assessment.rampTo) continue;
      const original = originalByDate.get(sw.date)!;
      if (['tempo', 'interval', 'repetition', 'long'].includes(original.workout.kind)) {
        expect(sw.workout.kind).toBe('easy');
        expect(sw.status).toBe('modified');
      }
    }
  });

  it('reduziert auch das Volumen bereits lockerer/Regenerations-Tage im Fenster', () => {
    // Das 4-Tage-Template hat keine "easy"-Rolle, aber "recovery" - reicht als Beleg,
    // dass auch nicht-Qualitäts-/Long-Run-Tage im Volumen gedämpft werden.
    const result = applyReturnRamp(plan, assessment, 50, REF);
    const looseDay = [...originalByDate.values()].find(
      (sw) => sw.date >= assessment.rampFrom && sw.date <= assessment.rampTo && sw.workout.kind === 'recovery',
    );
    expect(looseDay).toBeDefined();
    const adjusted = result.weeks.flatMap((w) => w.workouts).find((sw) => sw.date === looseDay!.date)!;
    expect(adjusted.workout.estimatedDistanceMeters!).toBeLessThan(looseDay!.workout.estimatedDistanceMeters!);
  });

  it('lässt Tage nach dem Rampen-Fenster unverändert', () => {
    const result = applyReturnRamp(plan, assessment, 50, REF);
    for (const sw of result.weeks.flatMap((w) => w.workouts)) {
      if (sw.date <= assessment.rampTo) continue;
      const original = originalByDate.get(sw.date)!;
      expect(sw.workout).toEqual(original.workout);
      expect(sw.status).toBe(original.status);
    }
  });

  it('rührt bereits erledigte Tage im Fenster nicht an', () => {
    const marked = {
      ...plan,
      weeks: plan.weeks.map((w) => ({
        ...w,
        workouts: w.workouts.map((sw) => (sw.date === assessment.rampFrom ? { ...sw, status: 'completed' as const } : sw)),
      })),
    };
    const result = applyReturnRamp(marked, assessment, 50, REF);
    const untouched = result.weeks.flatMap((w) => w.workouts).find((sw) => sw.date === assessment.rampFrom)!;
    expect(untouched.status).toBe('completed');
  });
});
