import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import { isRepeatBlock, type WorkoutStep } from '../src/domain/workout';
import { generatePlan, phaseSequence } from '../src/planner/generatePlan';
import { makeIntervals } from '../src/planner/workouts';
import { allZones } from '../src/vdot/zones';

function profile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    id: 'athlete-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: '10k', weeks: 12 },
    fitness: { estimatedVdot: 50 },
    currentVdot: 50,
    daysPerWeek: 4,
    units: 'metric',
    ...overrides,
  };
}

const FIXED_START = new Date(2026, 0, 5); // 5. Jan 2026 (ein Montag)

describe('phaseSequence', () => {
  it('erzeugt genau totalWeeks Phasen in der Reihenfolge base->build->peak->taper', () => {
    const seq = phaseSequence(12);
    expect(seq).toHaveLength(12);
    const order = ['base', 'build', 'peak', 'taper'];
    const firstIndex = order.map((p) => seq.indexOf(p as (typeof seq)[number]));
    // jede vorhandene Phase startet nach der vorherigen
    for (let i = 1; i < order.length; i++) {
      if (firstIndex[i]! >= 0 && firstIndex[i - 1]! >= 0) {
        expect(firstIndex[i]!).toBeGreaterThan(firstIndex[i - 1]!);
      }
    }
    expect(seq[seq.length - 1]).toBe('taper');
  });

  it('funktioniert auch für kurze Pläne', () => {
    expect(phaseSequence(4)).toHaveLength(4);
    expect(phaseSequence(6)).toHaveLength(6);
  });
});

describe('generatePlan – Struktur', () => {
  const plan = generatePlan(profile(), { startDate: FIXED_START });

  it('hat so viele Wochen wie gewünscht', () => {
    expect(plan.weeks).toHaveLength(12);
    expect(plan.method).toBe('daniels-vdot');
  });

  it('jede Woche hat 7 Tage und genau daysPerWeek Nicht-Ruhe-Einheiten', () => {
    for (const week of plan.weeks) {
      expect(week.workouts).toHaveLength(7);
      const training = week.workouts.filter((w) => w.workout.kind !== 'rest');
      expect(training).toHaveLength(4);
    }
  });

  it('genau ein Long Run pro Woche', () => {
    for (const week of plan.weeks) {
      const longs = week.workouts.filter((w) => w.workout.kind === 'long');
      expect(longs).toHaveLength(1);
    }
  });

  it('die letzte Woche ist Taper mit weniger Volumen als die Peak-Spitze', () => {
    const last = plan.weeks[plan.weeks.length - 1]!;
    expect(last.phase).toBe('taper');
    const peakMax = Math.max(
      ...plan.weeks.filter((w) => w.phase === 'peak').map((w) => w.targetWeeklyDistanceMeters),
    );
    expect(last.targetWeeklyDistanceMeters).toBeLessThan(peakMax);
  });

  it('Datumsangaben laufen fortlaufend und starten am Wochenanfang (Montag)', () => {
    const first = plan.weeks[0]!.workouts[0]!;
    expect(first.dayOfWeek).toBe(1);
    expect(new Date(first.date).getDay()).toBe(1);
    // Woche 1, Tag 0 liegt 7 Tage nach Woche 0, Tag 0
    const w0d0 = new Date(plan.weeks[0]!.workouts[0]!.date).getTime();
    const w1d0 = new Date(plan.weeks[1]!.workouts[0]!.date).getTime();
    expect((w1d0 - w0d0) / (24 * 3600 * 1000)).toBe(7);
  });
});

describe('generatePlan – Pace-Targets', () => {
  it('alle Pace-Targets sind gültig (lowMps < highMps)', () => {
    const plan = generatePlan(profile(), { startDate: FIXED_START });
    for (const week of plan.weeks) {
      for (const sw of week.workouts) {
        for (const el of sw.workout.elements) {
          const steps: WorkoutStep[] = isRepeatBlock(el) ? el.steps : [el];
          for (const s of steps) {
            if (s.target.type === 'pace') {
              expect(s.target.lowMps).toBeLessThan(s.target.highMps);
            }
          }
        }
      }
    }
  });

  it('Intervall-Workout nutzt die Intervall-Zone im Arbeitsintervall', () => {
    const w = makeIntervals('t', 50, 5, 1000, 400);
    const zone = allZones(50).interval;
    const repeat = w.elements.find(isRepeatBlock);
    expect(repeat).toBeDefined();
    const work = repeat!.steps[0]!;
    expect(work.target.type).toBe('pace');
    if (work.target.type === 'pace') {
      expect(work.target.lowMps).toBeCloseTo(zone.lowMps, 5);
      expect(work.target.highMps).toBeCloseTo(zone.highMps, 5);
    }
    expect(w.estimatedDistanceMeters).toBeGreaterThan(5000); // 5x1000 + Ein/Auslaufen
  });
});

describe('generatePlan – Varianten', () => {
  it('respektiert daysPerWeek für 3..6', () => {
    for (const d of [3, 4, 5, 6]) {
      const plan = generatePlan(profile({ daysPerWeek: d }), { startDate: FIXED_START });
      const training = plan.weeks[2]!.workouts.filter((w) => w.workout.kind !== 'rest');
      expect(training).toHaveLength(d);
    }
  });

  it('verschiebt den Long Run auf den Wunschtag', () => {
    const plan = generatePlan(profile({ longRunDay: 0 }), { startDate: FIXED_START });
    const long = plan.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!;
    expect(long.dayOfWeek).toBe(0);
  });

  it('weekStartDay verschiebt das gesamte Tages-Muster, nicht nur den Long Run', () => {
    const base = generatePlan(profile(), { startDate: FIXED_START });
    const baseDays = base.weeks[2]!.workouts
      .filter((w) => w.workout.kind !== 'rest')
      .map((w) => w.dayOfWeek)
      .sort((a, b) => a - b);

    // Anker des 4-Tage-Templates ist Dienstag (2) -> weekStartDay 4 verschiebt um +2.
    const shifted = generatePlan(profile({ weekStartDay: 4 }), { startDate: FIXED_START });
    const shiftedDays = shifted.weeks[2]!.workouts
      .filter((w) => w.workout.kind !== 'rest')
      .map((w) => w.dayOfWeek)
      .sort((a, b) => a - b);

    expect(shiftedDays).toEqual(baseDays.map((d) => (d + 2) % 7).sort((a, b) => a - b));
    // gleiche Anzahl Trainingstage, nur andere Wochentage
    expect(shiftedDays).toHaveLength(baseDays.length);
  });

  it('weekStartDay + longRunDay lassen sich kombinieren (longRunDay gewinnt für den Long Run)', () => {
    const plan = generatePlan(profile({ weekStartDay: 4, longRunDay: 3 }), { startDate: FIXED_START });
    const long = plan.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!;
    expect(long.dayOfWeek).toBe(3);
    // weiterhin genau daysPerWeek Trainingstage, keine Dopplungen/Lücken durch die Kombination
    const training = plan.weeks[0]!.workouts.filter((w) => w.workout.kind !== 'rest');
    expect(training).toHaveLength(4);
    expect(new Set(training.map((w) => w.dayOfWeek)).size).toBe(4);
  });

  it('ohne weekStartDay bleibt das bisherige Standard-Muster erhalten', () => {
    const plan = generatePlan(profile(), { startDate: FIXED_START });
    const days = plan.weeks[0]!.workouts
      .filter((w) => w.workout.kind !== 'rest')
      .map((w) => w.dayOfWeek)
      .sort((a, b) => a - b);
    expect(days).toEqual([0, 2, 4, 6]); // So(recovery)/Di/Do/Sa wie im 4-Tage-Template
  });

  it('availableDays: platziert alle Trainingstage innerhalb der verfügbaren Menge', () => {
    const avail = [1, 3, 5, 0]; // Mo, Mi, Fr, So
    const plan = generatePlan(profile({ availableDays: avail }), { startDate: FIXED_START });
    const training = plan.weeks[0]!.workouts.filter((w) => w.workout.kind !== 'rest');
    expect(training).toHaveLength(4); // daysPerWeek unverändert
    for (const w of training) {
      expect(avail).toContain(w.dayOfWeek);
    }
    // weiterhin genau ein Long Run
    expect(training.filter((w) => w.workout.kind === 'long')).toHaveLength(1);
  });

  it('availableDays: weniger verfügbare Tage als daysPerWeek -> entsprechend weniger Trainingstage', () => {
    const plan = generatePlan(profile({ daysPerWeek: 5, availableDays: [2, 4] }), { startDate: FIXED_START });
    const training = plan.weeks[0]!.workouts.filter((w) => w.workout.kind !== 'rest');
    expect(training).toHaveLength(2);
    expect(training.map((w) => w.dayOfWeek).sort()).toEqual([2, 4]);
  });

  it('availableDays hat Vorrang vor weekStartDay', () => {
    const plan = generatePlan(profile({ availableDays: [1, 3, 5, 0], weekStartDay: 2 }), {
      startDate: FIXED_START,
    });
    const training = plan.weeks[0]!.workouts.filter((w) => w.workout.kind !== 'rest');
    for (const w of training) {
      expect([1, 3, 5, 0]).toContain(w.dayOfWeek);
    }
  });

  it('longRunDay wird bei availableDays nur angewandt, wenn er selbst verfügbar ist', () => {
    // longRunDay=2 (Di) liegt NICHT in availableDays -> wird ignoriert, Long Run
    // bleibt auf einem der verfügbaren Tage statt auf Dienstag zu rutschen.
    const plan = generatePlan(profile({ availableDays: [1, 3, 5, 0], longRunDay: 2 }), {
      startDate: FIXED_START,
    });
    const long = plan.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!;
    expect(long.dayOfWeek).not.toBe(2);
    expect([1, 3, 5, 0]).toContain(long.dayOfWeek);

    // longRunDay=0 (So) liegt IN availableDays -> wird angewandt.
    const plan2 = generatePlan(profile({ availableDays: [1, 3, 5, 0], longRunDay: 0 }), {
      startDate: FIXED_START,
    });
    const long2 = plan2.weeks[0]!.workouts.find((w) => w.workout.kind === 'long')!;
    expect(long2.dayOfWeek).toBe(0);
  });

  it('Marathon-Ziel hat längere Long Runs als 5k-Ziel', () => {
    const mara = generatePlan(profile({ goal: { distance: 'marathon', weeks: 16 } }), { startDate: FIXED_START });
    const fivek = generatePlan(profile({ goal: { distance: '5k', weeks: 16 } }), { startDate: FIXED_START });
    const maxLong = (p: ReturnType<typeof generatePlan>) =>
      Math.max(
        ...p.weeks.flatMap((w) =>
          w.workouts.filter((x) => x.workout.kind === 'long').map((x) => x.workout.estimatedDistanceMeters ?? 0),
        ),
      );
    expect(maxLong(mara)).toBeGreaterThan(maxLong(fivek));
  });
});
