import type { DeliveryInstructions, ExportResult, Workout, WorkoutDeliveryProvider } from '@paceforge/core';
import { hasBackend } from '@/config';
import { getGarminStatus, garminPushWorkout } from '@/api/garmin';
import { useProfileStore } from '@/store/profile';

// Inoffizielle Garmin-Connect-Anbindung (13.08.2026 Uli-Entscheidung, siehe
// server/src/garmin.ts): überträgt Workouts direkt in den Garmin-Connect-
// Kalender des Nutzers, sodass Garmin Connect selbst sie kabellos auf die Uhr
// synchronisiert. Verbindung/Login läuft über die "Garmin Connect"-Karte in
// Mehr (more.tsx); dieser Provider prüft nur noch den Verbindungsstatus und
// stößt die eigentliche Übertragung serverseitig an - kein Passwort hier.
export class GarminApiProvider implements WorkoutDeliveryProvider {
  readonly id = 'garmin-api';
  readonly displayName = 'Garmin Connect (direkt auf die Uhr)';

  async isAvailable(): Promise<boolean> {
    if (!hasBackend) return false;
    try {
      const deviceId = useProfileStore.getState().deviceId;
      const status = await getGarminStatus(deviceId);
      return status.configured && status.connected;
    } catch {
      return false;
    }
  }

  async exportWorkout(workout: Workout, opts: { scheduledDate?: string } = {}): Promise<ExportResult> {
    const deviceId = useProfileStore.getState().deviceId;
    const date = opts.scheduledDate ?? new Date().toISOString().slice(0, 10);
    await garminPushWorkout(deviceId, workout, date);
    return { message: `„${workout.name}" wurde an Garmin Connect übertragen und erscheint dort im Kalender.` };
  }

  getDeliveryInstructions(): DeliveryInstructions {
    return {
      title: 'Direkt auf die Uhr',
      steps: [
        'Workout wird an dein Garmin-Connect-Konto übertragen.',
        'Die Garmin-Connect-App auf dem Handy synct es automatisch auf die Uhr.',
        'Die Uhr muss dafür einmal mit der Garmin-Connect-App verbunden/synchronisiert werden.',
      ],
    };
  }
}
