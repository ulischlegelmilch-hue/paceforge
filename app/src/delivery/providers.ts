import type { WorkoutDeliveryProvider } from '@paceforge/core';
import { fitFileProvider } from './FitFileProvider';
import { GarminApiProvider } from './GarminApiProvider';

// Registry der Auslieferungs-Provider in Prioritätsreihenfolge. Die App fragt den
// ersten verfügbaren ab. Solange die Garmin-API pausiert ist, greift automatisch
// der FIT-Datei-Provider. Ein späterer API-Provider wird hier einfach vorangestellt.
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
