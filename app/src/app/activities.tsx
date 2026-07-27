import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { compareWorkout, matchActivity, paceMpsToPerKm, suggestAdaptation } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { assessmentColor, assessmentLabel, formatDistance, formatDuration } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { pickAndDecodeActivity } from '@/delivery/importActivity';

export default function ActivitiesScreen() {
  const p = usePalette();
  const router = useRouter();
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);
  const addActivity = useProfileStore((s) => s.addActivity);
  const applyAdaptation = useProfileStore((s) => s.applyAdaptation);
  const [busy, setBusy] = useState(false);

  const adaptation = useMemo(
    () => (plan ? suggestAdaptation(plan, activities) : null),
    [plan, activities],
  );

  async function onImport() {
    try {
      setBusy(true);
      const activity = await pickAndDecodeActivity();
      if (activity) addActivity(activity);
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...activities].sort((a, b) => b.startTime.localeCompare(a.startTime));

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Fortschritt</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          Importiere absolvierte Läufe (FIT) – dein Plan passt sich an.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={onImport}
          disabled={busy}
          style={({ pressed }) => [
            styles.importBtn,
            { backgroundColor: p.accent, opacity: pressed || busy ? 0.7 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={p.accentText} />
          ) : (
            <Text style={[styles.importText, { color: p.accentText }]}>Lauf-Datei importieren</Text>
          )}
        </Pressable>

        {adaptation && (
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <Text style={[styles.cardTitle, { color: p.text }]}>Anpassung</Text>
            {adaptation.notes.map((n, i) => (
              <Text key={i} style={[styles.note, { color: p.subtext }]}>
                • {n}
              </Text>
            ))}
            {(adaptation.recommendedVdotDelta !== 0 || adaptation.reduceNextWeekVolume) && (
              <Pressable
                onPress={() => {
                  applyAdaptation(adaptation);
                  Alert.alert('Plan angepasst', 'Dein Trainingsplan wurde aktualisiert.');
                }}
                style={({ pressed }) => [
                  styles.applyBtn,
                  { borderColor: p.accent, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.applyText, { color: p.accent }]}>Plan anpassen</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: p.text }]}>
          Importierte Läufe ({activities.length})
        </Text>

        {sorted.length === 0 ? (
          <Text style={[styles.empty, { color: p.subtext }]}>Noch keine Läufe importiert.</Text>
        ) : (
          sorted.map((a) => {
            const matched = plan ? matchActivity(plan, a) : undefined;
            const assessment = matched ? compareWorkout(matched.workout, a).assessment : undefined;
            return (
              <View key={a.id} style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.date, { color: p.text }]}>
                    {new Date(a.startTime).toLocaleDateString('de-DE')}
                  </Text>
                  {assessment && (
                    <View style={[styles.badge, { backgroundColor: assessmentColor(assessment) }]}>
                      <Text style={styles.badgeText}>{assessmentLabel(assessment)}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.stats, { color: p.subtext }]}>
                  {formatDistance(a.totalDistanceMeters)} · {formatDuration(a.totalDurationSeconds)} ·{' '}
                  {paceMpsToPerKm(a.avgPaceMps)} /km
                  {a.avgHeartRate ? ` · ⌀ ${a.avgHeartRate} bpm` : ''}
                </Text>
                {(a.gradeAdjustedDistanceMeters || a.totalAscentMeters) && (
                  <Text style={[styles.matchNote, { color: p.subtext }]}>
                    {a.totalAscentMeters ? `⛰ ${a.totalAscentMeters} Hm` : ''}
                    {a.gradeAdjustedDistanceMeters
                      ? `${a.totalAscentMeters ? ' · ' : ''}flach-äquiv. ${formatDistance(a.gradeAdjustedDistanceMeters)} (Bewertung höhenkorrigiert)`
                      : ' · Bewertung höhenkorrigiert'}
                  </Text>
                )}
                {matched && (
                  <Text style={[styles.matchNote, { color: p.subtext }]}>
                    geplant: {matched.workout.name}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 2 },
  back: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 14, lineHeight: 20 },
  scroll: { padding: 20, paddingTop: 4, gap: 14 },
  importBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  importText: { fontSize: 17, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 14, lineHeight: 20 },
  applyBtn: { marginTop: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  applyText: { fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  empty: { fontSize: 15, paddingVertical: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 16, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stats: { fontSize: 14, fontVariant: ['tabular-nums'] },
  matchNote: { fontSize: 13 },
});
