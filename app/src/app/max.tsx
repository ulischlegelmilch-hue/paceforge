import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paceMpsToPerKm, ymdOf, type Workout } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { formatDistance } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { fetchMaxPlannedTraining, type PlannedTraining } from '@/api/kids';

function buildWorkoutFromTraining(training: PlannedTraining): Workout {
  const distanceMeters = training.distanceGoalMeters ?? 3000;
  const paceMps = training.targetPaceSecPerKm ? 1000 / training.targetPaceSecPerKm : undefined;
  const name = training.opponentName ? `Mit Max gegen ${training.opponentName}` : 'Lauf mit Max';
  return {
    id: `kids-${Date.now()}`,
    kind: 'easy',
    name,
    elements: [
      {
        intensity: 'active',
        duration: { type: 'distance', meters: distanceMeters },
        target: paceMps ? { type: 'pace', lowMps: paceMps * 0.95, highMps: paceMps * 1.05 } : { type: 'none' },
      },
    ],
    estimatedDistanceMeters: distanceMeters,
    estimatedDurationSeconds: paceMps ? Math.round(distanceMeters / paceMps) : undefined,
  };
}

export default function MaxScreen() {
  const p = usePalette();
  const router = useRouter();
  const childCode = useProfileStore((s) => s.kidsChildCode);
  const setKidsChildCode = useProfileStore((s) => s.setKidsChildCode);
  const overrideWorkoutForDate = useProfileStore((s) => s.overrideWorkoutForDate);
  const plan = useProfileStore((s) => s.plan);

  const [codeInput, setCodeInput] = useState(childCode ?? '');
  const [training, setTraining] = useState<PlannedTraining | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(code: string) {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchMaxPlannedTraining(code);
      setTraining(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (childCode) void load(childCode);
  }, [childCode]);

  function saveCode() {
    const code = codeInput.trim();
    if (!code) return;
    setKidsChildCode(code);
  }

  function takeOver() {
    if (!training) return;
    const workout = buildWorkoutFromTraining(training);
    const today = ymdOf(new Date());
    overrideWorkoutForDate(today, workout);
    Alert.alert('Übernommen', `„${workout.name}" ist jetzt dein heutiges Training.`, [
      { text: 'OK', onPress: () => router.push('/plan') },
    ]);
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 12 }]}>
          ‹ Zurück
        </Text>
        <Text style={[title, { color: p.text }]}>Max' Training</Text>
        <Text style={[body, { color: p.subtext, marginTop: 4, marginBottom: 16 }]}>
          Sieh, welches Training Max sich vorgenommen hat, und übernimm dieselbe Vorgabe für dich.
        </Text>

        {!childCode ? (
          <Card>
            <Text style={[heading, { color: p.text }]}>Mit Max' App koppeln</Text>
            <Text style={[body, { color: p.subtext, marginTop: 6, marginBottom: 12 }]}>
              Den Code findest du in PaceForge Kids im Bereich „Für Mama und Papa".
            </Text>
            <TextInput
              value={codeInput}
              onChangeText={setCodeInput}
              placeholder="z. B. max-ab12cd"
              placeholderTextColor={p.faint}
              autoCapitalize="none"
              style={[styles.input, { color: p.text, backgroundColor: p.surfaceRaised }]}
            />
            <Button title="Koppeln" onPress={saveCode} disabled={!codeInput.trim()} style={{ marginTop: 12 }} />
          </Card>
        ) : (
          <>
            {loading && <Text style={[body, { color: p.subtext }]}>Lädt…</Text>}
            {error && (
              <Card outlined outlineColor={p.warning}>
                <Text style={[body, { color: p.text }]}>{error}</Text>
              </Card>
            )}
            {!loading && !error && !training && (
              <Card>
                <Text style={[body, { color: p.subtext }]}>
                  Max hat noch kein Training eingestellt, oder der Code ist noch nicht korrekt.
                </Text>
              </Card>
            )}
            {training && (
              <Card>
                <Text style={[heading, { color: p.text }]}>
                  {training.opponentName ? `Gegen ${training.opponentName}` : 'Freies Training'}
                </Text>
                {training.targetPaceSecPerKm != null && (
                  <Text style={[bodyStrong, { color: p.accent, marginTop: 6 }]}>
                    {paceMpsToPerKm(1000 / training.targetPaceSecPerKm)} /km
                  </Text>
                )}
                {training.distanceGoalMeters != null && (
                  <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
                    Ziel: {formatDistance(training.distanceGoalMeters)}
                  </Text>
                )}
                {training.intervalRunSeconds != null && training.intervalWalkSeconds != null && (
                  <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
                    Intervalle: {training.intervalRunSeconds}s laufen / {training.intervalWalkSeconds}s gehen
                  </Text>
                )}
                <Text style={[caption, { color: p.faint, marginTop: 10 }]}>
                  Stand: {new Date(training.updatedAt).toLocaleString('de-DE')}
                </Text>
                {plan && (
                  <Button title="Für mich übernehmen" onPress={takeOver} style={{ marginTop: 14 }} />
                )}
              </Card>
            )}
            <Pressable onPress={() => void load(childCode)} hitSlop={8}>
              <Text style={[caption, { color: p.text, marginTop: 12 }]}>Aktualisieren ›</Text>
            </Pressable>
            <Pressable onPress={() => setKidsChildCode(null)} hitSlop={8}>
              <Text style={[caption, { color: p.subtext, marginTop: 8 }]}>Kopplung entfernen</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 12 },
  input: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, fontSize: 16 },
});
