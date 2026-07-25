import { vdotFromRace } from './formulas';

// Wettkampfzeit-Vorhersage aus der VDOT (Umkehrung von vdotFromRace).
// vdotFromRace(distance, t) fällt monoton mit t (längere Zeit = langsamer = kleinere
// VDOT) -> die Zeit t mit vdotFromRace(distance, t) == vdot per Bisektion finden.

export const STANDARD_RACE_METERS = {
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
} as const;

export type StandardRace = keyof typeof STANDARD_RACE_METERS;

/** Geschätzte Zielzeit (Sekunden) für eine Distanz bei gegebener VDOT. */
export function predictRaceTime(vdot: number, distanceMeters: number): number {
  let lo = 1; // 1 s (sicher schneller als jede reale Zeit)
  let hi = 24 * 3600; // 24 h (sicher langsamer)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    // vdot bei Zeit mid zu hoch -> Zeit müsste größer (langsamer) sein.
    if (vdotFromRace(distanceMeters, mid) - vdot > 0) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Vorhergesagte Zeiten für die Standard-Distanzen. */
export function predictedRaceTimes(vdot: number): Record<StandardRace, number> {
  return {
    '5k': predictRaceTime(vdot, STANDARD_RACE_METERS['5k']),
    '10k': predictRaceTime(vdot, STANDARD_RACE_METERS['10k']),
    half: predictRaceTime(vdot, STANDARD_RACE_METERS.half),
    marathon: predictRaceTime(vdot, STANDARD_RACE_METERS.marathon),
  };
}
