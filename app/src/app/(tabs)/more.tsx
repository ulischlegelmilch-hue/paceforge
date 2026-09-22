import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/ui/colors';
import { title, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { SettingsRow } from '@/ui/components/SettingsRow';
import { useProfileStore } from '@/store/profile';
import { hasBackend } from '@/config';
import { pullSnapshot, pushSnapshot } from '@/api/sync';
import { garminDisconnect, garminLogin, getGarminStatus, type GarminStatus } from '@/api/garmin';
import { exportBackupJson, importBackupJson } from '@/delivery/exportBackup';
import { getReminderPermissionStatus, scheduleUpcomingReminders } from '@/notifications/dailyReminder';

type ExpandedSection = 'sync' | 'reminders' | 'garmin' | 'backup' | null;

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

  // Immer nur ein Abschnitt gleichzeitig offen (Akkordeon) - hält die Liste
  // kompakt, statt dass alle Formulare gleichzeitig sichtbar sind.
  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const toggle = (section: ExpandedSection) => setExpanded((s) => (s === section ? null : section));

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
        <Text style={[title, { color: p.text }]}>Mehr</Text>

        {hasBackend && (
          <SettingsRow
            icon="cloud-outline"
            title="Cloud-Sync"
            subtitle={lastSyncedAt ? `Zuletzt gesichert: ${new Date(lastSyncedAt).toLocaleString('de-DE')}` : 'Noch nicht gesichert'}
            expanded={expanded === 'sync'}
            onToggle={() => toggle('sync')}
          >
            <Text style={[caption, { color: p.subtext, marginBottom: 12 }]}>
              Gerät: {deviceId}. Läuft automatisch im Hintergrund bei Änderungen.
            </Text>
            <View style={styles.row}>
              <Button title="In Cloud sichern" onPress={() => void onSyncPush()} loading={syncBusy} style={styles.rowBtn} />
              <Button title="Aus Cloud laden" variant="secondary" onPress={onSyncPull} disabled={syncBusy} style={styles.rowBtn} />
            </View>
          </SettingsRow>
        )}

        <SettingsRow
          icon="notifications-outline"
          title="Erinnerungen"
          subtitle={
            reminderStatus === 'granted'
              ? '✓ Aktiviert'
              : reminderStatus === 'denied'
                ? 'Abgelehnt – in Handy-Einstellungen erlauben'
                : 'Noch nicht erlaubt'
          }
          expanded={expanded === 'reminders'}
          onToggle={() => toggle('reminders')}
        >
          <Text style={[caption, { color: p.subtext, marginBottom: 12 }]}>
            Täglich um 6 Uhr eine Benachrichtigung, falls Training (Lauf oder Kraft) ansteht – läuft rein lokal auf
            dem Handy, braucht dafür kein Internet.
          </Text>
          {reminderStatus !== 'granted' && (
            <Button title="Erinnerungen erlauben" onPress={() => void onEnableReminders()} loading={reminderBusy} />
          )}
        </SettingsRow>

        {hasBackend && (
          <SettingsRow
            icon="watch-outline"
            title="Garmin Connect"
            subtitle={garminStatus?.connected ? `Verbunden als ${garminStatus.username}` : 'Nicht verbunden'}
            expanded={expanded === 'garmin'}
            onToggle={() => toggle('garmin')}
          >
            {garminStatus?.connected ? (
              <>
                <Text style={[caption, { color: p.subtext, marginBottom: 12 }]}>
                  Verbunden als {garminStatus.username}
                  {garminStatus.connectedAt ? ` · seit ${new Date(garminStatus.connectedAt).toLocaleDateString('de-DE')}` : ''}
                </Text>
                <Button title="Trennen" variant="secondary" onPress={() => void onGarminDisconnect()} loading={garminBusy} />
              </>
            ) : (
              <>
                <Text style={[caption, { color: p.subtext, marginBottom: 10 }]}>
                  Workouts direkt auf die Uhr übertragen (inoffizielle Anbindung – dein Passwort wird nicht
                  gespeichert, nur die Anmeldung selbst).
                </Text>
                <TextInput
                  value={garminUsername}
                  onChangeText={setGarminUsername}
                  placeholder="Garmin-Benutzername / E-Mail"
                  placeholderTextColor={p.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { color: p.text, backgroundColor: p.surfaceRaised }]}
                />
                <TextInput
                  value={garminPassword}
                  onChangeText={setGarminPassword}
                  placeholder="Passwort"
                  placeholderTextColor={p.faint}
                  secureTextEntry
                  style={[styles.input, { color: p.text, backgroundColor: p.surfaceRaised }]}
                />
                <Button title="Verbinden" onPress={() => void onGarminConnect()} loading={garminBusy} />
              </>
            )}
          </SettingsRow>
        )}

        <SettingsRow
          icon="save-outline"
          title="Lokale Sicherung"
          subtitle="Als Datei speichern oder laden"
          expanded={expanded === 'backup'}
          onToggle={() => toggle('backup')}
        >
          <Text style={[caption, { color: p.subtext, marginBottom: 12 }]}>
            Als Datei speichern (Drive, Mail, Dateien-App, ...) – unabhängig von der Cloud, z.B. falls die mal nicht
            erreichbar ist.
          </Text>
          <View style={styles.row}>
            <Button title="Als Datei sichern" onPress={() => void onExportBackup()} loading={backupBusy} style={styles.rowBtn} />
            <Button title="Aus Datei laden" variant="secondary" onPress={() => void onImportBackup()} disabled={backupBusy} style={styles.rowBtn} />
          </View>
        </SettingsRow>

        <Pressable onPress={() => router.push('/about')}>
          <Card style={styles.linkRow}>
            <Text style={[bodyStrong, { color: p.text }]}>Über & Quellen</Text>
            <Text style={{ color: p.subtext }}>›</Text>
          </Card>
        </Pressable>

        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={[caption, { color: p.subtext }]}>Angaben zurücksetzen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  rowBtn: { flex: 1, minHeight: 48 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resetBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
});
