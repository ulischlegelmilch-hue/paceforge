import type { CompletedActivity } from '../domain/activity';
import type { ScheduledWorkoutStatus, TrainingPlan } from '../domain/plan';
import type { Workout } from '../domain/workout';
import { weekOf } from '../planner/schedule';
import { isoDay } from '../util/date';
import { compareWorkout, type Assessment } from './adapt';

// Wochenrückblick (Abschnitt "jeden Sonntag die ganze Woche analysieren"): fasst
// eine einzelne Plan-Woche gegen die tatsächlich absolvierten Aktivitäten
// zusammen. Baut bewusst auf denselben Bausteinen wie suggestAdaptation() auf
// (compareWorkout je Tag) statt eigene Vergleichslogik zu duplizieren.

function ymd(iso: string): string {
  return iso.slice(0, 10);
}

export interface WeeklyEntry {
  date: string;
  dayOfWeek: number;
  workout: Workout;
  status: ScheduledWorkoutStatus;
  activity?: CompletedActivity;
  assessment?: Assessment;
}

export interface WeeklyAnalysis {
  weekIndex: number;
  startDate: string;
  endDate: string;
  entries: WeeklyEntry[];
  /** Läufe im Wochenzeitraum ohne zugehörige geplante Einheit (z. B. frei auf der Uhr gestartet). */
  extraActivities: CompletedActivity[];
  plannedDistanceMeters: number;
  actualDistanceMeters: number;
  plannedRunCount: number;
  completedRunCount: number;
  assessmentCounts: Record<Assessment, number>;
  notes: string[];
}

/** Fasst die Plan-Woche zusammen, die `referenceDate` enthält (Default: heute). */
export function weeklyAnalysis(
  plan: TrainingPlan,
  activities: CompletedActivity[],
  referenceDate: Date = new Date(),
): WeeklyAnalysis {
  const refYmd = isoDay(referenceDate);
  const week = weekOf(plan, refYmd);
  const workouts = week?.workouts ?? [];
  const startDate = workouts[0]?.date ?? refYmd;
  const endDate = workouts[workouts.length - 1]?.date ?? refYmd;

  // Aktivitäten dieser Woche primär über die beim Übernehmen gesetzte
  // linkedScheduledWorkoutDate zuordnen (stabil, siehe profile.ts:linkActivity),
  // sonst über den Kalendertag - deckt auch ältere, vor diesem Feature
  // importierte Aktivitäten ab.
  const activityByDay = new Map<string, CompletedActivity>();
  for (const a of activities) {
    activityByDay.set(a.linkedScheduledWorkoutDate ?? ymd(a.startTime), a);
  }

  const entries: WeeklyEntry[] = [];
  const assessmentCounts: Record<Assessment, number> = { incomplete: 0, faster: 0, slower: 0, 'on-target': 0 };
  let plannedDistanceMeters = 0;
  let actualDistanceMeters = 0;
  let plannedRunCount = 0;
  let completedRunCount = 0;

  for (const sw of workouts) {
    if (sw.workout.kind === 'rest') continue;
    plannedRunCount++;
    plannedDistanceMeters += sw.workout.estimatedDistanceMeters ?? 0;

    const activity = activityByDay.get(sw.date);
    let assessment: Assessment | undefined;
    if (activity) {
      assessment = compareWorkout(sw.workout, activity).assessment;
      assessmentCounts[assessment]++;
      actualDistanceMeters += activity.totalDistanceMeters;
      completedRunCount++;
      activityByDay.delete(sw.date);
    }
    entries.push({ date: sw.date, dayOfWeek: sw.dayOfWeek, workout: sw.workout, status: sw.status, activity, assessment });
  }

  const extraActivities = [...activityByDay.values()].filter((a) => {
    const day = ymd(a.startTime);
    return day >= startDate && day <= endDate;
  });
  for (const a of extraActivities) actualDistanceMeters += a.totalDistanceMeters;

  const notes: string[] = [];
  if (plannedRunCount > 0) {
    notes.push(`${completedRunCount} von ${plannedRunCount} geplanten Läufen absolviert.`);
  }
  if (extraActivities.length > 0) {
    const n = extraActivities.length;
    notes.push(`${n} zusätzliche${n === 1 ? 'r' : ''} Lauf${n === 1 ? '' : 'e'} ohne Plan-Bezug.`);
  }
  if (plannedRunCount === 0 && extraActivities.length === 0) {
    notes.push('Keine Läufe in dieser Woche.');
  }

  return {
    weekIndex: week?.index ?? 0,
    startDate,
    endDate,
    entries,
    extraActivities,
    plannedDistanceMeters,
    actualDistanceMeters,
    plannedRunCount,
    completedRunCount,
    assessmentCounts,
    notes,
  };
}
