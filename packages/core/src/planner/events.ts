import type { AthleteProfile } from '../domain/athlete';
import type { PlanEvent } from '../domain/event';
import type { ScheduledWorkout, TrainingPlan } from '../domain/plan';
import { isoDay } from '../util/date';
import { locateByDate } from './schedule';
import { generatePlan } from './generatePlan';
import { makeEasyRun, makeRace, makeRecovery } from './workouts';
import { applyToWindow, round500, type WindowTouch } from './windowAdjust';

// Zwischenevent (Ad-hoc-Wettkampf mitten im Plan, z. B. ein Testrennen während der
// Marathon-Vorbereitung): fügt am Zieldatum ein Wettkampf-Workout ein und dämpft die
// Tage davor (Taper) und danach (Erholung), ohne die restliche Periodisierung
// anzufassen. Baut auf `applyToWindow` (windowAdjust.ts) auf, die Vergangenheit und
// bereits absolvierte/übersprungene Tage von selbst ausspart.

const METERS_PER_MILE = 1609.34;

// Recovery-Seite: "1 Tag leichte Erholung pro gelaufene Meile" ist eine verbreitete
// Coaching-Faustregel (Daniels/Galloway-Tradition) für die Tage NACH einem Wettkampf.
// Untergrenze 2 Tage (auch ein 5k verdient etwas Erholung), Obergrenze 10 Tage (das
// ist ein Tune-up-/B-Rennen, kein Hauptwettkampf mit eigenem Taper-Zyklus).
const MIN_RECOVERY_DAYS = 2;
const MAX_RECOVERY_DAYS = 10;
export function recoveryDaysFor(distanceMeters: number): number {
  const miles = distanceMeters / METERS_PER_MILE;
  return Math.min(MAX_RECOVERY_DAYS, Math.max(MIN_RECOVERY_DAYS, Math.round(miles)));
}

// Taper-Seite: weniger klar durch eine einzelne Quelle belegt als die Recovery-Regel -
// als Faustregel die halbe Recovery-Länge (kürzeres Vor-Wettkampf-Dämpfen als Nach-
// Wettkampf-Erholung), Untergrenze 1 Tag, Obergrenze 7 Tage.
const MIN_TAPER_DAYS = 1;
const MAX_TAPER_DAYS = 7;
export function taperDaysFor(distanceMeters: number): number {
  const miles = distanceMeters / METERS_PER_MILE;
  return Math.min(MAX_TAPER_DAYS, Math.max(MIN_TAPER_DAYS, Math.round(miles * 0.5)));
}

/** Wie stark ein Qualitäts-/Long-Run-Tag im Erholungsfenster im Volumen sinkt. */
const RECOVERY_VOLUME_FACTOR = 0.5;
/** Deckel für lockere Taper-Tage (wie generatePlan.ts easyMetersForPhase('taper')). */
const EASY_TAPER_CAP_M = 6000;
/** Long-Run-Taper-Faktor (wie generatePlan.ts TAPER_LONG_FACTOR). */
const TAPER_LONG_FACTOR = 0.5;

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/** Nur Qualitäts-/Long-Run-Tage werden gedämpft - lockere Tage/Ruhetage bleiben, wie sie sind. */
function downgrade(sw: ScheduledWorkout, vdot: number, mode: 'taper' | 'recovery'): ScheduledWorkout | null {
  const kind = sw.workout.kind;
  if (kind !== 'tempo' && kind !== 'interval' && kind !== 'repetition' && kind !== 'long') return null;
  const original = sw.workout.estimatedDistanceMeters ?? 0;

  if (kind === 'long') {
    const meters = round500(original * TAPER_LONG_FACTOR);
    const workout = mode === 'taper' ? makeEasyRun(sw.workout.id, vdot, meters) : makeRecovery(sw.workout.id, vdot, meters);
    return { ...sw, workout, status: 'modified' };
  }
  const meters =
    mode === 'taper' ? Math.min(original, EASY_TAPER_CAP_M) : round500(original * RECOVERY_VOLUME_FACTOR);
  const workout = mode === 'taper' ? makeEasyRun(sw.workout.id, vdot, meters) : makeRecovery(sw.workout.id, vdot, meters);
  return { ...sw, workout, status: 'modified' };
}

export type PlanEventStatus = 'applied' | 'out-of-range' | 'in-past';

export interface PlanEventResult {
  plan: TrainingPlan;
  status: PlanEventStatus;
  taperWindow?: { fromYmd: string; toYmd: string };
  recoveryWindow?: { fromYmd: string; toYmd: string };
}

/**
 * Fügt ein Zwischenevent in den Plan ein: Wettkampf-Tag + gedämpftes Taper-/
 * Erholungsfenster. Event-Tage außerhalb des Plan-Zeitraums oder in der Vergangenheit
 * werden abgelehnt (Plan unverändert), statt etwas Unerwartetes zu tun.
 */
export function applyPlanEvent(
  plan: TrainingPlan,
  event: PlanEvent,
  vdot: number,
  referenceDate: Date = new Date(),
): PlanEventResult {
  const refYmd = isoDay(referenceDate);
  if (!locateByDate(plan, event.date)) return { plan, status: 'out-of-range' };
  if (event.date < refYmd) return { plan, status: 'in-past' };

  const raceWorkout = makeRace(`event-${event.id}`, vdot, event.distanceMeters, event.targetTimeSeconds);
  let next: TrainingPlan = {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map((sw) => (sw.date === event.date ? { ...sw, workout: raceWorkout, status: 'modified' as const } : sw)),
    })),
  };

  const taperDays = taperDaysFor(event.distanceMeters);
  const recoveryDays = recoveryDaysFor(event.distanceMeters);
  const taperWindow = { fromYmd: addDaysYmd(event.date, -taperDays), toYmd: addDaysYmd(event.date, -1) };
  const recoveryWindow = { fromYmd: addDaysYmd(event.date, 1), toYmd: addDaysYmd(event.date, recoveryDays) };

  const taperTouch: WindowTouch = { ...taperWindow, referenceYmd: refYmd };
  const recoveryTouch: WindowTouch = { ...recoveryWindow, referenceYmd: refYmd };
  next = applyToWindow(next, taperTouch, (sw) => downgrade(sw, vdot, 'taper'));
  next = applyToWindow(next, recoveryTouch, (sw) => downgrade(sw, vdot, 'recovery'));

  // Wochen-Totals neu berechnen, in denen NUR der Wettkampf-Tag selbst getauscht wurde
  // (applyToWindow tut das schon für Taper/Erholung, aber nicht für den reinen Tausch oben).
  next = {
    ...next,
    weeks: next.weeks.map((week) => ({
      ...week,
      targetWeeklyDistanceMeters: week.workouts.reduce((s, sw) => s + (sw.workout.estimatedDistanceMeters ?? 0), 0),
    })),
  };

  return { plan: next, status: 'applied', taperWindow, recoveryWindow };
}

/**
 * Entfernt ein Zwischenevent wieder: setzt genau das Taper-/Wettkampf-/Erholungs-
 * fenster auf den Stand zurück, den ein frischer Plan OHNE dieses Event hätte -
 * gezielter Datumsfenster-Ersatz statt mergePreservingHistory (die würde die per
 * applyPlanEvent gesetzten "modified"-Tage als Historie behandeln und behalten).
 * Bereits absolvierte/übersprungene Tage im ehemaligen Fenster bleiben unangetastet
 * (isDayEligible in applyToWindow sorgt dafür).
 */
export function removePlanEvent(
  plan: TrainingPlan,
  profileWithoutEvent: AthleteProfile,
  event: PlanEvent,
  referenceDate: Date = new Date(),
): TrainingPlan {
  const refYmd = isoDay(referenceDate);
  const fromYmd = addDaysYmd(event.date, -taperDaysFor(event.distanceMeters));
  const toYmd = addDaysYmd(event.date, recoveryDaysFor(event.distanceMeters));

  const startIso = plan.weeks[0]?.workouts[0]?.date;
  const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;
  const fresh = generatePlan(profileWithoutEvent, { startDate });
  const freshByDate = new Map(fresh.weeks.flatMap((w) => w.workouts.map((sw) => [sw.date, sw] as const)));

  return applyToWindow(plan, { fromYmd, toYmd, referenceYmd: refYmd }, (sw) => {
    const freshSw = freshByDate.get(sw.date);
    if (!freshSw) return null;
    return { ...freshSw, status: 'planned' };
  });
}
