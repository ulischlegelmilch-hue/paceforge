import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { encodeWorkoutToFit } from '@paceforge/core/fit';
import type {
  DeliveryInstructions,
  ExportResult,
  Workout,
  WorkoutDeliveryProvider,
} from '@paceforge/core';

// Phase-1-Auslieferung: Workout als FIT-Datei exportieren und über das System-
// Teilen-Menü speichern/weitergeben. Der Nutzer kopiert die Datei per USB in den
// Garmin-Ordner NewFiles. Implementiert das geräteunabhängige WorkoutDeliveryProvider-
// Interface aus @paceforge/core, damit später ein API-basierter Provider (Phase 2)
// ohne Änderungen an UI/Plan eingehängt werden kann.

function safeFileName(workout: Workout): string {
  const base = workout.name
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${base || 'workout'}.fit`;
}

export class FitFileProvider implements WorkoutDeliveryProvider {
  readonly id = 'fit-file';
  readonly displayName = 'FIT-Datei (manuell auf die Uhr)';

  async isAvailable(): Promise<boolean> {
    return Sharing.isAvailableAsync();
  }

  async exportWorkout(workout: Workout, opts: { fileName?: string } = {}): Promise<ExportResult> {
    const bytes = encodeWorkoutToFit(workout);
    const fileName = opts.fileName ?? safeFileName(workout);

    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Workout auf die Garmin-Uhr übertragen',
        UTI: 'public.data',
      });
    }

    return { fileUri: file.uri, fileName, bytes: bytes.length };
  }

  getDeliveryInstructions(): DeliveryInstructions {
    return {
      title: 'Workout auf deine Garmin-Uhr laden',
      steps: [
        'Auf „Exportieren" tippen und die FIT-Datei speichern/teilen.',
        'Die Uhr per USB-Kabel mit dem Computer verbinden.',
        'Den Uhren-Speicher „GARMIN" öffnen.',
        'Die .fit-Datei in den Ordner GARMIN/NewFiles kopieren.',
        'Uhr trennen – das Workout erscheint unter Training › Workouts.',
      ],
      platformNotes: {
        ios: 'Am iPhone die Datei über „Teilen" z. B. in „Dateien" sichern und am Computer weiterverwenden.',
        android: 'Auf Android die Datei direkt teilen oder im Dateimanager in den Garmin-Ordner kopieren.',
      },
    };
  }
}

export const fitFileProvider = new FitFileProvider();
