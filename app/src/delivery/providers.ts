import type { WorkoutDeliveryProvider } from '@paceforge/core';
import { fitFileProvider } from './FitFileProvider';
import { GarminApiProvider } from './GarminApiProvider';

// Registry der Auslieferungs-Provider in Prioritätsreihenfolge. Die App fragt den
// ersten verfügbaren ab: Garmin Connect direkt, wenn Backend erreichbar UND Konto
// verbunden ist (siehe GarminApiProvider.isAvailable()), sonst der immer verfügbare
// FIT-Datei-Export als Fallback.
export const deliveryProviders: WorkoutDeliveryProvider[] = [
  new GarminApiProvider(),
  fitFileProvider,
];

export async function activeDeliveryProvider(): Promise<WorkoutDeliveryProvider> {
  for (const provider of deliveryProviders) {
    if (await provider.isAvailable()) return provider;
  }
  return fitFileProvider; // sicherer Fallback
}
