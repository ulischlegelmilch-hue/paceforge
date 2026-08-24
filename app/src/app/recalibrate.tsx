import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gradeAdjustedDistance, paceMpsToPerKm, vdotFromRace, zonePaceMps } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, display, eyebrow, body, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { Button } from '@/ui/components/Button';
import { useProfileStore } from '@/store/profile';

const DISTANCES: { label: string; meters: number }[] = [
  { label: '3 km', meters: 3000 },
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: 'Halbmarathon', meters: 21097.5 },
  { label: 'Marathon', meters: 42195 },
];

// Wie im Onboarding: der 12-Minuten-Cooper-Test ist ein „Rennen" mit fester
// Zeit (720 s) und variabler Distanz.
const COOPER_SECONDS = 720;

export default function RecalibrateScreen() {
  const p = usePalette();
  const router = useRouter();
  const currentVdot = useProfileStore((s) => s.profile?.currentVdot ?? null);
  const updateFitnessFromRace = useProfileStore((s) => s.updateFitnessFromRace);

  const [mode, setMode] = useState<'race' | 'cooper'>('race');
  const [meters, setMeters] = useState(5000);
  const [cooperMeters, setCooperMeters] = useState('');
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [sec, setSec] = useState('');
  const [ascent, setAscent] = useState('');
  const ascentNum = ascent === '' ? 0 : parseInt(ascent, 10);

  // Beide Modi münden in dasselbe Paar Distanz/Zeit für vdotFromRace.
  const entry = useMemo((): { distanceMeters: number; timeSeconds: number } | null => {
    if (mode === 'cooper') {
      const d = parseInt(cooperMeters, 10);
      if (!Number.isFinite(d) || d < 1000 || d > 6000) return null;
      return { distanceMeters: d, timeSeconds: COOPER_SECONDS };
    }
    const hh = h === '' ? 0 : parseInt(h, 10);
    const mm = m === '' ? 0 : parseInt(m, 10);
    const ss = sec === '' ? 0 : parseInt(sec, 10);
    if ([hh, mm, ss].some((n) => !Number.isFinite(n)) || mm >= 60 || ss >= 60) return null;
    const total = hh * 3600 + mm * 60 + ss;
    return total > 0 ? { distanceMeters: meters, timeSeconds: total } : null;
  }, [mode, cooperMeters, h, m, sec, meters]);

  const newVdot = entry
    ? Math.round(
        vdotFromRace(gradeAdjustedDistance(entry.distanceMeters, ascentNum), entry.timeSeconds) * 10,
      ) / 10
    : null;

  function apply() {
    if (!entry) return;
    updateFitnessFromRace({
      ...entry,
      ...(Number.isFinite(ascentNum) && ascentNum > 0 ? { ascentMeters: ascentNum } : {}),
    });
    router.back();
  }

  const numField = (value: string, set: (v: string) => void, ph: string, maxLen: number) => (
    <TextInput
      value={value}
      onChangeText={(t) => set(t.replace(/[^0-9]/g, '').slice(0, maxLen))}
      keyboardType="number-pad"
      placeholder={ph}
      placeholderTextColor={p.faint}
      style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised }]}
    />
  );

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 6 }]}>Fitness aktualisieren</Text>
        <Text style={[body, { color: p.subtext }]}>
          Neue Bestzeit oder Testlauf? Trag sie ein – VDOT, Pace-Zonen und dein Plan werden neu berechnet.
          {currentVdot != null ? ` Aktuell: VDOT ${currentVdot}.` : ''}
        </Text>

        <View style={styles.chipWrap}>
          <Chip label="Lauf / Bestzeit" selected={mode === 'race'} onPress={() => setMode('race')} />
          <Chip label="12-Minuten-Test" selected={mode === 'cooper'} onPress={() => setMode('cooper')} />
        </View>

        {mode === 'cooper' ? (
          <>
            <Text style={[body, { color: p.subtext }]}>
              12 Minuten so weit laufen wie möglich (gern auf einer Bahn), danach die Distanz eintragen.
            </Text>
            <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Distanz in 12 Minuten (Meter)</Text>
            <TextInput
              value={cooperMeters}
              onChangeText={(t) => setCooperMeters(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="z. B. 2600"
              placeholderTextColor={p.faint}
              style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 130 }]}
            />
          </>
        ) : (
          <>
            <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Distanz</Text>
            <View style={styles.chipWrap}>
              {DISTANCES.map((d) => (
                <Chip key={d.meters} label={d.label} selected={meters === d.meters} onPress={() => setMeters(d.meters)} />
              ))}
            </View>

            <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Zeit (Std : Min : Sek)</Text>
            <View style={styles.timeRow}>
              {numField(h, setH, 'h', 2)}
              <Text style={[title, { color: p.text }]}>:</Text>
              {numField(m, setM, 'mm', 2)}
              <Text style={[title, { color: p.text }]}>:</Text>
              {numField(sec, setSec, 'ss', 2)}
            </View>
          </>
        )}

        <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Höhenmeter (optional)</Text>
        <TextInput
          value={ascent}
          onChangeText={(t) => setAscent(t.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="z. B. 40"
          placeholderTextColor={p.faint}
          style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 110 }]}
        />

        {newVdot != null && (
          <Card style={{ alignItems: 'flex-start' }}>
            <Text style={[eyebrow, { color: p.subtext }]}>Neue VDOT</Text>
            <Text style={[display, { color: p.accent, fontSize: 40, lineHeight: 44 }]}>{newVdot}</Text>
            <Text style={[caption, { color: p.text, marginTop: 4 }]}>
              Schwellen-Pace ~ {paceMpsToPerKm(zonePaceMps(newVdot, 'threshold').highMps)} /km
              {currentVdot != null ? `  ·  vorher VDOT ${currentVdot}` : ''}
            </Text>
          </Card>
        )}

        <Button title="Übernehmen & Plan neu berechnen" onPress={apply} disabled={!entry} style={{ marginTop: 4 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 24, gap: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: '700',
    width: 72,
    textAlign: 'center',
  },
});
