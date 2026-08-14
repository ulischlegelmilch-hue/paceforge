import type { Workout } from '@paceforge/core';
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
