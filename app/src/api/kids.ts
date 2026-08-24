import { API_BASE_URL } from '@/config';

// Liest Max' aktuell eingestelltes Training (PaceForge Kids, separate native App)
// über den einmalig ausgetauschten Kopplungs-Code - siehe server/src/kids.ts.

export interface PlannedTraining {
  opponentCharacterId: string | null;
  opponentName: string | null;
  targetPaceSecPerKm: number | null;
  intervalRunSeconds: number | null;
  intervalWalkSeconds: number | null;
  distanceGoalMeters: number | null;
  updatedAt: string;
}

export async function fetchMaxPlannedTraining(childId: string): Promise<PlannedTraining | null> {
  const res = await fetch(`${API_BASE_URL}/api/kids/${encodeURIComponent(childId)}/planned-training`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Max' Training abrufen fehlgeschlagen (HTTP ${res.status}).`);
  return (await res.json()) as PlannedTraining;
}
