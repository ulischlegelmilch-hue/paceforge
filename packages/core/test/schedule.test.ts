import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import { generatePlan } from '../src/planner/generatePlan';
import {
  currentWeekIndex,
  locateByDate,
  upcomingWorkouts,
  weekOf,
  ymdOf,
} from '../src/planner/schedule';

const FIXED_START = new Date(2026, 0, 5); // Mo 5.1. -> Wochenanfang So 4.1.

function profile(): AthleteProfile {
  return {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: '10k', weeks: 12 },
    fitness: { estimatedVdot: 50 },
    currentVdot: 50,
    daysPerWeek: 4,
    units: 'metric',
  };
}

const plan = generatePlan(profile(), { startDate: FIXED_START });

describe('ymdOf', () => {
  it('formatiert ein lokales Datum als YYYY-MM-DD', () => {
    expect(ymdOf(new Date(2026, 0, 6))).toBe('2026-01-06');
  });
});

describe('locateByDate', () => {
  it('findet die geplante Einheit am Datum inkl. Wochen-/Tagesindex', () => {
    const loc = locateByDate(plan, '2026-01-06'); // Di in Woche 0
    expect(loc).toBeDefined();
    expect(loc!.weekIndex).toBe(0);
    expect(loc!.scheduled.date).toBe('2026-01-06');
  });
  it('gibt undefined für ein Datum außerhalb des Plans', () => {
    expect(locateByDate(plan, '2020-01-01')).toBeUndefined();
  });
});

describe('currentWeekIndex / weekOf', () => {
  it('liefert die Woche, die das Datum enthält', () => {
    expect(currentWeekIndex(plan, '2026-01-13')).toBe(1); // zweite Woche
    expect(weekOf(plan, '2026-01-13')!.index).toBe(1);
  });
  it('clamped vor Planbeginn auf 0 und nach Planende auf die letzte Woche', () => {
    expect(currentWeekIndex(plan, '2020-01-01')).toBe(0);
    expect(currentWeekIndex(plan, '2030-01-01')).toBe(plan.weeks.length - 1);
  });
});

describe('upcomingWorkouts', () => {
  it('liefert die nächsten Nicht-Ruhe-Einheiten ab dem Datum', () => {
    const next = upcomingWorkouts(plan, '2026-01-04', 3);
    expect(next).toHaveLength(3);
    expect(next.every((l) => l.scheduled.workout.kind !== 'rest')).toBe(true);
    // chronologisch aufsteigend
    expect(next[0]!.scheduled.date <= next[1]!.scheduled.date).toBe(true);
    expect(next[1]!.scheduled.date <= next[2]!.scheduled.date).toBe(true);
  });
});
