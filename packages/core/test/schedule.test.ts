import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import type { CompletedActivity } from '../src/domain/activity';
import { generatePlan } from '../src/planner/generatePlan';
import {
  currentWeekIndex,
  groupActivitiesByEffectiveDate,
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

describe('groupActivitiesByEffectiveDate', () => {
  function activity(overrides: Partial<CompletedActivity>): CompletedActivity {
    return {
      id: 'act-1',
      source: 'manual',
      startTime: '2026-01-06T07:00:00.000Z',
      totalDistanceMeters: 5000,
      totalDurationSeconds: 1800,
      avgPaceMps: 2.78,
      ...overrides,
    };
  }

  it('gruppiert nach explizit verlinktem Datum, wenn gesetzt', () => {
    const a = activity({ id: 'a', linkedScheduledWorkoutDate: '2026-01-10' });
    const map = groupActivitiesByEffectiveDate(plan, [a]);
    expect(map.get('2026-01-10')).toEqual([a]);
  });

  it('fällt ohne Link auf das gematchte Plan-Datum, sonst den Kalendertag zurück', () => {
    const matched = activity({ id: 'm', startTime: '2026-01-06T07:00:00.000Z' }); // trifft geplanten Tag
    const unmatched = activity({ id: 'u', startTime: '2099-06-15T07:00:00.000Z' }); // außerhalb des Plans
    const map = groupActivitiesByEffectiveDate(plan, [matched, unmatched]);
    expect(map.get('2026-01-06')).toEqual([matched]);
    expect(map.get('2099-06-15')).toEqual([unmatched]);
  });

  it('sammelt mehrere Aktivitäten am selben effektiven Tag statt eine zu überschreiben', () => {
    const first = activity({ id: 'first', linkedScheduledWorkoutDate: '2026-01-08' });
    const second = activity({ id: 'second', linkedScheduledWorkoutDate: '2026-01-08' });
    const map = groupActivitiesByEffectiveDate(plan, [first, second]);
    expect(map.get('2026-01-08')).toEqual([first, second]);
  });

  it('funktioniert ohne Plan (rein nach Kalendertag)', () => {
    const a = activity({ id: 'a', startTime: '2026-02-01T07:00:00.000Z' });
    const map = groupActivitiesByEffectiveDate(null, [a]);
    expect(map.get('2026-02-01')).toEqual([a]);
  });

  it('fällt beim Kalendertag-Fallback auf den LOKALEN Tag zurück, nicht den UTC-Tag (Root-Cause-Fix 22.09.)', () => {
    // 23:30 UTC am 1.2. = 00:30 Uhr MEZ am 2.2. (Europe/Berlin) - außerhalb
    // jedes Plans (kein Match möglich), der naive UTC-Tag wäre fälschlich der 1.2.
    const a = activity({ id: 'a', startTime: '2026-02-01T23:30:00.000Z' });
    const map = groupActivitiesByEffectiveDate(null, [a]);
    expect(map.get('2026-02-02')).toEqual([a]);
    expect(map.has('2026-02-01')).toBe(false);
  });
});
