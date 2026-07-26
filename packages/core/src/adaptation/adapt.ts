import type { AthleteProfile } from '../domain/athlete';
import type { CompletedActivity } from '../domain/activity';
import type { PlanWeek, ScheduledWorkout, TrainingPlan } from '../domain/plan';
import type { StepDuration, Workout } from '../domain/workout';
import { isRepeatBlock } from '../domain/workout';
import { generatePlan } from '../planner/generatePlan';
import { gradeAdjustedDistance } from '../grade/index';

// Soll-Ist-Vergleich (geplant vs. tatsächlich) + regelbasierte Adaptions-Vorschläge.
// KEIN LLM. Alle Schwellen sind hier zentral dokumentiert.

export type Assessment = 'incomplete' | 'faster' | 'slower' | 'on-target';

export interface WorkoutComparison {
  plannedDistanceMeters: number;
  actualDistanceMeters: number;
  distanceRatio: number; // actual / planned
  plannedAvgPaceMps: number;
  actualAvgPaceMps: number;
  paceRatio: number; // actual / planned ; > 1 = schneller gelaufen
  assessment: Assessment;
}

/** Ab wann eine Einheit als „absolviert" gilt (Anteil der geplanten Distanz). */
export const COMPLETE_RATIO = 0.8;
/** Toleranzband um die geplante Pace, innerhalb dessen „on-target" gilt. */
export const PACE_TOLERANCE = 0.05;

export function compareWorkout(planned: Workout, actual: CompletedActivity): WorkoutComparison {
  const plannedDistanceMeters = planned.estimatedDistanceMeters ?? 0;
  const plannedDurationSeconds = planned.estimatedDurationSeconds ?? 0;
  const plannedAvgPaceMps = plannedDurationSeconds > 0 ? plannedDistanceMeters / plannedDurationSeconds : 0;
  // Höhenkorrigiert: ein hügeliger Lauf wird nicht faelschlich als „zu langsam" bewertet.
  const actualDistEff = actual.totalAscentMeters
    ? gradeAdjustedDistance(actual.totalDistanceMeters, actual.totalAscentMeters)
    : actual.totalDistanceMeters;
  const actualAvgPaceMps =
    actual.totalDurationSeconds > 0 ? actualDistEff / actual.totalDurationSeconds : actual.avgPaceMps;

  const distanceRatio = plannedDistanceMeters > 0 ? actual.totalDistanceMeters / plannedDistanceMeters : 1;
  const paceRatio = plannedAvgPaceMps > 0 ? actualAvgPaceMps / plannedAvgPaceMps : 1;

  let assessment: Assessment;
  if (distanceRatio < COMPLETE_RATIO) assessment = 'incomplete';
  else if (paceRatio > 1 + PACE_TOLERANCE) assessment = 'faster';
  else if (paceRatio < 1 - PACE_TOLERANCE) assessment = 'slower';
  else assessment = 'on-target';

  return {
    plannedDistanceMeters,
    actualDistanceMeters: actual.totalDistanceMeters,
    distanceRatio,
    plannedAvgPaceMps,
    actualAvgPaceMps,
    paceRatio,
    assessment,
  };
}

function ymd(iso: string): string {
  return iso.slice(0, 10);
}

/** Ordnet eine Aktivität der geplanten (Nicht-Ruhe-)Einheit am selben Tag zu. */
export function matchActivity(plan: TrainingPlan, activity: CompletedActivity): ScheduledWorkout | undefined {
  const day = ymd(activity.startTime);
  for (const week of plan.weeks) {
    for (const sw of week.workouts) {
      if (sw.date === day && sw.workout.kind !== 'rest') return sw;
    }
  }
  return undefined;
}

export interface AdaptationResult {
  recommendedVdotDelta: number; // +1 / 0 / -1
  reduceNextWeekVolume: boolean;
  consecutiveMissed: number;
  assessments: { date: string; assessment: Assessment }[];
  notes: string[];
}

export interface AdaptOptions {
  /** Stichtag für „verpasste Einheiten in der Vergangenheit" (Default: heute). */
  referenceDate?: Date;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function suggestAdaptation(
  plan: TrainingPlan,
  activities: CompletedActivity[],
  opts: AdaptOptions = {},
): AdaptationResult {
  const refYmd = isoDay(opts.referenceDate ?? new Date());

  const activityByDay = new Map<string, CompletedActivity>();
  for (const a of activities) activityByDay.set(ymd(a.startTime), a);

  // 1) Bewertungen aller zugeordneten Einheiten (chronologisch).
  const assessments: { date: string; assessment: Assessment }[] = [];
  const pastPlanned: { date: string; done: boolean }[] = [];
  for (const week of plan.weeks) {
    for (const sw of week.workouts) {
      if (sw.workout.kind === 'rest') continue;
      const a = activityByDay.get(sw.date);
      if (a) assessments.push({ date: sw.date, assessment: compareWorkout(sw.workout, a).assessment });
      if (sw.date < refYmd) pastPlanned.push({ date: sw.date, done: !!a || sw.status === 'completed' });
    }
  }
  assessments.sort((x, y) => x.date.localeCompare(y.date));
  pastPlanned.sort((x, y) => x.date.localeCompare(y.date));

  // 2) Verpasste Einheiten in Folge (vom jüngsten vergangenen Tag rückwärts).
  let consecutiveMissed = 0;
  for (let i = pastPlanned.length - 1; i >= 0; i--) {
    if (!pastPlanned[i]!.done) consecutiveMissed++;
    else break;
  }

  // 3) Regeln.
  const notes: string[] = [];
  let recommendedVdotDelta = 0;
  let reduceNextWeekVolume = false;

  const recent = assessments.slice(-5);
  const faster = recent.filter((a) => a.assessment === 'faster').length;
  const slower = recent.filter((a) => a.assessment === 'slower').length;

  if (recent.length >= 3 && faster >= 3) {
    recommendedVdotDelta = 1;
    notes.push(`${faster} der letzten ${recent.length} Läufe deutlich schneller als geplant – Intensität wird leicht erhöht (VDOT +1).`);
  } else if (recent.length >= 3 && slower >= 3) {
    recommendedVdotDelta = -1;
    notes.push(`${slower} der letzten ${recent.length} Läufe langsamer als geplant – Intensität wird leicht reduziert (VDOT −1).`);
  }

  if (consecutiveMissed >= 2) {
    reduceNextWeekVolume = true;
    notes.push(`${consecutiveMissed} Einheiten in Folge verpasst – die nächste Woche wird entlastet.`);
  }

  if (notes.length === 0) notes.push('Alles im Plan – aktuell keine Anpassung nötig.');

  return { recommendedVdotDelta, reduceNextWeekVolume, consecutiveMissed, assessments, notes };
}

/** Wendet die VDOT-Empfehlung auf das Profil an (Plan danach neu generieren). */
export function applyVdotAdaptation(profile: AthleteProfile, result: AdaptationResult): AthleteProfile {
  if (result.recommendedVdotDelta === 0) return profile;
  const currentVdot = Math.round((profile.currentVdot + result.recommendedVdotDelta) * 10) / 10;
  return { ...profile, currentVdot };
}

/** Anteil, auf den eine Entlastungswoche heruntergefahren wird. */
export const RECOVERY_WEEK_FACTOR = 0.8;

function scaleDuration(d: StepDuration, f: number): StepDuration {
  if (d.type === 'time') return { type: 'time', seconds: Math.round(d.seconds * f) };
  if (d.type === 'distance') return { type: 'distance', meters: Math.round(d.meters * f) };
  return d;
}

function scaleWorkout(w: Workout, f: number): Workout {
  if (w.elements.length === 0) return w; // Ruhetag unverändert
  const elements = w.elements.map((el) =>
    isRepeatBlock(el)
      ? { ...el, steps: el.steps.map((s) => ({ ...s, duration: scaleDuration(s.duration, f) })) }
      : { ...el, duration: scaleDuration(el.duration, f) },
  );
  return {
    ...w,
    elements,
    estimatedDistanceMeters: Math.round((w.estimatedDistanceMeters ?? 0) * f),
    estimatedDurationSeconds: Math.round((w.estimatedDurationSeconds ?? 0) * f),
  };
}

function scaleWeek(week: PlanWeek, f: number): PlanWeek {
  const workouts = week.workouts.map((sw) => ({ ...sw, workout: scaleWorkout(sw.workout, f) }));
  return {
    ...week,
    workouts,
    targetWeeklyDistanceMeters: workouts.reduce((s, sw) => s + (sw.workout.estimatedDistanceMeters ?? 0), 0),
  };
}

/** Reduziert das Volumen der ersten noch nicht vergangenen Woche (Entlastung). */
export function reduceUpcomingWeek(plan: TrainingPlan, referenceDate: Date, factor = RECOVERY_WEEK_FACTOR): TrainingPlan {
  const refYmd = isoDay(referenceDate);
  const idx = plan.weeks.findIndex((w) => {
    const last = w.workouts[w.workouts.length - 1]?.date ?? '';
    return last >= refYmd;
  });
  if (idx < 0) return plan;
  return { ...plan, weeks: plan.weeks.map((w, i) => (i === idx ? scaleWeek(w, factor) : w)) };
}

/**
 * Wendet eine Adaptions-Empfehlung auf Profil + Plan an:
 * - VDOT-Delta -> Profil aktualisiert, Plan mit neuen Pace-Zonen neu generiert
 *   (gleiches Startdatum, damit der Kalender erhalten bleibt).
 * - reduceNextWeekVolume -> die kommende Woche wird entlastet.
 */
export function applyAdaptation(
  profile: AthleteProfile,
  plan: TrainingPlan,
  result: AdaptationResult,
  opts: AdaptOptions = {},
): { profile: AthleteProfile; plan: TrainingPlan } {
  const newProfile = applyVdotAdaptation(profile, result);

  const startIso = plan.weeks[0]?.workouts[0]?.date;
  const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;

  let newPlan =
    result.recommendedVdotDelta !== 0 ? generatePlan(newProfile, { startDate }) : plan;

  if (result.reduceNextWeekVolume) {
    newPlan = reduceUpcomingWeek(newPlan, opts.referenceDate ?? new Date());
  }

  return { profile: newProfile, plan: newPlan };
}
