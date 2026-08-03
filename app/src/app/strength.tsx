import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EQUIPMENT_ITEM_LABEL,
  hardRunDays,
  kindLabel,
  STRENGTH_NOTES,
  strengthSessionsForPhase,
  weekOf,
  ymdOf,
  type EquipmentItem,
} from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { DOW_SHORT } from '@/ui/format';
import { useProfileStore } from '@/store/profile';

function EquipChip({ label, selected, onPress, p }: { label: string; selected: boolean; onPress: () => void; p: Palette }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? p.accent : p.chipBg, borderColor: selected ? p.accent : p.border }]}
    >
      <Text style={[styles.chipText, { color: selected ? p.accentText : p.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function StrengthScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const plan = useProfileStore((s) => s.plan);
  const setOwnedEquipment = useProfileStore((s) => s.setOwnedEquipment);

  const equipment = profile?.strength?.equipment ?? 'bodyweight';
  const ownedEquipment = new Set(profile?.strength?.ownedEquipment ?? []);
  const sessionsPerWeek = profile?.strength?.sessionsPerWeek ?? 2;
  const today = ymdOf(new Date());
  const week = plan ? weekOf(plan, today) : undefined;
  const allSessions = week ? strengthSessionsForPhase(week.phase, equipment) : [];
  const sessions = allSessions.slice(0, sessionsPerWeek);
  const days = (week ? hardRunDays(week) : []).slice(0, sessionsPerWeek);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Krafttraining</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          2×/Woche, an deine Trainingsphase angepasst. {STRENGTH_NOTES.benefit}
        </Text>

        <Text style={[styles.label, { color: p.subtext }]}>
          Welche Ausrüstung hast du? (ohne Auswahl: Körpergewicht)
        </Text>
        <View style={styles.chipWrap}>
          {(Object.keys(EQUIPMENT_ITEM_LABEL) as EquipmentItem[]).map((item) => (
            <EquipChip
              key={item}
              label={EQUIPMENT_ITEM_LABEL[item]}
              selected={ownedEquipment.has(item)}
              onPress={() => {
                const next = new Set(ownedEquipment);
                if (next.has(item)) next.delete(item);
                else next.add(item);
                setOwnedEquipment(Array.from(next));
              }}
              p={p}
            />
          ))}
        </View>

        {week && (
          <Text style={[styles.phaseLine, { color: p.subtext }]}>
            Aktuelle Phase: <Text style={{ color: p.text, fontWeight: '700' }}>{kindLabel(sessions[0]?.kind ?? 'foundation')}</Text>
            {days.length > 0 ? `  ·  empfohlen an: ${days.map((d) => DOW_SHORT[d]).join(', ')}` : ''}
          </Text>
        )}

        {!week ? (
          <Text style={[styles.sub, { color: p.subtext }]}>Erst einen Trainingsplan erstellen.</Text>
        ) : sessionsPerWeek === 0 ? (
          <Pressable
            onPress={() => router.push('/training')}
            style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}
          >
            <Text style={[styles.sessionName, { color: p.text }]}>Krafttraining ist aus</Text>
            <Text style={[styles.focus, { color: p.accent }]}>Im Trainingsumfang aktivieren ›</Text>
          </Pressable>
        ) : (
          sessions.map((s) => (
            <View key={s.id} style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
              <Text style={[styles.sessionName, { color: p.text }]}>{s.name}</Text>
              <Text style={[styles.focus, { color: p.accent }]}>{s.focusNote}</Text>
              <Text style={[styles.mins, { color: p.subtext }]}>~ {s.estimatedMinutes} min</Text>
              {s.exercises.map((ex, i) => (
                <View key={i} style={[styles.exRow, i < s.exercises.length - 1 && { borderBottomWidth: 1, borderBottomColor: p.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, { color: p.text }]}>{ex.name}</Text>
                    <Text style={[styles.exLoad, { color: p.subtext }]}>{ex.load}</Text>
                  </View>
                  <Text style={[styles.exSets, { color: p.text }]}>
                    {ex.sets}×{ex.reps}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={[styles.notes, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.notesTitle, { color: p.text }]}>Gut zu wissen</Text>
          {[STRENGTH_NOTES.dose, STRENGTH_NOTES.interference, STRENGTH_NOTES.bodyweightGate].map((n, i) => (
            <Text key={i} style={[styles.note, { color: p.subtext }]}>
              • {n}
            </Text>
          ))}
        </View>
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
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  chipText: { fontSize: 15, fontWeight: '600' },
  phaseLine: { fontSize: 14, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 2 },
  sessionName: { fontSize: 17, fontWeight: '700' },
  focus: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  mins: { fontSize: 12, marginBottom: 6 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  exName: { fontSize: 15, fontWeight: '600' },
  exLoad: { fontSize: 13, marginTop: 1 },
  exSets: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  notes: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 4 },
  notesTitle: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19 },
});
