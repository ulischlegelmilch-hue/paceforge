// Abgeschlossene Aktivität (Abschnitt 4). Quelle austauschbar: FIT-Import (MVP),
// später API oder manuelle Eingabe.

export type ActivitySource = 'fit-import' | 'api' | 'manual';

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
  laps?: ActivityLap[];
  /** An eine geplante Einheit gematcht (Datum), falls zugeordnet. */
  linkedScheduledWorkoutDate?: string;
}
