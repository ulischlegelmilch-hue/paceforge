import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import type { CompletedActivity } from '../src/domain/activity';
import { generatePlan } from '../src/planner/generatePlan';
import { makeEasyRun } from '../src/planner/workouts';
import {
  applyAdaptation,
  applyVdotAdaptation,
  compareWorkout,
  matchActivity,
  reduceUpcomingWeek,
  suggestAdaptation,
} from '../src/adaptation/adapt';
import type { AdaptationResult } from '../src/adaptation/adapt';

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

function activity(distanceM: number, paceMps: number, dateYmd: string): CompletedActivity {
  return {
    id: `a-${dateYmd}`,
    source: 'manual',
    startTime: `${dateYmd}T07:00:00.000Z`,
    totalDistanceMeters: distanceM,
    totalDurationSeconds: Math.round(distanceM / paceMps),
    avgPaceMps: paceMps,
  };
}

describe('compareWorkout', () => {
  const w = makeEasyRun('e', 50, 8000);
  const planPace = w.estimatedDistanceMeters! / w.estimatedDurationSeconds!;

  it('bewertet gleiche Pace als on-target', () => {
    expect(compareWorkout(w, activity(8000, planPace, '2026-01-06')).assessment).toBe('on-target');
  });
  it('bewertet deutlich schnellere Pace als faster', () => {
    expect(compareWorkout(w, activity(8000, planPace * 1.1, '2026-01-06')).assessment).toBe('faster');
  });
  it('bewertet deutlich langsamere Pace als slower', () => {
    expect(compareWorkout(w, activity(8000, planPace * 0.9, '2026-01-06')).assessment).toBe('slower');
  });
  it('bewertet zu kurze Distanz als incomplete', () => {
    expect(compareWorkout(w, activity(3000, planPace, '2026-01-06')).assessment).toBe('incomplete');
  });

  it('bewertet einen hügeligen Lauf höhenkorrigiert nicht als zu langsam', () => {
    // Real 8 km bei scheinbar 8 % langsamerer Pace, aber mit +300 Höhenmetern.
    const slow = activity(8000, planPace * 0.92, '2026-01-06');
    expect(compareWorkout(w, slow).assessment).toBe('slower');
    const hilly: CompletedActivity = { ...slow, totalAscentMeters: 300 };
    expect(compareWorkout(w, hilly).assessment).not.toBe('slower');
  });

  it('bevorzugt den genaueren per-Segment-Wert (gradeAdjustedDistanceMeters)', () => {
    const slow = activity(8000, planPace * 0.9, '2026-01-06');
    // per-Segment-Höhenprofil ergibt 9200 m flach-äquivalent -> Pace effektiv schneller.
    const hilly: CompletedActivity = { ...slow, gradeAdjustedDistanceMeters: 9200 };
    const cmp = compareWorkout(w, hilly);
    expect(cmp.actualAvgPaceMps).toBeGreaterThan(slow.avgPaceMps);
    expect(cmp.assessment).not.toBe('slower');
  });
});

describe('matchActivity', () => {
  it('ordnet eine Aktivität der Einheit am selben Tag zu', () => {
    const plan = generatePlan(profile(), { startDate: FIXED_START });
    const sw = plan.weeks.flatMap((w) => w.workouts).find((s) => s.workout.kind !== 'rest')!;
    const a = activity(sw.workout.estimatedDistanceMeters ?? 5000, 3.2, sw.date);
    expect(matchActivity(plan, a)?.date).toBe(sw.date);
  });

  it('ordnet einen sehr frühen Lauf dem LOKALEN Kalendertag zu, nicht dem UTC-Tag (Root-Cause-Fix 22.09.)', () => {
    // 00:30 Uhr lokal am Plantag liegt in UTC (Europe/Berlin, UTC+1/+2) noch am
    // Vortag - der naive iso.slice(0, 10)-Schnitt würde das fälschlich auf den
    // Vortag legen, statt es dem Plantag zuzuordnen.
    const plan = generatePlan(profile(), { startDate: FIXED_START });
    const sw = plan.weeks.flatMap((w) => w.workouts).find((s) => s.workout.kind !== 'rest')!;
    const earlyLocal = new Date(new Date(`${sw.date}T00:00:00`).getTime() + 30 * 60_000);
    const earlyLocalRun: CompletedActivity = {
      id: 'a-early',
      source: 'api',
      startTime: earlyLocal.toISOString(),
      totalDistanceMeters: sw.workout.estimatedDistanceMeters ?? 5000,
      totalDurationSeconds: 1800,
      avgPaceMps: 2.8,
    };
    expect(matchActivity(plan, earlyLocalRun)?.date).toBe(sw.date);
  });
});

describe('suggestAdaptation', () => {
  const plan = generatePlan(profile(), { startDate: FIXED_START });
  const nonRest = plan.weeks.flatMap((w) => w.workouts).filter((s) => s.workout.kind !== 'rest');

  it('empfiehlt VDOT +1 bei mehreren deutlich schnelleren Läufen', () => {
    const acts = nonRest.slice(0, 3).map((s) => {
      const pace = (s.workout.estimatedDistanceMeters! / s.workout.estimatedDurationSeconds!) * 1.12;
      return activity(s.workout.estimatedDistanceMeters!, pace, s.date);
    });
    const res = suggestAdaptation(plan, acts, { referenceDate: new Date(2026, 0, 1) });
    expect(res.recommendedVdotDelta).toBe(1);
    expect(res.reduceNextWeekVolume).toBe(false);
  });

  it('entlastet die nächste Woche nach ≥2 verpassten Einheiten in Folge', () => {
    const res = suggestAdaptation(plan, [], { referenceDate: new Date(2026, 0, 20) });
    expect(res.consecutiveMissed).toBeGreaterThanOrEqual(2);
    expect(res.reduceNextWeekVolume).toBe(true);
    expect(res.recommendedVdotDelta).toBe(0);
  });

  it('entlastet NICHT, wenn trotz verpasster Plan-Einheiten genug eigene Läufe stattfanden', () => {
    // Dieselbe Ausgangslage wie oben (≥2 verpasste Plan-Einheiten in Folge bis
    // 20.1.), aber zwei eigene Läufe in den letzten 7 Tagen davor, jeweils an
    // laut Plan freien Tagen (14.1./19.1. sind Ruhetage) - zählen trotzdem als
    // eigenes Training und dürfen die verpassten Plan-Tage nicht überschreiben.
    const freeRuns = [activity(6000, 3.0, '2026-01-14'), activity(5000, 3.0, '2026-01-19')];
    const res = suggestAdaptation(plan, freeRuns, { referenceDate: new Date(2026, 0, 20) });
    expect(res.consecutiveMissed).toBeGreaterThanOrEqual(2);
    expect(res.reduceNextWeekVolume).toBe(false);
    expect(res.notes.some((n) => /keine Entlastung nötig/i.test(n))).toBe(true);
  });

  it('empfiehlt nichts, wenn alles im Plan liegt', () => {
    const res = suggestAdaptation(plan, [], { referenceDate: new Date(2026, 0, 1) });
    expect(res.recommendedVdotDelta).toBe(0);
    expect(res.reduceNextWeekVolume).toBe(false);
    expect(res.notes[0]).toMatch(/keine Anpassung/i);
  });
});

describe('reduceUpcomingWeek', () => {
  it('reduziert das Volumen der ersten nicht vergangenen Woche', () => {
    const plan = generatePlan(profile(), { startDate: FIXED_START });
    // Referenzdatum in Woche 1 (Plan startet So 4.1., Woche 0 endet Sa 10.1.)
    const reduced = reduceUpcomingWeek(plan, new Date(2026, 0, 12));
    // Nur Woche 1 wird reduziert; Nachbarwochen bleiben unverändert.
    expect(reduced.weeks[1]!.targetWeeklyDistanceMeters).toBeLessThan(plan.weeks[1]!.targetWeeklyDistanceMeters);
    expect(reduced.weeks[0]!.targetWeeklyDistanceMeters).toBe(plan.weeks[0]!.targetWeeklyDistanceMeters);
    expect(reduced.weeks[2]!.targetWeeklyDistanceMeters).toBe(plan.weeks[2]!.targetWeeklyDistanceMeters);
  });
});

describe('applyAdaptation', () => {
  const base = profile();
  const plan = generatePlan(base, { startDate: FIXED_START });

  it('erhöht die VDOT und generiert den Plan mit gleichem Startdatum neu', () => {
    const result: AdaptationResult = {
      recommendedVdotDelta: 1,
      reduceNextWeekVolume: false,
      consecutiveMissed: 0,
      assessments: [],
      notes: [],
    };
    const out = applyAdaptation(base, plan, result, { referenceDate: new Date(2026, 0, 5) });
    expect(out.profile.currentVdot).toBe(51);
    // Startdatum bleibt erhalten
    expect(out.plan.weeks[0]!.workouts[0]!.date).toBe(plan.weeks[0]!.workouts[0]!.date);
    // schnellere Zonen -> Long Run gleicher Distanz, aber kürzere geschätzte Dauer
    const longBefore = plan.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!.workout;
    const longAfter = out.plan.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!.workout;
    expect(longAfter.estimatedDurationSeconds!).toBeLessThan(longBefore.estimatedDurationSeconds!);
  });

  it('entlastet die kommende Woche, wenn empfohlen', () => {
    const result: AdaptationResult = {
      recommendedVdotDelta: 0,
      reduceNextWeekVolume: true,
      consecutiveMissed: 2,
      assessments: [],
      notes: [],
    };
    const out = applyAdaptation(base, plan, result, { referenceDate: new Date(2026, 0, 12) });
    const reducedWeek = out.plan.weeks[1]!;
    expect(reducedWeek.targetWeeklyDistanceMeters).toBeLessThan(plan.weeks[1]!.targetWeeklyDistanceMeters);
  });
});

describe('applyAdaptation – Historie', () => {
  it('löscht bei einer VDOT-Anpassung nicht den Status bereits erledigter Tage', () => {
    const base = profile();
    const plan = generatePlan(base, { startDate: FIXED_START });
    const day0 = plan.weeks[0]!.workouts[0]!;
    const planWithHistory = {
      ...plan,
      weeks: plan.weeks.map((w, i) => (i !== 0 ? w : {
        ...w,
        workouts: w.workouts.map((sw) => (sw.date === day0.date ? { ...sw, status: 'completed' as const } : sw)),
      })),
    };

    const result: AdaptationResult = {
      recommendedVdotDelta: 1,
      reduceNextWeekVolume: false,
      consecutiveMissed: 0,
      assessments: [],
      notes: [],
    };
    const out = applyAdaptation(base, planWithHistory, result, { referenceDate: new Date(2026, 0, 20) });
    const mergedDay0 = out.plan.weeks[0]!.workouts.find((sw) => sw.date === day0.date)!;
    expect(mergedDay0.status).toBe('completed');
  });
});

describe('applyVdotAdaptation', () => {
  it('erhöht die VDOT gemäß Empfehlung', () => {
    const p = profile();
    const updated = applyVdotAdaptation(p, {
      recommendedVdotDelta: 1,
      reduceNextWeekVolume: false,
      consecutiveMissed: 0,
      assessments: [],
      notes: [],
    });
    expect(updated.currentVdot).toBe(51);
    expect(p.currentVdot).toBe(50); // Original unverändert
  });
});
