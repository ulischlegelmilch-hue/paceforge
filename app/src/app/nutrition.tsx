import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IRON_GUIDANCE,
  NUTRITION_DISCLAIMER,
  NUTRITION_PHASE_LABEL,
  postRunRecovery,
  preRunCarb,
  raceWeekCarbPerDay,
  recipesForPhase,
  type Macros,
  type NutritionPhase,
  type NutritionRecipe,
} from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';

const PHASE_ORDER: NutritionPhase[] = ['preRun', 'postRun', 'fuel', 'raceWeek', 'iron'];

function macroLine(m: Macros): string {
  const parts: string[] = [];
  if (m.calories != null) parts.push(`${m.calories} kcal`);
  if (m.carbG != null) parts.push(`${m.carbG} g KH`);
  if (m.proteinG != null) parts.push(`${m.proteinG} g Eiweiß`);
  if (m.fatG != null) parts.push(`${m.fatG} g Fett`);
  if (m.fiberG != null) parts.push(`${m.fiberG} g Ballaststoffe`);
  if (m.ironMg != null) parts.push(`${m.ironMg} mg Eisen`);
  return parts.join(' · ');
}

function RecipeCard({ r, p }: { r: NutritionRecipe; p: Palette }) {
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <Text style={[styles.recipeTitle, { color: p.text }]}>{r.title}</Text>
      <Text style={[styles.source, { color: p.subtext }]}>{r.source}</Text>
      {r.macros ? (
        <Text style={[styles.macros, { color: p.accent }]}>{macroLine(r.macros)}</Text>
      ) : r.noMacrosByDesign ? (
        <Text style={[styles.macrosMuted, { color: p.subtext }]}>keine Nährwerte – siehe Quelle</Text>
      ) : null}
      {r.note ? <Text style={[styles.note, { color: p.text }]}>{r.note}</Text> : null}
      <Text style={[styles.ingredients, { color: p.subtext }]}>{r.ingredients.join(' · ')}</Text>
    </View>
  );
}

export default function NutritionScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const setWeightKg = useProfileStore((s) => s.setWeightKg);

  const [w, setW] = useState(profile?.weightKg ? String(profile.weightKg) : '');
  const weightKg = profile?.weightKg;
  const distance = profile?.goal.distance;

  function onWeight(t: string) {
    const clean = t.replace(/[^0-9]/g, '').slice(0, 3);
    setW(clean);
    const n = parseInt(clean, 10);
    setWeightKg(Number.isFinite(n) && n > 0 ? n : undefined);
  }

  const pre = weightKg ? preRunCarb(weightKg, 3) : null;
  const post = weightKg ? postRunRecovery(weightKg) : null;
  const race = weightKg && distance ? raceWeekCarbPerDay(weightKg, distance) : null;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[styles.title, { color: p.text }]}>Ernährungscoach</Text>
        <Text style={[styles.sub, { color: p.subtext }]}>
          Phasenbasierte Empfehlungen aus benannten Sport-Ernährungsquellen. {NUTRITION_DISCLAIMER}
        </Text>

        {/* Persönliche Ziele */}
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.label, { color: p.subtext }]}>Körpergewicht (kg, optional)</Text>
          <TextInput
            value={w}
            onChangeText={onWeight}
            keyboardType="number-pad"
            placeholder="z. B. 68"
            placeholderTextColor={p.subtext}
            style={[styles.weightInput, { color: p.text, borderColor: p.border }]}
          />
          {pre && post ? (
            <View style={{ marginTop: 10, gap: 4 }}>
              <Text style={[styles.targetRow, { color: p.text }]}>
                Vor dem Lauf (~2–3 h): <Text style={{ fontWeight: '700' }}>{pre.grams} g KH</Text> ({pre.perKg} g/kg)
              </Text>
              <Text style={[styles.targetRow, { color: p.text }]}>
                Nach dem Lauf: <Text style={{ fontWeight: '700' }}>{post.carbG} g KH + {post.proteinG} g Eiweiß</Text> (~3:1)
              </Text>
              {race ? (
                <Text style={[styles.targetRow, { color: p.text }]}>
                  Wettkampfwoche: <Text style={{ fontWeight: '700' }}>{race.grams} g KH/Tag</Text> ({race.perKgLow}–{race.perKgHigh} g/kg)
                  {race.fullLoad ? ' · voller Carb-Load (>90 min)' : ' · nur Top-up (5k/10k)'}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.hint, { color: p.subtext }]}>
              Gewicht eintragen für persönliche Gramm-Ziele. Faustregeln: vor dem Lauf 1–4 g/kg KH, danach
              ~1,1 g/kg KH + 0,3 g/kg Eiweiß.
            </Text>
          )}
        </View>

        {PHASE_ORDER.map((phase) => {
          const recipes = recipesForPhase(phase);
          if (recipes.length === 0) return null;
          return (
            <View key={phase} style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: p.text }]}>{NUTRITION_PHASE_LABEL[phase]}</Text>
              {recipes.map((r) => (
                <RecipeCard key={r.id} r={r} p={p} />
              ))}
            </View>
          );
        })}

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.sectionTitle, { color: p.text }]}>Eisen</Text>
          <Text style={[styles.note, { color: p.subtext }]}>{IRON_GUIDANCE}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  weightInput: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 18, fontWeight: '700', marginTop: 8, width: 120 },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 10 },
  targetRow: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  recipeTitle: { fontSize: 16, fontWeight: '700' },
  source: { fontSize: 12, fontStyle: 'italic' },
  macros: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  macrosMuted: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  ingredients: { fontSize: 12, lineHeight: 17, marginTop: 2 },
});
