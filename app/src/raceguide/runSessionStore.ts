import { create } from 'zustand';
import { buildAnnouncementSchedule, type AnnouncementSlot, type PlanEvent } from '@paceforge/core';

import { raceGuideAudioQueue } from './audioQueue';
import {
  isLocationServicesEnabled,
  requestRaceGuidePermissions,
  startRaceGuideTracking,
  stopRaceGuideTracking,
} from './locationTracker';
import { resetPhraseResolver, resolveAnnouncement } from './phraseResolver';

// Nicht-persistenter Session-Store für den laufenden Wettkampf-Audioguide (im
// Gegensatz zu profile.ts, das dauerhaftes Profil/Plan/Aktivitäten hält) - eine
// laufende GPS-Session hat hier nichts verloren, sie lebt nur für die Dauer des
// Guides. Gleiches create<State>()((set,get)=>({...}))-Muster wie profile.ts, nur
// ohne persist-Middleware.

export type RaceGuideStatus = 'idle' | 'running' | 'paused' | 'finished';

interface RaceGuideState {
  status: RaceGuideStatus;
  event: PlanEvent | null;
  estimatedTotalSeconds: number;
  distanceMeters: number;
  startedAt: number | null;
  pausedElapsedSeconds: number;
  schedule: AnnouncementSlot[];
  firedSlotIds: Set<string>;
  lastAnnouncementText: string | null;
  backgroundGranted: boolean;
  lastAccuracyMeters: number | null;
  weakSignal: boolean;
  gpsDisabled: boolean;

  start: (event: PlanEvent, estimatedTotalSeconds: number) => Promise<'ok' | 'permission-denied' | 'gps-disabled'>;
  pause: () => Promise<void>;
  resume: () => Promise<'ok' | 'gps-disabled'>;
  stop: () => Promise<void>;
  reset: () => void;
}

const initialSessionState = {
  status: 'idle' as RaceGuideStatus,
  event: null as PlanEvent | null,
  estimatedTotalSeconds: 0,
  distanceMeters: 0,
  startedAt: null as number | null,
  pausedElapsedSeconds: 0,
  schedule: [] as AnnouncementSlot[],
  firedSlotIds: new Set<string>(),
  lastAnnouncementText: null as string | null,
  backgroundGranted: false,
  lastAccuracyMeters: null as number | null,
  weakSignal: false,
  gpsDisabled: false,
};

// Ab wie vielen HINTEREINANDER verworfenen Rohpunkten der "schwaches Signal"-
// Hinweis in der UI erscheint - ein einzelner Ausreißer soll nicht sofort
// Panik machen, aber ein Dauerzustand (siehe 0-km-Vorfall vom 30.08.) schon.
const WEAK_SIGNAL_STREAK_THRESHOLD = 5;
let rejectStreak = 0;

function makeRawSampleHandler(set: (partial: Partial<RaceGuideState>) => void) {
  return (accuracyMeters: number | null, accepted: boolean) => {
    if (accepted) {
      rejectStreak = 0;
      set({ lastAccuracyMeters: accuracyMeters, weakSignal: false });
      return;
    }
    rejectStreak += 1;
    set({ lastAccuracyMeters: accuracyMeters, weakSignal: rejectStreak >= WEAK_SIGNAL_STREAK_THRESHOLD });
  };
}

// Ist GPS beim Guide-Start aus, meldet requestForegroundPermissionsAsync trotzdem
// "granted" (App-Berechtigung != Geräte-Schalter) und startLocationUpdatesAsync läuft
// klaglos an, liefert aber nie Punkte - Distanz bleibt für immer bei 0, ohne Fehler.
// Schaltet der Nutzer GPS während einer laufenden Session an, nimmt der bereits
// gestartete Location-Task die Punkte in der Praxis nicht zuverlässig wieder auf
// (bestätigt: nur Beenden+GPS an+Neustart hat bisher funktioniert) - dieser Watchdog
// pollt daher den Geräte-Schalter und baut die Subscription bei aus→an-Wechsel
// automatisch neu auf, statt dass der Nutzer den Guide selbst neu starten muss.
const GPS_WATCHDOG_INTERVAL_MS = 3000;
let gpsWatchdogId: ReturnType<typeof setInterval> | null = null;

function stopGpsWatchdog(): void {
  if (gpsWatchdogId != null) {
    clearInterval(gpsWatchdogId);
    gpsWatchdogId = null;
  }
}

function startGpsWatchdog(set: (partial: Partial<RaceGuideState>) => void, get: () => RaceGuideState): void {
  stopGpsWatchdog();
  gpsWatchdogId = setInterval(() => {
    void (async () => {
      const state = get();
      if (state.status !== 'running') return;

      const enabled = await isLocationServicesEnabled();
      if (!enabled) {
        if (!state.gpsDisabled) set({ gpsDisabled: true });
        return;
      }

      if (state.gpsDisabled) {
        set({ gpsDisabled: false });
        await stopRaceGuideTracking();
        await startRaceGuideTracking(
          { onDistanceUpdate: (m) => handleDistanceUpdate(m, set, get), onRawSample: makeRawSampleHandler(set) },
          { reset: false },
        );
      }
    })();
  }, GPS_WATCHDOG_INTERVAL_MS);
}

export const useRaceGuideStore = create<RaceGuideState>()((set, get) => ({
  ...initialSessionState,

  start: async (event, estimatedTotalSeconds) => {
    const permissions = await requestRaceGuidePermissions();
    if (!permissions.granted) return 'permission-denied';
    // Erst hier prüfen, nicht erst nachdem die Session schon "running" gesetzt ist -
    // sonst startet der Guide scheinbar normal und die Distanz bleibt bei 0, ohne
    // dass Uli das vor dem Loslaufen mitbekommt.
    if (!(await isLocationServicesEnabled())) return 'gps-disabled';

    resetPhraseResolver();
    await raceGuideAudioQueue.configureAudioSession();
    raceGuideAudioQueue.setOnAnnounce((item) => set({ lastAnnouncementText: item.text }));

    const schedule = buildAnnouncementSchedule(event.distanceMeters, estimatedTotalSeconds);

    set({
      status: 'running',
      event,
      estimatedTotalSeconds,
      distanceMeters: 0,
      startedAt: Date.now(),
      pausedElapsedSeconds: 0,
      schedule,
      firedSlotIds: new Set(),
      lastAnnouncementText: null,
      backgroundGranted: permissions.backgroundGranted,
      lastAccuracyMeters: null,
      weakSignal: false,
      gpsDisabled: false,
    });
    rejectStreak = 0;

    await startRaceGuideTracking({
      onDistanceUpdate: (m) => handleDistanceUpdate(m, set, get),
      onRawSample: makeRawSampleHandler(set),
    });
    startGpsWatchdog(set, get);
    raceGuideAudioQueue.enqueue(resolveAnnouncement('start'));

    return 'ok';
  },

  pause: async () => {
    stopGpsWatchdog();
    await stopRaceGuideTracking();
    raceGuideAudioQueue.clear();
    const state = get();
    const elapsed = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
    set({ status: 'paused', pausedElapsedSeconds: state.pausedElapsedSeconds + elapsed, startedAt: null });
  },

  resume: async () => {
    if (!(await isLocationServicesEnabled())) return 'gps-disabled';
    set({ status: 'running', startedAt: Date.now(), gpsDisabled: false });
    rejectStreak = 0;
    await startRaceGuideTracking(
      { onDistanceUpdate: (m) => handleDistanceUpdate(m, set, get), onRawSample: makeRawSampleHandler(set) },
      { reset: false },
    );
    startGpsWatchdog(set, get);
    return 'ok';
  },

  stop: async () => {
    stopGpsWatchdog();
    await stopRaceGuideTracking();
    raceGuideAudioQueue.clear();
    set({ status: 'idle' });
  },

  reset: () => set({ ...initialSessionState, firedSlotIds: new Set(), schedule: [] }),
}));

function handleDistanceUpdate(
  distanceMeters: number,
  set: (partial: Partial<RaceGuideState>) => void,
  get: () => RaceGuideState,
): void {
  const state = get();
  if (state.status !== 'running') return;

  const firedSlotIds = new Set(state.firedSlotIds);
  let reachedFinish = false;

  for (const slot of state.schedule) {
    if (firedSlotIds.has(slot.id)) continue;
    if (distanceMeters < slot.atDistanceMeters) continue;
    firedSlotIds.add(slot.id);
    raceGuideAudioQueue.enqueue(resolveAnnouncement(slot.category, slot.km));
    if (slot.category === 'finish') reachedFinish = true;
  }

  set({ distanceMeters, firedSlotIds });
  if (reachedFinish) {
    stopGpsWatchdog();
    void stopRaceGuideTracking();
    set({ status: 'finished' });
  }
}

/** Reine Hilfsfunktion für die UI: verstrichene Sekunden ohne eigenen Ticker im Store. */
export function currentElapsedSeconds(state: Pick<RaceGuideState, 'status' | 'startedAt' | 'pausedElapsedSeconds'>): number {
  if (state.status === 'running' && state.startedAt) {
    return state.pausedElapsedSeconds + (Date.now() - state.startedAt) / 1000;
  }
  return state.pausedElapsedSeconds;
}
