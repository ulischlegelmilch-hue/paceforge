import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { useProfileStore } from '@/store/profile';

// Wöchentlicher Rückblick jeden Sonntagabend - 1:1 dasselbe Muster wie
// dailyReminder.ts: lokale, geräteseitig geplante Benachrichtigung statt
// Server-Push (funktioniert offline, unabhängig vom Render-Free-Tier-Sleep).
// Der Inhalt (was diese Woche passiert ist) kann erst am Sonntag selbst korrekt
// berechnet werden - die Notification ist deshalb bewusst generisch und
// verlinkt in den on-demand berechneten Wochenrückblick-Screen statt Zahlen
// vorab in den Notification-Text zu schreiben.

const REVIEW_HOUR = 18;
const REVIEW_DOW = 0; // Sonntag
const ID = 'paceforge-weekly-review';

async function ensurePermissionAndChannel(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  return granted;
}

function nextSunday(hour: number, from: Date): Date {
  const d = new Date(from);
  const daysUntilSunday = (REVIEW_DOW - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

/** Plant die Sonntags-Erinnerung neu (verwirft eine evtl. bestehende, plant frisch). */
export async function scheduleWeeklyReviewNotification(): Promise<void> {
  const { profile, plan } = useProfileStore.getState();
  if (!profile || !plan) return;

  const granted = await ensurePermissionAndChannel();
  if (!granted) return;

  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'Dein Wochenrückblick ist da',
      body: 'Wie ist die Woche gelaufen? Jetzt ansehen.',
      sound: true,
      data: { screen: 'weekly-review' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextSunday(REVIEW_HOUR, new Date()) },
  });
}

let started = false;

/** Einmal beim App-Start aufrufen (siehe _layout.tsx). */
export function startWeeklyReview(): void {
  if (started) return;
  started = true;

  scheduleWeeklyReviewNotification().catch(() => {
    // Berechtigung abgelehnt oder Fehler - nächster Trigger versucht es erneut.
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  useProfileStore.subscribe((state, prev) => {
    if (state.plan !== prev.plan || state.profile !== prev.profile) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => scheduleWeeklyReviewNotification().catch(() => {}), 4000);
    }
  });

  AppState.addEventListener('change', (next) => {
    if (next === 'active') scheduleWeeklyReviewNotification().catch(() => {});
  });
}
