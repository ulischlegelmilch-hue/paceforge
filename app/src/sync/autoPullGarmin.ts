import { AppState } from 'react-native';
import { useProfileStore } from '@/store/profile';
import { fetchGarminActivities } from '@/api/garmin';
import { hasBackend } from '@/config';

// Automatischer Garmin-Aktivitäts-Abruf: holt beim App-Start und jedes Mal,
// wenn die App wieder in den Vordergrund kommt (typischer Moment: Nutzer öffnet
// die App nach einem Lauf), neue Läufe vom Garmin-Konto und übernimmt sie in
// den Store - ohne manuellen FIT-Export/-Import. Der bestehende manuelle
// FIT-Import (importActivity.ts) bleibt als Fallback bestehen (andere Uhren,
// Garmin nicht verbunden). Läuft ins Leere (kein Fehler sichtbar), wenn kein
// Backend konfiguriert oder kein Garmin-Konto verbunden ist (Server liefert
// dann einfach 404, siehe server/src/garmin.ts).

let pulling = false;

/**
 * Holt neue Läufe seit dem letzten Abruf und übernimmt sie dedupliziert in
 * den Store. Gibt die Anzahl neu übernommener Läufe zurück. Wirft bei Netzwerk-/
 * Server-Fehlern (z. B. nicht verbunden) - Aufrufer entscheidet, ob das dem
 * Nutzer angezeigt oder still verschluckt wird.
 */
export async function pullGarminActivities(): Promise<number> {
  if (pulling) return 0;
  pulling = true;
  try {
    const { deviceId, garminLastPullAt, addActivities, setGarminLastPullAt } = useProfileStore.getState();
    const pulled = await fetchGarminActivities(deviceId, garminLastPullAt ?? undefined);
    const before = useProfileStore.getState().activities;
    const existingIds = new Set(before.map((a) => a.id));
    const fresh = pulled.filter((a) => !existingIds.has(a.id));
    if (fresh.length === 0) return 0;

    addActivities(fresh);
    const latest = fresh.reduce((max, a) => (a.startTime > max ? a.startTime : max), garminLastPullAt ?? '');
    setGarminLastPullAt(latest);
    return fresh.length;
  } finally {
    pulling = false;
  }
}

let started = false;

/** Einmal beim App-Start aufrufen (siehe _layout.tsx). */
export function startAutoPullGarmin(): void {
  if (started || !hasBackend) return;
  started = true;

  pullGarminActivities().catch(() => {
    // Beim Kaltstart still verschlucken (kein Garmin verbunden ist der Normalfall).
  });

  AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      pullGarminActivities().catch(() => {
        // Nächster Foreground-Trigger versucht es erneut, kein Retry-Loop nötig.
      });
    }
  });
}
