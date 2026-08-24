import type { TrainingPlan } from '../domain/plan';
import { isoDay } from '../util/date';
import type { WeeklyAnalysis } from './weeklyAnalysis';
import { applyToWindow, scaleWorkout } from '../planner/windowAdjust';

// Wochen-Entlastung bei viel planfremdem Laufen: wenn diese Woche schon deutlich
// Distanz OHNE Plan-Bezug zusammengekommen ist (weeklyAnalysis()s extraActivities),
// sollen die noch ausstehenden geplanten Einheiten nicht einfach obendrauf kommen,
// sondern anteilig leichter ausfallen - der eigene Lauf zählt für das Wochenziel mit.

/** Anteil planfremder Distanz am Wochenziel, ab dem eine Entlastung vorgeschlagen wird. */
export const EXTRA_TRIGGER_RATIO = 0.3;
/** Noch ausstehende Einheiten werden nie unter diesen Anteil ihres Volumens gekürzt. */
export const MIN_LIGHTEN_FACTOR = 0.6;

export interface WeekLighteningAssessment {
  extraDistanceMeters: number;
  remainingPlannedMeters: number;
  lightenFactor: number;
  reason: string;
}

/**
 * Prüft, ob die restlichen (noch nicht absolvierten) geplanten Einheiten dieser Woche
 * angesichts bereits gelaufener planfremder Distanz leichter ausfallen sollten.
 * `null`, wenn keine/zu wenig Zusatzdistanz vorliegt oder nichts mehr aussteht.
 */
export function assessWeekLightening(
  analysis: WeeklyAnalysis,
  referenceDate: Date = new Date(),
): WeekLighteningAssessment | null {
  const extraDistanceMeters = analysis.extraActivities.reduce((s, a) => s + a.totalDistanceMeters, 0);
  if (extraDistanceMeters === 0) return null;

  const refYmd = isoDay(referenceDate);
  const remainingPlannedMeters = analysis.entries
    .filter((e) => e.status === 'planned' && !e.activity && e.date >= refYmd && e.workout.kind !== 'rest')
    .reduce((s, e) => s + (e.workout.estimatedDistanceMeters ?? 0), 0);
  if (remainingPlannedMeters === 0) return null;

  if (extraDistanceMeters / (analysis.plannedDistanceMeters || 1) < EXTRA_TRIGGER_RATIO) return null;

  const doneSoFar = analysis.actualDistanceMeters - extraDistanceMeters;
  const budget = Math.max(0, analysis.plannedDistanceMeters - doneSoFar - extraDistanceMeters);
  const lightenFactor = Math.min(1, Math.max(MIN_LIGHTEN_FACTOR, budget / remainingPlannedMeters));
  if (lightenFactor >= 0.95) return null;

  return {
    extraDistanceMeters,
    remainingPlannedMeters,
    lightenFactor,
    reason: `${Math.round(extraDistanceMeters / 100) / 10} km zusätzlich außerhalb des Plans gelaufen – die restlichen geplanten Einheiten dieser Woche werden auf ${Math.round(lightenFactor * 100)}% reduziert.`,
  };
}

/**
 * Skaliert die noch ausstehenden (Status "planned", kein zugeordneter Lauf, kein
 * Ruhetag) Einheiten der analysierten Woche mit `lightenFactor`. Bereits erledigte
 * oder anderweitig (z. B. per Zwischenevent/Rampe) veränderte Tage bleiben unberührt,
 * damit sich Entlastungen nicht gegenseitig aufschaukeln.
 */
export function applyWeekLightening(
  plan: TrainingPlan,
  assessment: WeekLighteningAssessment,
  analysis: WeeklyAnalysis,
  referenceDate: Date = new Date(),
): TrainingPlan {
  const refYmd = isoDay(referenceDate);
  return applyToWindow(plan, { fromYmd: analysis.startDate, toYmd: analysis.endDate, referenceYmd: refYmd }, (sw) => {
    if (sw.status !== 'planned' || sw.workout.kind === 'rest') return null;
    return { ...sw, workout: scaleWorkout(sw.workout, assessment.lightenFactor), status: 'modified' };
  });
}
