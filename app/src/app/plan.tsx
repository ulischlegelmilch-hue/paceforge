import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { strengthScheduleForWeek } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { DOW_SHORT, formatDistance, phaseColor, phaseLabel } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { exportPlanIcs } from '@/delivery/exportPlanIcs';

export default function PlanScreen() {
  const p = usePalette();
  const router = useRouter();
  const plan = useProfileStore((s) => s.plan);
  const profile = useProfileStore((s) => s.profile);
  const eq = profile?.strength?.equipment ?? 'bodyweight';
  const spw = profile?.strength?.sessionsPerWeek ?? 2;
  const [icsBusy, setIcsBusy] = useState(false);

  async function onExportIcs() {
    if (!plan) return;
    try {
      setIcsBusy(true);
      await exportPlanIcs(plan, { equipment: eq, sessionsPerWeek: spw });
    } catch (e) {
      Alert.alert('Export fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setIcsBusy(false);
    }
  }

  if (!plan) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: p.subtext }]}>Noch kein Plan vorhanden.</Text>
          <Pressable onPress={() => router.replace('/')} style={[styles.cta, { backgroundColor: p.accent }]}>
            <Text style={[styles.ctaText, { color: p.accentText }]}>Zur Startseite</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Dein Trainingsplan</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>{plan.weeks.length} Wochen</Text>
        <Pressable
          onPress={onExportIcs}
          disabled={icsBusy}
          style={({ pressed }) => [styles.icsBtn, { borderColor: p.accent, opacity: pressed || icsBusy ? 0.6 : 1 }]}
        >
          {icsBusy ? (
            <ActivityIndicator color={p.accent} />
          ) : (
            <Text style={[styles.icsText, { color: p.accent }]}>📅 In Kalender exportieren (.ics)</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {plan.weeks.map((week) => {
          const training = week.workouts.filter((w) => w.workout.kind !== 'rest');
          const strengthDays = new Set(strengthScheduleForWeek(week, eq, spw).map((s) => s.dayOfWeek));
          return (
            <View key={week.index} style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
              <View style={styles.weekHead}>
                <Text style={[styles.weekTitle, { color: p.text }]}>Woche {week.index + 1}</Text>
                <View style={[styles.badge, { backgroundColor: phaseColor(week.phase) }]}>
                  <Text style={styles.badgeText}>{phaseLabel(week.phase)}</Text>
                </View>
              </View>
              <Text style={[styles.volume, { color: p.subtext }]}>
                {formatDistance(week.targetWeeklyDistanceMeters)} geplant
              </Text>

              {training.map((sw) => (
                <Pressable
                  key={sw.date}
                  onPress={() => router.push({ pathname: '/workout', params: { week: week.index, day: sw.dayOfWeek } })}
                  style={({ pressed }) => [styles.dayRow, { borderTopColor: p.border, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.dow, { color: p.subtext }]}>{DOW_SHORT[sw.dayOfWeek]}</Text>
                  <Text style={[styles.woName, { color: p.text }]} numberOfLines={1}>
                    {sw.workout.name}
                  </Text>
                  {strengthDays.has(sw.dayOfWeek) && (
                    <Text style={[styles.kraftTag, { color: p.accent, borderColor: p.accent }]}>Kraft</Text>
                  )}
                  <Text style={[styles.woDist, { color: p.subtext }]}>
                    {formatDistance(sw.workout.estimatedDistanceMeters ?? 0)}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 2 },
  back: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 14 },
  scroll: { padding: 20, paddingTop: 4, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekTitle: { fontSize: 17, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  volume: { fontSize: 13, marginTop: 2, marginBottom: 6 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  dow: { width: 26, fontSize: 14, fontWeight: '700' },
  woName: { flex: 1, fontSize: 15, fontWeight: '600' },
  woDist: { fontSize: 14, fontVariant: ['tabular-nums'] },
  kraftTag: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  icsBtn: { marginTop: 10, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  icsText: { fontSize: 15, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  emptyText: { fontSize: 16 },
  cta: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22 },
  ctaText: { fontSize: 16, fontWeight: '700' },
});
