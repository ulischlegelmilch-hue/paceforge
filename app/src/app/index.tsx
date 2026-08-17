import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  allZones,
  assessDetraining,
  kindLabel,
  locateByDate,
  paceMpsToPerKm,
  predictedRaceTimes,
  strengthOnDay,
  strengthScheduleForWeek,
  weekOf,
  ymdOf,
  type RaceDistance,
  type StandardRace,
  type ZoneKey,
} from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { DOW_SHORT, formatDistance, formatRaceTime, phaseColor, phaseLabel, workoutKindColor } from '@/ui/format';
import { useProfileStore } from '@/store/profile';

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
          <Text style={[styles.brand, { color: p.accent }]}>PaceForge</Text>
          <Text style={[styles.lead, { color: p.text }]}>
            Dein persönlicher Lauf-Trainingsplan
          </Text>
          <Text style={[styles.leadSub, { color: p.subtext }]}>
            Beantworte ein paar Fragen zu deinem Ziel und deiner Form – wir berechnen
            deine Trainings-Paces und bauen darauf deinen Plan.
          </Text>
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: p.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: p.accentText }]}>Plan erstellen</Text>
          </Pressable>
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
  const detrainingColor = detraining?.level === 'warn' ? '#d97706' : p.accent;

  const weekTraining = thisWeek?.workouts.filter((w) => w.workout.kind !== 'rest') ?? [];
  const weekDone = weekTraining.filter((w) => w.status === 'completed').length;
  const weekProgress = weekTraining.length > 0 ? weekDone / weekTraining.length : 0;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.brand, { color: p.accent }]}>PaceForge</Text>
          <Pressable onPress={() => router.push('/more')} hitSlop={10} style={[styles.gearBtn, { backgroundColor: p.chipBg }]}>
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </Pressable>
        </View>

        {thisWeek && (
          <View style={styles.weekStrip}>
            {thisWeek.workouts.map((sw) => {
              const isToday = sw.date === today;
              const isRest = sw.workout.kind === 'rest';
              return (
                <View key={sw.date} style={styles.weekStripDay}>
                  <Text style={[styles.weekStripDow, { color: isToday ? p.accent : p.subtext }]}>
                    {DOW_SHORT[sw.dayOfWeek]}
                  </Text>
                  <View
                    style={[
                      styles.weekStripDot,
                      isRest
                        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border }
                        : { backgroundColor: workoutKindColor(sw.workout.kind) },
                      isToday && { borderWidth: 2, borderColor: p.text },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>Dein Ziel</Text>
          <Text style={[styles.goalText, { color: p.text }]}>
            {profile.goal.mode === 'maintain'
              ? 'Form halten'
              : `${DISTANCE_LABEL[profile.goal.distance]}${profile.goal.weeks ? ` · ${profile.goal.weeks} Wochen` : ''}`}
          </Text>
          <Text style={[styles.cardLabel, { color: p.subtext, marginTop: 14 }]}>
            Aktuelle Fitness (VDOT)
          </Text>
          <Text style={[styles.vdot, { color: p.text }]}>{profile.currentVdot}</Text>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>
            {profile.daysPerWeek} Trainingstage / Woche
          </Text>
          <Pressable onPress={() => router.push('/recalibrate')} hitSlop={8}>
            <Text style={[styles.updateLink, { color: p.accent }]}>Neue Bestzeit? Fitness aktualisieren ›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/training')} hitSlop={8}>
            <Text style={[styles.updateLink, { color: p.accent }]}>Trainingsumfang & Tipps ›</Text>
          </Pressable>
        </View>

        {/* Detraining-Hinweis (nur mit Lauf-Historie) */}
        {detraining && (
          <View style={[styles.card, { backgroundColor: p.card, borderColor: detrainingColor }]}>
            <Text style={[styles.cardLabel, { color: detrainingColor }]}>
              {detraining.level === 'warn' ? 'Form in Gefahr' : 'Trainingsreiz niedrig'}
            </Text>
            <Text style={[styles.todaySub, { color: p.text, marginTop: 4 }]}>{detraining.text}</Text>
          </View>
        )}

        {/* Heute */}
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>Heute</Text>
          {todayLoc && todayLoc.scheduled.workout.kind !== 'rest' ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/workout',
                  params: { week: todayLoc.weekIndex, day: todayLoc.scheduled.dayOfWeek },
                })
              }
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text
                style={[
                  styles.goalText,
                  { color: p.text },
                  todayLoc.scheduled.status === 'skipped' && styles.woNameDone,
                ]}
              >
                {todayLoc.scheduled.workout.name}
              </Text>
              <Text style={[styles.todaySub, { color: todayLoc.scheduled.status === 'skipped' ? p.subtext : p.accent }]}>
                {todayLoc.scheduled.status === 'skipped'
                  ? '✕ Übersprungen · zum Ändern tippen ›'
                  : `${formatDistance(todayLoc.scheduled.workout.estimatedDistanceMeters ?? 0)} · zum Öffnen tippen ›`}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.todayRest, { color: p.subtext }]}>
              {todayLoc ? 'Ruhetag – Erholung zählt auch. 🌙' : 'Heute kein geplantes Training.'}
            </Text>
          )}
          {todayStrength && (
            <Pressable onPress={() => router.push('/strength')} hitSlop={6}>
              <Text style={[styles.todayStrength, { color: p.accent }]}>
                + Kraft: {kindLabel(todayStrength.kind)} ›
              </Text>
            </Pressable>
          )}
        </View>

        {/* Diese Woche */}
        {thisWeek && (
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <View style={styles.weekHead}>
              <Text style={[styles.cardLabel, { color: p.subtext }]}>
                Diese Woche · Woche {thisWeek.index + 1}
              </Text>
              <View style={[styles.badge, { backgroundColor: phaseColor(thisWeek.phase) }]}>
                <Text style={styles.badgeText}>{phaseLabel(thisWeek.phase)}</Text>
              </View>
            </View>
            {weekTraining.length > 0 && (
              <View style={styles.weekProgressRow}>
                <View style={[styles.weekProgressTrack, { backgroundColor: p.chipBg }]}>
                  <View style={[styles.weekProgressFill, { width: `${weekProgress * 100}%`, backgroundColor: '#16a34a' }]} />
                </View>
                <Text style={[styles.weekProgressText, { color: p.subtext }]}>
                  {weekDone}/{weekTraining.length} erledigt
                </Text>
              </View>
            )}
            {weekTraining.map((sw) => {
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
                  style={({ pressed }) => [styles.dayRow, { borderTopColor: p.border, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.dow, { color: isToday ? p.accent : p.subtext }]}>
                    {DOW_SHORT[sw.dayOfWeek]}
                  </Text>
                  <View style={[styles.kindDot, { backgroundColor: workoutKindColor(sw.workout.kind) }]} />
                  {moved && <Text style={[styles.movedTag, { color: p.accent }]}>↔</Text>}
                  <Text
                    style={[styles.woName, { color: p.text }, (done || skipped) && styles.woNameDone]}
                    numberOfLines={1}
                  >
                    {sw.workout.name}
                  </Text>
                  {weekStrengthDays.has(sw.dayOfWeek) && (
                    <Text style={[styles.kraftTag, { color: p.accent, borderColor: p.accent }]}>Kraft</Text>
                  )}
                  {done ? (
                    <Text style={[styles.doneCheck, { color: '#16a34a' }]}>✓</Text>
                  ) : skipped ? (
                    <Text style={[styles.doneCheck, { color: '#d97706' }]}>✕</Text>
                  ) : (
                    <Text style={[styles.woDist, { color: p.subtext }]}>
                      {formatDistance(sw.workout.estimatedDistanceMeters ?? 0)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: p.text }]}>Deine Trainings-Paces</Text>
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          {ZONE_ORDER.map((z, i) => (
            <View
              key={z}
              style={[
                styles.zoneRow,
                i < ZONE_ORDER.length - 1 && { borderBottomWidth: 1, borderBottomColor: p.border },
              ]}
            >
              <Text style={[styles.zoneLabel, { color: p.text }]}>{ZONE_LABEL[z]}</Text>
              <Text style={[styles.zonePace, { color: p.subtext }]}>
                {paceMpsToPerKm(zones[z].lowMps)}–{paceMpsToPerKm(zones[z].highMps)} /km
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: p.text }]}>Geschätzte Wettkampfzeiten</Text>
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          {RACE_ORDER.map((r, i) => (
            <View
              key={r}
              style={[
                styles.zoneRow,
                i < RACE_ORDER.length - 1 && { borderBottomWidth: 1, borderBottomColor: p.border },
              ]}
            >
              <Text style={[styles.zoneLabel, { color: p.text }]}>{DISTANCE_LABEL[r]}</Text>
              <Text style={[styles.zonePace, { color: p.subtext }]}>{formatRaceTime(races[r])}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/plan')}
          style={({ pressed }) => [
            styles.planCta,
            { backgroundColor: p.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: p.accentText }]}>Trainingsplan ansehen</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/activities')}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: p.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: p.accent }]}>Fortschritt & Läufe importieren</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: p.text }]}>Mehr trainieren</Text>
        <View style={styles.tileGrid}>
          <Pressable
            onPress={() => router.push('/strength')}
            style={({ pressed }) => [styles.tile, { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.tileEmoji}>💪</Text>
            <Text style={[styles.tileText, { color: p.text }]}>Krafttraining</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/nutrition')}
            style={({ pressed }) => [styles.tile, { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.tileEmoji}>🍽️</Text>
            <Text style={[styles.tileText, { color: p.text }]}>Ernährung</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/training')}
            style={({ pressed }) => [styles.tile, { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.tileEmoji}>📅</Text>
            <Text style={[styles.tileText, { color: p.text }]}>Trainingsumfang</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  gearBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  lead: { fontSize: 26, fontWeight: '700', marginTop: 8 },
  leadSub: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  cta: { marginTop: 24, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  planCta: { marginTop: 4, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  secondaryCta: { marginTop: 4, borderRadius: 14, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  cardLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  goalText: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  vdot: { fontSize: 44, fontWeight: '800', marginVertical: 2 },
  updateLink: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  todaySub: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  todayStrength: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  todayRest: { fontSize: 16, marginTop: 4 },
  kraftTag: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  movedTag: { fontSize: 13, fontWeight: '800' },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  weekStripDay: { alignItems: 'center', gap: 6 },
  weekStripDow: { fontSize: 12, fontWeight: '600' },
  weekStripDot: { width: 10, height: 10, borderRadius: 5 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  weekProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 2 },
  weekProgressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  weekProgressFill: { height: 6, borderRadius: 3 },
  weekProgressText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1 },
  dow: { width: 24, fontSize: 14, fontWeight: '700' },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  woName: { flex: 1, fontSize: 15, fontWeight: '600' },
  woNameDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  woDist: { fontSize: 14, fontVariant: ['tabular-nums'] },
  doneCheck: { fontSize: 16, fontWeight: '800' },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  zoneLabel: { fontSize: 15, fontWeight: '600' },
  zonePace: { fontSize: 15, fontVariant: ['tabular-nums'] },
  tileGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  tile: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 16, alignItems: 'center', gap: 6 },
  tileEmoji: { fontSize: 20 },
  tileText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
