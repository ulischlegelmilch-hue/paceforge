import type { PlanWeek, ScheduledWorkout, TrainingPlan } from '../domain/plan';
import { isoDay } from '../util/date';

// Neukalibrieren, Lauftage/Woche oder verfügbare Tage ändern generieren den Plan
// komplett neu (generatePlan() kennt keine Teil-Updates). Ohne diese Funktion
// gingen dabei alle bereits erledigten/übersprungenen/manuell geänderten Tage
// verloren, weil der neue Plan überall mit status "planned" startet.
//
// Regel: ein Tag aus dem ALTEN Plan bleibt erhalten, wenn er entweder schon
// vergangen ist (Datum < Stichtag) ODER bereits einen Status ungleich "planned"
// hat (auch für einen zukünftigen, aber schon erledigten/übersprungenen Tag).
// Alle anderen (noch bevorstehenden, unveränderten) Tage kommen aus dem NEUEN Plan.
export function mergePreservingHistory(
  oldPlan: TrainingPlan,
  newPlan: TrainingPlan,
  referenceDate: Date = new Date(),
): TrainingPlan {
  const refYmd = isoDay(referenceDate);
  const oldByDate = new Map<string, ScheduledWorkout>();
  for (const week of oldPlan.weeks) {
    for (const sw of week.workouts) oldByDate.set(sw.date, sw);
  }

  const weeks: PlanWeek[] = newPlan.weeks.map((week) => {
    const workouts = week.workouts.map((sw) => {
      const old = oldByDate.get(sw.date);
      if (!old) return sw;
      const keepOld = sw.date < refYmd || old.status !== 'planned';
      return keepOld ? old : sw;
    });
    return {
      ...week,
      workouts,
      targetWeeklyDistanceMeters: workouts.reduce((s, sw) => s + (sw.workout.estimatedDistanceMeters ?? 0), 0),
    };
  });

  return { ...newPlan, weeks };
}
