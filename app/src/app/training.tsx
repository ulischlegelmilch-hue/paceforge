import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assessTraining, type AdviceLevel } from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';

const RUN_OPTIONS = [3, 4, 5, 6];
const STRENGTH_OPTIONS = [0, 1, 2, 3];

function levelColor(level: AdviceLevel, p: Palette): string {
  if (level === 'good') return '#16a34a';
  if (level === 'warn') return '#d97706';
  return p.accent;
}

function Chip({ label, selected, onPress, p }: { label: string; selected: boolean; onPress: () => void; p: Palette }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? p.accent : p.chipBg, borderColor: selected ? p.accent : p.border }]}
    >
      <Text style={[styles.chipText, { color: selected ? p.accentText : p.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function TrainingScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const setDaysPerWeek = useProfileStore((s) => s.setDaysPerWeek);
  const setStrengthSessions = useProfileStore((s) => s.setStrengthSessions);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.center}>
          <Text style={{ color: p.subtext }}>Erst einen Plan erstellen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const daysPerWeek = profile.daysPerWeek;
  const strengthPerWeek = profile.strength?.sessionsPerWeek ?? 2;
  const assessment = assessTraining({ distance: profile.goal.distance, daysPerWeek, strengthPerWeek });

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Trainingsumfang</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          Wähle, wie oft du pro Woche laufen und Kraft trainieren willst. Änderungen an den Lauftagen
          erzeugen deinen Plan neu.
        </Text>

        <Text style={[styles.label, { color: p.subtext }]}>Lauftage pro Woche</Text>
        <View style={styles.chipWrap}>
          {RUN_OPTIONS.map((d) => (
            <Chip key={d} label={`${d}`} selected={daysPerWeek === d} onPress={() => setDaysPerWeek(d)} p={p} />
          ))}
        </View>
        <Text style={[styles.hint, { color: p.subtext }]}>
          Empfohlen für dein Ziel: mindestens {assessment.recommendedRunDays} Tage.
        </Text>

        <Text style={[styles.label, { color: p.subtext }]}>Krafteinheiten pro Woche</Text>
        <View style={styles.chipWrap}>
          {STRENGTH_OPTIONS.map((d) => (
            <Chip
              key={d}
              label={d === 0 ? 'Aus' : `${d}`}
              selected={strengthPerWeek === d}
              onPress={() => setStrengthSessions(d)}
              p={p}
            />
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.cardTitle, { color: p.text }]}>Reicht das für dein Ziel?</Text>
          {assessment.advice.map((a, i) => (
            <View key={i} style={styles.adviceRow}>
              <View style={[styles.dot, { backgroundColor: levelColor(a.level, p) }]} />
              <Text style={[styles.adviceText, { color: p.text }]}>{a.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/strength')}
          style={({ pressed }) => [styles.linkBtn, { borderColor: p.accent, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.linkText, { color: p.accent }]}>Krafteinheiten ansehen ›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 12 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 18 },
  chipText: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, marginTop: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  adviceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  adviceText: { flex: 1, fontSize: 14, lineHeight: 20 },
  linkBtn: { borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  linkText: { fontSize: 15, fontWeight: '700' },
});
