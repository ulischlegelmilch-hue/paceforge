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
import { title, heading, eyebrow, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
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
    <Card>
      <Text style={[heading, { color: p.text }]}>{r.title}</Text>
      <Text style={[caption, { color: p.faint, fontStyle: 'italic', marginTop: 2 }]}>{r.source}</Text>
      {r.macros ? (
        <Text style={[caption, { color: p.accent, marginTop: 6 }]}>{macroLine(r.macros)}</Text>
      ) : r.noMacrosByDesign ? (
        <Text style={[caption, { color: p.subtext, fontStyle: 'italic', marginTop: 6 }]}>keine Nährwerte – siehe Quelle</Text>
      ) : null}
      {r.note ? <Text style={[body, { color: p.text, marginTop: 6 }]}>{r.note}</Text> : null}
      <Text style={[caption, { color: p.subtext, marginTop: 6 }]}>{r.ingredients.join(' · ')}</Text>
    </Card>
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
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 4 }]}>Ernährungscoach</Text>
        <Text style={[body, { color: p.subtext }]}>
          Phasenbasierte Empfehlungen aus benannten Sport-Ernährungsquellen. {NUTRITION_DISCLAIMER}
        </Text>

        <Card>
          <Text style={[eyebrow, { color: p.subtext }]}>Körpergewicht (kg, optional)</Text>
          <TextInput
            value={w}
            onChangeText={onWeight}
            keyboardType="number-pad"
            placeholder="z. B. 68"
            placeholderTextColor={p.faint}
            style={[styles.weightInput, { color: p.text, backgroundColor: p.surfaceRaised }]}
          />
          {pre && post ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={[body, { color: p.text }]}>
                Vor dem Lauf (~2–3 h): <Text style={bodyStrong}>{pre.grams} g KH</Text> ({pre.perKg} g/kg)
              </Text>
              <Text style={[body, { color: p.text }]}>
                Nach dem Lauf: <Text style={bodyStrong}>{post.carbG} g KH + {post.proteinG} g Eiweiß</Text> (~3:1)
              </Text>
              {race ? (
                <Text style={[body, { color: p.text }]}>
                  Wettkampfwoche: <Text style={bodyStrong}>{race.grams} g KH/Tag</Text> ({race.perKgLow}–{race.perKgHigh} g/kg)
                  {race.fullLoad ? ' · voller Carb-Load (>90 min)' : ' · nur Top-up (5k/10k)'}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[caption, { color: p.subtext, marginTop: 12, lineHeight: 19 }]}>
              Gewicht eintragen für persönliche Gramm-Ziele. Faustregeln: vor dem Lauf 1–4 g/kg KH, danach
              ~1,1 g/kg KH + 0,3 g/kg Eiweiß.
            </Text>
          )}
        </Card>

        {PHASE_ORDER.map((phase) => {
          const recipes = recipesForPhase(phase);
          if (recipes.length === 0) return null;
          return (
            <View key={phase} style={{ gap: 10 }}>
              <Text style={[heading, { color: p.text, marginTop: 4 }]}>{NUTRITION_PHASE_LABEL[phase]}</Text>
              {recipes.map((r) => (
                <RecipeCard key={r.id} r={r} p={p} />
              ))}
            </View>
          );
        })}

        <Card>
          <Text style={[heading, { color: p.text }]}>Eisen</Text>
          <Text style={[body, { color: p.subtext, marginTop: 6 }]}>{IRON_GUIDANCE}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  weightInput: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, fontSize: 18, fontWeight: '700', marginTop: 10, width: 130 },
});
