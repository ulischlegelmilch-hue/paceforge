import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gradeAdjustedDistance, paceMpsToPerKm, vdotFromRace, zonePaceMps } from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';

const DISTANCES: { label: string; meters: number }[] = [
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: 'Halbmarathon', meters: 21097.5 },
  { label: 'Marathon', meters: 42195 },
];

function Chip({ label, selected, onPress, p }: { label: string; selected: boolean; onPress: () => void; p: Palette }) {
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

export default function RecalibrateScreen() {
  const p = usePalette();
  const router = useRouter();
  const currentVdot = useProfileStore((s) => s.profile?.currentVdot ?? null);
  const updateFitnessFromRace = useProfileStore((s) => s.updateFitnessFromRace);

  const [meters, setMeters] = useState(5000);
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [sec, setSec] = useState('');
  const [ascent, setAscent] = useState('');
  const ascentNum = ascent === '' ? 0 : parseInt(ascent, 10);

  const timeSeconds = useMemo(() => {
    const hh = h === '' ? 0 : parseInt(h, 10);
    const mm = m === '' ? 0 : parseInt(m, 10);
    const ss = sec === '' ? 0 : parseInt(sec, 10);
    if ([hh, mm, ss].some((n) => !Number.isFinite(n)) || mm >= 60 || ss >= 60) return 0;
    return hh * 3600 + mm * 60 + ss;
  }, [h, m, sec]);

  const newVdot =
    timeSeconds > 0
      ? Math.round(vdotFromRace(gradeAdjustedDistance(meters, ascentNum), timeSeconds) * 10) / 10
      : null;

  function apply() {
    if (timeSeconds <= 0) return;
    updateFitnessFromRace({
      distanceMeters: meters,
      timeSeconds,
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
      placeholderTextColor={p.subtext}
      style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border }]}
    />
  );

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Fitness aktualisieren</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          Neue Bestzeit oder Testlauf? Trag sie ein – VDOT, Pace-Zonen und dein Plan werden neu berechnet.
          {currentVdot != null ? ` Aktuell: VDOT ${currentVdot}.` : ''}
        </Text>

        <Text style={[styles.label, { color: p.subtext }]}>Distanz</Text>
        <View style={styles.chipWrap}>
          {DISTANCES.map((d) => (
            <Chip key={d.meters} label={d.label} selected={meters === d.meters} onPress={() => setMeters(d.meters)} p={p} />
          ))}
        </View>

        <Text style={[styles.label, { color: p.subtext }]}>Zeit (Std : Min : Sek)</Text>
        <View style={styles.timeRow}>
          {numField(h, setH, 'h', 2)}
          <Text style={[styles.colon, { color: p.text }]}>:</Text>
          {numField(m, setM, 'mm', 2)}
          <Text style={[styles.colon, { color: p.text }]}>:</Text>
          {numField(sec, setSec, 'ss', 2)}
        </View>

        <Text style={[styles.label, { color: p.subtext }]}>Höhenmeter (optional)</Text>
        <TextInput
          value={ascent}
          onChangeText={(t) => setAscent(t.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="z. B. 40"
          placeholderTextColor={p.subtext}
          style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border, width: 110 }]}
        />

        {newVdot != null && (
          <View style={[styles.preview, { backgroundColor: p.card, borderColor: p.border }]}>
            <Text style={[styles.previewLabel, { color: p.subtext }]}>Neue VDOT</Text>
            <Text style={[styles.previewVdot, { color: p.accent }]}>{newVdot}</Text>
            <Text style={[styles.previewPace, { color: p.text }]}>
              Schwellen-Pace ~ {paceMpsToPerKm(zonePaceMps(newVdot, 'threshold').highMps)} /km
              {currentVdot != null ? `  ·  vorher VDOT ${currentVdot}` : ''}
            </Text>
          </View>
        )}

        <Pressable
          onPress={apply}
          disabled={timeSeconds <= 0}
          style={[styles.applyBtn, { backgroundColor: timeSeconds > 0 ? p.accent : p.border }]}
        >
          <Text style={[styles.applyText, { color: timeSeconds > 0 ? p.accentText : p.subtext }]}>
            Übernehmen & Plan neu berechnen
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 24, gap: 14 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 6 },
  sub: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  chipText: { fontSize: 15, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: '700',
    width: 72,
    textAlign: 'center',
  },
  colon: { fontSize: 22, fontWeight: '800' },
  preview: { marginTop: 8, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'flex-start' },
  previewLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  previewVdot: { fontSize: 34, fontWeight: '800' },
  previewPace: { fontSize: 14, marginTop: 2 },
  applyBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyText: { fontSize: 17, fontWeight: '700' },
});
