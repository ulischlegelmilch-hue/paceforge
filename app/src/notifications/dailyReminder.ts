import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import {
  kindLabel,
  locateByDate,
  strengthOnDay,
  weekOf,
  ymdOf,
  type AthleteProfile,
  type TrainingPlan,
} from '@paceforge/core';
import { useProfileStore } from '@/store/profile';
import { formatDistance } from '@/ui/format';

// Tägliche 6-Uhr-Erinnerung an jedes geplante Training (Lauf UND/ODER Kraft).
// Bewusst als LOKALE, geräteseitig geplante Benachrichtigung umgesetzt statt
// serverseitigem Push: braucht dafür keinerlei Internetverbindung zum
// Auslösezeitpunkt (der OS-Scheduler feuert unabhängig davon), erfüllt also
// automatisch Ulis Wunsch "sollte ich später erst Internet haben, sollte die
// Benachrichtigung nachkommen" - stärker sogar: sie verpasst nichts, wenn das
// Handy offline ist, weil sie den Server nie braucht. Einzige Voraussetzung:
// das Handy ist an und die Erinnerungen wurden VOR dem 6-Uhr-Termin geplant
// (Horizont HORIZON_DAYS Tage im Voraus, neu geplant bei jeder Plan-/Profil-
// Änderung und jedem App-Start/Vordergrund - siehe startDailyReminders()).

const REMINDER_HOUR = 6;
const HORIZON_DAYS = 14;
const ID_PREFIX = 'paceforge-reminder-';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function reminderContent(
  profile: AthleteProfile,
  plan: TrainingPlan,
  ymd: string,
): { title: string; body: string } | null {
  const loc = locateByDate(plan, ymd);
  const week = weekOf(plan, ymd);
  const dow = loc?.scheduled.dayOfWeek ?? new Date(`${ymd}T12:00:00`).getDay();
  const strength =
    week && profile.strength
      ? strengthOnDay(week, profile.strength.equipment, profile.strength.sessionsPerWeek, dow)
      : undefined;

  const status = loc?.scheduled.status;
  const hasRun = Boolean(
    loc && loc.scheduled.workout.kind !== 'rest' && status !== 'completed' && status !== 'skipped',
  );
  if (!hasRun && !strength) return null;

  const parts: string[] = [];
  if (hasRun) {
    parts.push(
      `${loc!.scheduled.workout.name} (${formatDistance(loc!.scheduled.workout.estimatedDistanceMeters ?? 0)})`,
    );
  }
  if (strength) parts.push(`Kraft: ${kindLabel(strength.kind)}`);

  return { title: 'Heute steht Training an', body: parts.join(' · ') };
}

async function ensurePermissionAndChannel(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trainingserinnerungen',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return true;
}

/** Plant die 6-Uhr-Erinnerungen für die nächsten Tage neu (verwirft alte, plant frisch). */
export async function scheduleUpcomingReminders(): Promise<void> {
  const { profile, plan } = useProfileStore.getState();
  if (!profile || !plan) return;

  const granted = await ensurePermissionAndChannel();
  if (!granted) return;

  const already = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    already.filter((n) => n.identifier.startsWith(ID_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = new Date();
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const ymd = ymdOf(day);
    const content = reminderContent(profile, plan, ymd);
    if (!content) continue;

    const fireDate = new Date(day);
    fireDate.setHours(REMINDER_HOUR, 0, 0, 0);
    if (fireDate.getTime() <= now.getTime()) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${ymd}`,
      content: { title: content.title, body: content.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
  }
}

/** Aktuelle Berechtigung, ohne den Systemdialog auszulösen (für Anzeige in "Mehr"). */
export async function getReminderPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

let started = false;

/** Einmal beim App-Start aufrufen (siehe _layout.tsx). */
export function startDailyReminders(): void {
  if (started) return;
  started = true;

  scheduleUpcomingReminders().catch(() => {
    // Berechtigung abgelehnt oder Fehler - nächster Trigger versucht es erneut.
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  useProfileStore.subscribe((state, prev) => {
    if (state.plan !== prev.plan || state.profile !== prev.profile) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => scheduleUpcomingReminders().catch(() => {}), 4000);
    }
  });

  AppState.addEventListener('change', (next) => {
    if (next === 'active') scheduleUpcomingReminders().catch(() => {});
  });
}
