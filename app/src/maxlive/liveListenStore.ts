import { create } from 'zustand';

import { fetchLiveEventsSince, type LiveEvent } from '@/api/liveEvents';
import { liveAudioQueue } from './liveAudioQueue';

// Nicht-persistenter Session-Store für "Papa hört live mit" - gleiche Familie wie
// raceguide/runSessionStore.ts, aber ohne GPS: pollt Max' Live-Ansagen und spricht
// jede neue über liveAudioQueue nach.

const POLL_INTERVAL_MS = 5000;

export type LiveListenStatus = 'idle' | 'listening';

interface LiveListenState {
  status: LiveListenStatus;
  lastSeq: number;
  events: LiveEvent[];
  start: (childId: string) => void;
  stop: () => void;
}

let pollTimeout: ReturnType<typeof setTimeout> | null = null;

function stopPolling(): void {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

export const useLiveListenStore = create<LiveListenState>()((set, get) => ({
  status: 'idle',
  lastSeq: 0,
  events: [],

  start: (childId: string) => {
    stopPolling();
    set({ status: 'listening', lastSeq: 0, events: [] });

    // Rekursives setTimeout statt setInterval: verhindert überlappende GETs,
    // falls ein Poll wegen eines Render-Kaltstarts (bis zu 45s) lange braucht.
    const poll = async () => {
      if (get().status !== 'listening') return;
      try {
        const newEvents = await fetchLiveEventsSince(childId, get().lastSeq);
        if (newEvents.length > 0) {
          set((s) => ({
            events: [...s.events, ...newEvents],
            lastSeq: Math.max(s.lastSeq, ...newEvents.map((e) => e.seq)),
          }));
          for (const event of newEvents) liveAudioQueue.enqueue(event.text);
        }
      } catch {
        // Still bei Fehlern - kein Alert pro fehlgeschlagenem Poll, nächster
        // Versuch kommt automatisch in POLL_INTERVAL_MS.
      }
      if (get().status === 'listening') {
        pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    void poll();
  },

  stop: () => {
    stopPolling();
    liveAudioQueue.clear();
    set({ status: 'idle' });
  },
}));
