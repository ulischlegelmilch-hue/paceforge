import type { AthleteProfile } from '../domain/athlete';
import type { CompletedActivity } from '../domain/activity';
import type { ScheduledWorkout, TrainingPlan } from '../domain/plan';
import type { Workout } from '../domain/workout';

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
  const actualAvgPaceMps = actual.avgPaceMps;

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
