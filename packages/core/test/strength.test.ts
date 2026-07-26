import { describe, it, expect } from 'vitest';
import type { AthleteProfile } from '../src/domain/athlete';
import { generatePlan } from '../src/planner/generatePlan';
import {
  hardRunDays,
  strengthKindForPhase,
  strengthOnDay,
  strengthScheduleForWeek,
  strengthSessionsForPhase,
} from '../src/strength/index';

describe('strengthKindForPhase', () => {
  it('bildet Laufphasen auf Kraft-Arten ab', () => {
    expect(strengthKindForPhase('base')).toBe('foundation');
    expect(strengthKindForPhase('build')).toBe('heavy');
    expect(strengthKindForPhase('peak')).toBe('power');
    expect(strengthKindForPhase('taper')).toBe('taper');
  });
});

describe('strengthSessionsForPhase', () => {
  it('Grundlage: 2 Einheiten, moderate höhere Wiederholungen', () => {
    const s = strengthSessionsForPhase('base', 'gym');
    expect(s).toHaveLength(2);
    expect(s[0]!.kind).toBe('foundation');
    expect(s[0]!.exercises.some((e) => e.reps.includes('8–12'))).toBe(true);
  });

  it('Aufbau: schwer (≥80 % 1RM), niedrige Wiederholungen', () => {
    const s = strengthSessionsForPhase('build', 'gym');
    expect(s[0]!.kind).toBe('heavy');
    expect(s[0]!.exercises.some((e) => e.load.includes('80 % 1RM'))).toBe(true);
    expect(s[0]!.exercises.some((e) => e.reps.includes('3–6') || e.reps.includes('3–5'))).toBe(true);
  });

  it('Taper: nur eine reduzierte Einheit', () => {
    const s = strengthSessionsForPhase('taper', 'gym');
    expect(s).toHaveLength(1);
    expect(s[0]!.kind).toBe('taper');
  });

  it('Körpergewicht-Track nutzt kein 1RM und enthält Nordic Hamstring', () => {
    const s = strengthSessionsForPhase('base', 'bodyweight');
    const allEx = s.flatMap((x) => x.exercises);
    expect(allEx.every((e) => !e.load.includes('1RM'))).toBe(true);
    expect(allEx.some((e) => e.name.toLowerCase().includes('nordic'))).toBe(true);
  });
});

describe('hardRunDays', () => {
  it('liefert die Wochentage der harten Läufe (Tempo/Intervall/Wiederholung)', () => {
    const profile: AthleteProfile = {
      id: 'a1',
      createdAt: '2026-01-01T00:00:00.000Z',
      goal: { distance: '10k', weeks: 12 },
      fitness: { estimatedVdot: 50 },
      currentVdot: 50,
      daysPerWeek: 4,
      units: 'metric',
    };
    const plan = generatePlan(profile, { startDate: new Date(2026, 0, 5) });
    const days = hardRunDays(plan.weeks[1]!); // Aufbauwoche mit Qualitätseinheiten
    expect(days.length).toBeGreaterThanOrEqual(1);
    // jeder Tag ist ein gültiger Wochentag 0..6
    expect(days.every((d) => d >= 0 && d <= 6)).toBe(true);
  });
});

describe('strengthScheduleForWeek', () => {
  const profile: AthleteProfile = {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    goal: { distance: '10k', weeks: 12 },
    fitness: { estimatedVdot: 50 },
    currentVdot: 50,
    daysPerWeek: 4,
    units: 'metric',
  };
  const week = generatePlan(profile, { startDate: new Date(2026, 0, 5) }).weeks[1]!;

  it('legt 2 Einheiten auf Trainingstage, nicht auf Ruhetage', () => {
    const sched = strengthScheduleForWeek(week, 'gym', 2);
    expect(sched).toHaveLength(2);
    const trainingDays = new Set(
      week.workouts.filter((w) => w.workout.kind !== 'rest').map((w) => w.dayOfWeek),
    );
    expect(sched.every((s) => trainingDays.has(s.dayOfWeek))).toBe(true);
    // verschiedene Tage
    expect(sched[0]!.dayOfWeek).not.toBe(sched[1]!.dayOfWeek);
  });

  it('gibt bei 0 Einheiten nichts zurück; strengthOnDay findet die Einheit', () => {
    expect(strengthScheduleForWeek(week, 'gym', 0)).toHaveLength(0);
    const first = strengthScheduleForWeek(week, 'gym', 1)[0]!;
    expect(strengthOnDay(week, 'gym', 1, first.dayOfWeek)?.id).toBe(first.session.id);
  });
});
