import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentWeekIndex, fuelingSummary, isRepeatBlock, ymdOf, type WorkoutStep } from '@paceforge/core';

import { fitFileProvider } from '@/delivery/FitFileProvider';
import { activeDeliveryProvider } from '@/delivery/providers';

import { usePalette, type Palette } from '@/ui/colors';
import { title, heading, body, caption, button as buttonType } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import {
  DOW_SHORT,
  durationText,
  formatDistance,
  formatDuration,
  fuelingPrepText,
  intensityLabel,
  targetText,
  workoutKindColor,
} from '@/ui/format';
import { useProfileStore } from '@/store/profile';

function StepRow({ step, p }: { step: WorkoutStep; p: Palette }) {
  return (
    <View style={[styles.stepRow, { borderColor: p.border }]}>
      <View style={[styles.dot, { backgroundColor: p.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[body, { color: p.text, fontFamily: buttonType.fontFamily }]}>
          {intensityLabel(step.intensity)} · {durationText(step.duration)}
        </Text>
        <Text style={[caption, { color: p.subtext, marginTop: 2 }]}>{targetText(step.target)}</Text>
      </View>
    </View>
  );
}

export default function WorkoutScreen() {
  const p = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ week?: string; day?: string }>();
  const plan = useProfileStore((s) => s.plan);
  const setWorkoutStatus = useProfileStore((s) => s.setWorkoutStatus);
  const moveWorkout = useProfileStore((s) => s.moveWorkout);
  const [moveOpen, setMoveOpen] = useState(false);

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
  const fueling = fuelingSummary(workout.estimatedDistanceMeters ?? 0, workout.estimatedDurationSeconds ?? 0);
  const scheduledDate = scheduled.date;
  const date = new Date(scheduledDate);
  const [exporting, setExporting] = useState(false);
  const [instructions, setInstructions] = useState(() => fitFileProvider.getDeliveryInstructions());

  const today = ymdOf(new Date());
  const isCurrentWeek = plan ? currentWeekIndex(plan, today) === week : false;
  const canMove = isCurrentWeek && scheduledDate >= today;
  const candidateDays = canMove ? (plan?.weeks[week]?.workouts.filter((wo) => wo.dayOfWeek !== day && wo.date >= today) ?? []) : [];

  function onSkipToggle() {
    setWorkoutStatus(week, day, scheduled!.status === 'skipped' ? 'planned' : 'skipped');
  }

  function onMoveTo(toDayOfWeek: number, toDow: string, toName: string) {
    moveWorkout(week, day, toDayOfWeek);
    setMoveOpen(false);
    Alert.alert('Verschoben', `„${workout.name}" ist jetzt am ${toDow} (bisher dort: ${toName}).`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  useEffect(() => {
    let cancelled = false;
    void activeDeliveryProvider().then((provider) => {
      if (!cancelled) setInstructions(provider.getDeliveryInstructions());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onExport() {
    try {
      setExporting(true);
      const provider = await activeDeliveryProvider();
      const result = await provider.exportWorkout(workout, { scheduledDate });
      if (result.message) {
        Alert.alert('Übertragen', result.message);
      } else if (result.fileName && !(await fitFileProvider.isAvailable())) {
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
        <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 14 }]}>
          ‹ Zurück
        </Text>

        <View style={styles.dateRow}>
          <View style={[styles.kindDot, { backgroundColor: workoutKindColor(workout.kind) }]} />
          <Text style={[caption, { color: p.subtext, fontFamily: buttonType.fontFamily }]}>
            {DOW_SHORT[scheduled.dayOfWeek]}, {date.toLocaleDateString('de-DE')}
          </Text>
        </View>
        <Text style={[title, { color: p.text, marginTop: 4 }]}>{workout.name}</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text, fontFamily: buttonType.fontFamily }]}>
              {formatDistance(workout.estimatedDistanceMeters ?? 0)}
            </Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text, fontFamily: buttonType.fontFamily }]}>
              ~ {formatDuration(workout.estimatedDurationSeconds ?? 0)}
            </Text>
          </View>
        </View>

        {fueling && (
          <Card style={{ marginTop: 14 }}>
            <Text style={[body, { color: p.text }]}>{fuelingPrepText(fueling)}</Text>
          </Card>
        )}

        {workout.kind !== 'rest' && (workout.estimatedDistanceMeters ?? 0) > 0 && (
          <Button
            title="Audioguide für diesen Lauf starten"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/race-guide',
                params: {
                  distanceMeters: String(workout.estimatedDistanceMeters),
                  estimatedTotalSeconds: String(workout.estimatedDurationSeconds ?? 0),
                  name: workout.name,
                },
              })
            }
            style={{ marginTop: 12 }}
          />
        )}

        {scheduled.status === 'modified' && (
          <Text style={[caption, { color: p.subtext, marginTop: 12, fontStyle: 'italic' }]}>
            ↔ Diese Einheit wurde verschoben.
          </Text>
        )}

        {workout.elements.length > 0 && (
          <View style={styles.actionRow}>
            <Button
              title={scheduled.status === 'completed' ? '✓ Als erledigt markiert' : 'Als erledigt markieren'}
              variant={scheduled.status === 'completed' ? 'primary' : 'secondary'}
              onPress={() => setWorkoutStatus(week, day, scheduled.status === 'completed' ? 'planned' : 'completed')}
              style={[
                styles.actionBtn,
                scheduled.status === 'completed' && { backgroundColor: p.success },
              ]}
            />
            <Button
              title={scheduled.status === 'skipped' ? '✕ Fällt aus' : 'Fällt aus / überspringen'}
              variant={scheduled.status === 'skipped' ? 'primary' : 'secondary'}
              onPress={onSkipToggle}
              style={[styles.actionBtn, scheduled.status === 'skipped' && { backgroundColor: p.warning }]}
            />
          </View>
        )}

        {candidateDays.length > 0 && (
          <Pressable
            onPress={() => setMoveOpen(true)}
            style={({ pressed }) => [styles.moveBtn, { backgroundColor: p.surfaceRaised, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[caption, { color: p.text, fontFamily: buttonType.fontFamily }]}>
              ↔ Auf einen anderen Tag dieser Woche verschieben
            </Text>
          </Pressable>
        )}

        {workout.elements.length === 0 ? (
          <Text style={[body, { color: p.subtext, marginTop: 16, lineHeight: 24 }]}>
            Ruhetag – Erholung ist Teil des Trainings. 🌙
          </Text>
        ) : (
          <View style={{ gap: 12, marginTop: 14 }}>
            {workout.elements.map((el, idx) => {
              if (isRepeatBlock(el)) {
                return (
                  <View key={idx} style={[styles.repeatBlock, { borderColor: p.accent, backgroundColor: p.surface }]}>
                    <Text style={[caption, { color: p.accent, fontFamily: buttonType.fontFamily, paddingHorizontal: 8, marginBottom: 2 }]}>
                      {el.repeats}× wiederholen
                    </Text>
                    {el.steps.map((s, i) => (
                      <StepRow key={i} step={s} p={p} />
                    ))}
                  </View>
                );
              }
              return (
                <View key={idx} style={[styles.card, { backgroundColor: p.surface }]}>
                  <StepRow step={el} p={p} />
                </View>
              );
            })}
          </View>
        )}

        {workout.elements.length > 0 && (
          <View style={{ marginTop: 22, gap: 12 }}>
            <Button title="Auf Garmin-Uhr exportieren" onPress={onExport} loading={exporting} />

            <Card>
              <Text style={[body, { color: p.text, fontFamily: buttonType.fontFamily, marginBottom: 8 }]}>
                {instructions.title}
              </Text>
              {instructions.steps.map((s, i) => (
                <View key={i} style={styles.instrRow}>
                  <Text style={[caption, { color: p.accent, width: 20 }]}>{i + 1}.</Text>
                  <Text style={[caption, { flex: 1, color: p.subtext }]}>{s}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      <Modal visible={moveOpen} transparent animationType="fade" onRequestClose={() => setMoveOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMoveOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: p.surface }]} onPress={() => {}}>
            <Text style={[heading, { color: p.text, marginBottom: 8 }]}>Tauschen mit …</Text>
            {candidateDays.map((c) => (
              <Pressable
                key={c.date}
                onPress={() => onMoveTo(c.dayOfWeek, DOW_SHORT[c.dayOfWeek]!, c.workout.name)}
                style={[styles.modalRow, { borderTopColor: p.border }]}
              >
                <Text style={[body, { width: 32, color: p.text, fontFamily: buttonType.fontFamily }]}>
                  {DOW_SHORT[c.dayOfWeek]}
                </Text>
                <Text style={[body, { flex: 1, color: p.subtext }]} numberOfLines={1}>
                  {c.workout.name}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setMoveOpen(false)} style={styles.modalCancel}>
              <Text style={[body, { color: p.accent, fontFamily: buttonType.fontFamily }]}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindDot: { width: 10, height: 10, borderRadius: 5 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, minHeight: 48 },
  moveBtn: { marginTop: 12, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1 },
  modalCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  summaryPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  card: { borderRadius: 18, padding: 4 },
  repeatBlock: { borderRadius: 18, borderWidth: 2, padding: 8, paddingTop: 10, gap: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  instrRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
