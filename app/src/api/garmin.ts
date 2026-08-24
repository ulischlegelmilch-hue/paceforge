import type { CompletedActivity, Workout } from '@paceforge/core';
import { API_BASE_URL } from '@/config';

export interface GarminStatus {
  configured: boolean;
  connected: boolean;
  username?: string | null;
  connectedAt?: string | null;
}

export async function getGarminStatus(deviceId: string): Promise<GarminStatus> {
  const res = await fetch(`${API_BASE_URL}/api/garmin/status?deviceId=${encodeURIComponent(deviceId)}`);
  if (!res.ok) throw new Error(`Garmin-Status abrufen fehlgeschlagen (HTTP ${res.status}).`);
  return (await res.json()) as GarminStatus;
}

// Passwort verlässt den Speicher NICHT dauerhaft: es geht einmalig an den
// Server, der sich damit bei Garmin anmeldet und nur die Session-Tokens
// (verschlüsselt) ablegt - siehe server/src/garmin.ts.
export async function garminLogin(deviceId: string, username: string, password: string): Promise<{ username: string }> {
  const res = await fetch(`${API_BASE_URL}/api/garmin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, username, password }),
  });
  const body = (await res.json()) as { username?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Garmin-Anmeldung fehlgeschlagen (HTTP ${res.status}).`);
  return { username: body.username ?? username };
}

export async function garminDisconnect(deviceId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/garmin/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  if (!res.ok) throw new Error(`Garmin trennen fehlgeschlagen (HTTP ${res.status}).`);
}

export async function garminPushWorkout(
  deviceId: string,
  workout: Workout,
  date: string,
): Promise<{ workoutId: number | string; scheduledDate: string }> {
  const res = await fetch(`${API_BASE_URL}/api/garmin/push-workout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, workout, date }),
  });
  const body = (await res.json()) as { workoutId?: number | string; scheduledDate?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Übertragung an Garmin fehlgeschlagen (HTTP ${res.status}).`);
  return { workoutId: body.workoutId!, scheduledDate: body.scheduledDate! };
}

// Holt absolvierte Läufe direkt von Garmin Connect (server/src/garmin.ts,
// getActivities() der inoffiziellen Bibliothek) - Alternative zum manuellen
// FIT-Datei-Import in importActivity.ts, ohne Datei-Export vom Nutzer.
// `sinceIso` grenzt auf Läufe NACH diesem Zeitpunkt ein (Cursor im Store).
export async function fetchGarminActivities(
  deviceId: string,
  sinceIso?: string,
): Promise<CompletedActivity[]> {
  const params = new URLSearchParams({ deviceId });
  if (sinceIso) params.set('sinceIso', sinceIso);
  const res = await fetch(`${API_BASE_URL}/api/garmin/activities?${params.toString()}`);
  const body = (await res.json()) as { activities?: CompletedActivity[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Garmin-Läufe abrufen fehlgeschlagen (HTTP ${res.status}).`);
  return body.activities ?? [];
}

// Einmaliger Vollimport der Garmin-Historie (server/src/garmin.ts,
// /api/garmin/activities/backfill) - im Unterschied zu fetchGarminActivities()
// nicht auf die letzten ≤50 Läufe begrenzt, sondern paginiert über mehrere
// Seiten. Kann je nach Kontohistorie einige Sekunden dauern.
export async function fetchGarminActivitiesBackfill(deviceId: string): Promise<CompletedActivity[]> {
  const params = new URLSearchParams({ deviceId });
  const res = await fetch(`${API_BASE_URL}/api/garmin/activities/backfill?${params.toString()}`);
  const body = (await res.json()) as { activities?: CompletedActivity[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Garmin-Verlauf importieren fehlgeschlagen (HTTP ${res.status}).`);
  return body.activities ?? [];
}
