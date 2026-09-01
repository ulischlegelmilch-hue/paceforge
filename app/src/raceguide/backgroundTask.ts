import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';

// Muss beim App-Start EINMAL importiert werden (siehe _layout.tsx), damit die
// Task-Definition beim Modul-Laden ausgeführt wird - Expo-Vorgabe für
// Hintergrund-Tasks: sie müssen außerhalb des React-Lifecycles registriert sein,
// bevor Location.startLocationUpdatesAsync() aufgerufen wird, sonst schlägt der
// Hintergrundbetrieb (Screen aus) fehl, auch wenn Vordergrund-Tracking noch liefe.

export const RACE_GUIDE_LOCATION_TASK = 'paceforge-raceguide-location';

type LocationPointListener = (locations: LocationObject[]) => void;

let listener: LocationPointListener | null = null;

export function setRaceGuideLocationListener(l: LocationPointListener | null): void {
  listener = l;
}

TaskManager.defineTask(RACE_GUIDE_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[raceguide] location task error', error.message, error.code);
    return;
  }
  if (!data) return;
  const { locations } = data as { locations: LocationObject[] };
  listener?.(locations);
});
