import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assessWeekLightening, coachCommentForWeek, paceMpsToPerKm, weeklyAnalysis } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Eyebrow } from '@/ui/components/Eyebrow';
import { DOW_SHORT, assessmentColor, formatDistance, formatDuration, workoutKindColor } from '@/ui/format';
import { BarRow } from '@/ui/charts/BarRow';
import { useProfileStore } from '@/store/profile';

// Wochenrückblick: on-demand berechnet über weeklyAnalysis() (immer aktuell,
// nicht in der Sonntags-Notification vorberechnet) - Ziel des Notification-
// Deep-Links, zusätzlich jederzeit über "Fortschritt" erreichbar.
export default function WeeklyReviewScreen() {
  const p = usePalette();
  const router = useRouter();
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);
  const applyWeekLighteningAction = useProfileStore((s) => s.applyWeekLightening);

  const analysis = useMemo(() => (plan ? weeklyAnalysis(plan, activities) : null), [plan, activities]);
  const lastWeek = useMemo(
    () => (plan ? weeklyAnalysis(plan, activities, new Date(Date.now() - 7 * 86_400_000)) : null),
    [plan, activities],
  );
  const lightening = useMemo(() => (analysis ? assessWeekLightening(analysis) : null), [analysis]);

  if (!analysis) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.scroll}>
          <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 12 }]}>
            ‹ Zurück
          </Text>
          <Text style={{ color: p.subtext }}>Noch kein Trainingsplan vorhanden.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxDayDistance = Math.max(
    1,
    ...analysis.entries.map((e) => e.activity?.totalDistanceMeters ?? 0),
    ...analysis.extraActivities.map((a) => a.totalDistanceMeters),
  );

  // Zusätzliche Kennzahlen über die Basis-Zusammenfassung hinaus: Höhenmeter,
  // durchschnittliche (distanzgewichtete) Pace, Vorwochenvergleich.
  const allWeekActivities = [
    ...analysis.entries.map((e) => e.activity).filter((a): a is NonNullable<typeof a> => Boolean(a)),
    ...analysis.extraActivities,
  ];
  const totalAscent = allWeekActivities.reduce((sum, a) => sum + (a.totalAscentMeters ?? 0), 0);
  const totalDurationSeconds = allWeekActivities.reduce((sum, a) => sum + a.totalDurationSeconds, 0);
  const avgPaceMps = totalDurationSeconds > 0 ? analysis.actualDistanceMeters / totalDurationSeconds : 0;
  const distanceDeltaMeters = analysis.actualDistanceMeters - (lastWeek?.actualDistanceMeters ?? 0);
  const coachComment = coachCommentForWeek(analysis);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 12 }]}>
          ‹ Zurück
        </Text>
        <Text style={[title, { color: p.text }]}>Wochenrückblick</Text>
        <Text style={[body, { color: p.subtext, marginTop: 2, marginBottom: 14 }]}>
          {new Date(`${analysis.startDate}T12:00:00`).toLocaleDateString('de-DE')} –{' '}
          {new Date(`${analysis.endDate}T12:00:00`).toLocaleDateString('de-DE')}
        </Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text }]}>
              {formatDistance(analysis.actualDistanceMeters)} von {formatDistance(analysis.plannedDistanceMeters)}
            </Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text }]}>
              {analysis.completedRunCount} von {analysis.plannedRunCount} Läufen
            </Text>
          </View>
          {avgPaceMps > 0 && (
            <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
              <Text style={[caption, { color: p.text }]}>⌀ {paceMpsToPerKm(avgPaceMps)} /km</Text>
            </View>
          )}
          {totalAscent > 0 && (
            <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
              <Text style={[caption, { color: p.text }]}>⛰ {totalAscent} Hm</Text>
            </View>
          )}
        </View>

        <Card style={styles.section} outlined outlineColor={p.accent}>
          <Eyebrow style={{ color: p.accent }}>Trainer-Einschätzung</Eyebrow>
          <Text style={[body, { color: p.text, marginTop: 6, lineHeight: 21 }]}>{coachComment}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={[heading, { color: p.text }]}>Zusammenfassung</Text>
          {analysis.notes.map((n, i) => (
            <Text key={i} style={[body, { color: p.subtext, marginTop: i === 0 ? 6 : 4 }]}>
              • {n}
            </Text>
          ))}
          {lastWeek && (lastWeek.actualDistanceMeters > 0 || analysis.actualDistanceMeters > 0) && (
            <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
              • {formatDistance(Math.abs(distanceDeltaMeters))} {distanceDeltaMeters >= 0 ? 'mehr' : 'weniger'} als
              letzte Woche ({formatDistance(lastWeek.actualDistanceMeters)}).
            </Text>
          )}
        </Card>

        {lightening && analysis && (
          <Card style={styles.section}>
            <Text style={[heading, { color: p.text }]}>Schon viel eigenständig gelaufen</Text>
            <Text style={[body, { color: p.subtext, marginTop: 8 }]}>{lightening.reason}</Text>
            <Button
              title="Restliche Woche entlasten"
              variant="secondary"
              style={{ marginTop: 12, minHeight: 46 }}
              onPress={() => {
                applyWeekLighteningAction(lightening, analysis);
                Alert.alert('Woche angepasst', 'Die restlichen geplanten Einheiten dieser Woche wurden reduziert.');
              }}
            />
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={[heading, { color: p.text }]}>Tage im Überblick</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {analysis.entries.map((e) => (
              <BarRow
                key={e.date}
                label={DOW_SHORT[e.dayOfWeek] ?? ''}
                value={e.activity ? formatDistance(e.activity.totalDistanceMeters) : '–'}
                fraction={e.activity ? e.activity.totalDistanceMeters / maxDayDistance : 0}
                color={e.assessment ? assessmentColor(e.assessment) : workoutKindColor(e.workout.kind)}
              />
            ))}
          </View>
        </Card>

        {analysis.extraActivities.length > 0 && (
          <Card style={styles.section}>
            <Text style={[heading, { color: p.text }]}>Zusätzliche Läufe ohne Plan-Bezug</Text>
            {analysis.extraActivities.map((a, i) => (
              <Text key={a.id} style={[body, { color: p.subtext, marginTop: i === 0 ? 6 : 4 }]}>
                {new Date(a.startTime).toLocaleDateString('de-DE', { weekday: 'short' })} ·{' '}
                {formatDistance(a.totalDistanceMeters)} · {formatDuration(a.totalDurationSeconds)}
              </Text>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  summaryPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  section: { marginBottom: 14 },
});
