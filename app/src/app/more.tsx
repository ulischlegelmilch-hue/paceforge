import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';
import { hasBackend } from '@/config';
import { pullSnapshot, pushSnapshot } from '@/api/sync';
import { garminDisconnect, garminLogin, getGarminStatus, type GarminStatus } from '@/api/garmin';

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

  const [garminStatus, setGarminStatus] = useState<GarminStatus | null>(null);
  const [garminBusy, setGarminBusy] = useState(false);
  const [garminUsername, setGarminUsername] = useState('');
  const [garminPassword, setGarminPassword] = useState('');

  useEffect(() => {
    if (!hasBackend) return;
    void getGarminStatus(deviceId)
      .then(setGarminStatus)
      .catch(() => setGarminStatus(null));
  }, [deviceId]);

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
