import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  coachCommentForWeek,
  compareWorkout,
  groupActivitiesByEffectiveDate,
  strengthScheduleForWeek,
  weeklyAnalysis,
  weekOf,
  ymdOf,
  type CompletedActivity,
} from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { HeaderIconButton } from '@/ui/components/HeaderIconButton';
import { assessmentColor, assessmentLabel, DOW_SHORT, formatDistance, phaseColor, phaseLabel, workoutKindColor } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { exportPlanIcs } from '@/delivery/exportPlanIcs';

export default function PlanScreen() {
  const p = usePalette();
  const router = useRouter();
  const plan = useProfileStore((s) => s.plan);
  const profile = useProfileStore((s) => s.profile);
  const activities = useProfileStore((s) => s.activities);
  const eq = profile?.strength?.equipment ?? 'bodyweight';
  const spw = profile?.strength?.sessionsPerWeek ?? 2;
  const [icsBusy, setIcsBusy] = useState(false);
  const today = ymdOf(new Date());

  const activitiesByDate = useMemo(() => groupActivitiesByEffectiveDate(plan, activities), [activities, plan]);

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
          <Text style={[body, { color: p.subtext }]}>Noch kein Plan vorhanden.</Text>
          <Button title="Zur Startseite" onPress={() => router.replace('/')} style={{ paddingHorizontal: 22 }} />
        </View>
      </SafeAreaView>
    );
  }

  const currentWeekIndex = weekOf(plan, today)?.index;

  function onMoreActions() {
    Alert.alert('Mehr', undefined, [
      { text: 'Workout-Arten erklärt', onPress: () => router.push('/glossary') },
      { text: 'In Kalender exportieren (.ics)', onPress: onExportIcs },
      { text: 'Wettkampf eintragen', onPress: () => router.push('/add-event') },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[title, { color: p.text }]}>Dein Trainingsplan</Text>
            <Text style={[body, { color: p.subtext }]}>{plan.weeks.length} Wochen</Text>
          </View>
          <View style={styles.headerActions}>
            <HeaderIconButton icon="grid-outline" label="Kalender" onPress={() => router.push('/calendar')} />
            <HeaderIconButton icon="time-outline" label="Verlauf" onPress={() => router.push('/activities')} />
            <HeaderIconButton icon="ellipsis-horizontal" label="Mehr" onPress={onMoreActions} disabled={icsBusy} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {plan.weeks.map((week) => {
          const isPastWeek = week.workouts[6]!.date < today;
          const isCurrentWeek = week.index === currentWeekIndex;

          if (isPastWeek) {
            const pastDays = week.workouts
              .map((sw) => {
                const dayActivities = activitiesByDate.get(sw.date);
                if (!dayActivities || dayActivities.length === 0) return null;
                // Bei mehreren Aktivitäten am selben Tag (z.B. nachgeholter verpasster
                // Lauf + eigentlich geplanter) gilt die längste als "die" Einheit für
                // Soll-Ist-Vergleich/Detailansicht, die Distanz-Anzeige summiert aber
                // alle - keine geht mehr stillschweigend verloren.
                const primary = dayActivities.reduce((a, b) => (b.totalDistanceMeters > a.totalDistanceMeters ? b : a));
                const totalDistanceMeters = dayActivities.reduce((sum, a) => sum + a.totalDistanceMeters, 0);
                return { sw, activity: primary, totalDistanceMeters };
              })
              .filter((row): row is { sw: (typeof week.workouts)[number]; activity: CompletedActivity; totalDistanceMeters: number } => !!row);
            const actualTotal = pastDays.reduce((sum, row) => sum + row.totalDistanceMeters, 0);
            const weekComment =
              pastDays.length === 0
                ? coachCommentForWeek(weeklyAnalysis(plan, activities, new Date(`${week.workouts[0]!.date}T00:00:00`)))
                : null;

            return (
              <Card key={week.index} style={{ opacity: 0.85 }}>
                <View style={styles.weekHead}>
                  <Text style={[heading, { color: p.text }]}>Woche {week.index + 1}</Text>
                  <View style={[styles.badge, { backgroundColor: p.surfaceRaised }]}>
                    <Text style={[caption, { color: p.subtext, fontSize: 11 }]}>Abgeschlossen</Text>
                  </View>
                </View>
                <Text style={[caption, { color: p.subtext, marginTop: 4, marginBottom: 8 }]}>
                  {pastDays.length > 0 ? `${formatDistance(actualTotal)} gelaufen` : weekComment}
                </Text>
                {pastDays.map(({ sw, activity, totalDistanceMeters }, i) => {
                  const assessment = sw.workout.kind !== 'rest' ? compareWorkout(sw.workout, activity).assessment : undefined;
                  return (
                    <Pressable
                      key={sw.date}
                      onPress={() => router.push({ pathname: '/activity-detail', params: { id: activity.id } })}
                      style={({ pressed }) => [
                        styles.dayRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: p.border },
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Text style={[caption, { width: 24, color: p.subtext }]}>{DOW_SHORT[sw.dayOfWeek]}</Text>
                      <Text style={[bodyStrong, { flex: 1, color: p.text }]} numberOfLines={1}>
                        {formatDistance(totalDistanceMeters)}
                      </Text>
                      {assessment && (
                        <View style={[styles.badge, { backgroundColor: assessmentColor(assessment) }]}>
                          <Text style={[caption, { color: '#fff', fontSize: 11 }]}>{assessmentLabel(assessment)}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            );
          }

          const training = week.workouts.filter((w) => w.workout.kind !== 'rest');
          const done = training.filter((w) => w.status === 'completed').length;
          const strengthDays = new Set(strengthScheduleForWeek(week, eq, spw).map((s) => s.dayOfWeek));
          return (
            <Card key={week.index} outlined={isCurrentWeek} outlineColor={p.accent}>
              <View style={styles.weekHead}>
                <Text style={[heading, { color: p.text }]}>
                  {isCurrentWeek ? 'Diese Woche' : `Woche ${week.index + 1}`}
                </Text>
                <View style={[styles.badge, { backgroundColor: phaseColor(week.phase) }]}>
                  <Text style={[caption, { color: '#fff', fontSize: 11 }]}>{phaseLabel(week.phase)}</Text>
                </View>
              </View>
              <Text style={[caption, { color: p.subtext, marginTop: 4, marginBottom: 8 }]}>
                {formatDistance(week.targetWeeklyDistanceMeters)} geplant
                {done > 0 ? ` · ${done}/${training.length} erledigt` : ''}
              </Text>
              {training.length > 0 && (
                <View style={[styles.progressTrack, { backgroundColor: p.surfaceRaised }]}>
                  <View style={[styles.progressFill, { width: `${(done / training.length) * 100}%`, backgroundColor: p.success }]} />
                </View>
              )}

              {training.map((sw, i) => {
                const isDone = sw.status === 'completed';
                const isSkipped = sw.status === 'skipped';
                const isMoved = sw.status === 'modified';
                return (
                  <Pressable
                    key={sw.date}
                    onPress={() => router.push({ pathname: '/workout', params: { week: week.index, day: sw.dayOfWeek } })}
                    style={({ pressed }) => [
                      styles.dayRow,
                      i > 0 && { borderTopWidth: 1, borderTopColor: p.border },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[caption, { width: 24, color: p.subtext }]}>{DOW_SHORT[sw.dayOfWeek]}</Text>
                    <View style={[styles.kindDot, { backgroundColor: workoutKindColor(sw.workout.kind) }]} />
                    {sw.workout.kind === 'race' ? (
                      <Text style={{ fontSize: 14 }}>🏁</Text>
                    ) : (
                      isMoved && <Text style={{ color: p.accent, fontSize: 13 }}>↔</Text>
                    )}
                    <Text style={[bodyStrong, { flex: 1, color: p.text }, (isDone || isSkipped) && styles.strike]} numberOfLines={1}>
                      {sw.workout.name}
                    </Text>
                    {strengthDays.has(sw.dayOfWeek) && (
                      <Text style={[styles.kraftTag, caption, { color: p.accent, borderColor: p.accent }]}>Kraft</Text>
                    )}
                    {isDone ? (
                      <Text style={{ fontSize: 16, color: p.success }}>✓</Text>
                    ) : isSkipped ? (
                      <Text style={{ fontSize: 16, color: p.warning }}>✕</Text>
                    ) : (
                      <Text style={[caption, { color: p.subtext }]}>
                        {formatDistance(sw.workout.estimatedDistanceMeters ?? 0)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 4 },
  scroll: { padding: 20, paddingTop: 4, gap: 14 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 5, borderRadius: 3 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  strike: { textDecorationLine: 'line-through', opacity: 0.5 },
  kraftTag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
});
