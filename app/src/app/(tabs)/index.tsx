import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  allZones,
  assessDetraining,
  classifyFreeRun,
  kindLabel,
  locateByDate,
  paceMpsToPerKm,
  predictedRaceTimes,
  strengthOnDay,
  strengthScheduleForWeek,
  weekOf,
  weeklyAnalysis,
  ymdOf,
  type RaceDistance,
  type StandardRace,
  type ZoneKey,
} from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { display, eyebrow, heading, title, body, bodyStrong, caption, button as buttonType } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Eyebrow } from '@/ui/components/Eyebrow';
import { DOW_SHORT, formatDistance, formatRaceTime, phaseColor, phaseLabel, workoutKindColor } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { hasBackend } from '@/config';

const DISTANCE_LABEL: Record<RaceDistance, string> = {
  '5k': '5 km',
  '10k': '10 km',
  half: 'Halbmarathon',
  marathon: 'Marathon',
  custom: 'Freie Distanz',
};

const ZONE_LABEL: Record<ZoneKey, string> = {
  easy: 'Locker (E)',
  marathon: 'Marathon (M)',
  threshold: 'Schwelle (T)',
  interval: 'Intervall (I)',
  repetition: 'Wiederholung (R)',
};

const ZONE_ORDER: ZoneKey[] = ['easy', 'marathon', 'threshold', 'interval', 'repetition'];
const RACE_ORDER: StandardRace[] = ['5k', '10k', 'half', 'marathon'];

const TILES = [
  { route: '/strength' as const, icon: 'barbell-outline' as const, label: 'Krafttraining' },
  { route: '/nutrition' as const, icon: 'restaurant-outline' as const, label: 'Ernährung' },
  { route: '/training' as const, icon: 'calendar-outline' as const, label: 'Trainingsumfang' },
];

export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const plan = useProfileStore((s) => s.plan);
  const activities = useProfileStore((s) => s.activities);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.centerWrap}>
          <Text style={[title, { color: p.accent }]}>PaceForge</Text>
          <Text style={[title, { color: p.text, marginTop: 10 }]}>Dein persönlicher Lauf-Trainingsplan</Text>
          <Text style={[body, { color: p.subtext, marginTop: 6 }]}>
            Beantworte ein paar Fragen zu deinem Ziel und deiner Form – wir berechnen deine Trainings-Paces und
            bauen darauf deinen Plan.
          </Text>
          <Button title="Plan erstellen" onPress={() => router.push('/onboarding')} style={{ marginTop: 28 }} />
        </View>
      </SafeAreaView>
    );
  }

  const zones = allZones(profile.currentVdot);
  const races = predictedRaceTimes(profile.currentVdot);
  const today = ymdOf(new Date());
  const todayLoc = plan ? locateByDate(plan, today) : undefined;
  const thisWeek = plan ? weekOf(plan, today) : undefined;
  const eq = profile.strength?.equipment ?? 'bodyweight';
  const spw = profile.strength?.sessionsPerWeek ?? 2;
  const todayDow = todayLoc?.scheduled.dayOfWeek ?? new Date().getDay();
  const todayStrength = thisWeek ? strengthOnDay(thisWeek, eq, spw, todayDow) : undefined;
  const weekStrengthDays = thisWeek
    ? new Set(strengthScheduleForWeek(thisWeek, eq, spw).map((s) => s.dayOfWeek))
    : new Set<number>();
  const detraining = assessDetraining(activities);
  const detrainingColor = detraining?.level === 'warn' ? p.danger : p.warning;

  const weekTraining = thisWeek?.workouts.filter((w) => w.workout.kind !== 'rest') ?? [];
  const weekDone = weekTraining.filter((w) => w.status === 'completed').length;
  // Eigene Läufe (z. B. an Ruhetagen) zählen als echtes, absolviertes Training
  // mit - der Fortschrittsbalken darf dadurch über 100 % geplant hinausgehen,
  // gedeckelt auf 100 % Anzeige, mit eigenem Hinweis auf die Zusatzläufe.
  const weekAnalysis = plan ? weeklyAnalysis(plan, activities) : null;
  const extraRuns = weekAnalysis?.extraActivities ?? [];
  const weekDoneWithExtras = weekDone + extraRuns.length;
  const weekProgress = weekTraining.length > 0 ? Math.min(1, weekDoneWithExtras / weekTraining.length) : 0;
  // Geplante + eigene Läufe dieser Woche chronologisch gemischt, damit ein
  // spontaner Lauf am Ruhetag genauso sichtbar ist wie eine geplante Einheit.
  type WeekRow =
    | { kind: 'planned'; date: string; dayOfWeek: number; sw: (typeof weekTraining)[number] }
    | { kind: 'free'; date: string; dayOfWeek: number; activity: (typeof extraRuns)[number] };
  const weekRows: WeekRow[] = [
    ...thisWeek?.workouts
      .filter((w) => w.workout.kind !== 'rest')
      .map((sw): WeekRow => ({ kind: 'planned', date: sw.date, dayOfWeek: sw.dayOfWeek, sw })) ?? [],
    ...extraRuns.map((a): WeekRow => ({
      kind: 'free',
      date: a.startTime.slice(0, 10),
      dayOfWeek: new Date(`${a.startTime.slice(0, 10)}T12:00:00`).getDay(),
      activity: a,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[heading, { color: p.text, letterSpacing: -0.2 }]}>PaceForge</Text>
          <Pressable
            onPress={() => router.push('/more')}
            hitSlop={10}
            style={[styles.gearBtn, { backgroundColor: p.surfaceRaised }]}
          >
            <Ionicons name="settings-outline" size={19} color={p.text} />
          </Pressable>
        </View>

        {thisWeek && (
          <View style={styles.weekStrip}>
            {thisWeek.workouts.map((sw) => {
              const isToday = sw.date === today;
              const isRest = sw.workout.kind === 'rest';
              return (
                <View key={sw.date} style={styles.weekStripDay}>
                  <Text style={[caption, { color: isToday ? p.accent : p.faint }]}>{DOW_SHORT[sw.dayOfWeek]}</Text>
                  <View
                    style={[
                      styles.weekStripDot,
                      isRest
                        ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.border }
                        : { backgroundColor: workoutKindColor(sw.workout.kind) },
                      isToday && { borderWidth: 2, borderColor: p.accent },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        )}

        <Card style={styles.heroCard}>
          <Eyebrow>Dein Ziel</Eyebrow>
          <Text style={[heading, { color: p.text, marginTop: 2 }]}>
            {profile.goal.mode === 'maintain'
              ? 'Form halten'
              : `${DISTANCE_LABEL[profile.goal.distance]}${profile.goal.weeks ? ` · ${profile.goal.weeks} Wochen` : ''}`}
          </Text>
          <Eyebrow style={{ marginTop: 18 }}>Aktuelle Fitness (VDOT)</Eyebrow>
          <Text style={[display, { color: p.accent }]}>{profile.currentVdot}</Text>
          <Text style={[caption, { color: p.subtext }]}>{profile.daysPerWeek} Trainingstage / Woche</Text>
          <View style={styles.heroLinks}>
            <Pressable onPress={() => router.push('/recalibrate')} hitSlop={8}>
              <Text style={[caption, { color: p.text }]}>Neue Bestzeit? Fitness aktualisieren ›</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/training')} hitSlop={8}>
              <Text style={[caption, { color: p.text }]}>Trainingsumfang & Tipps ›</Text>
            </Pressable>
          </View>
        </Card>

        {detraining && (
          <Card outlined outlineColor={detrainingColor}>
            <Eyebrow style={{ color: detrainingColor }}>
              {detraining.level === 'warn' ? 'Form in Gefahr' : 'Trainingsreiz niedrig'}
            </Eyebrow>
            <Text style={[body, { color: p.text, marginTop: 4 }]}>{detraining.text}</Text>
          </Card>
        )}

        <Card>
          <Eyebrow>Heute</Eyebrow>
          {todayLoc && todayLoc.scheduled.workout.kind !== 'rest' ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/workout',
                  params: { week: todayLoc.weekIndex, day: todayLoc.scheduled.dayOfWeek },
                })
              }
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginTop: 4 }]}
            >
              <Text
                style={[
                  heading,
                  { color: p.text },
                  todayLoc.scheduled.status === 'skipped' && styles.strike,
                ]}
              >
                {todayLoc.scheduled.workout.name}
              </Text>
              <Text style={[caption, { color: todayLoc.scheduled.status === 'skipped' ? p.subtext : p.accent, marginTop: 4 }]}>
                {todayLoc.scheduled.status === 'skipped'
                  ? '✕ Übersprungen · zum Ändern tippen ›'
                  : `${formatDistance(todayLoc.scheduled.workout.estimatedDistanceMeters ?? 0)} · zum Öffnen tippen ›`}
              </Text>
            </Pressable>
          ) : (
            <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
              {todayLoc ? 'Ruhetag – Erholung zählt auch. 🌙' : 'Heute kein geplantes Training.'}
            </Text>
          )}
          {todayStrength && (
            <Pressable onPress={() => router.push('/strength')} hitSlop={6}>
              <Text style={[caption, { color: p.accent, fontFamily: buttonType.fontFamily, marginTop: 10 }]}>
                + Kraft: {kindLabel(todayStrength.kind)} ›
              </Text>
            </Pressable>
          )}
        </Card>

        {thisWeek && (
          <Card>
            <View style={styles.weekHead}>
              <Eyebrow>Diese Woche · Woche {thisWeek.index + 1}</Eyebrow>
              <View style={[styles.badge, { backgroundColor: phaseColor(thisWeek.phase) }]}>
                <Text style={[caption, { color: '#fff', fontFamily: buttonType.fontFamily, fontSize: 11 }]}>
                  {phaseLabel(thisWeek.phase)}
                </Text>
              </View>
            </View>
            {weekTraining.length > 0 && (
              <View style={styles.weekProgressRow}>
                <View style={[styles.weekProgressTrack, { backgroundColor: p.surfaceRaised }]}>
                  <View style={[styles.weekProgressFill, { width: `${weekProgress * 100}%`, backgroundColor: p.success }]} />
                </View>
                <Text style={[caption, { color: p.subtext }]}>
                  {weekDoneWithExtras}/{weekTraining.length} erledigt
                  {extraRuns.length > 0 ? ` (+${extraRuns.length} eigene)` : ''}
                </Text>
              </View>
            )}
            {weekRows.map((row, i) => {
              const rowStyle = [
                styles.dayRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: p.border },
              ];
              if (row.kind === 'free') {
                const zone = profile ? classifyFreeRun(row.activity, profile.currentVdot) : null;
                return (
                  <Pressable
                    key={row.activity.id}
                    onPress={() => router.push({ pathname: '/activity-detail', params: { id: row.activity.id } })}
                    style={({ pressed }) => [...rowStyle, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[caption, { width: 24, color: row.date === today ? p.accent : p.subtext, fontFamily: buttonType.fontFamily }]}>
                      {DOW_SHORT[row.dayOfWeek]}
                    </Text>
                    <View style={[styles.kindDot, { backgroundColor: p.accent }]} />
                    <Text style={[bodyStrong, { flex: 1, color: p.text }]} numberOfLines={1}>
                      Eigener Lauf{zone ? ` · ${zone.zoneLabel}` : ''}
                    </Text>
                    <Text style={{ fontSize: 16, color: p.success }}>✓</Text>
                  </Pressable>
                );
              }
              const { sw } = row;
              const isToday = sw.date === today;
              const done = sw.status === 'completed';
              const skipped = sw.status === 'skipped';
              const moved = sw.status === 'modified';
              return (
                <Pressable
                  key={sw.date}
                  onPress={() =>
                    router.push({
                      pathname: '/workout',
                      params: { week: thisWeek.index, day: sw.dayOfWeek },
                    })
                  }
                  style={({ pressed }) => [...rowStyle, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[caption, { width: 24, color: isToday ? p.accent : p.subtext, fontFamily: buttonType.fontFamily }]}>
                    {DOW_SHORT[sw.dayOfWeek]}
                  </Text>
                  <View style={[styles.kindDot, { backgroundColor: workoutKindColor(sw.workout.kind) }]} />
                  {sw.workout.kind === 'race' ? (
                    <Text style={{ fontSize: 14 }}>🏁</Text>
                  ) : (
                    moved && <Text style={[caption, { color: p.accent, fontFamily: buttonType.fontFamily }]}>↔</Text>
                  )}
                  <Text style={[bodyStrong, { flex: 1, color: p.text }, (done || skipped) && styles.strike]} numberOfLines={1}>
                    {sw.workout.name}
                  </Text>
                  {weekStrengthDays.has(sw.dayOfWeek) && (
                    <Text style={[styles.kraftTag, caption, { color: p.accent, borderColor: p.accent }]}>Kraft</Text>
                  )}
                  {done ? (
                    <Text style={{ fontSize: 16, color: p.success }}>✓</Text>
                  ) : skipped ? (
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
        )}

        <Text style={[heading, { color: p.text, marginTop: 4 }]}>Deine Trainings-Paces</Text>
        <Card>
          {ZONE_ORDER.map((z, i) => (
            <View key={z} style={[styles.zoneRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}>
              <Text style={[bodyStrong, { color: p.text }]}>{ZONE_LABEL[z]}</Text>
              <Text style={[body, { color: p.subtext }]}>
                {paceMpsToPerKm(zones[z].lowMps)}–{paceMpsToPerKm(zones[z].highMps)} /km
              </Text>
            </View>
          ))}
        </Card>

        <Text style={[heading, { color: p.text, marginTop: 4 }]}>Geschätzte Wettkampfzeiten</Text>
        <Card>
          {RACE_ORDER.map((r, i) => (
            <View key={r} style={[styles.zoneRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}>
              <Text style={[bodyStrong, { color: p.text }]}>{DISTANCE_LABEL[r]}</Text>
              <Text style={[body, { color: p.subtext }]}>{formatRaceTime(races[r])}</Text>
            </View>
          ))}
        </Card>

        <Button title="Trainingsplan ansehen" onPress={() => router.push('/plan')} style={{ marginTop: 4 }} />
        <Button
          title="Fortschritt & Läufe importieren"
          variant="secondary"
          onPress={() => router.push('/activities')}
        />
        {hasBackend && (
          <Button
            title="Max' Training ansehen"
            variant="secondary"
            onPress={() => router.push('/max')}
          />
        )}

        <Text style={[heading, { color: p.text, marginTop: 4 }]}>Mehr trainieren</Text>
        <View style={styles.tileGrid}>
          {TILES.map((t) => (
            <Pressable
              key={t.route}
              onPress={() => router.push(t.route)}
              style={({ pressed }) => [styles.tile, { backgroundColor: p.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: p.accentSoft }]}>
                <Ionicons name={t.icon} size={22} color={p.accent} />
              </View>
              <Text style={[caption, { color: p.text, fontFamily: buttonType.fontFamily, textAlign: 'center' }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gearBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 14 },
  heroCard: { paddingBottom: 22 },
  heroLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  strike: { textDecorationLine: 'line-through', opacity: 0.5 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 2 },
  weekStripDay: { alignItems: 'center', gap: 8 },
  weekStripDot: { width: 12, height: 12, borderRadius: 6 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  weekProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 },
  weekProgressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  weekProgressFill: { height: 6, borderRadius: 3 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  kraftTag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  tileGrid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 20, paddingVertical: 18, alignItems: 'center', gap: 10 },
  tileIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
