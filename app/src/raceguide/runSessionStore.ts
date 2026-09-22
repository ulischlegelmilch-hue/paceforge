import { create } from 'zustand';
import {
  buildAnnouncementSchedule,
  paceMpsToPerKm,
  type AnnouncementCategory,
  type AnnouncementSlot,
  type CompletedActivity,
  type PlanEvent,
} from '@paceforge/core';

import { raceGuideAudioQueue } from './audioQueue';
import {
  isLocationServicesEnabled,
  requestRaceGuidePermissions,
  startRaceGuideTracking,
  stopRaceGuideTracking,
} from './locationTracker';
import { resetPhraseResolver, resolveAnnouncement } from './phraseResolver';
import { useProfileStore } from '@/store/profile';

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
  /** Wanduhrzeit des allerersten Starts (im Ggs. zu `startedAt`, das bei jedem Resume überschrieben wird) - Basis für `CompletedActivity.startTime` beim Loggen. */
  sessionStartedAt: number | null;
  pausedElapsedSeconds: number;
  schedule: AnnouncementSlot[];
  firedSlotIds: Set<string>;
  lastAnnouncementText: string | null;
  backgroundGranted: boolean;
  lastAccuracyMeters: number | null;
  weakSignal: boolean;
  gpsDisabled: boolean;
  /** Distanz/Laufzeit beim letzten Pace-Check (Basis für den nächsten km-Split, siehe checkPaceFeedback). */
  lastPaceCheckMeters: number;
  lastPaceCheckElapsedSeconds: number;

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
  sessionStartedAt: null as number | null,
  pausedElapsedSeconds: 0,
  schedule: [] as AnnouncementSlot[],
  firedSlotIds: new Set<string>(),
  lastAnnouncementText: null as string | null,
  backgroundGranted: false,
  lastAccuracyMeters: null as number | null,
  weakSignal: false,
  gpsDisabled: false,
  lastPaceCheckMeters: 0,
  lastPaceCheckElapsedSeconds: 0,
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
      sessionStartedAt: Date.now(),
      pausedElapsedSeconds: 0,
      schedule,
      firedSlotIds: new Set(),
      lastAnnouncementText: null,
      backgroundGranted: permissions.backgroundGranted,
      lastAccuracyMeters: null,
      weakSignal: false,
      gpsDisabled: false,
      lastPaceCheckMeters: 0,
      lastPaceCheckElapsedSeconds: 0,
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
    logSessionAsActivity(get());
    set({ status: 'idle' });
  },

  reset: () => set({ ...initialSessionState, firedSlotIds: new Set(), schedule: [] }),
}));

// Fortschritts-Kategorien, deren Aussagewert rein daran hängt, WELCHER
// km-Stand aktuell ist - im Gegensatz zu einmaligen Ereignissen wie
// Verpflegung/Zieleinlauf, die unabhängig von der km-Zahl gehört werden sollen.
const PROGRESS_CATEGORIES: ReadonlySet<AnnouncementCategory> = new Set(['kmCovered', 'kmRemaining']);

function handleDistanceUpdate(
  distanceMeters: number,
  set: (partial: Partial<RaceGuideState>) => void,
  get: () => RaceGuideState,
): void {
  const state = get();
  if (state.status !== 'running') return;

  const firedSlotIds = new Set(state.firedSlotIds);
  let reachedFinish = false;

  // Bei einem GPS-Nachzügler-Schub (Hintergrund-Task liefert nach schwachem
  // Signal mehrere Punkte auf einmal, siehe locationTracker.ts) können in
  // einem einzigen Aufruf mehrere km-Marken gleichzeitig überschritten werden.
  // Würde man alle nacheinander in die Audio-Queue stellen, spricht der Guide
  // "Kilometer 3! ... Kilometer 4!" noch, während die Anzeige längst weiter
  // ist - genau das gefühlte "Ansage passt nicht zur Anzeige". Direkt
  // aufeinanderfolgende km-Marken im selben Schub werden daher zusammengefasst:
  // nur die zuletzt erreichte wird tatsächlich angesagt, die übersprungenen
  // gelten trotzdem als gefeuert (kein nachträgliches "Kilometer 3" mehr).
  const newlyCrossed: AnnouncementSlot[] = [];
  for (const slot of state.schedule) {
    if (firedSlotIds.has(slot.id)) continue;
    if (distanceMeters < slot.atDistanceMeters) continue;
    firedSlotIds.add(slot.id);
    newlyCrossed.push(slot);
  }

  for (let i = 0; i < newlyCrossed.length; i++) {
    const slot = newlyCrossed[i];
    const next = newlyCrossed[i + 1];
    if (PROGRESS_CATEGORIES.has(slot.category) && next && PROGRESS_CATEGORIES.has(next.category)) {
      continue; // von einer späteren km-Marke im selben Schub überholt
    }
    raceGuideAudioQueue.enqueue(resolveAnnouncement(slot.category, slot.km));
    if (slot.category === 'finish') reachedFinish = true;
  }

  const paceCheck = checkPaceFeedback(state, distanceMeters);

  set({ distanceMeters, firedSlotIds, ...paceCheck });
  if (reachedFinish) {
    stopGpsWatchdog();
    void stopRaceGuideTracking();
    logSessionAsActivity({ ...get(), distanceMeters });
    set({ status: 'finished' });
  }
}

/**
 * Alle wie viele Meter Fortschritt (Distanz) UND aktuelle Pace angesagt werden
 * (Uli-Wunsch 11.09.: "alle 500 Meter auf meinen Fortschritt hingewiesen" -
 * vorher lag Pace bei 2 km, wodurch sie auf kürzeren Läufen nie fiel). An
 * ganzen km-Marken (1000m, 2000m, ...) übernimmt der schon vorhandene
 * kmCovered/kmRemaining-Ansagen-Schedule die Distanz (eigene, hübschere
 * ElevenLabs-Stimme) - hier wird an diesen Marken NUR die Pace ergänzt, um
 * keine Distanz doppelt anzusagen. An den dazwischenliegenden Halb-km-Marken
 * (500m, 1500m, ...), für die es keine vorproduzierten Ansagen gibt, sagt
 * dieser Check Distanz UND Pace zusammen per On-Device-TTS an.
 */
const PROGRESS_CHECK_INTERVAL_METERS = 500;

/** "1234" -> "1,2" (deutsches Komma statt Punkt) fürs gesprochene Distanz-Fortschritt. */
function formatKmForSpeech(meters: number): string {
  return (meters / 1000).toFixed(1).replace('.', ',');
}

/**
 * Prüft alle PROGRESS_CHECK_INTERVAL_METERS Meter die tatsächliche Pace seit
 * dem letzten Check und sagt Fortschritt+Pace an. Läuft bewusst unabhängig vom
 * Ansagen-Schedule (das kennt nur feste Distanz-Slots für kmCovered/
 * kmRemaining/etc.), und wird bei schwachem GPS-Signal übersprungen - ein
 * Nachzügler-Schub nach einem Signalloch würde sonst eine falsche, extreme
 * Pace vortäuschen (dieselbe Ursache wie beim km-Ansage-Nachzügler-Fix oben).
 */
function checkPaceFeedback(
  state: RaceGuideState,
  distanceMeters: number,
): Pick<RaceGuideState, 'lastPaceCheckMeters' | 'lastPaceCheckElapsedSeconds'> {
  const noUpdate = { lastPaceCheckMeters: state.lastPaceCheckMeters, lastPaceCheckElapsedSeconds: state.lastPaceCheckElapsedSeconds };

  const currentInterval = Math.floor(distanceMeters / PROGRESS_CHECK_INTERVAL_METERS);
  const lastCheckedInterval = Math.floor(state.lastPaceCheckMeters / PROGRESS_CHECK_INTERVAL_METERS);
  if (currentInterval <= lastCheckedInterval) return noUpdate;

  const elapsedNow = currentElapsedSeconds(state);
  const distanceDelta = distanceMeters - state.lastPaceCheckMeters;
  const elapsedDelta = elapsedNow - state.lastPaceCheckElapsedSeconds;
  const updated = { lastPaceCheckMeters: distanceMeters, lastPaceCheckElapsedSeconds: elapsedNow };
  if (state.weakSignal || distanceDelta <= 0 || elapsedDelta <= 0) return updated;

  const splitPaceMps = distanceDelta / elapsedDelta;
  const paceText = `Aktuelle Pace: ${paceMpsToPerKm(splitPaceMps)} pro Kilometer.`;
  const isWholeKmCheckpoint = currentInterval % 2 === 0;
  raceGuideAudioQueue.enqueue({
    id: 'progressCheck',
    text: isWholeKmCheckpoint
      ? paceText
      : `Du hast jetzt ${formatKmForSpeech(currentInterval * PROGRESS_CHECK_INTERVAL_METERS)} Kilometer geschafft. ${paceText}`,
  });

  return updated;
}

/** Reine Hilfsfunktion für die UI: verstrichene Sekunden ohne eigenen Ticker im Store. */
export function currentElapsedSeconds(state: Pick<RaceGuideState, 'status' | 'startedAt' | 'pausedElapsedSeconds'>): number {
  if (state.status === 'running' && state.startedAt) {
    return state.pausedElapsedSeconds + (Date.now() - state.startedAt) / 1000;
  }
  return state.pausedElapsedSeconds;
}

// Kürzere Läufe/Abbrüche direkt nach dem Start nicht als Aktivität loggen -
// sonst würde ein versehentlicher Start+Beenden-Tap einen Fake-Lauf erzeugen.
const MIN_LOGGED_DISTANCE_METERS = 300;
const MIN_LOGGED_DURATION_SECONDS = 60;

/**
 * Der Audioguide war bisher eine reine Live-Begleitung ohne eigene Aufzeichnung -
 * beendete Sessions verschwanden spurlos, ohne je in `profile.ts`s `activities`
 * zu landen. Dadurch hielt z.B. `assessDetraining` (Home-Warnung "seit X Tagen
 * kein Lauf") jeden per Guide gelaufenen Lauf für nicht existent, sobald kein
 * separater FIT-Import erfolgte. Root-Fix: Sessions loggen sich beim Beenden
 * selbst als CompletedActivity (source 'app-tracked'), egal ob durch
 * Zieleinlauf oder manuelles "Beenden".
 */
function logSessionAsActivity(state: RaceGuideState): void {
  const elapsedSeconds = currentElapsedSeconds(state);
  if (state.sessionStartedAt == null) return;
  if (state.distanceMeters < MIN_LOGGED_DISTANCE_METERS || elapsedSeconds < MIN_LOGGED_DURATION_SECONDS) return;

  const activity: CompletedActivity = {
    id: `raceguide-${state.sessionStartedAt}`,
    source: 'app-tracked',
    startTime: new Date(state.sessionStartedAt).toISOString(),
    totalDistanceMeters: state.distanceMeters,
    totalDurationSeconds: Math.round(elapsedSeconds),
    avgPaceMps: state.distanceMeters / elapsedSeconds,
  };
  useProfileStore.getState().addActivity(activity);
}
