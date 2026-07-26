import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import { generatePlan } from '../src/planner/generatePlan';
import { planToIcs } from '../src/calendar/ics';

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

const plan = generatePlan(profile(), { startDate: new Date(2026, 0, 5) });
const FIXED = new Date('2026-01-01T00:00:00Z');

describe('planToIcs', () => {
  it('erzeugt einen gültigen VCALENDAR-Rahmen mit CRLF-Zeilen', () => {
    const ics = planToIcs(plan, { dtstamp: FIXED });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('ein Ganztages-VEVENT pro Nicht-Ruhe-Einheit', () => {
    const ics = planToIcs(plan, { dtstamp: FIXED });
    const events = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    const nonRest = plan.weeks.flatMap((w) => w.workouts).filter((w) => w.workout.kind !== 'rest').length;
    expect(events).toBe(nonRest);
    expect(ics).toContain('DTSTART;VALUE=DATE:2026');
  });

  it('markiert Krafttage mit „+ Kraft", wenn Kraft aktiv', () => {
    const ics = planToIcs(plan, { dtstamp: FIXED, strength: { equipment: 'gym', sessionsPerWeek: 2 } });
    expect(ics).toContain('+ Kraft');
    expect(ics).toContain('Krafteinheit:');
  });

  it('ohne Kraft-Option keine Kraft-Markierung', () => {
    const ics = planToIcs(plan, { dtstamp: FIXED });
    expect(ics).not.toContain('+ Kraft');
  });
});
