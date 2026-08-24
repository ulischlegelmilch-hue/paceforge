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

import { usePalette } from '@/ui/colors';
import { title, heading, eyebrow, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { DOW_SHORT } from '@/ui/format';
import { useProfileStore } from '@/store/profile';

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
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 4 }]}>Krafttraining</Text>
        <Text style={[body, { color: p.subtext }]}>
          2×/Woche, an deine Trainingsphase angepasst. {STRENGTH_NOTES.benefit}
        </Text>

        <Text style={[eyebrow, { color: p.subtext, marginTop: 6 }]}>
          Welche Ausrüstung hast du? (ohne Auswahl: Körpergewicht)
        </Text>
        <View style={styles.chipWrap}>
          {(Object.keys(EQUIPMENT_ITEM_LABEL) as EquipmentItem[]).map((item) => (
            <Chip
              key={item}
              label={EQUIPMENT_ITEM_LABEL[item]}
              selected={ownedEquipment.has(item)}
              onPress={() => {
                const next = new Set(ownedEquipment);
                if (next.has(item)) next.delete(item);
                else next.add(item);
                setOwnedEquipment(Array.from(next));
              }}
            />
          ))}
        </View>

        {week && (
          <Text style={[body, { color: p.subtext }]}>
            Aktuelle Phase: <Text style={[bodyStrong, { color: p.text }]}>{kindLabel(sessions[0]?.kind ?? 'foundation')}</Text>
            {days.length > 0 ? `  ·  empfohlen an: ${days.map((d) => DOW_SHORT[d]).join(', ')}` : ''}
          </Text>
        )}

        {!week ? (
          <Text style={[body, { color: p.subtext }]}>Erst einen Trainingsplan erstellen.</Text>
        ) : sessionsPerWeek === 0 ? (
          <Pressable onPress={() => router.push('/training')}>
            <Card>
              <Text style={[heading, { color: p.text }]}>Krafttraining ist aus</Text>
              <Text style={[caption, { color: p.accent, marginTop: 4 }]}>Im Trainingsumfang aktivieren ›</Text>
            </Card>
          </Pressable>
        ) : (
          sessions.map((s) => (
            <Card key={s.id}>
              <Text style={[heading, { color: p.text }]}>{s.name}</Text>
              <Text style={[caption, { color: p.accent, marginTop: 4 }]}>{s.focusNote}</Text>
              <Text style={[caption, { color: p.subtext, marginTop: 2, marginBottom: 6 }]}>~ {s.estimatedMinutes} min</Text>
              {s.exercises.map((ex, i) => (
                <View key={i} style={[styles.exRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[bodyStrong, { color: p.text }]}>{ex.name}</Text>
                    <Text style={[caption, { color: p.subtext, marginTop: 1 }]}>{ex.load}</Text>
                  </View>
                  <Text style={[bodyStrong, { color: p.text }]}>
                    {ex.sets}×{ex.reps}
                  </Text>
                </View>
              ))}
            </Card>
          ))
        )}

        <Card>
          <Text style={[heading, { color: p.text }]}>Gut zu wissen</Text>
          {[STRENGTH_NOTES.dose, STRENGTH_NOTES.interference, STRENGTH_NOTES.bodyweightGate].map((n, i) => (
            <Text key={i} style={[caption, { color: p.subtext, marginTop: i === 0 ? 8 : 6, lineHeight: 19 }]}>
              • {n}
            </Text>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
});
