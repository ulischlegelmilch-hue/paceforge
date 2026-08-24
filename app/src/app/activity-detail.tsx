import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { classifyFreeRun, coachCommentForActivity, compareWorkout, locateByDate, matchActivity, paceMpsToPerKm } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Eyebrow } from '@/ui/components/Eyebrow';
import { assessmentColor, assessmentLabel, formatDistance, formatDuration } from '@/ui/format';
import { BarRow } from '@/ui/charts/BarRow';
import { useProfileStore } from '@/store/profile';

// Umfangreiche Analyse EINER abgeleisteten Einheit: Plan-Vergleich (falls
// verlinkt), sonst Zonen-Einordnung für freie Läufe, Höhenkorrektur, Runden.
// Erreichbar per Tap auf eine Aktivitäts-Karte in activities.tsx.
export default function ActivityDetailScreen() {
  const p = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const profile = useProfileStore((s) => s.profile);
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);

  const activity = activities.find((a) => a.id === params.id);

  const matched = useMemo(() => {
    if (!activity || !plan) return undefined;
    return activity.linkedScheduledWorkoutDate
      ? locateByDate(plan, activity.linkedScheduledWorkoutDate)?.scheduled
      : matchActivity(plan, activity);
  }, [activity, plan]);

  const comparison = matched && activity ? compareWorkout(matched.workout, activity) : undefined;
  // Zonen-Einordnung IMMER berechnen (auch bei planmäßigen Läufen) - "wie hat
  // sich das angefühlt" beantwortet die Pace-Zone unabhängig vom Soll-Ist-
  // Vergleich; bei Läufen ohne Plan-Bezug ist sie die einzige Einordnung.
  const zoneContext = activity && profile ? classifyFreeRun(activity, profile.currentVdot) : undefined;
  const freeZone = !matched ? zoneContext : undefined;

  if (!activity) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.scroll}>
          <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 12 }]}>
            ‹ Zurück
          </Text>
          <Text style={{ color: p.subtext }}>Aktivität nicht gefunden.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const laps = activity.laps ?? [];
  const fastestPace = laps.length > 0 ? Math.max(...laps.map((l) => l.avgPaceMps)) : 0;
  // Pace-Streuung über die Runden: wie gleichmäßig war das Tempo? Größere
  // Streuung ist normal bei Intervallen, bei einem Dauerlauf eher ein Zeichen
  // für ungleichmäßiges Pacing.
  const slowestLapPace = laps.length > 1 ? Math.min(...laps.map((l) => l.avgPaceMps)) : 0;
  const paceSpreadSeconds =
    laps.length > 1 && slowestLapPace > 0 && fastestPace > 0
      ? Math.round(1000 / slowestLapPace - 1000 / fastestPace)
      : 0;
  const coachComment = coachCommentForActivity(activity, {
    comparison,
    freeZone,
    ...(paceSpreadSeconds > 0 ? { paceSpreadSeconds } : {}),
  });

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 12 }]}>
          ‹ Zurück
        </Text>

        <Text style={[caption, { color: p.subtext }]}>
          {new Date(activity.startTime).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </Text>
        <Text style={[title, { color: p.text, marginTop: 2, marginBottom: 12 }]}>
          {matched ? matched.workout.name : freeZone ? `Freier Lauf · ${freeZone.zoneLabel}` : 'Lauf'}
        </Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text }]}>{formatDistance(activity.totalDistanceMeters)}</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text }]}>{formatDuration(activity.totalDurationSeconds)}</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[caption, { color: p.text }]}>{paceMpsToPerKm(activity.avgPaceMps)} /km</Text>
          </View>
          {activity.avgHeartRate ? (
            <View style={[styles.summaryPill, { backgroundColor: p.surfaceRaised }]}>
              <Text style={[caption, { color: p.text }]}>⌀ {activity.avgHeartRate} bpm</Text>
            </View>
          ) : null}
        </View>

        <Card style={styles.section} outlined outlineColor={p.accent}>
          <Eyebrow style={{ color: p.accent }}>Trainer-Einschätzung</Eyebrow>
          <Text style={[body, { color: p.text, marginTop: 6, lineHeight: 21 }]}>{coachComment}</Text>
        </Card>

        {comparison && (
          <Card style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={[heading, { color: p.text }]}>Plan-Vergleich</Text>
              <View style={[styles.badge, { backgroundColor: assessmentColor(comparison.assessment) }]}>
                <Text style={[caption, { color: '#fff', fontSize: 11 }]}>{assessmentLabel(comparison.assessment)}</Text>
              </View>
            </View>
            <Text style={[body, { color: p.subtext, marginTop: 6 }]}>
              Geplant: {formatDistance(comparison.plannedDistanceMeters)} bei {paceMpsToPerKm(comparison.plannedAvgPaceMps)}{' '}
              /km
            </Text>
            <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
              Absolviert: {formatDistance(comparison.actualDistanceMeters)} bei{' '}
              {paceMpsToPerKm(comparison.actualAvgPaceMps)} /km
              {activity.gradeAdjustedDistanceMeters || activity.totalAscentMeters ? ' (höhenkorrigiert)' : ''}
            </Text>
            {zoneContext && (
              <Text style={[caption, { color: p.subtext, marginTop: 8 }]}>
                Deine Pace entspricht der Zone „{zoneContext.zoneLabel}" (bezogen auf VDOT {profile?.currentVdot}).
              </Text>
            )}
          </Card>
        )}

        {freeZone && (
          <Card style={styles.section}>
            <Text style={[heading, { color: p.text }]}>Einordnung</Text>
            <Text style={[body, { color: p.subtext, marginTop: 6 }]}>
              Kein geplantes Training an diesem Tag – die Pace entspricht der Zone „{freeZone.zoneLabel}" bezogen auf
              deine aktuelle VDOT ({profile?.currentVdot}).
            </Text>
          </Card>
        )}

        {(activity.totalAscentMeters || activity.gradeAdjustedDistanceMeters) && (
          <Card style={styles.section}>
            <Text style={[heading, { color: p.text }]}>Höhenprofil</Text>
            {activity.totalAscentMeters ? (
              <Text style={[body, { color: p.subtext, marginTop: 6 }]}>⛰ {activity.totalAscentMeters} Höhenmeter</Text>
            ) : null}
            {activity.gradeAdjustedDistanceMeters ? (
              <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
                Flach-äquivalent: {formatDistance(activity.gradeAdjustedDistanceMeters)} (Bewertung höhenkorrigiert)
              </Text>
            ) : null}
          </Card>
        )}

        {laps.length > 0 ? (
          <Card style={styles.section}>
            <Text style={[heading, { color: p.text }]}>Runden ({laps.length})</Text>
            {paceSpreadSeconds > 0 && (
              <Text style={[caption, { color: p.subtext, marginTop: 6 }]}>
                Pace-Streuung: {paceSpreadSeconds} Sek/km zwischen schnellster und langsamster Runde.
              </Text>
            )}
            <View style={{ gap: 8, marginTop: 10 }}>
              {laps.map((lap, i) => (
                <BarRow
                  key={i}
                  label={`${i + 1}.`}
                  value={`${paceMpsToPerKm(lap.avgPaceMps)} /km${lap.avgHeartRate ? ` · ${lap.avgHeartRate} bpm` : ''}`}
                  fraction={fastestPace > 0 ? lap.avgPaceMps / fastestPace : 0}
                />
              ))}
            </View>
          </Card>
        ) : (
          <Text style={[caption, { color: p.subtext, marginTop: 6 }]}>
            Keine Rundendaten verfügbar (nur bei FIT-Import oder angereichertem Garmin-Verlauf).
          </Text>
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
