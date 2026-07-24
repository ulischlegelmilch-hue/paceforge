import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  paceMpsToPerKm,
  parseGoalText,
  vdotFromFitness,
  zonePaceMps,
  type FitnessInput,
  type Goal,
  type RaceDistance,
  type SelfRatedLevel,
} from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';

// ---- kleine wiederverwendbare Chip-Auswahl ----------------------------------
function Chip({
  label,
  selected,
  onPress,
  p,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  p: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? p.accent : p.chipBg, borderColor: selected ? p.accent : p.border },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? p.accentText : p.text }]}>{label}</Text>
    </Pressable>
  );
}

const DISTANCES: { key: RaceDistance; label: string }[] = [
  { key: '5k', label: '5 km' },
  { key: '10k', label: '10 km' },
  { key: 'half', label: 'Halbmarathon' },
  { key: 'marathon', label: 'Marathon' },
];

const WEEK_OPTIONS = [8, 12, 16, 20];
const DAY_OPTIONS = [3, 4, 5, 6];
const LEVELS: { key: SelfRatedLevel; label: string }[] = [
  { key: 'beginner', label: 'Einsteiger' },
  { key: 'intermediate', label: 'Fortgeschritten' },
  { key: 'advanced', label: 'Ambitioniert' },
];

type FitnessMode = 'race' | 'level';

export default function Onboarding() {
  const p = usePalette();
  const router = useRouter();
  const createProfile = useProfileStore((s) => s.createProfile);

  const [step, setStep] = useState(0);

  const [distance, setDistance] = useState<RaceDistance | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [targetTimeSeconds, setTargetTimeSeconds] = useState<number | null>(null);

  const [quickText, setQuickText] = useState('');
  const [quickHint, setQuickHint] = useState<string | null>(null);

  function applyQuick() {
    const parsed = parseGoalText(quickText);
    const found: string[] = [];
    if (parsed.distance) {
      setDistance(parsed.distance);
      found.push('Distanz');
    }
    if (parsed.weeks) {
      setWeeks(parsed.weeks);
      found.push('Zeitrahmen');
    }
    if (parsed.daysPerWeek) {
      setDays(parsed.daysPerWeek);
      found.push('Trainingstage');
    }
    if (parsed.targetTimeSeconds) {
      setTargetTimeSeconds(parsed.targetTimeSeconds);
      found.push('Zielzeit');
    }
    setQuickHint(found.length ? `Erkannt: ${found.join(', ')}.` : 'Nichts erkannt – wähle unten manuell.');
  }

  const [fitnessMode, setFitnessMode] = useState<FitnessMode>('race');
  const [raceMeters, setRaceMeters] = useState<number>(5000);
  const [raceMin, setRaceMin] = useState('');
  const [raceSec, setRaceSec] = useState('');
  const [level, setLevel] = useState<SelfRatedLevel | null>(null);

  // Aus der aktuellen Fitness-Eingabe eine FitnessInput bauen (falls valide).
  const fitness: FitnessInput | null = useMemo(() => {
    if (fitnessMode === 'race') {
      const m = parseInt(raceMin, 10);
      const s = raceSec === '' ? 0 : parseInt(raceSec, 10);
      if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(s) || s < 0 || s >= 60) return null;
      return { recentRace: { distanceMeters: raceMeters, timeSeconds: m * 60 + s } };
    }
    return level ? { selfRatedLevel: level } : null;
  }, [fitnessMode, raceMin, raceSec, raceMeters, level]);

  const previewVdot = fitness ? Math.round(vdotFromFitness(fitness) * 10) / 10 : null;

  const steps = ['Ziel', 'Zeitrahmen', 'Fitness', 'Tage'];
  const canNext =
    (step === 0 && distance !== null) ||
    (step === 1 && weeks !== null) ||
    (step === 2 && fitness !== null) ||
    (step === 3 && days !== null);

  function finish() {
    if (!distance || !weeks || !days || !fitness) return;
    const goal: Goal = { distance, weeks, ...(targetTimeSeconds ? { targetTimeSeconds } : {}) };
    createProfile({ goal, fitness, daysPerWeek: days });
    router.replace('/');
  }

  function onNext() {
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  }
  function onBack() {
    if (step > 0) setStep(step - 1);
    else router.back();
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      {/* Fortschritt */}
      <View style={styles.progressRow}>
        {steps.map((label, i) => (
          <View key={label} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                { backgroundColor: i <= step ? p.accent : p.border },
              ]}
            />
            <Text style={[styles.progressLabel, { color: i <= step ? p.text : p.subtext }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <View style={[styles.quickCard, { backgroundColor: p.card, borderColor: p.border }]}>
              <Text style={[styles.subLabel, { color: p.subtext }]}>Ziel in einem Satz (optional)</Text>
              <TextInput
                value={quickText}
                onChangeText={setQuickText}
                placeholder="z. B. 10k unter 45 min in 12 Wochen, 4x pro Woche"
                placeholderTextColor={p.subtext}
                style={[styles.quickInput, { color: p.text, borderColor: p.border }]}
                multiline
              />
              <Pressable
                onPress={applyQuick}
                style={[styles.quickBtn, { borderColor: p.accent }]}
              >
                <Text style={[styles.quickBtnText, { color: p.accent }]}>Übernehmen</Text>
              </Pressable>
              {quickHint && <Text style={[styles.quickHintText, { color: p.subtext }]}>{quickHint}</Text>}
            </View>

            <Text style={[styles.q, { color: p.text }]}>Welche Distanz ist dein Ziel?</Text>
            <View style={styles.chipWrap}>
              {DISTANCES.map((d) => (
                <Chip
                  key={d.key}
                  label={d.label}
                  selected={distance === d.key}
                  onPress={() => setDistance(d.key)}
                  p={p}
                />
              ))}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Wie lange soll dein Plan laufen?</Text>
            <View style={styles.chipWrap}>
              {WEEK_OPTIONS.map((w) => (
                <Chip
                  key={w}
                  label={`${w} Wochen`}
                  selected={weeks === w}
                  onPress={() => setWeeks(w)}
                  p={p}
                />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Wie fit bist du gerade?</Text>
            <View style={styles.chipWrap}>
              <Chip label="Ich kenne eine Bestzeit" selected={fitnessMode === 'race'} onPress={() => setFitnessMode('race')} p={p} />
              <Chip label="Grobe Einschätzung" selected={fitnessMode === 'level'} onPress={() => setFitnessMode('level')} p={p} />
            </View>

            {fitnessMode === 'race' ? (
              <View style={{ gap: 14, marginTop: 6 }}>
                <Text style={[styles.subLabel, { color: p.subtext }]}>Distanz der Bestzeit</Text>
                <View style={styles.chipWrap}>
                  <Chip label="5 km" selected={raceMeters === 5000} onPress={() => setRaceMeters(5000)} p={p} />
                  <Chip label="10 km" selected={raceMeters === 10000} onPress={() => setRaceMeters(10000)} p={p} />
                </View>
                <Text style={[styles.subLabel, { color: p.subtext }]}>Zeit (Minuten : Sekunden)</Text>
                <View style={styles.timeRow}>
                  <TextInput
                    value={raceMin}
                    onChangeText={(t) => setRaceMin(t.replace(/[^0-9]/g, '').slice(0, 3))}
                    keyboardType="number-pad"
                    placeholder="mm"
                    placeholderTextColor={p.subtext}
                    style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border }]}
                  />
                  <Text style={[styles.colon, { color: p.text }]}>:</Text>
                  <TextInput
                    value={raceSec}
                    onChangeText={(t) => setRaceSec(t.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    placeholder="ss"
                    placeholderTextColor={p.subtext}
                    style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border }]}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.chipWrap}>
                {LEVELS.map((l) => (
                  <Chip key={l.key} label={l.label} selected={level === l.key} onPress={() => setLevel(l.key)} p={p} />
                ))}
              </View>
            )}

            {previewVdot !== null && (
              <View style={[styles.preview, { backgroundColor: p.card, borderColor: p.border }]}>
                <Text style={[styles.previewLabel, { color: p.subtext }]}>Geschätzte VDOT</Text>
                <Text style={[styles.previewVdot, { color: p.accent }]}>{previewVdot}</Text>
                <Text style={[styles.previewPace, { color: p.text }]}>
                  Schwellen-Pace ~ {paceMpsToPerKm(zonePaceMps(previewVdot, 'threshold').highMps)} /km
                </Text>
              </View>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[styles.q, { color: p.text }]}>An wie vielen Tagen pro Woche willst du laufen?</Text>
            <View style={styles.chipWrap}>
              {DAY_OPTIONS.map((d) => (
                <Chip key={d} label={`${d} Tage`} selected={days === d} onPress={() => setDays(d)} p={p} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navBar, { borderTopColor: p.border }]}>
        <Pressable onPress={onBack} style={styles.navBack}>
          <Text style={[styles.navBackText, { color: p.subtext }]}>Zurück</Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={!canNext}
          style={[styles.navNext, { backgroundColor: canNext ? p.accent : p.border }]}
        >
          <Text style={[styles.navNextText, { color: canNext ? p.accentText : p.subtext }]}>
            {step === steps.length - 1 ? 'Plan erstellen' : 'Weiter'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  progressRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  progressItem: { flex: 1, alignItems: 'center', gap: 6 },
  progressDot: { width: '100%', height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 12, fontWeight: '600' },
  scroll: { padding: 24, gap: 18 },
  q: { fontSize: 23, fontWeight: '700', lineHeight: 30 },
  subLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  quickCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  quickInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, minHeight: 64, textAlignVertical: 'top' },
  quickBtn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  quickBtnText: { fontSize: 15, fontWeight: '700' },
  quickHintText: { fontSize: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  chipText: { fontSize: 15, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '700',
    width: 90,
    textAlign: 'center',
  },
  colon: { fontSize: 24, fontWeight: '800' },
  preview: { marginTop: 8, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'flex-start' },
  previewLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  previewVdot: { fontSize: 34, fontWeight: '800' },
  previewPace: { fontSize: 15, marginTop: 2 },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderTopWidth: 1 },
  navBack: { paddingVertical: 14, paddingHorizontal: 8 },
  navBackText: { fontSize: 16, fontWeight: '600' },
  navNext: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  navNextText: { fontSize: 17, fontWeight: '700' },
});
