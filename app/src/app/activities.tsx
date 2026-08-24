import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  assessReturnRamp,
  classifyFreeRun,
  compareWorkout,
  locateByDate,
  matchActivity,
  paceMpsToPerKm,
  suggestAdaptation,
  ymdOf,
  type CompletedActivity,
} from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { assessmentColor, assessmentLabel, formatDistance, formatDuration } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { pickAndDecodeActivity } from '@/delivery/importActivity';
import { pullGarminActivities } from '@/sync/autoPullGarmin';
import { fetchGarminActivitiesBackfill } from '@/api/garmin';
import { hasBackend } from '@/config';

/** Datum des Wochenanfangs (lokal, `weekStartDay`-relativ), als 'YYYY-MM-DD'. */
function startOfWeek(dateIso: string, weekStartDay: number): string {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00`);
  const dow = d.getDay();
  const diff = (dow - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return ymdOf(d);
}

interface WeekGroup {
  key: string;
  label: string;
  totalDistanceMeters: number;
  activities: CompletedActivity[];
  /** 7 Einträge, Index 0 = weekStartDay - für die kleine Wochen-Glance-Zeile. */
  dayHasRun: boolean[];
}

function groupByWeek(activities: CompletedActivity[], weekStartDay: number, currentWeekKey: string): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const a of activities) {
    const key = startOfWeek(a.startTime, weekStartDay);
    let group = map.get(key);
    if (!group) {
      const d = new Date(`${key}T12:00:00`);
      group = {
        key,
        label: key === currentWeekKey ? 'Diese Woche' : `Woche vom ${d.toLocaleDateString('de-DE')}`,
        totalDistanceMeters: 0,
        activities: [],
        dayHasRun: [false, false, false, false, false, false, false],
      };
      map.set(key, group);
    }
    group.totalDistanceMeters += a.totalDistanceMeters;
    group.activities.push(a);
    const dow = new Date(`${a.startTime.slice(0, 10)}T12:00:00`).getDay();
    group.dayHasRun[(dow - weekStartDay + 7) % 7] = true;
  }
  for (const g of map.values()) g.activities.sort((x, y) => y.startTime.localeCompare(x.startTime));
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export default function ActivitiesScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);
  const addActivity = useProfileStore((s) => s.addActivity);
  const addActivities = useProfileStore((s) => s.addActivities);
  const applyAdaptation = useProfileStore((s) => s.applyAdaptation);
  const applyReturnRampAction = useProfileStore((s) => s.applyReturnRamp);
  const [busy, setBusy] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const adaptation = useMemo(
    () => (plan ? suggestAdaptation(plan, activities) : null),
    [plan, activities],
  );
  const returnRamp = useMemo(() => assessReturnRamp(activities), [activities]);

  const weekStartDay = profile?.weekStartDay ?? 1;
  const currentWeekKey = startOfWeek(ymdOf(new Date()), weekStartDay);
  const weeks = useMemo(
    () => groupByWeek(activities, weekStartDay, currentWeekKey),
    [activities, weekStartDay, currentWeekKey],
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

  async function onPullGarmin() {
    try {
      setPullBusy(true);
      const count = await pullGarminActivities();
      Alert.alert(
        count > 0 ? 'Läufe übernommen' : 'Keine neuen Läufe',
        count > 0
          ? `${count} ${count === 1 ? 'Lauf wurde' : 'Läufe wurden'} von Garmin übernommen.`
          : 'Garmin hat seit dem letzten Abruf keine neuen Läufe gemeldet.',
      );
    } catch (e) {
      Alert.alert('Abruf fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setPullBusy(false);
    }
  }

  async function onBackfill() {
    try {
      setBackfillBusy(true);
      const deviceId = useProfileStore.getState().deviceId;
      const pulled = await fetchGarminActivitiesBackfill(deviceId);
      const existingIds = new Set(useProfileStore.getState().activities.map((a) => a.id));
      const fresh = pulled.filter((a) => !existingIds.has(a.id));
      addActivities(fresh);
      Alert.alert(
        fresh.length > 0 ? 'Verlauf importiert' : 'Nichts Neues',
        fresh.length > 0
          ? `${fresh.length} ${fresh.length === 1 ? 'Lauf wurde' : 'Läufe wurden'} aus dem Garmin-Verlauf übernommen.`
          : 'Alle verfügbaren Läufe waren bereits importiert.',
      );
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setBackfillBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 6 }]}>Fortschritt</Text>
        <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
          Absolvierte Läufe werden bei verbundenem Garmin-Konto automatisch übernommen – dein Plan passt sich an.
        </Text>
        <Pressable onPress={() => router.push('/weekly-review')} hitSlop={8}>
          <Text style={[caption, { color: p.text, marginTop: 10 }]}>Wochenrückblick ansehen ›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {hasBackend && (
          <>
            <Button title="Von Garmin abrufen" onPress={onPullGarmin} loading={pullBusy} />
            <Button
              title="Kompletten Garmin-Verlauf importieren"
              variant="secondary"
              onPress={onBackfill}
              loading={backfillBusy}
            />
          </>
        )}
        <Button title="Lauf-Datei importieren (FIT)" variant="secondary" onPress={onImport} loading={busy} />

        {adaptation && (
          <Card>
            <Text style={[heading, { color: p.text }]}>Anpassung</Text>
            {adaptation.notes.map((n, i) => (
              <Text key={i} style={[body, { color: p.subtext, marginTop: i === 0 ? 8 : 4 }]}>
                • {n}
              </Text>
            ))}
            {(adaptation.recommendedVdotDelta !== 0 || adaptation.reduceNextWeekVolume) && (
              <Button
                title="Plan anpassen"
                variant="secondary"
                style={{ marginTop: 12, minHeight: 46 }}
                onPress={() => {
                  applyAdaptation(adaptation);
                  Alert.alert('Plan angepasst', 'Dein Trainingsplan wurde aktualisiert.');
                }}
              />
            )}
          </Card>
        )}

        {returnRamp && (
          <Card>
            <Text style={[heading, { color: p.text }]}>Rückkehr-Woche</Text>
            <Text style={[body, { color: p.subtext, marginTop: 8 }]}>{returnRamp.reason}</Text>
            <Button
              title="Rückkehr-Rampe anwenden"
              variant="secondary"
              style={{ marginTop: 12, minHeight: 46 }}
              onPress={() => {
                applyReturnRampAction(returnRamp);
                Alert.alert('Plan angepasst', 'Die nächsten Tage starten mit reduziertem Umfang.');
              }}
            />
          </Card>
        )}

        {weeks.length === 0 ? (
          <Text style={[body, { color: p.subtext }]}>Noch keine Läufe importiert.</Text>
        ) : (
          weeks.map((week) => (
            <View key={week.key} style={styles.weekBlock}>
              <View style={styles.weekHeader}>
                <Text style={[heading, { color: p.text }]}>{week.label}</Text>
                <Text style={[caption, { color: p.subtext }]}>
                  {formatDistance(week.totalDistanceMeters)} · {week.activities.length}{' '}
                  {week.activities.length === 1 ? 'Lauf' : 'Läufe'}
                </Text>
              </View>
              <View style={styles.dotsRow}>
                {week.dayHasRun.map((has, i) => (
                  <View key={i} style={[styles.dayDot, { backgroundColor: has ? p.accent : p.surfaceRaised }]} />
                ))}
              </View>

              {week.activities.map((a) => {
                const matched = plan
                  ? a.linkedScheduledWorkoutDate
                    ? locateByDate(plan, a.linkedScheduledWorkoutDate)?.scheduled
                    : matchActivity(plan, a)
                  : undefined;
                const assessment = matched ? compareWorkout(matched.workout, a).assessment : undefined;
                const freeZone = !matched && profile ? classifyFreeRun(a, profile.currentVdot) : undefined;

                return (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push({ pathname: '/activity-detail', params: { id: a.id } })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Card style={styles.activityCard}>
                      <View style={styles.rowBetween}>
                        <Text style={[bodyStrong, { color: p.text }]}>
                          {new Date(a.startTime).toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </Text>
                        {assessment ? (
                          <View style={[styles.badge, { backgroundColor: assessmentColor(assessment) }]}>
                            <Text style={[caption, { color: '#fff', fontSize: 11 }]}>{assessmentLabel(assessment)}</Text>
                          </View>
                        ) : freeZone ? (
                          <View style={[styles.badge, { backgroundColor: p.surfaceRaised }]}>
                            <Text style={[caption, { color: p.text, fontSize: 11 }]}>{freeZone.zoneLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
                        {formatDistance(a.totalDistanceMeters)} · {formatDuration(a.totalDurationSeconds)} ·{' '}
                        {paceMpsToPerKm(a.avgPaceMps)} /km
                        {a.avgHeartRate ? ` · ⌀ ${a.avgHeartRate} bpm` : ''}
                      </Text>
                      {matched && (
                        <Text style={[caption, { color: p.faint, marginTop: 2 }]}>geplant: {matched.workout.name}</Text>
                      )}
                      <Text style={[caption, { color: p.accent, marginTop: 6 }]}>Analyse ansehen ›</Text>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  scroll: { padding: 20, paddingTop: 4, gap: 14 },
  weekBlock: { gap: 10 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  activityCard: { padding: 16, borderRadius: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
