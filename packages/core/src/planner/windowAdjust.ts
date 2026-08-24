import type { PlanWeek, ScheduledWorkout, TrainingPlan } from '../domain/plan';
import type { StepDuration, Workout } from '../domain/workout';
import { isRepeatBlock } from '../domain/workout';

// Gemeinsamer Baustein für "verändere Tage in einem Datumsfenster, ohne Vergangenheit
// oder bereits vom Nutzer entschiedene Tage anzufassen, und rechne betroffene Wochen
// neu". Wird von mehreren Features gebraucht (Zwischenevent-Taper/-Erholung in
// planner/events.ts, Rückkehr-Rampe nach Trainingspause + Wochen-Entlastung bei viel
// planfremdem Laufen in adaptation/), statt dieselbe Schutzlogik mehrfach zu bauen.

export interface WindowTouch {
  fromYmd: string;
  toYmd: string;
  /** Stichtag - Tage davor gelten als Vergangenheit und werden nie angefasst. */
  referenceYmd: string;
}

/** Darf dieser Tag von einer Fenster-Transformation verändert werden? */
export function isDayEligible(sw: ScheduledWorkout, touch: WindowTouch): boolean {
  if (sw.date < touch.fromYmd || sw.date > touch.toYmd) return false;
  if (sw.date < touch.referenceYmd) return false; // Vergangenheit bleibt unangetastet
  if (sw.status === 'completed' || sw.status === 'skipped') return false; // Nutzer-Historie bleibt unangetastet
  return true;
}

/**
 * Wendet `transform` auf jeden im Fenster liegenden, veränderbaren Tag an.
 * `transform` gibt `null` zurück, wenn dieser Tag unverändert bleiben soll, sonst das
 * komplette Ersatz-`ScheduledWorkout` INKLUSIVE des gewünschten Status - meist
 * "modified" (schützt vor künftigem Überschreiben durch mergePreservingHistory),
 * aber removePlanEvent() setzt bewusst wieder "planned" zurück, um genau diesen
 * Schutz aufzuheben. Betroffene Wochen bekommen `targetWeeklyDistanceMeters` neu
 * berechnet.
 */
export function applyToWindow(
  plan: TrainingPlan,
  touch: WindowTouch,
  transform: (sw: ScheduledWorkout) => ScheduledWorkout | null,
): TrainingPlan {
  const weeks: PlanWeek[] = plan.weeks.map((week) => {
    let changed = false;
    const workouts = week.workouts.map((sw) => {
      if (!isDayEligible(sw, touch)) return sw;
      const next = transform(sw);
      if (!next) return sw;
      changed = true;
      return next;
    });
    if (!changed) return week;
    return {
      ...week,
      workouts,
      targetWeeklyDistanceMeters: workouts.reduce((s, w) => s + (w.workout.estimatedDistanceMeters ?? 0), 0),
    };
  });
  return { ...plan, weeks };
}

// ---- Workout-Skalierung (verschoben aus adaptation/adapt.ts - reine Plan-/Workout-
// Utilities, keine Adaptions-Regel, werden jetzt auch von planner/events.ts und den
// neuen adaptation/-Modulen gebraucht). ----------------------------------------------

function scaleDuration(d: StepDuration, f: number): StepDuration {
  if (d.type === 'time') return { type: 'time', seconds: Math.round(d.seconds * f) };
  if (d.type === 'distance') return { type: 'distance', meters: Math.round(d.meters * f) };
  return d;
}

export function scaleWorkout(w: Workout, f: number): Workout {
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

export function scaleWeek(week: PlanWeek, f: number): PlanWeek {
  const workouts = week.workouts.map((sw) => ({ ...sw, workout: scaleWorkout(sw.workout, f) }));
  return {
    ...week,
    workouts,
    targetWeeklyDistanceMeters: workouts.reduce((s, sw) => s + (sw.workout.estimatedDistanceMeters ?? 0), 0),
  };
}

function round500(m: number): number {
  return Math.round(m / 500) * 500;
}

/** Rundet auf 500 m - dieselbe Konvention wie generatePlan.ts/maintenance.ts. */
export { round500 };
