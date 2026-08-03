import type { AthleteProfile, CompletedActivity, TrainingPlan } from '@paceforge/core';
import { API_BASE_URL } from '@/config';

export interface Snapshot {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
  updatedAt?: string;
}

/**
 * Ergebnis des Sicherns. `conflict` heißt: in der Cloud liegt ein Stand, den
 * dieses Gerät nicht kennt (ein anderes Gerät hat geschrieben). Der Serverstand
 * kommt mit, damit die UI die Wahl anbieten kann: laden oder überschreiben.
 */
export type PushResult =
  | { status: 'ok'; updatedAt: string }
  | { status: 'conflict'; serverUpdatedAt: string; snapshot: Snapshot };

// Snapshot (Profil + Plan + Aktivitäten) unter der Geräte-ID in der Cloud ablegen.
// `baseUpdatedAt` = Stand, auf dem dieses Gerät aufsetzt; `force` überschreibt bewusst.
export async function pushSnapshot(
  id: string,
  snap: Omit<Snapshot, 'updatedAt'>,
  opts: { baseUpdatedAt?: string | null; force?: boolean } = {},
): Promise<PushResult> {
  const query = opts.force ? '?force=1' : '';
  const res = await fetch(`${API_BASE_URL}/api/sync/${encodeURIComponent(id)}${query}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...snap, baseUpdatedAt: opts.baseUpdatedAt ?? null }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { serverUpdatedAt: string; snapshot: Snapshot };
    return { status: 'conflict', serverUpdatedAt: body.serverUpdatedAt, snapshot: body.snapshot };
  }
  if (!res.ok) throw new Error(`Sichern fehlgeschlagen (HTTP ${res.status}).`);
  const body = (await res.json()) as { updatedAt: string };
  return { status: 'ok', updatedAt: body.updatedAt };
}

// Snapshot aus der Cloud holen (null, wenn keiner existiert).
export async function pullSnapshot(id: string): Promise<Snapshot | null> {
  const res = await fetch(`${API_BASE_URL}/api/sync/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Laden fehlgeschlagen (HTTP ${res.status}).`);
  return (await res.json()) as Snapshot;
}
