import type { AthleteProfile, RaceDistance } from '../domain/athlete';
import type { PlanPhase, PlanWeek, ScheduledWorkout, TrainingPlan } from '../domain/plan';
import type { Workout } from '../domain/workout';
import {
  makeEasyRun,
  makeIntervals,
  makeLongRun,
  makeRecovery,
  makeRepetitions,
  makeRest,
  makeTempo,
} from './workouts';
import { generateMaintenancePlan } from './maintenance';
import { placeRolesOnAvailableDays, shiftSlotsToWeekStart } from './weekTemplate';

// Regelbasierter Plan-Generator (KEIN LLM). Periodisierung base -> build -> peak
// -> taper; jede Woche folgt einem Tages-Template mit 1 Long Run + 1–2 Qualitäts-
// einheiten, Rest locker/Regeneration/Ruhe. Alle 4 Wochen (außer im Taper) eine
// Entlastungswoche mit reduziertem Volumen. Pace-Targets stammen aus den VDOT-Zonen.

type Role = 'long' | 'quality1' | 'quality2' | 'easy' | 'recovery';
interface Slot {
  dayOfWeek: number; // 0=So .. 6=Sa
  role: Role;
}

// Tages-Templates je Trainingstage/Woche (Fr bleibt frei; Long Run Sa=6).
const DAY_TEMPLATES: Record<3 | 4 | 5 | 6, Slot[]> = {
  3: [
    { dayOfWeek: 2, role: 'quality1' },
    { dayOfWeek: 4, role: 'easy' },
    { dayOfWeek: 6, role: 'long' },
  ],
  4: [
    { dayOfWeek: 2, role: 'quality1' },
    { dayOfWeek: 4, role: 'quality2' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'recovery' },
  ],
  5: [
    { dayOfWeek: 2, role: 'quality1' },
    { dayOfWeek: 3, role: 'easy' },
    { dayOfWeek: 4, role: 'quality2' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'easy' },
  ],
  6: [
    { dayOfWeek: 1, role: 'easy' },
    { dayOfWeek: 2, role: 'quality1' },
    { dayOfWeek: 3, role: 'easy' },
    { dayOfWeek: 4, role: 'quality2' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'recovery' },
  ],
};

// Peak-Long-Run-Distanz je Zieldistanz (Meter).
const PEAK_LONG_M: Record<RaceDistance, number> = {
  '5k': 12000,
  '10k': 15000,
  half: 21000,
  marathon: 30000,
  custom: 18000,
};

const TAPER_LONG_FACTOR = 0.5;
const RECOVERY_VOLUME_FACTOR = 0.8;

function clampDays(n: number): 3 | 4 | 5 | 6 {
  return (Math.min(6, Math.max(3, Math.round(n))) as 3 | 4 | 5 | 6);
}

function round500(m: number): number {
  return Math.round(m / 500) * 500;
}

/** Verteilt die Wochen auf die vier Phasen (in Reihenfolge). */
export function phaseSequence(totalWeeks: number): PlanPhase[] {
  const taper = totalWeeks >= 8 ? 2 : 1;
  const remaining = Math.max(1, totalWeeks - taper);
  let base = Math.round(remaining * 0.45);
  let build = Math.round(remaining * 0.35);
  let peak = remaining - base - build;
  if (peak < 1) {
    peak = 1;
    if (base >= build && base > 1) base--;
    else if (build > 1) build--;
    else base = Math.max(0, remaining - build - peak);
  }
  const seq: PlanPhase[] = [];
  for (let i = 0; i < base; i++) seq.push('base');
  for (let i = 0; i < build; i++) seq.push('build');
  for (let i = 0; i < peak; i++) seq.push('peak');
  for (let i = 0; i < taper; i++) seq.push('taper');
  while (seq.length < totalWeeks) seq.unshift('base');
  return seq.slice(0, totalWeeks);
}

interface QualityPlan {
  q1: (id: string, vdot: number) => Workout;
  q2: (id: string, vdot: number) => Workout;
}

function qualityForPhase(phase: PlanPhase): QualityPlan {
  switch (phase) {
    case 'base':
      return {
        q1: (id, v) => makeTempo(id, v, 20),
        q2: (id, v) => makeEasyRun(id, v, 8000),
      };
    case 'build':
      return {
        q1: (id, v) => makeIntervals(id, v, 5, 800, 400),
        q2: (id, v) => makeTempo(id, v, 25),
      };
    case 'peak':
      return {
        q1: (id, v) => makeIntervals(id, v, 5, 1000, 400),
        q2: (id, v) => makeRepetitions(id, v, 8, 200, 200),
      };
    case 'taper':
    case 'maintenance':
      return {
        q1: (id, v) => makeTempo(id, v, 15),
        q2: (id, v) => makeEasyRun(id, v, 6000),
      };
  }
}

function easyMetersForPhase(phase: PlanPhase): number {
  switch (phase) {
    case 'base':
      return 8000;
    case 'build':
      return 8000;
    case 'peak':
      return 7000;
    case 'taper':
    case 'maintenance':
      return 6000;
  }
}

function longRunMeters(
  goal: RaceDistance,
  phase: PlanPhase,
  weekIndex: number,
  progressWeeks: number,
  isRecovery: boolean,
): number {
  const peak = PEAK_LONG_M[goal];
  if (phase === 'taper') return round500(peak * TAPER_LONG_FACTOR);
  const start = peak * 0.6;
  const frac = progressWeeks > 1 ? Math.min(1, weekIndex / (progressWeeks - 1)) : 1;
  let m = start + (peak - start) * frac;
  if (isRecovery) m *= RECOVERY_VOLUME_FACTOR;
  return round500(m);
}

// ---- Datum-Helfer -----------------------------------------------------------

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // zurück auf Montag
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- Hauptfunktion ----------------------------------------------------------

export interface GenerateOptions {
  /** Startdatum des Plans (Default: heute). Wird auf den Wochenanfang (So) gelegt. */
  startDate?: Date;
}

export function generatePlan(profile: AthleteProfile, options: GenerateOptions = {}): TrainingPlan {
  // Ohne Wettkampf: fortlaufender Erhaltungs-Rhythmus statt periodisiertem Plan.
  if (profile.goal.mode === 'maintain') {
    return generateMaintenancePlan(profile, options);
  }
  const totalWeeks = resolveWeeks(profile);
  const phases = phaseSequence(totalWeeks);
  const taperCount = phases.filter((p) => p === 'taper').length;
  const progressWeeks = Math.max(1, totalWeeks - taperCount);

  const days = clampDays(profile.daysPerWeek);
  const baseTemplate = DAY_TEMPLATES[days];
  // Verfügbare Tage (falls gesetzt) haben Vorrang vor der einfachen Rotation:
  // die Rollen wandern dann auf die tatsächlich nutzbaren Wochentage statt auf
  // ein fest verdrahtetes Di/Do/Sa-Muster.
  const template: Slot[] =
    profile.availableDays && profile.availableDays.length > 0
      ? placeRolesOnAvailableDays(baseTemplate.map((s) => s.role), profile.availableDays)
      : shiftSlotsToWeekStart(baseTemplate, profile.weekStartDay);
  const vdot = profile.currentVdot;
  const longDay = profile.longRunDay;
  const availableDays = profile.availableDays;

  const weekStart = startOfWeekMonday(options.startDate ?? new Date());

  const weeks: PlanWeek[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const phase = phases[w] ?? 'base';
    const isRecovery = (w + 1) % 4 === 0 && phase !== 'taper';
    const quality = qualityForPhase(phase);
    const easyM = isRecovery ? Math.round(easyMetersForPhase(phase) * RECOVERY_VOLUME_FACTOR) : easyMetersForPhase(phase);
    const longM = longRunMeters(profile.goal.distance, phase, w, progressWeeks, isRecovery);

    // Long-Run-Tag ggf. auf Wunschtag verschieben. Ist der Wunschtag bereits
    // belegt, wird mit diesem Slot getauscht (statt ihn zu überschreiben), damit
    // der Long Run erhalten bleibt und die Tageszahl stimmt.
    const slots: Slot[] = template.map((s) => ({ ...s }));
    // longRunDay überschreibt den Long-Run-Slot nur, wenn er (bei gesetzten
    // availableDays) auch tatsächlich verfügbar ist – sonst würde der Long Run
    // auf einen laut Nutzer nicht nutzbaren Tag rutschen.
    if (longDay !== undefined && (!availableDays || availableDays.includes(longDay))) {
      const longSlot = slots.find((s) => s.role === 'long');
      if (longSlot && longSlot.dayOfWeek !== longDay) {
        const origDay = longSlot.dayOfWeek;
        const occupant = slots.find((s) => s.dayOfWeek === longDay && s !== longSlot);
        if (occupant) occupant.dayOfWeek = origDay;
        longSlot.dayOfWeek = longDay;
      }
    }
    const byDay = new Map<number, Role>(slots.map((s) => [s.dayOfWeek, s.role]));

    const workouts: ScheduledWorkout[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + w * 7 + d);
      // dayOfWeek ist der ECHTE Kalendertag (0=So..6=Sa, siehe Slot-Typ), nicht
      // der Schleifenindex - der Wochenstart-Anker (Montag) bestimmt nur die
      // PlanWeek-Gruppierung, nicht welcher Wochentag welche Rolle bekommt.
      const dow = date.getDay();
      const role: Role | undefined = byDay.get(dow);
      const id = `w${w}-d${d}`;
      let workout: Workout;
      switch (role) {
        case 'long':
          workout = makeLongRun(id, vdot, longM);
          break;
        case 'quality1':
          workout = quality.q1(id, vdot);
          break;
        case 'quality2':
          workout = quality.q2(id, vdot);
          break;
        case 'easy':
          workout = makeEasyRun(id, vdot, easyM);
          break;
        case 'recovery':
          workout = makeRecovery(id, vdot, Math.round(easyM * 0.7));
          break;
        default:
          workout = makeRest(id);
      }
      workouts.push({ date: isoDate(date), dayOfWeek: dow, workout, status: 'planned' });
    }

    const targetWeeklyDistanceMeters = workouts.reduce(
      (sum, sw) => sum + (sw.workout.estimatedDistanceMeters ?? 0),
      0,
    );
    weeks.push({ index: w, phase, targetWeeklyDistanceMeters, workouts });
  }

  return {
    id: `plan-${Date.now()}`,
    athleteId: profile.id,
    createdAt: new Date().toISOString(),
    method: 'daniels-vdot',
    weeks,
    raceDate: profile.goal.targetDate,
  };
}

function resolveWeeks(profile: AthleteProfile): number {
  if (profile.goal.weeks && profile.goal.weeks > 0) return Math.round(profile.goal.weeks);
  if (profile.goal.targetDate) {
    const now = new Date();
    const target = new Date(profile.goal.targetDate);
    const weeks = Math.ceil((target.getTime() - now.getTime()) / (7 * 24 * 3600 * 1000));
    if (weeks >= 1) return weeks;
  }
  return 12; // sicherer Default
}
