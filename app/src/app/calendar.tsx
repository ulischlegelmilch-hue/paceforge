import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { compareWorkout, groupActivitiesByEffectiveDate, locateByDate, ymdOf, type CompletedActivity } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { assessmentColor, DOW_SHORT, workoutKindColor } from '@/ui/format';
import { useProfileStore } from '@/store/profile';

const CELLS_PER_GRID = 42; // immer 6 Wochen -> gleichbleibende Höhe über alle Monate

function buildMonthGrid(viewDate: Date): string[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const days: string[] = [];
  for (let i = 0; i < CELLS_PER_GRID; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(ymdOf(d));
  }
  return days;
}

// Monats-Kalender über vergangene UND kommende Trainings (Uli-Wunsch 22.09.:
// "vergangene Trainings in Form eines Kalenders aufrufen") - Muster großer
// Lauf-Apps (Garmin Connect/TrainingPeaks): gefüllter Punkt = absolviert (Farbe
// nach Soll-Ist wie im Plan-Tab), Ring = geplant/noch offen, Warnfarbe = verpasst.
// Erreichbar über das Kalender-Icon im Plan-Tab-Header statt eines eigenen Tabs.
export default function CalendarScreen() {
  const p = usePalette();
  const router = useRouter();
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);
  const today = ymdOf(new Date());
  const [viewDate, setViewDate] = useState(() => new Date());

  const activitiesByDate = useMemo(() => groupActivitiesByEffectiveDate(plan, activities), [activities, plan]);
  const days = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const viewMonth = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  function changeMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  function primaryActivity(dayActivities: CompletedActivity[]): CompletedActivity {
    return dayActivities.reduce((a, b) => (b.totalDistanceMeters > a.totalDistanceMeters ? b : a));
  }

  function onDayPress(ymd: string) {
    const dayActivities = activitiesByDate.get(ymd);
    if (dayActivities && dayActivities.length > 0) {
      router.push({ pathname: '/activity-detail', params: { id: primaryActivity(dayActivities).id } });
      return;
    }
    const loc = plan ? locateByDate(plan, ymd) : undefined;
    if (loc && loc.scheduled.workout.kind !== 'rest') {
      router.push({ pathname: '/workout', params: { week: loc.weekIndex, day: loc.scheduled.dayOfWeek } });
    }
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.header}>
        <Text style={[title, { color: p.text }]}>Kalender</Text>
        <View style={styles.monthNav}>
          <Pressable onPress={() => changeMonth(-1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color={p.text} />
          </Pressable>
          <Text style={[heading, { color: p.text, textTransform: 'capitalize' }]}>{monthLabel}</Text>
          <Pressable onPress={() => changeMonth(1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={22} color={p.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!plan && activities.length === 0 ? (
          <Text style={[body, { color: p.subtext, textAlign: 'center', marginTop: 20 }]}>
            Noch keine Läufe oder Plan vorhanden.
          </Text>
        ) : (
          <Card style={{ padding: 12 }}>
            <View style={styles.weekRow}>
              {DOW_SHORT.map((d) => (
                <Text key={d} style={[caption, { color: p.faint, width: 40, textAlign: 'center' }]}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {days.map((ymd) => {
                const date = new Date(`${ymd}T12:00:00`);
                const inMonth = date.getMonth() === viewMonth;
                const isToday = ymd === today;
                const dayActivities = activitiesByDate.get(ymd);
                const hasActivity = !!dayActivities && dayActivities.length > 0;
                const loc = plan ? locateByDate(plan, ymd) : undefined;
                const sw = loc?.scheduled;
                const isRestDay = !sw || sw.workout.kind === 'rest';
                const isPast = ymd < today;

                let dotColor: string | null = null;
                let dotFilled = false;
                if (hasActivity) {
                  dotFilled = true;
                  if (sw && !isRestDay) {
                    const assessment = compareWorkout(sw.workout, primaryActivity(dayActivities!)).assessment;
                    dotColor = assessmentColor(assessment);
                  } else {
                    dotColor = p.accent;
                  }
                } else if (sw && !isRestDay) {
                  dotColor = isPast && sw.status !== 'modified' ? p.warning : workoutKindColor(sw.workout.kind);
                }

                return (
                  <Pressable
                    key={ymd}
                    onPress={() => onDayPress(ymd)}
                    disabled={!hasActivity && (!sw || isRestDay)}
                    style={[styles.cell, isToday && { borderColor: p.accent, borderWidth: 1.5 }]}
                  >
                    <Text style={[caption, { color: inMonth ? p.text : p.faint, fontFamily: isToday ? bodyStrong.fontFamily : caption.fontFamily }]}>
                      {date.getDate()}
                    </Text>
                    {dotColor && (
                      <View
                        style={[
                          styles.dot,
                          dotFilled
                            ? { backgroundColor: dotColor }
                            : { borderWidth: 1.5, borderColor: dotColor, backgroundColor: 'transparent' },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        <Card style={{ marginTop: 14, gap: 10 }}>
          <Text style={[caption, { color: p.subtext }]}>Zeichenerklärung</Text>
          <LegendRow color={p.success} label="Absolviert, im Ziel" filled />
          <LegendRow color={p.warning} label="Verpasst" />
          <LegendRow color={p.accent} label="Eigener Lauf (ohne Plan-Bezug)" filled />
        </Card>

        {!plan && (
          <Button title="Plan erstellen" onPress={() => router.push('/onboarding')} style={{ marginTop: 16 }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendRow({ color, label, filled }: { color: string; label: string; filled?: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.legendRow}>
      <View
        style={[
          styles.dot,
          { marginTop: 0 },
          filled ? { backgroundColor: color } : { borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' },
        ]}
      />
      <Text style={[caption, { color: p.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 10 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: 6 },
  scroll: { padding: 20, paddingTop: 8, gap: 14 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
