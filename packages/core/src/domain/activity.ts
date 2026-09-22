// Abgeschlossene Aktivität (Abschnitt 4). Quelle austauschbar: FIT-Import (MVP),
// später API oder manuelle Eingabe.

export type ActivitySource = 'fit-import' | 'api' | 'manual' | 'app-tracked';

export interface ActivityLap {
  distanceMeters: number;
  durationSeconds: number;
  avgPaceMps: number;
  avgHeartRate?: number;
}

export interface CompletedActivity {
  id: string;
  source: ActivitySource;
  startTime: string;                  // ISO
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  avgPaceMps: number;
  avgHeartRate?: number;
  /** Gesamtanstieg in Metern (für höhenkorrigierte Auswertung). */
  totalAscentMeters?: number;
  /**
   * Flach-äquivalente Distanz aus dem Höhenprofil (per-Segment, Minetti/Strava).
   * Nur gesetzt, wenn die FIT-Records Höhendaten enthielten; genauer als die
   * Totals-Näherung aus `totalAscentMeters`.
   */
  gradeAdjustedDistanceMeters?: number;
  laps?: ActivityLap[];
  /** An eine geplante Einheit gematcht (Datum), falls zugeordnet. */
  linkedScheduledWorkoutDate?: string;
}
