import { API_BASE_URL } from '@/config';

// "Live mithören": pollt Max' gerade gesprochene Audio-Coach-Ansagen (PaceForge
// Kids, separate native App) über denselben Kopplungs-Code wie planned-training -
// siehe server/src/liveEvents.ts.

export interface LiveEvent {
  seq: number;
  category: string;
  text: string;
  createdAtMillis: number;
}

export async function fetchLiveEventsSince(childId: string, sinceSeq: number): Promise<LiveEvent[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/kids/${encodeURIComponent(childId)}/live-events?since=${sinceSeq}`,
  );
  if (!res.ok) throw new Error(`Live-Ansagen abrufen fehlgeschlagen (HTTP ${res.status}).`);
  const body = (await res.json()) as { events: LiveEvent[] };
  return body.events;
}
