import type { AthleteProfile, CompletedActivity, TrainingPlan } from '@paceforge/core';
import { API_BASE_URL } from '@/config';

export interface Snapshot {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
  updatedAt?: string;
}

// Snapshot (Profil + Plan + Aktivitäten) unter der Geräte-ID in der Cloud ablegen.
export async function pushSnapshot(id: string, snap: Omit<Snapshot, 'updatedAt'>): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/sync/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snap),
  });
  if (!res.ok) throw new Error(`Sichern fehlgeschlagen (HTTP ${res.status}).`);
  const body = (await res.json()) as { updatedAt: string };
  return body.updatedAt;
}

// Snapshot aus der Cloud holen (null, wenn keiner existiert).
export async function pullSnapshot(id: string): Promise<Snapshot | null> {
  const res = await fetch(`${API_BASE_URL}/api/sync/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Laden fehlgeschlagen (HTTP ${res.status}).`);
  return (await res.json()) as Snapshot;
}
