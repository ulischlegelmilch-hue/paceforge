import { describe, it, expect } from 'vitest';
import type { CompletedActivity } from '../src/domain/activity';
import type { WorkoutComparison, Assessment } from '../src/adaptation/adapt';
import type { FreeRunClassification, FreeRunZone } from '../src/adaptation/classifyFreeRun';
import type { WeeklyAnalysis } from '../src/adaptation/weeklyAnalysis';
import { coachCommentForActivity, coachCommentForWeek } from '../src/advice/coachComment';

function activity(overrides: Partial<CompletedActivity> = {}): CompletedActivity {
  return {
    id: 'a1',
    source: 'manual',
    startTime: '2026-03-01T07:00:00.000Z',
    totalDistanceMeters: 8000,
    totalDurationSeconds: 2400,
    avgPaceMps: 3.33,
    ...overrides,
  };
}

function comparison(assessment: Assessment): WorkoutComparison {
  return {
    plannedDistanceMeters: 8000,
    actualDistanceMeters: 8000,
    distanceRatio: 1,
    plannedAvgPaceMps: 3.33,
    actualAvgPaceMps: 3.33,
    paceRatio: 1,
    assessment,
  };
}

function freeZone(zone: FreeRunZone): FreeRunClassification {
  return { zone, zoneLabel: zone, paceMps: 3.0 };
}

describe('coachCommentForActivity', () => {
  it('formuliert für jede Assessment-Stufe einen nicht-leeren Kommentar', () => {
    const assessments: Assessment[] = ['on-target', 'faster', 'slower', 'incomplete'];
    for (const a of assessments) {
      const text = coachCommentForActivity(activity(), { comparison: comparison(a) });
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it('erwähnt bei "faster" die gute Form', () => {
    const text = coachCommentForActivity(activity(), { comparison: comparison('faster') });
    expect(text).toMatch(/Form/);
  });

  it('erwähnt bei "incomplete" das vorsichtige Vorgehen', () => {
    const text = coachCommentForActivity(activity(), { comparison: comparison('incomplete') });
    expect(text).toMatch(/verletz/i);
  });

  it('formuliert für freie Läufe je nach Zone unterschiedlich', () => {
    const easy = coachCommentForActivity(activity(), { freeZone: freeZone('easy') });
    const hard = coachCommentForActivity(activity(), { freeZone: freeZone('interval') });
    expect(easy).not.toBe(hard);
    expect(hard).toMatch(/Erholung/);
  });

  it('weist auf große Pace-Streuung zwischen den Runden hin', () => {
    const withSpread = coachCommentForActivity(activity(), { freeZone: freeZone('easy'), paceSpreadSeconds: 45 });
    const withoutSpread = coachCommentForActivity(activity(), { freeZone: freeZone('easy'), paceSpreadSeconds: 10 });
    expect(withSpread).toMatch(/gesprungen/);
    expect(withoutSpread).not.toMatch(/gesprungen/);
  });

  it('erwähnt Höhenmeter ab einer nennenswerten Größenordnung', () => {
    const hilly = coachCommentForActivity(activity({ totalAscentMeters: 250 }), { freeZone: freeZone('easy') });
    const flat = coachCommentForActivity(activity({ totalAscentMeters: 20 }), { freeZone: freeZone('easy') });
    expect(hilly).toMatch(/Höhenmeter/);
    expect(flat).not.toMatch(/Höhenmeter/);
  });

  it('fällt auf eine neutrale Distanz-Aussage zurück, wenn weder Vergleich noch Zone vorliegen', () => {
    const text = coachCommentForActivity(activity(), {});
    expect(text).toMatch(/8 km/);
  });
});

function week(overrides: Partial<WeeklyAnalysis> = {}): WeeklyAnalysis {
  return {
    weekIndex: 0,
    startDate: '2026-03-02',
    endDate: '2026-03-08',
    entries: [],
    extraActivities: [],
    plannedDistanceMeters: 30000,
    actualDistanceMeters: 30000,
    plannedRunCount: 4,
    completedRunCount: 4,
    assessmentCounts: { incomplete: 0, faster: 0, slower: 0, 'on-target': 4 },
    notes: [],
    ...overrides,
  };
}

describe('coachCommentForWeek', () => {
  it('erkennt eine trainingsfreie Woche', () => {
    const text = coachCommentForWeek(week({ plannedRunCount: 0, completedRunCount: 0, actualDistanceMeters: 0, plannedDistanceMeters: 0 }));
    expect(text).toMatch(/trainingsfreie/i);
  });

  it('lobt einen vollständig abgearbeiteten Plan', () => {
    const text = coachCommentForWeek(week());
    expect(text).toMatch(/abgearbeitet/);
  });

  it('erwähnt eigene Läufe zusätzlich zum Plan', () => {
    const extra = activity({ id: 'x1' });
    const text = coachCommentForWeek(week({ extraActivities: [extra] }));
    expect(text).toMatch(/eigene/);
  });

  it('weist auf niedriges Wochenvolumen hin', () => {
    const text = coachCommentForWeek(week({ actualDistanceMeters: 10000, completedRunCount: 1 }));
    expect(text).toMatch(/Umfang/);
  });

  it('weist auf mehrere zu langsame Läufe hin', () => {
    const text = coachCommentForWeek(
      week({ assessmentCounts: { incomplete: 0, faster: 0, slower: 2, 'on-target': 2 } }),
    );
    expect(text).toMatch(/Erholung/);
  });
});
