import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { allZones, paceMpsToPerKm, type RaceDistance, type ZoneKey } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
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

export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const reset = useProfileStore((s) => s.reset);

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

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.brand, { color: p.accent }]}>PaceForge</Text>

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>Dein Ziel</Text>
          <Text style={[styles.goalText, { color: p.text }]}>
            {DISTANCE_LABEL[profile.goal.distance]}
            {profile.goal.weeks ? ` · ${profile.goal.weeks} Wochen` : ''}
          </Text>
          <Text style={[styles.cardLabel, { color: p.subtext, marginTop: 14 }]}>
            Aktuelle Fitness (VDOT)
          </Text>
          <Text style={[styles.vdot, { color: p.text }]}>{profile.currentVdot}</Text>
          <Text style={[styles.cardLabel, { color: p.subtext }]}>
            {profile.daysPerWeek} Trainingstage / Woche
          </Text>
        </View>

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
                {paceMpsToPerKm(zones[z].highMps)}–{paceMpsToPerKm(zones[z].lowMps)} /km
              </Text>
            </View>
          ))}
        </View>

        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: p.subtext }]}>Angaben zurücksetzen</Text>
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
  ctaText: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  cardLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  goalText: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  vdot: { fontSize: 44, fontWeight: '800', marginVertical: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
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
});
