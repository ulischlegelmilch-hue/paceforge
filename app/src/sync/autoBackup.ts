import { AppState } from 'react-native';
import { useProfileStore } from '@/store/profile';
import { pushSnapshot } from '@/api/sync';
import { hasBackend } from '@/config';

// Automatische Cloud-Sicherung: debounced bei jeder Änderung an Profil/Plan/
// Aktivitäten + sofort beim Verlassen der App (Background/Inactive), damit Timer
// nicht mitten in der Sicherung vom OS pausiert werden. Der manuelle "In Cloud
// sichern"-Button in Mehr bleibt zusätzlich bestehen (u.a. für den "Überschreiben"-
// Fall bei einem Konflikt).
const DEBOUNCE_MS = 8000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pendingRetry = false;

function flush(): void {
  if (!hasBackend) return;
  const { profile, plan, activities, deviceId, lastSyncedAt, setLastSyncedAt } = useProfileStore.getState();
  if (!profile || !plan) return;
  if (pushing) {
    pendingRetry = true;
    return;
  }
  pushing = true;
  pushSnapshot(deviceId, { profile, plan, activities }, { baseUpdatedAt: lastSyncedAt })
    .then((res) => {
      if (res.status === 'ok') setLastSyncedAt(res.updatedAt);
      // Bei Konflikt (anderes Gerät hat zuletzt geschrieben) NICHT automatisch
      // überschreiben - der Nutzer löst das bewusst über "In Cloud sichern" in Mehr.
    })
    .catch(() => {
      // Netzwerk/Server nicht erreichbar - nächster Änderungs- oder Foreground-
      // Trigger versucht es erneut, kein Retry-Loop nötig.
    })
    .finally(() => {
      pushing = false;
      if (pendingRetry) {
        pendingRetry = false;
        flush();
      }
    });
}

function scheduleFlush(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

let started = false;

/** Einmal beim App-Start aufrufen (siehe _layout.tsx). */
export function startAutoBackup(): void {
  if (started || !hasBackend) return;
  started = true;

  useProfileStore.subscribe((state, prevState) => {
    if (
      state.profile !== prevState.profile ||
      state.plan !== prevState.plan ||
      state.activities !== prevState.activities
    ) {
      scheduleFlush();
    }
  });

  AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') {
      if (timer) clearTimeout(timer);
      flush();
    }
  });
}
