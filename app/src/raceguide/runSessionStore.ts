import { create } from 'zustand';
import { buildAnnouncementSchedule, type AnnouncementSlot, type PlanEvent } from '@paceforge/core';

import { raceGuideAudioQueue } from './audioQueue';
import { requestRaceGuidePermissions, startRaceGuideTracking, stopRaceGuideTracking } from './locationTracker';
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

  start: (event: PlanEvent, estimatedTotalSeconds: number) => Promise<'ok' | 'permission-denied'>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
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

export const useRaceGuideStore = create<RaceGuideState>()((set, get) => ({
  ...initialSessionState,

  start: async (event, estimatedTotalSeconds) => {
    const permissions = await requestRaceGuidePermissions();
    if (!permissions.granted) return 'permission-denied';

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
    });
    rejectStreak = 0;

    await startRaceGuideTracking({
      onDistanceUpdate: (m) => handleDistanceUpdate(m, set, get),
      onRawSample: makeRawSampleHandler(set),
    });
    raceGuideAudioQueue.enqueue(resolveAnnouncement('start'));

    return 'ok';
  },

  pause: async () => {
    await stopRaceGuideTracking();
    raceGuideAudioQueue.clear();
    const state = get();
    const elapsed = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
    set({ status: 'paused', pausedElapsedSeconds: state.pausedElapsedSeconds + elapsed, startedAt: null });
  },

  resume: async () => {
    set({ status: 'running', startedAt: Date.now() });
    rejectStreak = 0;
    await startRaceGuideTracking(
      { onDistanceUpdate: (m) => handleDistanceUpdate(m, set, get), onRawSample: makeRawSampleHandler(set) },
      { reset: false },
    );
  },

  stop: async () => {
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
