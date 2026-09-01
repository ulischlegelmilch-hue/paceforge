import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { allZones, paceMpsToPerKm, predictedRaceTimes, type RaceDistance, type StandardRace, type ZoneKey } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, bodyStrong, caption, button as buttonType } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { formatRaceTime } from '@/ui/format';
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

// Bündelt alles, was zuvor Home überladen hat, aber nicht "heute/diese Woche"
// ist: Paces, Wettkampfzeiten, die Kraft/Ernährung/Trainingsumfang-Kacheln und
// Max' Training. Eigener Tab statt Scroll-Anhängsel.
export default function TrainingHubScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.centerWrap}>
          <Text style={[body, { color: p.subtext, textAlign: 'center' }]}>
            Sobald dein Profil steht, findest du hier deine Trainings-Paces, Wettkampfzeiten und mehr.
          </Text>
          <Button title="Plan erstellen" onPress={() => router.push('/onboarding')} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  const zones = allZones(profile.currentVdot);
  const races = predictedRaceTimes(profile.currentVdot);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[title, { color: p.text }]}>Training</Text>

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
          <Pressable onPress={() => router.push('/recalibrate')} hitSlop={6} style={{ marginTop: 12 }}>
            <Text style={[caption, { color: p.text }]}>Neue Bestzeit? Fitness aktualisieren ›</Text>
          </Pressable>
        </Card>

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

        {hasBackend && (
          <Button
            title="Max' Training ansehen"
            variant="secondary"
            onPress={() => router.push('/max')}
            style={{ marginTop: 4 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  scroll: { padding: 20, gap: 14 },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  tileGrid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 20, paddingVertical: 18, alignItems: 'center', gap: 10 },
  tileIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
