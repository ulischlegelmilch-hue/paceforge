import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import type { CompletedActivity } from '../src/domain/activity';
import { generatePlan } from '../src/planner/generatePlan';
import { weeklyAnalysis } from '../src/adaptation/weeklyAnalysis';
import { assessWeekLightening, applyWeekLightening, MIN_LIGHTEN_FACTOR } from '../src/adaptation/weekLightening';

const FIXED_START = new Date(2026, 0, 5); // Montag

function profile(): AthleteProfile {
  return {
    id: 'athlete-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: 'marathon', weeks: 12 },
    fitness: { estimatedVdot: 50 },
    currentVdot: 50,
    daysPerWeek: 4,
    units: 'metric',
  };
}

function activity(distanceM: number, dateYmd: string): CompletedActivity {
  return {
    id: `a-${dateYmd}`,
    source: 'manual',
    startTime: `${dateYmd}T07:00:00.000Z`,
    totalDistanceMeters: distanceM,
    totalDurationSeconds: Math.round(distanceM / 3.0),
    avgPaceMps: 3.0,
  };
}

const plan = generatePlan(profile(), { startDate: FIXED_START });
const week0 = plan.weeks[0]!;
const restDay = week0.workouts.find((w) => w.workout.kind === 'rest')!;
// Referenzdatum = erster Nicht-Ruhe-Tag der Woche, damit noch Tage "ausstehen".
const firstNonRest = week0.workouts.find((w) => w.workout.kind !== 'rest')!;
const referenceDate = new Date(`${firstNonRest.date}T12:00:00`);

describe('assessWeekLightening', () => {
  it('gibt null ohne planfremde (Extra-)Läufe zurück', () => {
    const analysis = weeklyAnalysis(plan, [], referenceDate);
    expect(assessWeekLightening(analysis, referenceDate)).toBeNull();
  });

  it('gibt null zurück, wenn die Extra-Distanz unter der Auslöse-Schwelle bleibt', () => {
    const tiny = activity(500, restDay.date); // weit unter 30 % des Wochenziels
    const analysis = weeklyAnalysis(plan, [tiny], referenceDate);
    expect(assessWeekLightening(analysis, referenceDate)).toBeNull();
  });

  it('löst eine Entlastung aus, wenn genug planfremde Distanz zusammenkommt', () => {
    const extraMeters = Math.round(week0.targetWeeklyDistanceMeters * 0.5);
    const acts = [activity(extraMeters, restDay.date)];
    const analysis = weeklyAnalysis(plan, acts, referenceDate);
    const result = assessWeekLightening(analysis, referenceDate)!;
    expect(result).not.toBeNull();
    expect(result.extraDistanceMeters).toBe(extraMeters);
    expect(result.lightenFactor).toBeLessThan(1);
    expect(result.lightenFactor).toBeGreaterThanOrEqual(MIN_LIGHTEN_FACTOR);
  });

  it('reduziert nie unter MIN_LIGHTEN_FACTOR, auch bei sehr viel Extra-Distanz', () => {
    const extraMeters = Math.round(week0.targetWeeklyDistanceMeters * 0.9);
    const acts = [activity(extraMeters, restDay.date)];
    const analysis = weeklyAnalysis(plan, acts, referenceDate);
    const result = assessWeekLightening(analysis, referenceDate)!;
    expect(result.lightenFactor).toBe(MIN_LIGHTEN_FACTOR);
  });
});

describe('applyWeekLightening', () => {
  it('reduziert nur noch nicht absolvierte geplante Tage dieser Woche, lässt erledigte und Ruhetage unberührt', () => {
    const extraMeters = Math.round(week0.targetWeeklyDistanceMeters * 0.5);
    const acts = [activity(extraMeters, restDay.date)];
    const analysis = weeklyAnalysis(plan, acts, referenceDate);
    const assessment = assessWeekLightening(analysis, referenceDate)!;

    const result = applyWeekLightening(plan, assessment, analysis, referenceDate);
    const originalByDate = new Map(plan.weeks.flatMap((w) => w.workouts).map((sw) => [sw.date, sw]));

    for (const sw of result.weeks.flatMap((w) => w.workouts)) {
      const original = originalByDate.get(sw.date)!;
      const isRemainingThisWeek =
        sw.date >= analysis.startDate && sw.date <= analysis.endDate && sw.date >= firstNonRest.date && original.workout.kind !== 'rest';
      if (isRemainingThisWeek) {
        expect(sw.status).toBe('modified');
        expect(sw.workout.estimatedDistanceMeters!).toBeLessThan(original.workout.estimatedDistanceMeters ?? Infinity);
      } else {
        expect(sw.workout).toEqual(original.workout);
      }
    }
  });

  it('lässt Tage außerhalb der aktuellen Woche unangetastet', () => {
    const extraMeters = Math.round(week0.targetWeeklyDistanceMeters * 0.5);
    const acts = [activity(extraMeters, restDay.date)];
    const analysis = weeklyAnalysis(plan, acts, referenceDate);
    const assessment = assessWeekLightening(analysis, referenceDate)!;

    const result = applyWeekLightening(plan, assessment, analysis, referenceDate);
    const week1 = result.weeks[1]!;
    const originalWeek1 = plan.weeks[1]!;
    expect(week1).toEqual(originalWeek1);
  });
});
