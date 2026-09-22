import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  assessDetraining,
  kindLabel,
  locateByDate,
  strengthOnDay,
  weekOf,
  weeklyAnalysis,
  ymdOf,
  type RaceDistance,
} from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { display, eyebrow, heading, title, body, bodyStrong, caption, button as buttonType } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Eyebrow } from '@/ui/components/Eyebrow';
import { DOW_SHORT, formatDistance, phaseColor, phaseLabel, workoutKindColor } from '@/ui/format';
import { useProfileStore } from '@/store/profile';

const DISTANCE_LABEL: Record<RaceDistance, string> = {
  '5k': '5 km',
  '10k': '10 km',
  half: 'Halbmarathon',
  marathon: 'Marathon',
  custom: 'Freie Distanz',
};

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

  const today = ymdOf(new Date());
  const todayLoc = plan ? locateByDate(plan, today) : undefined;
  const thisWeek = plan ? weekOf(plan, today) : undefined;
  const eq = profile.strength?.equipment ?? 'bodyweight';
  const upcomingRaceEvent = (profile.raceEvents ?? [])
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const spw = profile.strength?.sessionsPerWeek ?? 2;
  const todayDow = todayLoc?.scheduled.dayOfWeek ?? new Date().getDay();
  const todayStrength = thisWeek ? strengthOnDay(thisWeek, eq, spw, todayDow) : undefined;
  const detraining = assessDetraining(activities);
  const detrainingColor = detraining?.level === 'warn' ? p.danger : p.warning;

  const weekTraining = thisWeek?.workouts.filter((w) => w.workout.kind !== 'rest') ?? [];
  const weekDone = weekTraining.filter((w) => w.status === 'completed').length;
  // Eigene Läufe (z. B. an Ruhetagen) zählen als echtes, absolviertes Training
  // mit - der Fortschrittsbalken darf dadurch über 100 % geplant hinausgehen,
  // gedeckelt auf 100 % Anzeige, mit eigenem Hinweis auf die Zusatzläufe.
  const weekAnalysis = plan ? weeklyAnalysis(plan, activities) : null;
  const extraRunsCount = weekAnalysis?.extraActivities.length ?? 0;
  const weekDoneWithExtras = weekDone + extraRunsCount;
  const weekProgress = weekTraining.length > 0 ? Math.min(1, weekDoneWithExtras / weekTraining.length) : 0;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[heading, { color: p.text, letterSpacing: -0.2 }]}>PaceForge</Text>
        </View>

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
            <View style={styles.weekStrip}>
              {thisWeek.workouts.map((sw) => {
                const isToday = sw.date === today;
                const isRest = sw.workout.kind === 'rest';
                return (
                  <View key={sw.date} style={styles.weekStripDay}>
                    <Text style={[caption, { color: isToday ? p.accent : p.faint, fontSize: 11 }]}>{DOW_SHORT[sw.dayOfWeek]}</Text>
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
            {weekTraining.length > 0 && (
              <View style={styles.weekProgressRow}>
                <View style={[styles.weekProgressTrack, { backgroundColor: p.surfaceRaised }]}>
                  <View style={[styles.weekProgressFill, { width: `${weekProgress * 100}%`, backgroundColor: p.success }]} />
                </View>
                <Text style={[caption, { color: p.subtext }]}>
                  {weekDoneWithExtras}/{weekTraining.length} erledigt
                  {extraRunsCount > 0 ? ` (+${extraRunsCount} eigene)` : ''}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => router.push('/calendar')}
              hitSlop={6}
              style={({ pressed }) => [styles.weekFooterLink, { borderTopColor: p.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[caption, { color: p.text, fontFamily: buttonType.fontFamily }]}>
                Alle Tage & Verlauf im Kalender ansehen ›
              </Text>
            </Pressable>
          </Card>
        )}

        {upcomingRaceEvent && (
          <Card style={{ marginTop: 4 }}>
            <Text style={[eyebrow, { color: p.subtext }]}>Nächster Wettkampf</Text>
            <Text style={[bodyStrong, { color: p.text, marginTop: 4 }]}>
              {upcomingRaceEvent.name ?? formatDistance(upcomingRaceEvent.distanceMeters)}
            </Text>
            <Button
              title="Wettkampf-Audioguide öffnen"
              onPress={() => router.push({ pathname: '/race-guide', params: { eventId: upcomingRaceEvent.id } })}
              style={{ marginTop: 12 }}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroll: { padding: 20, gap: 14 },
  heroCard: { paddingBottom: 22 },
  heroLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  strike: { textDecorationLine: 'line-through', opacity: 0.5 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 10, marginBottom: 2 },
  weekStripDay: { alignItems: 'center', gap: 8 },
  weekStripDot: { width: 12, height: 12, borderRadius: 6 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  weekProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 },
  weekProgressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  weekProgressFill: { height: 6, borderRadius: 3 },
  weekFooterLink: { marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
});
