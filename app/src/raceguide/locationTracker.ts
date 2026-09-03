import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { haversineMeters, type GeoPoint } from '@paceforge/core';

import { RACE_GUIDE_LOCATION_TASK, setRaceGuideLocationListener } from './backgroundTask';

// GPS-Distanz-Tracking für den Wettkampf-Audioguide. Läuft über
// Location.startLocationUpdatesAsync statt watchPositionAsync, weil das auch bei
// gesperrtem Bildschirm/App im Hintergrund weiterliefert (Uli-Entscheidung: Guide
// soll auch mit Handy in der Tasche funktionieren) - deckt Vordergrund UND
// Hintergrund mit demselben Mechanismus ab, kein zweiter Pfad nötig.
//
// Genauigkeits-Filter gegen GPS-Jitter-Phantomdistanz: Punkte mit schlechter
// Genauigkeit (> 25m) werden verworfen statt in die Distanz einzurechnen.
//
// Erster Live-Test (30.08.) zählte über den ganzen Lauf 0 km - Verdacht: die
// Genauigkeit blieb (Startbereich/Bebauung/Handy in der Tasche) durchgehend über
// 25m, wodurch JEDER Punkt verworfen wurde und totalMeters für immer bei 0 blieb.
// Fallback dagegen: bleibt der Filter länger als STALL_TIMEOUT_MS ohne akzeptierten
// Punkt hängen, wird ein mäßig ungenauer Punkt (bis FALLBACK_ACCURACY_M) statt
// komplett nichts angenommen - lieber leicht ungenaue Distanz als dauerhaft 0.
const MAX_ACCEPTABLE_ACCURACY_M = 25;
const FALLBACK_ACCURACY_M = 100;
const STALL_TIMEOUT_MS = 20_000;

export interface RaceGuidePermissionResult {
  granted: boolean;
  backgroundGranted: boolean;
}

export async function requestRaceGuidePermissions(): Promise<RaceGuidePermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return { granted: false, backgroundGranted: false };
  if (Platform.OS === 'web') return { granted: true, backgroundGranted: false };

  const background = await Location.requestBackgroundPermissionsAsync();
  return { granted: true, backgroundGranted: background.status === 'granted' };
}

// App-Berechtigung (oben) ist unabhängig vom GERÄTE-GPS-Schalter - mit erteilter
// Berechtigung aber ausgeschaltetem GPS läuft startLocationUpdatesAsync klaglos an,
// liefert aber nie Punkte, wodurch die Distanz für immer bei 0 hängen bleibt (siehe
// runSessionStore.ts gpsDisabled-Watchdog, der das hierüber erkennt).
export async function isLocationServicesEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  return Location.hasServicesEnabledAsync();
}

export interface RaceGuideTrackerCallbacks {
  onDistanceUpdate: (totalMeters: number) => void;
  /** Jede eingehende Rohposition, auch verworfene - für eine Live-Diagnoseanzeige,
   *  damit ein 0-km-Lauf künftig live als "Signal schwach" statt erst hinterher als
   *  Rätsel sichtbar wird (siehe Kommentar zum 0-km-Vorfall vom 30.08. oben). */
  onRawSample?: (accuracyMeters: number | null, accepted: boolean) => void;
}

let lastPoint: GeoPoint | null = null;
let totalMeters = 0;
let lastAcceptedAt = 0;

export async function startRaceGuideTracking(
  callbacks: RaceGuideTrackerCallbacks,
  options: { reset?: boolean } = {},
): Promise<void> {
  if (options.reset ?? true) {
    lastPoint = null;
    totalMeters = 0;
    lastAcceptedAt = 0;
  }

  setRaceGuideLocationListener((locations) => {
    for (const loc of locations) {
      const accuracy = loc.coords.accuracy;
      const now = Date.now();
      const stalled = now - lastAcceptedAt > STALL_TIMEOUT_MS;

      if (accuracy != null && accuracy > MAX_ACCEPTABLE_ACCURACY_M) {
        const acceptAsFallback = stalled && accuracy <= FALLBACK_ACCURACY_M;
        if (!acceptAsFallback) {
          console.warn(`[raceguide] Punkt verworfen, Genauigkeit ${Math.round(accuracy)}m`);
          callbacks.onRawSample?.(accuracy, false);
          continue;
        }
        console.warn(`[raceguide] Fallback: Punkt mit ${Math.round(accuracy)}m trotzdem angenommen (kein besserer seit ${STALL_TIMEOUT_MS}ms)`);
      }

      const point: GeoPoint = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (lastPoint) {
        totalMeters += haversineMeters(lastPoint, point);
      }
      lastPoint = point;
      lastAcceptedAt = now;
      callbacks.onRawSample?.(accuracy, true);
      callbacks.onDistanceUpdate(totalMeters);
    }
  });

  if (Platform.OS === 'web') return; // Web hat keinen Hintergrund-Task-Support - Guide bleibt dort deaktiviert.

  await Location.startLocationUpdatesAsync(RACE_GUIDE_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 10,
    deferredUpdatesInterval: 3000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'PaceForge Wettkampf-Guide',
      notificationBody: 'Trackt deine Distanz im Hintergrund weiter.',
    },
  });
}

export async function stopRaceGuideTracking(): Promise<void> {
  setRaceGuideLocationListener(null);
  lastPoint = null;
  if (Platform.OS === 'web') return;
  const started = await Location.hasStartedLocationUpdatesAsync(RACE_GUIDE_LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(RACE_GUIDE_LOCATION_TASK);
}
