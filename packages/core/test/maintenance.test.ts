import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import { generateMaintenancePlan } from '../src/planner/maintenance';
import { generatePlan } from '../src/planner/generatePlan';

function profile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    id: 'athlete-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { mode: 'maintain', distance: 'half' },
    fitness: { estimatedVdot: 48 },
    currentVdot: 48,
    daysPerWeek: 4,
    units: 'metric',
    ...overrides,
  };
}

const FIXED_START = new Date(2026, 0, 5); // Montag

function runDays(week: { workouts: { workout: { kind: string } }[] }): number {
  return week.workouts.filter((w) => w.workout.kind !== 'rest').length;
}

describe('generateMaintenancePlan', () => {
  it('erzeugt fortlaufende Wochen, alle in der Phase "maintenance"', () => {
    const plan = generateMaintenancePlan(profile(), { startDate: FIXED_START, weeks: 8 });
    expect(plan.weeks).toHaveLength(8);
    expect(plan.weeks.every((w) => w.phase === 'maintenance')).toBe(true);
    expect(plan.raceDate).toBeUndefined();
    expect(plan.weeks.every((w) => w.workouts.length === 7)).toBe(true);
  });

  it('hält die gewählte Zahl an Trainingstagen ein', () => {
    for (const days of [3, 4, 5, 6]) {
      const plan = generateMaintenancePlan(profile({ daysPerWeek: days }), {
        startDate: FIXED_START,
        weeks: 3,
      });
      expect(runDays(plan.weeks[0]!)).toBe(days);
    }
  });

  it('enthält pro Woche GENAU eine Qualitätseinheit (Schwelle/Intervalle)', () => {
    const plan = generateMaintenancePlan(profile(), { startDate: FIXED_START, weeks: 6 });
    for (const week of plan.weeks) {
      const quality = week.workouts.filter(
        (w) => w.workout.kind === 'tempo' || w.workout.kind === 'interval',
      );
      expect(quality).toHaveLength(1);
    }
  });

  it('wechselt die Qualitätseinheit Woche für Woche zwischen Schwelle und Intervallen', () => {
    const plan = generateMaintenancePlan(profile(), { startDate: FIXED_START, weeks: 4 });
    const kinds = plan.weeks.map(
      (w) => w.workouts.find((x) => x.workout.kind === 'tempo' || x.workout.kind === 'interval')!.workout.kind,
    );
    expect(kinds[0]).toBe('tempo');
    expect(kinds[1]).toBe('interval');
    expect(kinds[2]).toBe('tempo');
    expect(kinds[3]).toBe('interval');
  });

  it('enthält pro Woche genau einen Long Run', () => {
    const plan = generateMaintenancePlan(profile(), { startDate: FIXED_START, weeks: 4 });
    for (const week of plan.weeks) {
      expect(week.workouts.filter((w) => w.workout.kind === 'long')).toHaveLength(1);
    }
  });

  it('hält den Long Run bei ≤30 % des Wochenvolumens (Daniels-Obergrenze)', () => {
    for (const days of [3, 4, 5, 6]) {
      const plan = generateMaintenancePlan(profile({ daysPerWeek: days }), {
        startDate: FIXED_START,
        weeks: 2,
      });
      const week = plan.weeks[0]!;
      const long = week.workouts.find((w) => w.workout.kind === 'long')!;
      const frac = (long.workout.estimatedDistanceMeters ?? 0) / week.targetWeeklyDistanceMeters;
      expect(frac).toBeLessThanOrEqual(0.32); // 28 % Ziel + Rundungsspielraum
    }
  });

  it('bleibt über der Erhaltungs-Untergrenze (~25 km/Woche)', () => {
    const plan = generateMaintenancePlan(profile({ daysPerWeek: 3 }), {
      startDate: FIXED_START,
      weeks: 2,
    });
    expect(plan.weeks[0]!.targetWeeklyDistanceMeters).toBeGreaterThanOrEqual(25000);
  });

  it('generatePlan delegiert bei goal.mode === "maintain" an den Erhaltungs-Generator', () => {
    const plan = generatePlan(profile({ goal: { mode: 'maintain', distance: 'half' } }), {
      startDate: FIXED_START,
    });
    expect(plan.weeks.every((w) => w.phase === 'maintenance')).toBe(true);
    expect(plan.raceDate).toBeUndefined();
  });

  it('legt den Long Run auf den Wunschtag (longRunDay)', () => {
    const plan = generateMaintenancePlan(profile({ longRunDay: 0 }), {
      startDate: FIXED_START,
      weeks: 1,
    });
    const long = plan.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!;
    expect(long.dayOfWeek).toBe(0);
    // Tageszahl bleibt trotz Verschiebung erhalten.
    expect(runDays(plan.weeks[0]!)).toBe(4);
  });

  it('weekStartDay verschiebt das gesamte Tages-Muster (Anker Dienstag -> +2 bei Wunsch Donnerstag)', () => {
    const base = generateMaintenancePlan(profile(), { startDate: FIXED_START, weeks: 1 });
    const baseDays = base.weeks[0]!.workouts
      .filter((w) => w.workout.kind !== 'rest')
      .map((w) => w.dayOfWeek)
      .sort((a, b) => a - b);

    const shifted = generateMaintenancePlan(profile({ weekStartDay: 4 }), { startDate: FIXED_START, weeks: 1 });
    const shiftedDays = shifted.weeks[0]!.workouts
      .filter((w) => w.workout.kind !== 'rest')
      .map((w) => w.dayOfWeek)
      .sort((a, b) => a - b);

    expect(shiftedDays).toEqual(baseDays.map((d) => (d + 2) % 7).sort((a, b) => a - b));
    expect(runDays(shifted.weeks[0]!)).toBe(4);
  });
});
