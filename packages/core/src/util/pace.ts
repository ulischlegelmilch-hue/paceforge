// Reine Pace-/Einheiten-Helfer (framework-unabhängig, gut testbar).

/** m/s -> "m:ss" pro Kilometer (z.B. 3.33 -> "5:00"). */
export function paceMpsToPerKm(mps: number): string {
  if (!Number.isFinite(mps) || mps <= 0) return '--:--';
  return formatSeconds(1000 / mps);
}

/** m/s -> "m:ss" pro Meile. */
export function paceMpsToPerMile(mps: number): string {
  if (!Number.isFinite(mps) || mps <= 0) return '--:--';
  return formatSeconds(1609.344 / mps);
}

/** Sekunden -> "m:ss" (rundet auf ganze Sekunden, mit Überlauf-Korrektur). */
export function formatSeconds(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "m:ss pro km" -> m/s. Nützlich für manuelle Eingaben. */
export function perKmToMps(minutes: number, seconds: number): number {
  const secPerKm = minutes * 60 + seconds;
  if (secPerKm <= 0) return 0;
  return 1000 / secPerKm;
}
