import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/ui/colors';
import { WORKOUT_KIND_ORDER, workoutKindBlurb, workoutKindColor, workoutKindLabel } from '@/ui/format';

// Kurzes Nachschlagewerk: was bedeuten die Workout-Arten im Plan. Eigene Texte,
// abgeleitet aus der VDOT-Zonen-Dokumentation im Core-Paket.
export default function GlossaryScreen() {
  const p = usePalette();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Workout-Arten erklärt</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          Dein Plan kombiniert verschiedene Laufarten – jede hat einen eigenen Trainingszweck.
        </Text>

        {WORKOUT_KIND_ORDER.map((kind) => (
          <View key={kind} style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <View style={styles.rowHead}>
              <View style={[styles.dot, { backgroundColor: workoutKindColor(kind) }]} />
              <Text style={[styles.kindTitle, { color: p.text }]}>{workoutKindLabel(kind)}</Text>
            </View>
            <Text style={[styles.blurb, { color: p.subtext }]}>{workoutKindBlurb(kind)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 12 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  kindTitle: { fontSize: 16, fontWeight: '700' },
  blurb: { fontSize: 14, lineHeight: 20 },
});
