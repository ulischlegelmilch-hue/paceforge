import type { AthleteProfile } from '../domain/athlete';
import type { PlanWeek, ScheduledWorkout, TrainingPlan } from '../domain/plan';
import type { Workout } from '../domain/workout';
import { zonePaceMps } from '../vdot/zones';
import {
  makeEasyRun,
  makeIntervals,
  makeLongRun,
  makeRecovery,
  makeRest,
  makeTempo,
} from './workouts';
import type { GenerateOptions } from './generatePlan';
import { placeRolesOnAvailableDays, shiftSlotsToWeekStart } from './weekTemplate';

// Erhaltungs-Plan ("Form halten") — für Läufer:innen mit vorhandener Grundlage,
// die keinen Wettkampf vorbereiten. Quelle: Recherche Teil 2 (Minetti/Hickson/Seiler).
//
// Kernbefund: INTENSITÄT, nicht Volumen, erhält die Form. Hickson zeigte, dass man
// das Volumen um bis zu zwei Drittel kürzen und die VO2max ~15 Wochen halten kann,
// solange Intensität + Frequenz bleiben. Regeln:
//  - Frequenz: min. 3×/Woche (Default 3–4).
//  - Intensität: 80/20, aber MINDESTENS EINE Qualitätseinheit/Woche (Schwelle/Intervalle)
//    — der nicht verhandelbare Reiz gegen VO2max-Abbau.
//  - Long Run: ~25–30 % des Wochenvolumens, bei geringem Umfang per Zeit gedeckelt (~120 min).
//  - Struktur: fester rollierender Wochenrhythmus (1 Long Run + 1 Qualität + 1–2 locker),
//    KEINE base→build→peak→taper-Periodisierung.
//  - Volumen-Untergrenze: ~25–30 km/Woche für halbmarathon-fähige Läufer:innen.

type Role = 'long' | 'quality' | 'easy' | 'recovery';
interface Slot {
  dayOfWeek: number; // 0=So .. 6=Sa
  role: Role;
}

// Rollierende Wochen-Templates: genau EINE Qualitätseinheit, Rest locker/Regeneration.
const MAINT_TEMPLATES: Record<3 | 4 | 5 | 6, Slot[]> = {
  3: [
    { dayOfWeek: 2, role: 'quality' },
    { dayOfWeek: 4, role: 'easy' },
    { dayOfWeek: 6, role: 'long' },
  ],
  4: [
    { dayOfWeek: 2, role: 'quality' },
    { dayOfWeek: 4, role: 'easy' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'recovery' },
  ],
  5: [
    { dayOfWeek: 1, role: 'easy' },
    { dayOfWeek: 2, role: 'quality' },
    { dayOfWeek: 4, role: 'easy' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'recovery' },
  ],
  6: [
    { dayOfWeek: 1, role: 'easy' },
    { dayOfWeek: 2, role: 'quality' },
    { dayOfWeek: 3, role: 'easy' },
    { dayOfWeek: 4, role: 'easy' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'recovery' },
  ],
};

// Ziel-Wochenvolumen (Meter) je Trainingstage — durchweg ≥ ~28 km, also über der
// Erhaltungs-Untergrenze (~25–30 km) für halbmarathon-fähige Läufer:innen.
const MAINT_WEEKLY_M: Record<3 | 4 | 5 | 6, number> = {
  3: 28000,
  4: 35000,
  5: 42000,
  6: 50000,
};

/** Long Run als Anteil am Wochenvolumen (Daniels-Obergrenze 25–30 %). */
const LONG_RUN_FRACTION = 0.28;
/** Zeitdeckel für den Long Run bei geringem Umfang (~120 min). */
const LONG_RUN_TIME_CAP_SECONDS = 120 * 60;
const MIN_EASY_M = 4000;

function clampDays(n: number): 3 | 4 | 5 | 6 {
  return Math.min(6, Math.max(3, Math.round(n))) as 3 | 4 | 5 | 6;
}

function round500(m: number): number {
  return Math.round(m / 500) * 500;
}

function easyMidMps(vdot: number): number {
  const z = zonePaceMps(vdot, 'easy');
  return (z.lowMps + z.highMps) / 2;
}

// ---- Datum-Helfer (identisch zu generatePlan) -------------------------------

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Erzeugt einen fortlaufenden Erhaltungs-Plan über `weeks` Wochen (Default 12).
 * Jede Woche = derselbe rollierende Rhythmus; die Qualitätseinheit wechselt Woche
 * für Woche zwischen Schwellenlauf und Intervallen (Abwechslung ohne Periodisierung).
 */
export function generateMaintenancePlan(
  profile: AthleteProfile,
  options: GenerateOptions & { weeks?: number } = {},
): TrainingPlan {
  const totalWeeks = options.weeks && options.weeks > 0 ? Math.round(options.weeks) : 12;
  const days = clampDays(profile.daysPerWeek);
  const baseTemplate = MAINT_TEMPLATES[days];
  const template: Slot[] =
    profile.availableDays && profile.availableDays.length > 0
      ? placeRolesOnAvailableDays(baseTemplate.map((s) => s.role), profile.availableDays)
      : shiftSlotsToWeekStart(baseTemplate, profile.weekStartDay);
  const vdot = profile.currentVdot;
  const availableDays = profile.availableDays;
  const longDay = profile.longRunDay;

  const weeklyM = MAINT_WEEKLY_M[days];
  const longCapByTime = round500(easyMidMps(vdot) * LONG_RUN_TIME_CAP_SECONDS);
  const longM = Math.min(round500(weeklyM * LONG_RUN_FRACTION), longCapByTime);

  const weekStart = startOfWeekMonday(options.startDate ?? new Date());

  const weeks: PlanWeek[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    // Long-Run-Tag ggf. auf Wunschtag legen (Slot-Tausch, damit die Tageszahl stimmt).
    const slots: Slot[] = template.map((s) => ({ ...s }));
    if (longDay !== undefined && (!availableDays || availableDays.includes(longDay))) {
      const longSlot = slots.find((s) => s.role === 'long');
      if (longSlot && longSlot.dayOfWeek !== longDay) {
        const origDay = longSlot.dayOfWeek;
        const occupant = slots.find((s) => s.dayOfWeek === longDay && s !== longSlot);
        if (occupant) occupant.dayOfWeek = origDay;
        longSlot.dayOfWeek = longDay;
      }
    }

    // Qualitätseinheit dieser Woche (alternierend Schwelle / Intervalle).
    const qualityId = `m${w}-quality`;
    const quality: Workout =
      w % 2 === 0 ? makeTempo(qualityId, vdot, 25) : makeIntervals(qualityId, vdot, 5, 1000, 400);
    const qualityM = quality.estimatedDistanceMeters ?? 0;

    // Restliches Volumen gleichmäßig auf die lockeren Tage verteilen (mit Untergrenze).
    const easySlots = slots.filter((s) => s.role === 'easy' || s.role === 'recovery');
    const remaining = Math.max(0, weeklyM - longM - qualityM);
    const perEasy = round500(Math.max(MIN_EASY_M, easySlots.length > 0 ? remaining / easySlots.length : 0));

    const byDay = new Map<number, Role>(slots.map((s) => [s.dayOfWeek, s.role]));

    const workouts: ScheduledWorkout[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + w * 7 + d);
      // dayOfWeek ist der ECHTE Kalendertag (0=So..6=Sa) - siehe generatePlan.ts.
      const dow = date.getDay();
      const role = byDay.get(dow);
      const id = `m${w}-d${d}`;
      let workout: Workout;
      switch (role) {
        case 'long':
          workout = makeLongRun(id, vdot, longM);
          break;
        case 'quality':
          workout = quality;
          break;
        case 'easy':
          workout = makeEasyRun(id, vdot, perEasy);
          break;
        case 'recovery':
          workout = makeRecovery(id, vdot, round500(perEasy * 0.8));
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
    weeks.push({ index: w, phase: 'maintenance', targetWeeklyDistanceMeters, workouts });
  }

  return {
    id: `plan-${Date.now()}`,
    athleteId: profile.id,
    createdAt: new Date().toISOString(),
    method: 'daniels-vdot',
    weeks,
  };
}
