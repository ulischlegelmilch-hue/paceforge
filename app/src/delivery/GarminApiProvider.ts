import type {
  DeliveryInstructions,
  ExportResult,
  WorkoutDeliveryProvider,
} from '@paceforge/core';

// Phase-2-Platzhalter für die offizielle Garmin Training API (Push direkt auf die
// Uhr). Der Zugang zum Garmin Connect Developer Program ist derzeit pausiert und
// nur für Firmen offen -> der Provider meldet sich als NICHT verfügbar. Sobald ein
// Zugang besteht, wird ausschließlich diese Klasse implementiert; UI, Plan-Engine
// und der Rest der App bleiben durch das WorkoutDeliveryProvider-Interface unberührt.
export class GarminApiProvider implements WorkoutDeliveryProvider {
  readonly id = 'garmin-api';
  readonly displayName = 'Garmin Connect (direkt auf die Uhr)';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async exportWorkout(): Promise<ExportResult> {
    throw new Error('Direkte Garmin-Connect-Übertragung ist noch nicht verfügbar (Phase 2).');
  }

  getDeliveryInstructions(): DeliveryInstructions {
    return {
      title: 'Direkt auf die Uhr (in Vorbereitung)',
      steps: [
        'Sobald der Garmin-Connect-Zugang freigeschaltet ist, werden Workouts automatisch übertragen – ganz ohne Kabel.',
      ],
    };
  }
}
