import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import { generatePlan } from '../src/planner/generatePlan';
import { mergePreservingHistory } from '../src/planner/mergePlan';

const FIXED_START = new Date(2026, 0, 5); // Montag

function profile(vdot: number): AthleteProfile {
  return {
    id: 'athlete-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: '10k', weeks: 12 },
    fitness: { estimatedVdot: vdot },
    currentVdot: vdot,
    daysPerWeek: 4,
    units: 'metric',
  };
}

describe('mergePreservingHistory', () => {
  it('behält einen bereits erledigten vergangenen Tag statt der neu generierten Version', () => {
    const oldPlan = generatePlan(profile(40), { startDate: FIXED_START });
    const day0 = oldPlan.weeks[0]!.workouts[0]!;
    const completedOld = { ...oldPlan, weeks: oldPlan.weeks.map((w, i) => (i !== 0 ? w : {
      ...w,
      workouts: w.workouts.map((sw) => (sw.date === day0.date ? { ...sw, status: 'completed' as const } : sw)),
    })) };

    const newPlan = generatePlan(profile(50), { startDate: FIXED_START });
    // Stichtag deutlich nach dem ersten Tag -> "vergangen".
    const merged = mergePreservingHistory(completedOld, newPlan, new Date(2026, 0, 20));

    const mergedDay0 = merged.weeks[0]!.workouts.find((sw) => sw.date === day0.date)!;
    expect(mergedDay0.status).toBe('completed');
    // Der ALTE (langsamere) Workout-Inhalt bleibt erhalten, nicht der neu berechnete.
    expect(mergedDay0.workout.estimatedDurationSeconds).toBe(day0.workout.estimatedDurationSeconds);
  });

  it('behält einen zukünftigen, aber bereits als "skipped" markierten Tag', () => {
    const oldPlan = generatePlan(profile(40), { startDate: FIXED_START });
    const future = oldPlan.weeks[1]!.workouts[0]!;
    const skippedOld = {
      ...oldPlan,
      weeks: oldPlan.weeks.map((w, i) => (i !== 1 ? w : {
        ...w,
        workouts: w.workouts.map((sw) => (sw.date === future.date ? { ...sw, status: 'skipped' as const } : sw)),
      })),
    };

    const newPlan = generatePlan(profile(50), { startDate: FIXED_START });
    // Stichtag VOR diesem Tag -> wäre eigentlich "Zukunft", bleibt aber wegen status != planned erhalten.
    const merged = mergePreservingHistory(skippedOld, newPlan, FIXED_START);

    const mergedFuture = merged.weeks[1]!.workouts.find((sw) => sw.date === future.date)!;
    expect(mergedFuture.status).toBe('skipped');
  });

  it('übernimmt für noch bevorstehende, unveränderte Tage die neu generierte Version', () => {
    const oldPlan = generatePlan(profile(40), { startDate: FIXED_START });
    const newPlan = generatePlan(profile(50), { startDate: FIXED_START });

    const merged = mergePreservingHistory(oldPlan, newPlan, FIXED_START);

    const lastWeek = merged.weeks[merged.weeks.length - 1]!;
    const newLastWeek = newPlan.weeks[newPlan.weeks.length - 1]!;
    expect(lastWeek.targetWeeklyDistanceMeters).toBe(newLastWeek.targetWeeklyDistanceMeters);
  });

  it('berechnet targetWeeklyDistanceMeters nach dem Mischen einer Woche neu', () => {
    const oldPlan = generatePlan(profile(40), { startDate: FIXED_START });
    const day0 = oldPlan.weeks[0]!.workouts[0]!;
    const completedOld = {
      ...oldPlan,
      weeks: oldPlan.weeks.map((w, i) => (i !== 0 ? w : {
        ...w,
        workouts: w.workouts.map((sw) => (sw.date === day0.date ? { ...sw, status: 'completed' as const } : sw)),
      })),
    };
    const newPlan = generatePlan(profile(50), { startDate: FIXED_START });

    const merged = mergePreservingHistory(completedOld, newPlan, new Date(2026, 0, 20));
    const week0 = merged.weeks[0]!;
    const expected = week0.workouts.reduce((s, sw) => s + (sw.workout.estimatedDistanceMeters ?? 0), 0);
    expect(week0.targetWeeklyDistanceMeters).toBe(expected);
  });
});
