import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';
import { hasBackend } from '@/config';
import { pullSnapshot, pushSnapshot } from '@/api/sync';
import { garminDisconnect, garminLogin, getGarminStatus, type GarminStatus } from '@/api/garmin';
import { exportBackupJson, importBackupJson } from '@/delivery/exportBackup';
import { getReminderPermissionStatus, scheduleUpcomingReminders } from '@/notifications/dailyReminder';

// Konsolidiert Cloud-Sync, Zurücksetzen und "Über & Quellen" – vorher lange
// Einzel-Buttons am Ende der Home-Seite, jetzt über das Zahnrad im Header erreichbar.
export default function MoreScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);
  const deviceId = useProfileStore((s) => s.deviceId);
  const hydrateFromSnapshot = useProfileStore((s) => s.hydrateFromSnapshot);
  const lastSyncedAt = useProfileStore((s) => s.lastSyncedAt);
  const setLastSyncedAt = useProfileStore((s) => s.setLastSyncedAt);
  const reset = useProfileStore((s) => s.reset);
  const [syncBusy, setSyncBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const [garminStatus, setGarminStatus] = useState<GarminStatus | null>(null);
  const [garminBusy, setGarminBusy] = useState(false);
  const [garminUsername, setGarminUsername] = useState('');
  const [garminPassword, setGarminPassword] = useState('');

  const [reminderStatus, setReminderStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    if (!hasBackend) return;
    void getGarminStatus(deviceId)
      .then(setGarminStatus)
      .catch(() => setGarminStatus(null));
  }, [deviceId]);

  useEffect(() => {
    void getReminderPermissionStatus().then(setReminderStatus).catch(() => setReminderStatus(null));
  }, []);

  async function onEnableReminders() {
    try {
      setReminderBusy(true);
      await scheduleUpcomingReminders();
      const status = await getReminderPermissionStatus();
      setReminderStatus(status);
      if (status !== 'granted') {
        Alert.alert(
          'Keine Berechtigung',
          'Benachrichtigungen wurden nicht erlaubt. Bitte in den Handy-Einstellungen für PaceForge aktivieren.',
        );
      }
    } catch (e) {
      Alert.alert('Fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setReminderBusy(false);
    }
  }

  async function onGarminConnect() {
    if (!garminUsername.trim() || !garminPassword) {
      Alert.alert('Angaben fehlen', 'Bitte Garmin-Benutzername und Passwort eingeben.');
      return;
    }
    try {
      setGarminBusy(true);
      await garminLogin(deviceId, garminUsername.trim(), garminPassword);
      setGarminPassword('');
      const status = await getGarminStatus(deviceId);
      setGarminStatus(status);
      Alert.alert('Verbunden', 'Garmin Connect ist jetzt verbunden. Workouts lassen sich direkt auf die Uhr übertragen.');
    } catch (e) {
      Alert.alert('Verbindung fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setGarminBusy(false);
    }
  }

  async function onGarminDisconnect() {
    try {
      setGarminBusy(true);
      await garminDisconnect(deviceId);
      const status = await getGarminStatus(deviceId);
      setGarminStatus(status);
    } catch (e) {
      Alert.alert('Trennen fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setGarminBusy(false);
    }
  }

  async function onSyncPush(force = false) {
    try {
      setSyncBusy(true);
      const res = await pushSnapshot(
        deviceId,
        { profile, plan, activities },
        { baseUpdatedAt: lastSyncedAt, force },
      );
      if (res.status === 'conflict') {
        const serverTime = new Date(res.serverUpdatedAt).toLocaleString('de-DE');
        Alert.alert(
          'Anderer Stand in der Cloud',
          `In der Cloud liegt ein Stand von ${serverTime}, den dieses Gerät noch nicht kennt.`,
          [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Cloud laden',
              onPress: () => {
                hydrateFromSnapshot({
                  profile: res.snapshot.profile,
                  plan: res.snapshot.plan,
                  activities: res.snapshot.activities ?? [],
                  updatedAt: res.serverUpdatedAt,
                });
              },
            },
            { text: 'Überschreiben', style: 'destructive', onPress: () => void onSyncPush(true) },
          ],
        );
        return;
      }
      setLastSyncedAt(res.updatedAt);
      Alert.alert('In Cloud gesichert', `Stand: ${new Date(res.updatedAt).toLocaleString('de-DE')}`);
    } catch (e) {
      Alert.alert('Sichern fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setSyncBusy(false);
    }
  }
  async function onSyncPull() {
    try {
      setSyncBusy(true);
      const snap = await pullSnapshot(deviceId);
      if (!snap) {
        Alert.alert('Nichts gefunden', 'Für dieses Gerät liegt noch kein Cloud-Stand vor.');
        return;
      }
      hydrateFromSnapshot({
        profile: snap.profile,
        plan: snap.plan,
        activities: snap.activities ?? [],
        ...(snap.updatedAt ? { updatedAt: snap.updatedAt } : {}),
      });
      Alert.alert('Aus Cloud geladen', 'Deine Daten wurden übernommen.');
    } catch (e) {
      Alert.alert('Laden fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setSyncBusy(false);
    }
  }

  async function onExportBackup() {
    try {
      setBackupBusy(true);
      await exportBackupJson(profile, plan, activities);
    } catch (e) {
      Alert.alert('Sicherung fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function onImportBackup() {
    try {
      setBackupBusy(true);
      const backup = await importBackupJson();
      if (!backup) return; // Auswahl abgebrochen
      Alert.alert(
        'Sicherung wiederherstellen?',
        `Sicherung vom ${new Date(backup.exportedAt).toLocaleString('de-DE')} überschreibt deine aktuellen Daten auf diesem Gerät.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Wiederherstellen',
            style: 'destructive',
            onPress: () =>
              hydrateFromSnapshot({ profile: backup.profile, plan: backup.plan, activities: backup.activities }),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Wiederherstellen fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Mehr</Text>

        {hasBackend && (
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <Text style={[styles.cardLabel, { color: p.subtext }]}>Cloud-Sync</Text>
            <Text style={[styles.syncId, { color: p.subtext }]}>Gerät: {deviceId}</Text>
            <Text style={[styles.syncId, { color: p.subtext }]}>
              Läuft automatisch im Hintergrund bei Änderungen.{' '}
              {lastSyncedAt
                ? `Zuletzt gesichert: ${new Date(lastSyncedAt).toLocaleString('de-DE')}`
                : 'Noch nicht gesichert'}
            </Text>
            <View style={styles.syncRow}>
              <Pressable
                onPress={() => void onSyncPush()}
                disabled={syncBusy}
                style={[styles.syncBtn, { backgroundColor: p.accent, opacity: syncBusy ? 0.6 : 1 }]}
              >
                {syncBusy ? (
                  <ActivityIndicator color={p.accentText} />
                ) : (
                  <Text style={[styles.syncBtnText, { color: p.accentText }]}>In Cloud sichern</Text>
                )}
              </Pressable>
              <Pressable
                onPress={onSyncPull}
                disabled={syncBusy}
                style={[styles.syncBtnOutline, { borderColor: p.accent, opacity: syncBusy ? 0.6 : 1 }]}
              >
                <Text style={[styles.syncBtnText, { color: p.accent }]}>Aus Cloud laden</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>Erinnerungen</Text>
          <Text style={[styles.syncId, { color: p.subtext, marginBottom: 12 }]}>
            Täglich um 6 Uhr eine Benachrichtigung, falls Training (Lauf oder Kraft) ansteht – läuft rein lokal auf
            dem Handy, braucht dafür kein Internet.
          </Text>
          <Text style={[styles.syncId, { color: p.subtext, marginBottom: 12 }]}>
            {reminderStatus === 'granted'
              ? '✓ Aktiviert.'
              : reminderStatus === 'denied'
                ? 'Abgelehnt – bitte in den Handy-Einstellungen für PaceForge erlauben.'
                : 'Noch nicht erlaubt.'}
          </Text>
          {reminderStatus !== 'granted' && (
            <Pressable
              onPress={() => void onEnableReminders()}
              disabled={reminderBusy}
              style={[styles.syncBtn, { backgroundColor: p.accent, opacity: reminderBusy ? 0.6 : 1 }]}
            >
              {reminderBusy ? (
                <ActivityIndicator color={p.accentText} />
              ) : (
                <Text style={[styles.syncBtnText, { color: p.accentText }]}>Erinnerungen erlauben</Text>
              )}
            </Pressable>
          )}
        </View>

        {hasBackend && (
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <Text style={[styles.cardLabel, { color: p.subtext }]}>Garmin Connect</Text>
            {garminStatus?.connected ? (
              <>
                <Text style={[styles.syncId, { color: p.subtext }]}>
                  Verbunden als {garminStatus.username}
                  {garminStatus.connectedAt ? ` · seit ${new Date(garminStatus.connectedAt).toLocaleDateString('de-DE')}` : ''}
                </Text>
                <Pressable
                  onPress={() => void onGarminDisconnect()}
                  disabled={garminBusy}
                  style={[styles.syncBtnOutline, { borderColor: p.accent, opacity: garminBusy ? 0.6 : 1 }]}
                >
                  {garminBusy ? (
                    <ActivityIndicator color={p.accent} />
                  ) : (
                    <Text style={[styles.syncBtnText, { color: p.accent }]}>Trennen</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.syncId, { color: p.subtext, marginBottom: 10 }]}>
                  Workouts direkt auf die Uhr übertragen (inoffizielle Anbindung – dein Passwort wird nicht
                  gespeichert, nur die Anmeldung selbst).
                </Text>
                <TextInput
                  value={garminUsername}
                  onChangeText={setGarminUsername}
                  placeholder="Garmin-Benutzername / E-Mail"
                  placeholderTextColor={p.subtext}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <TextInput
                  value={garminPassword}
                  onChangeText={setGarminPassword}
                  placeholder="Passwort"
                  placeholderTextColor={p.subtext}
                  secureTextEntry
                  style={[styles.input, { color: p.text, borderColor: p.border }]}
                />
                <Pressable
                  onPress={() => void onGarminConnect()}
                  disabled={garminBusy}
                  style={[styles.syncBtn, { backgroundColor: p.accent, opacity: garminBusy ? 0.6 : 1 }]}
                >
                  {garminBusy ? (
                    <ActivityIndicator color={p.accentText} />
                  ) : (
                    <Text style={[styles.syncBtnText, { color: p.accentText }]}>Verbinden</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>Lokale Sicherung</Text>
          <Text style={[styles.syncId, { color: p.subtext, marginBottom: 12 }]}>
            Als Datei speichern (Drive, Mail, Dateien-App, ...) – unabhängig von der Cloud, z.B. falls die mal nicht
            erreichbar ist.
          </Text>
          <View style={styles.syncRow}>
            <Pressable
              onPress={() => void onExportBackup()}
              disabled={backupBusy}
              style={[styles.syncBtn, { backgroundColor: p.accent, opacity: backupBusy ? 0.6 : 1 }]}
            >
              {backupBusy ? (
                <ActivityIndicator color={p.accentText} />
              ) : (
                <Text style={[styles.syncBtnText, { color: p.accentText }]}>Als Datei sichern</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void onImportBackup()}
              disabled={backupBusy}
              style={[styles.syncBtnOutline, { borderColor: p.accent, opacity: backupBusy ? 0.6 : 1 }]}
            >
              <Text style={[styles.syncBtnText, { color: p.accent }]}>Aus Datei laden</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/about')}
          style={[styles.rowBtn, { backgroundColor: p.card, borderColor: p.border }]}
        >
          <Text style={[styles.rowText, { color: p.text }]}>Über & Quellen</Text>
          <Text style={{ color: p.subtext }}>›</Text>
        </Pressable>

        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: p.subtext }]}>Angaben zurücksetzen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', marginTop: 2, marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  cardLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  syncId: { fontSize: 12, marginTop: 4, marginBottom: 12, fontVariant: ['tabular-nums'] },
  syncRow: { flexDirection: 'row', gap: 10 },
  syncBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  syncBtnOutline: { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  syncBtnText: { fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  rowBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowText: { fontSize: 15, fontWeight: '600' },
  resetBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 8 },
  resetText: { fontSize: 14 },
});
