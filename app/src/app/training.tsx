import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assessTraining, terrainAdvice, TERRAIN_LABEL, type AdviceLevel } from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { title, heading, eyebrow, body, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { Button } from '@/ui/components/Button';
import { useProfileStore } from '@/store/profile';

const RUN_OPTIONS = [3, 4, 5, 6];
const STRENGTH_OPTIONS = [0, 1, 2, 3];
// Anzeige Mo..So (0=So..6=Sa wie im Domain-Modell).
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'So' },
];

function levelColor(level: AdviceLevel, p: Palette): string {
  if (level === 'good') return p.success;
  if (level === 'warn') return p.warning;
  return p.accent;
}

export default function TrainingScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const setDaysPerWeek = useProfileStore((s) => s.setDaysPerWeek);
  const setStrengthSessions = useProfileStore((s) => s.setStrengthSessions);
  const setAvailableDays = useProfileStore((s) => s.setAvailableDays);

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
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 4 }]}>Trainingsumfang</Text>
        <Text style={[body, { color: p.subtext }]}>
          Wähle, wie oft du pro Woche laufen und Kraft trainieren willst. Änderungen an den Lauftagen
          erzeugen deinen Plan neu.
        </Text>

        <Text style={[eyebrow, { color: p.subtext, marginTop: 6 }]}>Lauftage pro Woche</Text>
        <View style={styles.chipWrap}>
          {RUN_OPTIONS.map((d) => (
            <Chip key={d} label={`${d}`} selected={daysPerWeek === d} onPress={() => setDaysPerWeek(d)} />
          ))}
        </View>
        <Text style={[caption, { color: p.subtext }]}>
          Empfohlen für dein Ziel: mindestens {assessment.recommendedRunDays} Tage.
        </Text>

        <Text style={[eyebrow, { color: p.subtext, marginTop: 6 }]}>Verfügbare Wochentage</Text>
        <View style={styles.chipWrap}>
          {WEEKDAY_OPTIONS.map((d) => {
            const set = new Set(profile.availableDays ?? []);
            const selected = set.has(d.value);
            return (
              <Chip
                key={d.value}
                label={d.label}
                selected={selected}
                onPress={() => {
                  const next = new Set(set);
                  if (selected) next.delete(d.value);
                  else next.add(d.value);
                  setAvailableDays(next.size > 0 ? Array.from(next) : undefined);
                }}
              />
            );
          })}
        </View>
        <Text style={[caption, { color: p.subtext }]}>
          Wähle ruhig mehr Tage als du brauchst – wir verteilen deine {daysPerWeek} Trainingstage
          gleichmäßig darauf. Ohne Auswahl nutzen wir ein Standardmuster (Di/Do/Sa).
        </Text>

        <Text style={[eyebrow, { color: p.subtext, marginTop: 6 }]}>Krafteinheiten pro Woche</Text>
        <View style={styles.chipWrap}>
          {STRENGTH_OPTIONS.map((d) => (
            <Chip
              key={d}
              label={d === 0 ? 'Aus' : `${d}`}
              selected={strengthPerWeek === d}
              onPress={() => setStrengthSessions(d)}
            />
          ))}
        </View>

        <Card style={{ marginTop: 6 }}>
          <Text style={[heading, { color: p.text }]}>Reicht das für dein Ziel?</Text>
          <View style={{ marginTop: 8, gap: 10 }}>
            {assessment.advice.map((a, i) => (
              <View key={i} style={styles.adviceRow}>
                <View style={[styles.dot, { backgroundColor: levelColor(a.level, p) }]} />
                <Text style={[body, { flex: 1, color: p.text }]}>{a.text}</Text>
              </View>
            ))}
          </View>
        </Card>

        {profile.goal.courseTerrain && (
          <Card>
            <Text style={[heading, { color: p.text }]}>Gelände: {TERRAIN_LABEL[profile.goal.courseTerrain]}</Text>
            <Text style={[body, { color: p.text, marginTop: 6 }]}>{terrainAdvice(profile.goal.courseTerrain)}</Text>
          </Card>
        )}

        <Button title="Krafteinheiten ansehen ›" variant="secondary" onPress={() => router.push('/strength')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  adviceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
