import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/ui/colors';
import { title, heading, body, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
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
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 4 }]}>Workout-Arten erklärt</Text>
        <Text style={[body, { color: p.subtext }]}>
          Dein Plan kombiniert verschiedene Laufarten – jede hat einen eigenen Trainingszweck.
        </Text>

        {WORKOUT_KIND_ORDER.map((kind) => (
          <Card key={kind}>
            <View style={styles.rowHead}>
              <View style={[styles.dot, { backgroundColor: workoutKindColor(kind) }]} />
              <Text style={[heading, { color: p.text }]}>{workoutKindLabel(kind)}</Text>
            </View>
            <Text style={[body, { color: p.subtext, marginTop: 8 }]}>{workoutKindBlurb(kind)}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
