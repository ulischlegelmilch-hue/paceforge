import { velocityForVo2 } from './formulas';

// Trainings-Pace-Zonen aus dem VDOT.
//
// Jede Zone entspricht einem Intensitäts-Anteil am VDOT (als VO2-Bruchteil). Setzt
// man diesen Bruchteil in die Umkehrformel velocityForVo2() ein, erhält man die
// Ziel-Geschwindigkeit. Die Anteile reproduzieren näherungsweise Daniels' Pace-
// Tabellen (E langsamer ... R schneller).
//
// HINWEIS zur Kalibrierung: Repetition (R) ist bei Daniels mechanisch/anaerob
// definiert; die VO2-Näherung ist dort am gröbsten. Eine spätere Feinjustierung
// direkt an den veröffentlichten Tabellen ist als Follow-up vorgesehen.

export type ZoneKey = 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';

/** low = langsames Ende der Zone, high = schnelles Ende (jeweils VO2-Anteil am VDOT). */
export const ZONE_FRACTIONS: Record<ZoneKey, { low: number; high: number }> = {
  easy: { low: 0.59, high: 0.74 },
  marathon: { low: 0.75, high: 0.84 },
  threshold: { low: 0.83, high: 0.88 },
  interval: { low: 0.95, high: 1.0 },
  repetition: { low: 1.0, high: 1.05 },
};

export interface PaceRange {
  /** langsameres Ende in m/s */
  lowMps: number;
  /** schnelleres Ende in m/s */
  highMps: number;
}

const minPerMToMps = (vMetersPerMin: number): number => vMetersPerMin / 60;

/** Pace-Range einer Zone in m/s. */
export function zonePaceMps(vdot: number, zone: ZoneKey): PaceRange {
  const f = ZONE_FRACTIONS[zone];
  return {
    lowMps: minPerMToMps(velocityForVo2(f.low * vdot)),
    highMps: minPerMToMps(velocityForVo2(f.high * vdot)),
  };
}

/** Alle Pace-Zonen für eine gegebene VDOT. */
export function allZones(vdot: number): Record<ZoneKey, PaceRange> {
  return {
    easy: zonePaceMps(vdot, 'easy'),
    marathon: zonePaceMps(vdot, 'marathon'),
    threshold: zonePaceMps(vdot, 'threshold'),
    interval: zonePaceMps(vdot, 'interval'),
    repetition: zonePaceMps(vdot, 'repetition'),
  };
}
