import type { PlanWeek, ScheduledWorkout, TrainingPlan } from '../domain/plan';

// Datums-Navigation im Plan: „heute", „diese Woche", „nächste Einheiten".
// Framework-agnostisch, damit die App (und Tests) dieselbe Logik nutzen.

export interface PlanLocation {
  weekIndex: number;
  dayIndex: number; // 0..6
  scheduled: ScheduledWorkout;
}

/** Lokales Datum als YYYY-MM-DD (passend zu den in generatePlan erzeugten Daten). */
export function ymdOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Die geplante Einheit an einem konkreten Datum (oder undefined). */
export function locateByDate(plan: TrainingPlan, ymd: string): PlanLocation | undefined {
  for (const week of plan.weeks) {
    const idx = week.workouts.findIndex((w) => w.date === ymd);
    if (idx >= 0) return { weekIndex: week.index, dayIndex: idx, scheduled: week.workouts[idx]! };
  }
  return undefined;
}

/** Index der Woche, die das Datum enthält; davor → 0, danach → letzte Woche. */
export function currentWeekIndex(plan: TrainingPlan, ymd: string): number {
  if (plan.weeks.length === 0) return 0;
  for (const week of plan.weeks) {
    const first = week.workouts[0]?.date ?? '';
    const last = week.workouts[week.workouts.length - 1]?.date ?? '';
    if (ymd >= first && ymd <= last) return week.index;
  }
  const firstDay = plan.weeks[0]!.workouts[0]?.date ?? '';
  if (ymd < firstDay) return 0;
  return plan.weeks[plan.weeks.length - 1]!.index;
}

/** Die Woche, die das Datum enthält (bzw. die nächstgelegene). */
export function weekOf(plan: TrainingPlan, ymd: string): PlanWeek | undefined {
  const idx = currentWeekIndex(plan, ymd);
  return plan.weeks.find((w) => w.index === idx);
}

/** Die nächsten `count` Nicht-Ruhe-Einheiten ab dem Datum (einschließlich). */
export function upcomingWorkouts(plan: TrainingPlan, ymd: string, count: number): PlanLocation[] {
  const out: PlanLocation[] = [];
  for (const week of plan.weeks) {
    for (let d = 0; d < week.workouts.length; d++) {
      const sw = week.workouts[d]!;
      if (sw.date >= ymd && sw.workout.kind !== 'rest') {
        out.push({ weekIndex: week.index, dayIndex: d, scheduled: sw });
        if (out.length >= count) return out;
      }
    }
  }
  return out;
}
