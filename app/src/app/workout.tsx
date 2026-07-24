import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isRepeatBlock, type WorkoutStep } from '@paceforge/core';

import { fitFileProvider } from '@/delivery/FitFileProvider';
import { activeDeliveryProvider } from '@/delivery/providers';

import { usePalette, type Palette } from '@/ui/colors';
import {
  DOW_SHORT,
  durationText,
  formatDistance,
  formatDuration,
  intensityLabel,
  targetText,
} from '@/ui/format';
import { useProfileStore } from '@/store/profile';

function StepRow({ step, p }: { step: WorkoutStep; p: Palette }) {
  return (
    <View style={[styles.stepRow, { borderColor: p.border }]}>
      <View style={[styles.dot, { backgroundColor: p.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, { color: p.text }]}>
          {intensityLabel(step.intensity)} · {durationText(step.duration)}
        </Text>
        <Text style={[styles.stepTarget, { color: p.subtext }]}>{targetText(step.target)}</Text>
      </View>
    </View>
  );
}

export default function WorkoutScreen() {
  const p = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ week?: string; day?: string }>();
  const plan = useProfileStore((s) => s.plan);

  const week = Number(params.week);
  const day = Number(params.day);
  const scheduled = plan?.weeks[week]?.workouts.find((w) => w.dayOfWeek === day);

  if (!scheduled) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.empty}>
          <Text style={{ color: p.subtext }}>Einheit nicht gefunden.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { workout } = scheduled;
  const date = new Date(scheduled.date);
  const [exporting, setExporting] = useState(false);
  const instructions = fitFileProvider.getDeliveryInstructions();

  async function onExport() {
    try {
      setExporting(true);
      const provider = await activeDeliveryProvider();
      const result = await provider.exportWorkout(workout);
      if (!(await fitFileProvider.isAvailable())) {
        Alert.alert('FIT-Datei erstellt', `Gespeichert als ${result.fileName} (${result.bytes} Bytes).`);
      }
    } catch (e) {
      Alert.alert('Export fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text onPress={() => router.back()} style={[styles.back, { color: p.accent }]}>
          ‹ Zurück
        </Text>

        <Text style={[styles.date, { color: p.subtext }]}>
          {DOW_SHORT[scheduled.dayOfWeek]}, {date.toLocaleDateString('de-DE')}
        </Text>
        <Text style={[styles.name, { color: p.text }]}>{workout.name}</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: p.chipBg }]}>
            <Text style={[styles.summaryText, { color: p.text }]}>
              {formatDistance(workout.estimatedDistanceMeters ?? 0)}
            </Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: p.chipBg }]}>
            <Text style={[styles.summaryText, { color: p.text }]}>
              ~ {formatDuration(workout.estimatedDurationSeconds ?? 0)}
            </Text>
          </View>
        </View>

        {workout.elements.length === 0 ? (
          <Text style={[styles.restText, { color: p.subtext }]}>
            Ruhetag – Erholung ist Teil des Trainings. 🌙
          </Text>
        ) : (
          <View style={{ gap: 12, marginTop: 10 }}>
            {workout.elements.map((el, idx) => {
              if (isRepeatBlock(el)) {
                return (
                  <View key={idx} style={[styles.repeatBlock, { borderColor: p.accent, backgroundColor: p.card }]}>
                    <Text style={[styles.repeatLabel, { color: p.accent }]}>{el.repeats}× wiederholen</Text>
                    {el.steps.map((s, i) => (
                      <StepRow key={i} step={s} p={p} />
                    ))}
                  </View>
                );
              }
              return (
                <View key={idx} style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
                  <StepRow step={el} p={p} />
                </View>
              );
            })}
          </View>
        )}

        {workout.elements.length > 0 && (
          <View style={{ marginTop: 20, gap: 12 }}>
            <Pressable
              onPress={onExport}
              disabled={exporting}
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: p.accent, opacity: pressed || exporting ? 0.7 : 1 },
              ]}
            >
              {exporting ? (
                <ActivityIndicator color={p.accentText} />
              ) : (
                <Text style={[styles.exportText, { color: p.accentText }]}>Auf Garmin-Uhr exportieren</Text>
              )}
            </Pressable>

            <View style={[styles.instructions, { backgroundColor: p.card, borderColor: p.border }]}>
              <Text style={[styles.instrTitle, { color: p.text }]}>{instructions.title}</Text>
              {instructions.steps.map((s, i) => (
                <View key={i} style={styles.instrRow}>
                  <Text style={[styles.instrNum, { color: p.accent }]}>{i + 1}.</Text>
                  <Text style={[styles.instrText, { color: p.subtext }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 4 },
  back: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  date: { fontSize: 14, fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  summaryPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  summaryText: { fontSize: 14, fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: 1, padding: 4 },
  repeatBlock: { borderRadius: 14, borderWidth: 2, padding: 8, paddingTop: 10, gap: 2 },
  repeatLabel: { fontSize: 14, fontWeight: '800', paddingHorizontal: 8, marginBottom: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepTitle: { fontSize: 15, fontWeight: '600' },
  stepTarget: { fontSize: 14, marginTop: 2, fontVariant: ['tabular-nums'] },
  restText: { fontSize: 16, lineHeight: 24, marginTop: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  exportBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  exportText: { fontSize: 17, fontWeight: '700' },
  instructions: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  instrTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  instrRow: { flexDirection: 'row', gap: 8 },
  instrNum: { fontSize: 14, fontWeight: '700', width: 20 },
  instrText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
