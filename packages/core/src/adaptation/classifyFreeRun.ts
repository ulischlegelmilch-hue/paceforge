import type { CompletedActivity } from '../domain/activity';
import { allZones, type ZoneKey } from '../vdot/zones';

// Einordnung eines Laufs OHNE Plan-Bezug (kein `linkedScheduledWorkoutDate`) - z. B.
// direkt auf der Uhr gestartet, nicht von PaceForge geplant. Reine Pace-vs-VDOT-
// Einordnung, damit auch solche Läufe eine Analyse statt nur Rohdaten bekommen.

export type FreeRunZone = ZoneKey | 'below-easy' | 'above-repetition';

export interface FreeRunClassification {
  zone: FreeRunZone;
  zoneLabel: string;
  paceMps: number;
}

const ZONE_ORDER: ZoneKey[] = ['easy', 'marathon', 'threshold', 'interval', 'repetition'];

const ZONE_LABELS: Record<FreeRunZone, string> = {
  easy: 'Locker',
  marathon: 'Marathon-Tempo',
  threshold: 'Schwelle',
  interval: 'Intervall',
  repetition: 'Wiederholung',
  'below-easy': 'Regeneration',
  'above-repetition': 'Sehr schnell',
};

/**
 * Ordnet die (höhenkorrigierte, falls vorhanden) Durchschnitts-Pace einer der
 * fünf VDOT-Zonen aus zones.ts zu. Die Zonen-Grenzen (ZONE_FRACTIONS) haben
 * zwischen threshold und interval eine kleine Lücke (0.88..0.95 VO2-Anteil) -
 * bei einer Pace in dieser Lücke gewinnt die NÄCHSTNIEDRIGERE Zone (hier:
 * threshold), nicht "keine Zone".
 */
export function classifyFreeRun(activity: CompletedActivity, vdot: number): FreeRunClassification {
  const distEff = activity.gradeAdjustedDistanceMeters ?? activity.totalDistanceMeters;
  const paceMps = activity.totalDurationSeconds > 0 ? distEff / activity.totalDurationSeconds : activity.avgPaceMps;

  const zones = allZones(vdot);
  let zone: FreeRunZone = 'below-easy';
  if (paceMps > zones.repetition.highMps) {
    zone = 'above-repetition';
  } else {
    for (let i = ZONE_ORDER.length - 1; i >= 0; i--) {
      const key = ZONE_ORDER[i]!;
      if (paceMps >= zones[key].lowMps) {
        zone = key;
        break;
      }
    }
  }

  return { zone, zoneLabel: ZONE_LABELS[zone], paceMps };
}
