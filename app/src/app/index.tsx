import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  allZones,
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
import { DOW_SHORT, formatDistance, formatRaceTime, phaseColor, phaseLabel } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { hasBackend } from '@/config';
import { pullSnapshot, pushSnapshot } from '@/api/sync';

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
  const deviceId = useProfileStore((s) => s.deviceId);
  const hydrateFromSnapshot = useProfileStore((s) => s.hydrateFromSnapshot);
  const reset = useProfileStore((s) => s.reset);
  const [syncBusy, setSyncBusy] = useState(false);

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

  async function onSyncPush() {
    try {
      setSyncBusy(true);
      const at = await pushSnapshot(deviceId, { profile, plan, activities });
      Alert.alert('In Cloud gesichert', `Stand: ${new Date(at).toLocaleString('de-DE')}`);
    } catch (e) {
      Alert.alert('Sichern fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setSyncBusy(false);
    }
  }
  async function onSyncPull() {
    try {
      setSyncBusy(true);
      const snap = await pullSnapshot(deviceId);
      if (!snap) {
        Alert.alert('Nichts gefunden', 'Für dieses Gerät liegt noch kein Cloud-Stand vor.');
        return;
      }
      hydrateFromSnapshot({ profile: snap.profile, plan: snap.plan, activities: snap.activities ?? [] });
      Alert.alert('Aus Cloud geladen', 'Deine Daten wurden übernommen.');
    } catch (e) {
      Alert.alert('Laden fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.brand, { color: p.accent }]}>PaceForge</Text>

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
              <Text style={[styles.goalText, { color: p.text }]}>{todayLoc.scheduled.workout.name}</Text>
              <Text style={[styles.todaySub, { color: p.accent }]}>
                {formatDistance(todayLoc.scheduled.workout.estimatedDistanceMeters ?? 0)} · zum Öffnen tippen ›
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
            {thisWeek.workouts
              .filter((w) => w.workout.kind !== 'rest')
              .map((sw) => {
                const isToday = sw.date === today;
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
                    <Text style={[styles.woName, { color: p.text }]} numberOfLines={1}>
                      {sw.workout.name}
                    </Text>
                    {weekStrengthDays.has(sw.dayOfWeek) && (
                      <Text style={[styles.kraftTag, { color: p.accent, borderColor: p.accent }]}>Kraft</Text>
                    )}
                    <Text style={[styles.woDist, { color: p.subtext }]}>
                      {formatDistance(sw.workout.estimatedDistanceMeters ?? 0)}
                    </Text>
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

        <View style={styles.dualRow}>
          <Pressable
            onPress={() => router.push('/strength')}
            style={({ pressed }) => [styles.dualCta, { borderColor: p.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.dualText, { color: p.accent }]}>Krafttraining</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/nutrition')}
            style={({ pressed }) => [styles.dualCta, { borderColor: p.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.dualText, { color: p.accent }]}>Ernährungscoach</Text>
          </Pressable>
        </View>

        {hasBackend && (
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <Text style={[styles.cardLabel, { color: p.subtext }]}>Cloud-Sync</Text>
            <Text style={[styles.syncId, { color: p.subtext }]}>Gerät: {deviceId}</Text>
            <View style={styles.syncRow}>
              <Pressable
                onPress={onSyncPush}
                disabled={syncBusy}
                style={[styles.syncBtn, { backgroundColor: p.accent, opacity: syncBusy ? 0.6 : 1 }]}
              >
                {syncBusy ? (
                  <ActivityIndicator color={p.accentText} />
                ) : (
                  <Text style={[styles.syncBtnText, { color: p.accentText }]}>In Cloud sichern</Text>
                )}
              </Pressable>
              <Pressable
                onPress={onSyncPull}
                disabled={syncBusy}
                style={[styles.syncBtnOutline, { borderColor: p.accent, opacity: syncBusy ? 0.6 : 1 }]}
              >
                <Text style={[styles.syncBtnText, { color: p.accent }]}>Aus Cloud laden</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: p.subtext }]}>Angaben zurücksetzen</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/about')} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: p.subtext }]}>Über & Quellen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  brand: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  lead: { fontSize: 26, fontWeight: '700', marginTop: 8 },
  leadSub: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  cta: { marginTop: 24, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  planCta: { marginTop: 4, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  secondaryCta: { marginTop: 4, borderRadius: 14, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
  dualRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dualCta: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
  dualText: { fontSize: 15, fontWeight: '700' },
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
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  dow: { width: 26, fontSize: 14, fontWeight: '700' },
  woName: { flex: 1, fontSize: 15, fontWeight: '600' },
  woDist: { fontSize: 14, fontVariant: ['tabular-nums'] },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  zoneLabel: { fontSize: 15, fontWeight: '600' },
  zonePace: { fontSize: 15, fontVariant: ['tabular-nums'] },
  resetBtn: { alignItems: 'center', paddingVertical: 10 },
  resetText: { fontSize: 14 },
  syncId: { fontSize: 12, marginTop: 4, marginBottom: 12, fontVariant: ['tabular-nums'] },
  syncRow: { flexDirection: 'row', gap: 10 },
  syncBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  syncBtnOutline: { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  syncBtnText: { fontSize: 14, fontWeight: '700' },
});
