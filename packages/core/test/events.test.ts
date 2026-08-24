import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import type { PlanEvent } from '../src/domain/event';
import { generatePlan } from '../src/planner/generatePlan';
import { applyPlanEvent, removePlanEvent, recoveryDaysFor, taperDaysFor } from '../src/planner/events';

const FIXED_START = new Date(2026, 0, 5); // Montag
const REF = FIXED_START; // "heute" liegt vor dem gesamten Plan

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

const HALF_M = 21097;

function findEvent(basePlan = generatePlan(profile(), { startDate: FIXED_START })) {
  const week = basePlan.weeks[6]!;
  const longDay = week.workouts.find((w) => w.workout.kind === 'long')!;
  const event: PlanEvent = { id: 'evt-1', date: longDay.date, distanceMeters: HALF_M };
  return { basePlan, event };
}

describe('taperDaysFor / recoveryDaysFor', () => {
  it('deckelt Erholungstage auf 10 (Halbmarathon läge sonst bei 13)', () => {
    expect(recoveryDaysFor(HALF_M)).toBe(10);
  });
  it('Taper ist die halbe Erholungslänge, gedeckelt auf 7', () => {
    expect(taperDaysFor(HALF_M)).toBe(7);
  });
  it('bleibt für kurze Distanzen über der Untergrenze (2/1 Tage)', () => {
    expect(recoveryDaysFor(3000)).toBeGreaterThanOrEqual(2);
    expect(taperDaysFor(3000)).toBeGreaterThanOrEqual(1);
  });
});

describe('applyPlanEvent', () => {
  it('fügt am Zieldatum einen Wettkampf-Tag ein', () => {
    const { basePlan, event } = findEvent();
    const result = applyPlanEvent(basePlan, event, 50, REF);
    expect(result.status).toBe('applied');
    const raceDay = result.plan.weeks.flatMap((w) => w.workouts).find((sw) => sw.date === event.date)!;
    expect(raceDay.workout.kind).toBe('race');
    expect(raceDay.status).toBe('modified');
    expect(raceDay.workout.estimatedDistanceMeters).toBe(HALF_M);
  });

  it('tapert Qualitäts-/Long-Run-Tage im Taper-Fenster auf "easy", Ruhetage bleiben Ruhetage', () => {
    const { basePlan, event } = findEvent();
    const result = applyPlanEvent(basePlan, event, 50, REF);
    const { fromYmd, toYmd } = result.taperWindow!;
    const originalByDate = new Map(basePlan.weeks.flatMap((w) => w.workouts).map((sw) => [sw.date, sw]));

    for (const sw of result.plan.weeks.flatMap((w) => w.workouts)) {
      if (sw.date < fromYmd || sw.date > toYmd) continue;
      const original = originalByDate.get(sw.date)!;
      if (original.workout.kind === 'rest') {
        expect(sw.workout.kind).toBe('rest');
      } else if (['tempo', 'interval', 'repetition', 'long'].includes(original.workout.kind)) {
        expect(sw.workout.kind).toBe('easy');
        expect(sw.status).toBe('modified');
      }
    }
  });

  it('baut ein Erholungsfenster nach dem Event, das Qualität/Long Run auf "recovery" dämpft', () => {
    const { basePlan, event } = findEvent();
    const result = applyPlanEvent(basePlan, event, 50, REF);
    const { fromYmd, toYmd } = result.recoveryWindow!;
    const originalByDate = new Map(basePlan.weeks.flatMap((w) => w.workouts).map((sw) => [sw.date, sw]));

    for (const sw of result.plan.weeks.flatMap((w) => w.workouts)) {
      if (sw.date < fromYmd || sw.date > toYmd) continue;
      const original = originalByDate.get(sw.date)!;
      if (['tempo', 'interval', 'repetition', 'long'].includes(original.workout.kind)) {
        expect(sw.workout.kind).toBe('recovery');
        expect(sw.status).toBe('modified');
      }
    }
  });

  it('lässt Tage außerhalb der Taper-/Renn-/Erholungsfenster unangetastet, Periodisierung läuft normal weiter', () => {
    const { basePlan, event } = findEvent();
    const result = applyPlanEvent(basePlan, event, 50, REF);
    const { fromYmd: taperFrom } = result.taperWindow!;
    const { toYmd: recoveryTo } = result.recoveryWindow!;

    const originalByDate = new Map(basePlan.weeks.flatMap((w) => w.workouts).map((sw) => [sw.date, sw]));
    for (const sw of result.plan.weeks.flatMap((w) => w.workouts)) {
      if (sw.date >= taperFrom && sw.date <= recoveryTo) continue;
      const original = originalByDate.get(sw.date)!;
      expect(sw.workout).toEqual(original.workout);
      expect(sw.status).toBe(original.status);
    }
    // Die Phasen-Zuordnung späterer Wochen ist unverändert.
    const lastWeek = result.plan.weeks[result.plan.weeks.length - 1]!;
    const originalLastWeek = basePlan.weeks[basePlan.weeks.length - 1]!;
    expect(lastWeek.phase).toBe(originalLastWeek.phase);
  });

  it('überschreibt bereits absolvierte/übersprungene Tage im Taper-/Erholungsfenster NICHT', () => {
    const { basePlan, event } = findEvent();
    // Einen Qualitätstag im Taper-Fenster (Tag vor dem Event) als "completed" markieren.
    const sevenDaysBefore = new Date(new Date(`${event.date}T00:00:00`).getTime() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const dayBefore = basePlan.weeks
      .flatMap((w) => w.workouts)
      .find((sw) => sw.date < event.date && sw.date >= sevenDaysBefore && sw.workout.kind !== 'rest')!;
    const marked = {
      ...basePlan,
      weeks: basePlan.weeks.map((w) => ({
        ...w,
        workouts: w.workouts.map((sw) => (sw.date === dayBefore.date ? { ...sw, status: 'completed' as const } : sw)),
      })),
    };

    const result = applyPlanEvent(marked, event, 50, REF);
    const untouched = result.plan.weeks.flatMap((w) => w.workouts).find((sw) => sw.date === dayBefore.date)!;
    expect(untouched.status).toBe('completed');
    expect(untouched.workout).toEqual(dayBefore.workout);
  });

  it('lehnt ein Event außerhalb des Plan-Zeitraums ab, Plan bleibt unverändert', () => {
    const { basePlan } = findEvent();
    const lastDate = basePlan.weeks[basePlan.weeks.length - 1]!.workouts.slice(-1)[0]!.date;
    const farFuture = new Date(new Date(`${lastDate}T00:00:00`).getTime() + 100 * 86_400_000).toISOString().slice(0, 10);
    const event: PlanEvent = { id: 'evt-2', date: farFuture, distanceMeters: HALF_M };

    const result = applyPlanEvent(basePlan, event, 50, REF);
    expect(result.status).toBe('out-of-range');
    expect(result.plan).toBe(basePlan);
  });

  it('lehnt ein Event in der Vergangenheit ab', () => {
    const { basePlan, event } = findEvent();
    const laterRef = new Date(`${event.date}T00:00:00`);
    laterRef.setDate(laterRef.getDate() + 1);
    const result = applyPlanEvent(basePlan, event, 50, laterRef);
    expect(result.status).toBe('in-past');
    expect(result.plan).toBe(basePlan);
  });
});

describe('removePlanEvent', () => {
  it('stellt das Taper-/Renn-/Erholungsfenster auf den Stand eines frischen Plans ohne das Event zurück', () => {
    const { basePlan, event } = findEvent();
    const applied = applyPlanEvent(basePlan, event, 50, REF);
    const reverted = removePlanEvent(applied.plan, profile(), event, REF);

    const originalByDate = new Map(basePlan.weeks.flatMap((w) => w.workouts).map((sw) => [sw.date, sw]));
    const { fromYmd } = applied.taperWindow!;
    const { toYmd } = applied.recoveryWindow!;
    for (const sw of reverted.weeks.flatMap((w) => w.workouts)) {
      if (sw.date < fromYmd || sw.date > toYmd) continue;
      const original = originalByDate.get(sw.date)!;
      expect(sw.workout).toEqual(original.workout);
      expect(sw.status).toBe('planned');
    }
  });

  it('lässt bereits erledigte Tage im ehemaligen Fenster beim Entfernen unangetastet', () => {
    const { basePlan, event } = findEvent();
    const applied = applyPlanEvent(basePlan, event, 50, REF);
    const someDate = applied.taperWindow!.fromYmd;
    const marked = {
      ...applied.plan,
      weeks: applied.plan.weeks.map((w) => ({
        ...w,
        workouts: w.workouts.map((sw) => (sw.date === someDate ? { ...sw, status: 'completed' as const } : sw)),
      })),
    };

    const reverted = removePlanEvent(marked, profile(), event, REF);
    const untouched = reverted.weeks.flatMap((w) => w.workouts).find((sw) => sw.date === someDate)!;
    expect(untouched.status).toBe('completed');
  });
});
