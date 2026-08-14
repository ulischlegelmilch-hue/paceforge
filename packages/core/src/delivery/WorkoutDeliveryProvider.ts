import type { Workout } from '../domain/workout';

// Abstraktion für die Workout-Auslieferung (Abschnitt 3). Phase 1: FIT-Datei-Export.
// Phase 2: austauschbarer Provider für die offizielle Garmin Training API o.ä.,
// OHNE dass Plan-Generierung oder UI angefasst werden müssen.

export interface DeliveryInstructions {
  title: string;
  steps: string[];                    // menschenlesbare Schritte für die UI
  platformNotes?: { ios?: string; android?: string };
}

export interface ExportResult {
  fileUri?: string;                   // Ablageort der erzeugten FIT-Datei (Datei-Provider)
  fileName?: string;
  bytes?: number;
  message?: string;                   // menschenlesbare Erfolgsmeldung (API-Provider, keine Datei)
}

export interface WorkoutDeliveryProvider {
  readonly id: string;                // 'fit-file' | 'garmin-api' | ...
  readonly displayName: string;
  exportWorkout(
    workout: Workout,
    opts?: { fileName?: string; scheduledDate?: string },
  ): Promise<ExportResult>;
  getDeliveryInstructions(): DeliveryInstructions;
  isAvailable(): Promise<boolean>;
}
