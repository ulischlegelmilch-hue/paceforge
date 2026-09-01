// Verpflegungs-Zeitpunkte während des Wettkampf-Audioguides. Grundlage
// (siehe Recherche-Quellen im Plan): Zielkorridor 30-60g Kohlenhydrate/Stunde,
// in der Praxis alle ~30-45 Min ein Gel à 25-30g; unter ~60-75 Min Gesamtzeit
// ist i.d.R. keine Zwischenverpflegung nötig (Glykogenspeicher reichen). Reine
// Funktion: rechnet Zeit-Checkpoints über die geschätzte Ø-Pace in Distanz um,
// damit sie sich wie die km-Ansagen anhand der zurückgelegten Strecke auslösen
// lassen (kein separates Zeit-Tracking im Aufrufer nötig).

export interface FuelingCheckpoint {
  atDistanceMeters: number;
}

/** Unterhalb dieser Gesamtdauer wird keine Verpflegung empfohlen. */
export const MIN_DURATION_FOR_FUELING_S = 60 * 60;
/** Abstand zwischen zwei Verpflegungs-Hinweisen, in Minuten (auch für die Vorschau vor dem Lauf). */
export const FUELING_INTERVAL_MINUTES = 35;
const INTERVAL_S = FUELING_INTERVAL_MINUTES * 60;
/** Erster Hinweis nicht vor dieser Zeit (Magen braucht keine Verpflegung gleich zu Beginn). */
const FIRST_CHECKPOINT_S = 20 * 60;
/** Kein Hinweis mehr in den letzten X Sekunden vor dem Ziel. */
const NO_FUELING_BEFORE_FINISH_S = 10 * 60;

export function fuelingPlan(totalMeters: number, estimatedTotalSeconds: number): FuelingCheckpoint[] {
  if (estimatedTotalSeconds < MIN_DURATION_FOR_FUELING_S || totalMeters <= 0) return [];

  const secondsPerMeter = estimatedTotalSeconds / totalMeters;
  const checkpoints: FuelingCheckpoint[] = [];
  for (let t = FIRST_CHECKPOINT_S; t <= estimatedTotalSeconds - NO_FUELING_BEFORE_FINISH_S; t += INTERVAL_S) {
    checkpoints.push({ atDistanceMeters: t / secondsPerMeter });
  }
  return checkpoints;
}

export interface FuelingSummary {
  /** Wie oft während des Laufs Verpflegung fällig wird. */
  count: number;
  /** Abstand zwischen zwei Hinweisen (Minuten). */
  intervalMinutes: number;
}

/**
 * Kurzfassung für die Vorbereitung VOR dem Lauf (z.B. "3× Gel mitnehmen") -
 * dieselbe Regel wie `fuelingPlan`, aber ohne die Distanz-Checkpoints, die
 * erst während des laufenden Audioguides gebraucht werden. `null` = für
 * diese Länge ist keine Zwischenverpflegung nötig.
 */
export function fuelingSummary(totalMeters: number, estimatedTotalSeconds: number): FuelingSummary | null {
  const checkpoints = fuelingPlan(totalMeters, estimatedTotalSeconds);
  if (checkpoints.length === 0) return null;
  return { count: checkpoints.length, intervalMinutes: FUELING_INTERVAL_MINUTES };
}
