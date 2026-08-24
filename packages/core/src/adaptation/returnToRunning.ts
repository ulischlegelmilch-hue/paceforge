import type { CompletedActivity } from '../domain/activity';
import type { TrainingPlan } from '../domain/plan';
import { isoDay } from '../util/date';
import { daysSinceLastRun } from '../advice/detraining';
import { makeEasyRun } from '../planner/workouts';
import { applyToWindow, round500, scaleWorkout } from '../planner/windowAdjust';

// Rückkehr-Rampe nach einer Trainingspause: statt nach z. B. drei Wochen Pause direkt
// wieder ins volle geplante Tempo/Intervall-Programm zu springen, wird für ein paar
// Tage Volumen reduziert und Qualität ausgesetzt. Nutzt denselben Gap-Wert wie die
// bestehende advice/detraining.ts-Warnung (daysSinceLastRun), löst aber - anders als
// die reine Text-Warnung dort - eine tatsächliche Plan-Anpassung aus.

/** Ab wie vielen Tagen ohne Lauf eine Rückkehr-Rampe vorgeschlagen wird (deckt sich
 *  mit assessDetraining()s ">14 Tage"-Warnschwelle). */
const GAP_TRIGGER_DAYS = 14;
const MIN_RAMP_DAYS = 4;
const MAX_RAMP_DAYS = 14;

export interface ReturnRampAssessment {
  gapDays: number;
  rampDays: number;
  rampFrom: string;
  rampTo: string;
  reason: string;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/**
 * Prüft, ob aktuell eine Rückkehr-Rampe angebracht ist. `null`, wenn die letzte
 * Pause zu kurz war (oder keine Historie vorliegt).
 */
export function assessReturnRamp(
  activities: CompletedActivity[],
  referenceDate: Date = new Date(),
): ReturnRampAssessment | null {
  const gap = daysSinceLastRun(activities, referenceDate);
  if (gap === null || gap < GAP_TRIGGER_DAYS) return null;

  const rampDays = Math.min(MAX_RAMP_DAYS, Math.max(MIN_RAMP_DAYS, Math.round(gap * 0.5)));
  const refYmd = isoDay(referenceDate);
  const gapRounded = Math.round(gap);
  return {
    gapDays: gapRounded,
    rampDays,
    rampFrom: refYmd,
    rampTo: addDaysYmd(refYmd, rampDays - 1),
    reason: `${gapRounded} Tage ohne Lauf – die nächsten ${rampDays} Tage starten mit reduziertem Umfang, ohne Tempo-/Intervalleinheiten.`,
  };
}

/**
 * Wendet die Rampe auf den Plan an: Qualitäts-/Long-Run-Tage im Fenster werden zu
 * lockeren Läufen mit reduziertem Volumen, lockere/Regenerationstage bleiben in der
 * Art, aber ebenfalls im Volumen gedämpft (linear von ~50% am ersten Rampentag auf
 * 100% am letzten). Ruhetage bleiben Ruhetage. Vergangene/bereits absolvierte Tage
 * werden über applyToWindow automatisch ausgespart.
 */
export function applyReturnRamp(
  plan: TrainingPlan,
  assessment: ReturnRampAssessment,
  vdot: number,
  referenceDate: Date = new Date(),
): TrainingPlan {
  const refYmd = isoDay(referenceDate);
  const span = Math.max(1, assessment.rampDays - 1);

  return applyToWindow(plan, { fromYmd: assessment.rampFrom, toYmd: assessment.rampTo, referenceYmd: refYmd }, (sw) => {
    const kind = sw.workout.kind;
    if (kind === 'rest') return null;

    const dayIndex = Math.round(
      (new Date(`${sw.date}T00:00:00`).getTime() - new Date(`${assessment.rampFrom}T00:00:00`).getTime()) /
        (24 * 3600 * 1000),
    );
    const factor = 0.5 + 0.5 * (Math.min(dayIndex, span) / span);

    if (kind === 'tempo' || kind === 'interval' || kind === 'repetition' || kind === 'long') {
      const meters = round500((sw.workout.estimatedDistanceMeters ?? 0) * factor);
      return { ...sw, workout: makeEasyRun(sw.workout.id, vdot, meters), status: 'modified' };
    }
    return { ...sw, workout: scaleWorkout(sw.workout, factor), status: 'modified' };
  });
}
