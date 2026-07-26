import type { TrainingPlan } from '../domain/plan';
import { strengthScheduleForWeek, type StrengthEquipment } from '../strength/index';

// Exportiert den Trainingsplan als iCalendar (.ics) – ein Ganztages-Ereignis pro
// Trainingstag (Läufe + optional die eingewobenen Krafteinheiten). Reiner String,
// damit er unit-getestet werden kann; das Teilen/Speichern macht die App.

export interface IcsOptions {
  calendarName?: string;
  strength?: { equipment: StrengthEquipment; sessionsPerWeek: number };
  dtstamp?: Date;
}

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function ymdCompact(ymd: string): string {
  return ymd.replace(/-/g, '');
}

function nextDayCompact(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d! + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}`;
}

function stampUtc(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(
    d.getUTCMinutes(),
  )}${p(d.getUTCSeconds())}Z`;
}

function km(meters?: number): string {
  return meters ? `${Math.round(meters / 100) / 10} km` : '';
}

export function planToIcs(plan: TrainingPlan, opts: IcsOptions = {}): string {
  const name = opts.calendarName ?? 'PaceForge Trainingsplan';
  const stamp = stampUtc(opts.dtstamp ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PaceForge//Trainingsplan//DE',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(name)}`,
  ];

  for (const week of plan.weeks) {
    const strengthDays = opts.strength
      ? new Map(
          strengthScheduleForWeek(week, opts.strength.equipment, opts.strength.sessionsPerWeek).map(
            (s) => [s.dayOfWeek, s.session] as const,
          ),
        )
      : new Map<number, { name: string }>();

    for (const sw of week.workouts) {
      const hasStrength = strengthDays.has(sw.dayOfWeek);
      if (sw.workout.kind === 'rest' && !hasStrength) continue;

      let summary = sw.workout.kind === 'rest' ? 'Ruhetag' : sw.workout.name;
      if (hasStrength) summary += ' + Kraft';

      const descParts: string[] = [];
      const dist = km(sw.workout.estimatedDistanceMeters);
      if (dist) descParts.push(dist);
      if (hasStrength) descParts.push(`Krafteinheit: ${strengthDays.get(sw.dayOfWeek)!.name}`);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:pf-w${week.index}-d${sw.dayOfWeek}@paceforge`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${ymdCompact(sw.date)}`);
      lines.push(`DTEND;VALUE=DATE:${nextDayCompact(sw.date)}`);
      lines.push(`SUMMARY:${esc(summary)}`);
      if (descParts.length > 0) lines.push(`DESCRIPTION:${esc(descParts.join(' · '))}`);
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
