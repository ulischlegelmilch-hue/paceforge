import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IRON_GUIDANCE,
  NUTRITION_DISCLAIMER,
  NUTRITION_LIBRARY,
  STRENGTH_NOTES,
} from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';

const APP_VERSION = '0.1.0';

function Section({ label, children }: { label: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <Card>
      <Text style={[heading, { color: p.text }]}>{label}</Text>
      {children}
    </Card>
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
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 4 }]}>Über & Quellen</Text>
        <Text style={[body, { color: p.subtext }]}>
          PaceForge · Version {APP_VERSION}. Adaptive Lauf-Trainingspläne mit evidenzbasiertem Kraft- und
          Ernährungscoaching.
        </Text>

        <Section label="Hinweis">
          <Text style={[caption, { color: p.subtext, marginTop: 6, lineHeight: 19 }]}>
            {NUTRITION_DISCLAIMER} Keine medizinische Beratung – bei gesundheitlichen Fragen bitte
            ärztlichen Rat einholen.
          </Text>
        </Section>

        <Section label="Krafttraining – Evidenz">
          <Text style={[caption, { color: p.subtext, marginTop: 6, lineHeight: 19 }]}>• {STRENGTH_NOTES.benefit}</Text>
          <Text style={[caption, { color: p.subtext, marginTop: 4, lineHeight: 19 }]}>• {STRENGTH_NOTES.dose}</Text>
          <Text style={[caption, { color: p.subtext, marginTop: 4, lineHeight: 19 }]}>• {STRENGTH_NOTES.interference}</Text>
        </Section>

        <Section label="Ernährung – Quellen">
          <Text style={[caption, { color: p.subtext, marginTop: 6, lineHeight: 19 }]}>
            Die Rezepte stammen von benannten Sport-Ernährungsfachleuten. Nährwerte werden nur angezeigt,
            wo die Quelle sie angibt – keine erfundenen Zahlen.
          </Text>
          {sources.map((s) => (
            <Text key={s} style={[bodyStrong, { color: p.text, marginTop: 6 }]}>
              · {s}
            </Text>
          ))}
          <Text style={[caption, { color: p.subtext, marginTop: 8, lineHeight: 19 }]}>
            „Run Fast. Eat Slow.": Autorinnen sind keine Ernährungsberaterinnen (RD); der Verlag nennt keine
            Nährwerte – nur als Inspiration.
          </Text>
        </Section>

        <Section label="Eisen">
          <Text style={[caption, { color: p.subtext, marginTop: 6, lineHeight: 19 }]}>{IRON_GUIDANCE}</Text>
        </Section>

        <Pressable onPress={() => router.push('/glossary')} hitSlop={6}>
          <Text style={[caption, { color: p.text, textAlign: 'center', paddingVertical: 8 }]}>
            Workout-Arten erklärt ›
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
});
