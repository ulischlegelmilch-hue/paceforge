import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IRON_GUIDANCE,
  NUTRITION_DISCLAIMER,
  NUTRITION_LIBRARY,
  STRENGTH_NOTES,
} from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';

const APP_VERSION = '0.1.0';

function Card({ title, children, p }: { title: string; children: ReactNode; p: Palette }) {
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <Text style={[styles.cardTitle, { color: p.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function AboutScreen() {
  const p = usePalette();
  const router = useRouter();

  const sources = Array.from(new Set(NUTRITION_LIBRARY.map((r) => r.source))).sort();

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Über & Quellen</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          PaceForge · Version {APP_VERSION}. Adaptive Lauf-Trainingspläne mit evidenzbasiertem Kraft- und
          Ernährungscoaching.
        </Text>

        <Card title="Hinweis" p={p}>
          <Text style={[styles.body, { color: p.subtext }]}>
            {NUTRITION_DISCLAIMER} Keine medizinische Beratung – bei gesundheitlichen Fragen bitte
            ärztlichen Rat einholen.
          </Text>
        </Card>

        <Card title="Krafttraining – Evidenz" p={p}>
          <Text style={[styles.body, { color: p.subtext }]}>• {STRENGTH_NOTES.benefit}</Text>
          <Text style={[styles.body, { color: p.subtext }]}>• {STRENGTH_NOTES.dose}</Text>
          <Text style={[styles.body, { color: p.subtext }]}>• {STRENGTH_NOTES.interference}</Text>
        </Card>

        <Card title="Ernährung – Quellen" p={p}>
          <Text style={[styles.body, { color: p.subtext }]}>
            Die Rezepte stammen von benannten Sport-Ernährungsfachleuten. Nährwerte werden nur angezeigt,
            wo die Quelle sie angibt – keine erfundenen Zahlen.
          </Text>
          {sources.map((s) => (
            <Text key={s} style={[styles.sourceItem, { color: p.text }]}>
              · {s}
            </Text>
          ))}
          <Text style={[styles.body, { color: p.subtext, marginTop: 6 }]}>
            „Run Fast. Eat Slow.": Autorinnen sind keine Ernährungsberaterinnen (RD); der Verlag nennt keine
            Nährwerte – nur als Inspiration.
          </Text>
        </Card>

        <Card title="Eisen" p={p}>
          <Text style={[styles.body, { color: p.subtext }]}>{IRON_GUIDANCE}</Text>
        </Card>

        <Pressable onPress={() => router.push('/glossary')} hitSlop={6}>
          <Text style={[styles.link, { color: p.accent }]}>Workout-Arten erklärt ›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 12 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 20 },
  sourceItem: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
});
