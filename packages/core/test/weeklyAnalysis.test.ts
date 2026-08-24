import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import type { CompletedActivity } from '../src/domain/activity';
import { generatePlan } from '../src/planner/generatePlan';
import { weeklyAnalysis } from '../src/adaptation/weeklyAnalysis';

const FIXED_START = new Date(2026, 0, 5); // Montag

function profile(): AthleteProfile {
  return {
    id: 'athlete-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: '10k', weeks: 12 },
    fitness: { estimatedVdot: 50 },
    currentVdot: 50,
    daysPerWeek: 4,
    units: 'metric',
  };
}

function activity(distanceM: number, paceMps: number, dateYmd: string, linked?: string): CompletedActivity {
  return {
    id: `a-${dateYmd}`,
    source: 'manual',
    startTime: `${dateYmd}T07:00:00.000Z`,
    totalDistanceMeters: distanceM,
    totalDurationSeconds: Math.round(distanceM / paceMps),
    avgPaceMps: paceMps,
    ...(linked ? { linkedScheduledWorkoutDate: linked } : {}),
  };
}

describe('weeklyAnalysis', () => {
  const plan = generatePlan(profile(), { startDate: FIXED_START });
  const week0 = plan.weeks[0]!;
  const nonRest = week0.workouts.filter((w) => w.workout.kind !== 'rest');
  const referenceDate = new Date(`${week0.workouts[week0.workouts.length - 1]!.date}T12:00:00`);

  it('zählt absolvierte vs. geplante Läufe der Woche', () => {
    const sw = nonRest[0]!;
    const pace = sw.workout.estimatedDistanceMeters! / sw.workout.estimatedDurationSeconds!;
    const acts = [activity(sw.workout.estimatedDistanceMeters!, pace, sw.date, sw.date)];
    const res = weeklyAnalysis(plan, acts, referenceDate);
    expect(res.plannedRunCount).toBe(nonRest.length);
    expect(res.completedRunCount).toBe(1);
    expect(res.assessmentCounts['on-target']).toBe(1);
  });

  it('erfasst Läufe ohne Plan-Bezug (z. B. am Ruhetag) als extraActivities', () => {
    const restDay = week0.workouts.find((w) => w.workout.kind === 'rest')!;
    const acts = [activity(5000, 3.0, restDay.date)];
    const res = weeklyAnalysis(plan, acts, referenceDate);
    expect(res.extraActivities).toHaveLength(1);
    expect(res.completedRunCount).toBe(0);
  });

  it('summiert geplante und tatsächliche Distanz', () => {
    const res = weeklyAnalysis(plan, [], referenceDate);
    expect(res.plannedDistanceMeters).toBe(week0.targetWeeklyDistanceMeters);
    expect(res.actualDistanceMeters).toBe(0);
    expect(res.startDate).toBe(week0.workouts[0]!.date);
    expect(res.endDate).toBe(week0.workouts[week0.workouts.length - 1]!.date);
  });

  it('liefert Notizen zu absolvierten und zusätzlichen Läufen', () => {
    const restDay = week0.workouts.find((w) => w.workout.kind === 'rest')!;
    const acts = [activity(5000, 3.0, restDay.date)];
    const res = weeklyAnalysis(plan, acts, referenceDate);
    expect(res.notes.some((n) => /zusätzliche/.test(n))).toBe(true);
  });
});
