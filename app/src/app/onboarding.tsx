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
  assessTraining,
  EQUIPMENT_ITEM_LABEL,
  equipmentFromOwnedItems,
  paceMpsToPerKm,
  TERRAIN_LABEL,
  TERRAIN_RANGE_LABEL,
  vdotFromFitness,
  zonePaceMps,
  type AdviceLevel,
  type CourseTerrain,
  type EquipmentItem,
  type FitnessInput,
  type Goal,
  type RaceDistance,
  type SelfRatedLevel,
} from '@paceforge/core';

import { usePalette, type Palette } from '@/ui/colors';
import { useProfileStore } from '@/store/profile';
import { parseGoalSmart } from '@/api/parseGoal';

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
// Anzeige Mo..So (0=So..6=Sa wie im Domain-Modell), passend zu DOW_SHORT aus ui/format.
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'So' },
];
const LEVELS: { key: SelfRatedLevel; label: string; criterion: string }[] = [
  {
    key: 'beginner',
    label: 'Einsteiger',
    criterion: 'Laufen ist für dich noch neu oder ungewohnt – du läufst nicht regelmäßig am Stück.',
  },
  {
    key: 'intermediate',
    label: 'Fortgeschritten',
    criterion: 'Du läufst regelmäßig, mehrmals pro Woche, aber (noch) ohne festen Trainingsplan.',
  },
  {
    key: 'advanced',
    label: 'Ambitioniert',
    criterion: 'Du trainierst strukturiert (z. B. Intervalle/Tempoläufe) und läufst regelmäßig größere Distanzen.',
  },
];

type FitnessMode = 'cooper' | 'race' | 'level';

export default function Onboarding() {
  const p = usePalette();
  const router = useRouter();
  const createProfile = useProfileStore((s) => s.createProfile);

  const [step, setStep] = useState(0);

  const [goalMode, setGoalMode] = useState<'race' | 'maintain'>('race');
  const [distance, setDistance] = useState<RaceDistance | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);
  const [courseTerrain, setCourseTerrain] = useState<CourseTerrain | null>(null);
  const [startChoice, setStartChoice] = useState<'today' | 'tomorrow' | 'monday' | 'custom'>('today');
  const [startDay, setStartDay] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [days, setDays] = useState<number | null>(null);
  const [availableDays, setAvailableDaysState] = useState<Set<number>>(new Set());
  const [strengthSessions, setStrengthSessions] = useState(2);
  const [ownedEquipment, setOwnedEquipment] = useState<Set<EquipmentItem>>(new Set());
  const strengthEquipment = equipmentFromOwnedItems(Array.from(ownedEquipment));
  const [targetTimeSeconds, setTargetTimeSeconds] = useState<number | null>(null);

  const [quickText, setQuickText] = useState('');
  const [quickHint, setQuickHint] = useState<string | null>(null);

  async function applyQuick() {
    if (!quickText.trim()) return;
    setQuickHint('… wird analysiert');
    const { parsed, source } = await parseGoalSmart(quickText);
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
    const via = source === 'llm' ? ' (per KI)' : '';
    setQuickHint(
      found.length ? `Erkannt: ${found.join(', ')}${via}.` : 'Nichts erkannt – wähle unten manuell.',
    );
  }

  const [fitnessMode, setFitnessMode] = useState<FitnessMode>('cooper');
  const [cooperMeters, setCooperMeters] = useState('');
  const [raceMeters, setRaceMeters] = useState<number>(3000);
  const [raceMin, setRaceMin] = useState('');
  const [raceSec, setRaceSec] = useState('');
  const [raceAscent, setRaceAscent] = useState('');
  const [level, setLevel] = useState<SelfRatedLevel | null>(null);

  // Aus der aktuellen Fitness-Eingabe eine FitnessInput bauen (falls valide).
  // Eigenes Datum aus den drei Ziffernfeldern (nur gültig, wenn vollständig/plausibel).
  const customStartDate: Date | null = useMemo(() => {
    const d = parseInt(startDay, 10);
    const m = parseInt(startMonth, 10);
    const y = parseInt(startYear, 10);
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null;
    const date = new Date(y, m - 1, d);
    // ungültige Kombinationen (z. B. 31. Feb) rollen in JS über -> Monat prüfen.
    if (date.getMonth() !== m - 1) return null;
    return date;
  }, [startDay, startMonth, startYear]);

  function nextMonday(from: Date): Date {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const diff = ((8 - d.getDay()) % 7) || 7; // immer der NÄCHSTE Montag, auch wenn heute Montag ist
    d.setDate(d.getDate() + diff);
    return d;
  }

  const resolvedStartDate: Date = useMemo(() => {
    const today = new Date();
    if (startChoice === 'today') return today;
    if (startChoice === 'tomorrow') {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (startChoice === 'monday') return nextMonday(today);
    return customStartDate ?? today;
  }, [startChoice, customStartDate]);

  const fitness: FitnessInput | null = useMemo(() => {
    const ascent = raceAscent === '' ? 0 : parseInt(raceAscent, 10);
    const ascentField = Number.isFinite(ascent) && ascent > 0 ? { ascentMeters: ascent } : {};
    if (fitnessMode === 'cooper') {
      // 12-Min-Cooper-Test = Rennen mit fester Zeit 12:00, variabler Distanz.
      const d = parseInt(cooperMeters, 10);
      if (!Number.isFinite(d) || d < 1000 || d > 6000) return null;
      return { recentRace: { distanceMeters: d, timeSeconds: 720, ...ascentField } };
    }
    if (fitnessMode === 'race') {
      const m = parseInt(raceMin, 10);
      const s = raceSec === '' ? 0 : parseInt(raceSec, 10);
      if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(s) || s < 0 || s >= 60) return null;
      return { recentRace: { distanceMeters: raceMeters, timeSeconds: m * 60 + s, ...ascentField } };
    }
    return level ? { selfRatedLevel: level } : null;
  }, [fitnessMode, cooperMeters, raceMin, raceSec, raceAscent, raceMeters, level]);

  const previewVdot = fitness ? Math.round(vdotFromFitness(fitness) * 10) / 10 : null;

  // Schrittfolge per Schlüssel – im Erhaltungs-Modus entfällt der Zeitrahmen.
  type StepKey = 'goal' | 'startDate' | 'weeks' | 'terrain' | 'fitness' | 'days' | 'strength';
  const STEP_LABEL: Record<StepKey, string> = {
    goal: 'Ziel',
    startDate: 'Start',
    weeks: 'Zeitrahmen',
    terrain: 'Gelände',
    fitness: 'Fitness',
    days: 'Tage',
    strength: 'Kraft',
  };
  // Gelände-Frage nur sinnvoll, wenn es eine konkrete Zielstrecke gibt (race-Modus).
  const stepKeys: StepKey[] =
    goalMode === 'maintain'
      ? ['goal', 'startDate', 'fitness', 'days', 'strength']
      : ['goal', 'startDate', 'weeks', 'terrain', 'fitness', 'days', 'strength'];
  const currentKey = stepKeys[Math.min(step, stepKeys.length - 1)];

  const canNext =
    (currentKey === 'goal' && (goalMode === 'maintain' || distance !== null)) ||
    (currentKey === 'startDate' && (startChoice !== 'custom' || customStartDate !== null)) ||
    (currentKey === 'weeks' && weeks !== null) ||
    (currentKey === 'terrain' && courseTerrain !== null) ||
    (currentKey === 'fitness' && fitness !== null) ||
    (currentKey === 'days' && days !== null) ||
    currentKey === 'strength';

  function finish() {
    if (!days || !fitness) return;
    let goal: Goal;
    if (goalMode === 'maintain') {
      // Erhaltung: keine Zieldistanz/-zeit; 'half' dient nur als neutrale Referenz.
      goal = { mode: 'maintain', distance: 'half' };
    } else {
      if (!distance || !weeks) return;
      goal = {
        mode: 'race',
        distance,
        weeks,
        ...(targetTimeSeconds ? { targetTimeSeconds } : {}),
        ...(courseTerrain ? { courseTerrain } : {}),
      };
    }
    createProfile({
      goal,
      fitness,
      daysPerWeek: days,
      ...(availableDays.size > 0 ? { availableDays: Array.from(availableDays) } : {}),
      strength: {
        sessionsPerWeek: strengthSessions,
        equipment: strengthEquipment,
        ...(ownedEquipment.size > 0 ? { ownedEquipment: Array.from(ownedEquipment) } : {}),
      },
      startDate: resolvedStartDate,
    });
    router.replace('/');
  }

  function toggleAvailableDay(d: number) {
    setAvailableDaysState((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function onNext() {
    if (step < stepKeys.length - 1) setStep(step + 1);
    else finish();
  }
  function onBack() {
    if (step > 0) setStep(step - 1);
    else router.back();
  }
  function levelColor(l: AdviceLevel): string {
    return l === 'good' ? '#16a34a' : l === 'warn' ? '#d97706' : p.accent;
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      {/* Fortschritt: Balken pro Schritt + Label nur für den aktuellen Schritt
          (bei jetzt bis zu 7 Schritten laufen sonst die Beschriftungen ineinander). */}
      <View style={styles.progressRow}>
        {stepKeys.map((key, i) => (
          <View
            key={key}
            style={[styles.progressDot, { backgroundColor: i <= step ? p.accent : p.border }]}
          />
        ))}
      </View>
      <Text style={[styles.progressLabel, { color: p.text }]}>{STEP_LABEL[currentKey]}</Text>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {currentKey === 'goal' && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Was ist dein Ziel?</Text>
            <View style={styles.chipWrap}>
              <Chip
                label="Auf ein Ziel hintrainieren"
                selected={goalMode === 'race'}
                onPress={() => setGoalMode('race')}
                p={p}
              />
              <Chip
                label="Nur Form halten"
                selected={goalMode === 'maintain'}
                onPress={() => setGoalMode('maintain')}
                p={p}
              />
            </View>

            {goalMode === 'maintain' ? (
              <View style={[styles.quickCard, { backgroundColor: p.card, borderColor: p.border, marginTop: 6 }]}>
                <Text style={[styles.previewPace, { color: p.text }]}>
                  Fortlaufender Plan, der deine Fitness hält – ohne Wettkampf.
                </Text>
                <Text style={[styles.subLabel, { color: p.subtext, marginTop: 6, textTransform: 'none', letterSpacing: 0 }]}>
                  Rollierender Wochenrhythmus: 1 Long Run + 1 Qualitätseinheit + lockere Läufe,
                  ~80/20 leicht/hart. Für Läufer:innen mit vorhandener Grundlage (etwa
                  halbmarathon-fähig). Intensität – nicht Umfang – erhält die Form.
                </Text>
              </View>
            ) : (
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
                  <Pressable onPress={applyQuick} style={[styles.quickBtn, { borderColor: p.accent }]}>
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
          </>
        )}

        {currentKey === 'startDate' && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Wann soll dein Plan beginnen?</Text>
            <Text style={[styles.sub, { color: p.subtext }]}>
              Wähle ein Startdatum, das für dich passt – du kannst es später jederzeit ändern.
            </Text>
            <View style={styles.chipWrap}>
              <Chip label="Heute" selected={startChoice === 'today'} onPress={() => setStartChoice('today')} p={p} />
              <Chip
                label="Morgen"
                selected={startChoice === 'tomorrow'}
                onPress={() => setStartChoice('tomorrow')}
                p={p}
              />
              <Chip
                label="Nächster Montag"
                selected={startChoice === 'monday'}
                onPress={() => setStartChoice('monday')}
                p={p}
              />
              <Chip
                label="Eigenes Datum"
                selected={startChoice === 'custom'}
                onPress={() => setStartChoice('custom')}
                p={p}
              />
            </View>
            {startChoice === 'custom' && (
              <View style={styles.timeRow}>
                <TextInput
                  value={startDay}
                  onChangeText={(t) => setStartDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="TT"
                  placeholderTextColor={p.subtext}
                  style={[styles.timeInput, { color: p.text, borderColor: p.border, width: 70 }]}
                />
                <Text style={[styles.colon, { color: p.text }]}>.</Text>
                <TextInput
                  value={startMonth}
                  onChangeText={(t) => setStartMonth(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="MM"
                  placeholderTextColor={p.subtext}
                  style={[styles.timeInput, { color: p.text, borderColor: p.border, width: 70 }]}
                />
                <Text style={[styles.colon, { color: p.text }]}>.</Text>
                <TextInput
                  value={startYear}
                  onChangeText={(t) => setStartYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="JJJJ"
                  placeholderTextColor={p.subtext}
                  style={[styles.timeInput, { color: p.text, borderColor: p.border, width: 90 }]}
                />
              </View>
            )}
            {startChoice === 'custom' && customStartDate === null ? (
              <Text style={[styles.hint, { color: '#d97706' }]}>Bitte ein gültiges Datum eingeben.</Text>
            ) : (
              <Text style={[styles.hint, { color: p.subtext }]}>
                Start: {resolvedStartDate.toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            )}
          </>
        )}

        {currentKey === 'weeks' && (
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

        {currentKey === 'terrain' && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Wie bergig ist deine Zielstrecke?</Text>
            <Text style={[styles.sub, { color: p.subtext }]}>
              Nur eine grobe Einschätzung – hilft uns, gezielt Bergreize in dein Training einzubauen,
              falls nötig. Du kannst das später jederzeit ändern.
            </Text>
            <View style={{ gap: 10 }}>
              {(['flat', 'rolling', 'moderate', 'hilly'] as CourseTerrain[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setCourseTerrain(t)}
                  style={[
                    styles.quickCard,
                    {
                      backgroundColor: p.card,
                      borderColor: courseTerrain === t ? p.accent : p.border,
                      borderWidth: courseTerrain === t ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.subLabel, { color: p.text, textTransform: 'none' }]}>
                    {TERRAIN_LABEL[t]}
                  </Text>
                  <Text style={[styles.quickHintText, { color: p.subtext }]}>{TERRAIN_RANGE_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {currentKey === 'fitness' && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Machen wir einen kurzen Einstiegslauf</Text>
            <Text style={[styles.subLabel, { color: p.subtext, textTransform: 'none', letterSpacing: 0 }]}>
              Ein echter Testlauf kalibriert dein Training viel zuverlässiger als eine Selbst-
              einschätzung. Wähle, was für dich passt:
            </Text>
            <View style={styles.chipWrap}>
              <Chip label="12-Minuten-Test" selected={fitnessMode === 'cooper'} onPress={() => setFitnessMode('cooper')} p={p} />
              <Chip label="Testlauf / letzter Lauf" selected={fitnessMode === 'race'} onPress={() => setFitnessMode('race')} p={p} />
              <Chip label="Nur grob schätzen" selected={fitnessMode === 'level'} onPress={() => setFitnessMode('level')} p={p} />
            </View>

            {fitnessMode === 'cooper' && (
              <View style={{ gap: 14, marginTop: 6 }}>
                <View style={[styles.quickCard, { backgroundColor: p.card, borderColor: p.border }]}>
                  <Text style={[styles.previewPace, { color: p.text }]}>
                    Lauf 12 Minuten so weit du kannst.
                  </Text>
                  <Text style={[styles.subLabel, { color: p.subtext, textTransform: 'none', letterSpacing: 0, marginTop: 4 }]}>
                    Kurz locker einlaufen, dann 12 Minuten gleichmäßig zügig (nicht Sprint). Am besten
                    auf flacher Runde oder Bahn. Danach die gelaufene Distanz eintragen.
                  </Text>
                </View>
                <Text style={[styles.subLabel, { color: p.subtext }]}>Gelaufene Distanz in Metern</Text>
                <TextInput
                  value={cooperMeters}
                  onChangeText={(t) => setCooperMeters(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="z. B. 2400"
                  placeholderTextColor={p.subtext}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border, width: 140 }]}
                />
                <Text style={[styles.subLabel, { color: p.subtext }]}>Höhenmeter (optional)</Text>
                <TextInput
                  value={raceAscent}
                  onChangeText={(t) => setRaceAscent(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="z. B. 15"
                  placeholderTextColor={p.subtext}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border, width: 110 }]}
                />
              </View>
            )}

            {fitnessMode === 'race' && (
              <View style={{ gap: 14, marginTop: 6 }}>
                <Text style={[styles.subLabel, { color: p.subtext }]}>Distanz</Text>
                <View style={styles.chipWrap}>
                  <Chip label="3 km" selected={raceMeters === 3000} onPress={() => setRaceMeters(3000)} p={p} />
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
                <Text style={[styles.subLabel, { color: p.subtext }]}>Höhenmeter (optional)</Text>
                <TextInput
                  value={raceAscent}
                  onChangeText={(t) => setRaceAscent(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="z. B. 40"
                  placeholderTextColor={p.subtext}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.card, borderColor: p.border, width: 110 }]}
                />
              </View>
            )}

            {fitnessMode === 'level' && (
              <View style={{ gap: 10 }}>
                {LEVELS.map((l) => (
                  <Pressable
                    key={l.key}
                    onPress={() => setLevel(l.key)}
                    style={[
                      styles.quickCard,
                      {
                        backgroundColor: p.card,
                        borderColor: level === l.key ? p.accent : p.border,
                        borderWidth: level === l.key ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.subLabel, { color: p.text, textTransform: 'none' }]}>{l.label}</Text>
                    <Text style={[styles.quickHintText, { color: p.subtext }]}>{l.criterion}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {previewVdot !== null && (
              <View style={[styles.preview, { backgroundColor: p.card, borderColor: p.border }]}>
                <Text style={[styles.previewLabel, { color: p.subtext }]}>Geschätzte VDOT</Text>
                <Text style={[styles.previewVdot, { color: p.accent }]}>{previewVdot}</Text>
                <Text style={[styles.previewPace, { color: p.text }]}>
                  Lockere Läufe ~ {paceMpsToPerKm(zonePaceMps(previewVdot, 'easy').lowMps)}–
                  {paceMpsToPerKm(zonePaceMps(previewVdot, 'easy').highMps)} /km
                </Text>
              </View>
            )}
          </>
        )}

        {currentKey === 'days' && (
          <>
            <Text style={[styles.q, { color: p.text }]}>An wie vielen Tagen pro Woche willst du laufen?</Text>
            <View style={styles.chipWrap}>
              {DAY_OPTIONS.map((d) => (
                <Chip key={d} label={`${d} Tage`} selected={days === d} onPress={() => setDays(d)} p={p} />
              ))}
            </View>

            <Text style={[styles.subLabel, { color: p.subtext, marginTop: 18 }]}>
              An welchen Wochentagen kannst du grundsätzlich laufen? (optional)
            </Text>
            <Text style={[styles.sub, { color: p.subtext, marginTop: 0, marginBottom: 4 }]}>
              Wähle ruhig mehr Tage als du brauchst – wir verteilen deine {days ?? '…'} Trainingstage
              gleichmäßig darauf. Ohne Auswahl nutzen wir ein Standardmuster (Di/Do/Sa).
            </Text>
            <View style={styles.chipWrap}>
              {WEEKDAY_OPTIONS.map((d) => (
                <Chip
                  key={d.value}
                  label={d.label}
                  selected={availableDays.has(d.value)}
                  onPress={() => toggleAvailableDay(d.value)}
                  p={p}
                />
              ))}
            </View>
            {days !== null && availableDays.size > 0 && availableDays.size < days && (
              <Text style={[styles.hint, { color: '#d97706' }]}>
                Nur {availableDays.size} von {days} gewünschten Tagen ausgewählt – dein Plan bekommt
                entsprechend weniger Trainingstage.
              </Text>
            )}
          </>
        )}

        {currentKey === 'strength' && (
          <>
            <Text style={[styles.q, { color: p.text }]}>Krafttraining dazu?</Text>
            <Text style={[styles.subLabel, { color: p.subtext }]}>Einheiten pro Woche (2× empfohlen)</Text>
            <View style={styles.chipWrap}>
              {[0, 1, 2, 3].map((n) => (
                <Chip
                  key={n}
                  label={n === 0 ? 'Aus' : `${n}×`}
                  selected={strengthSessions === n}
                  onPress={() => setStrengthSessions(n)}
                  p={p}
                />
              ))}
            </View>
            <Text style={[styles.subLabel, { color: p.subtext }]}>
              Welche Ausrüstung hast du? (optional – ohne Auswahl trainierst du mit Körpergewicht)
            </Text>
            <View style={styles.chipWrap}>
              {(Object.keys(EQUIPMENT_ITEM_LABEL) as EquipmentItem[]).map((item) => (
                <Chip
                  key={item}
                  label={EQUIPMENT_ITEM_LABEL[item]}
                  selected={ownedEquipment.has(item)}
                  onPress={() =>
                    setOwnedEquipment((prev) => {
                      const next = new Set(prev);
                      if (next.has(item)) next.delete(item);
                      else next.add(item);
                      return next;
                    })
                  }
                  p={p}
                />
              ))}
            </View>
            <Text style={[styles.hint, { color: p.subtext }]}>
              {strengthEquipment === 'gym'
                ? 'Deine Krafteinheiten nutzen die verfügbaren Gewichte.'
                : 'Deine Krafteinheiten laufen mit Körpergewichtsübungen.'}
            </Text>

            {distance && days && (
              <View style={[styles.preview, { backgroundColor: p.card, borderColor: p.border }]}>
                <Text style={[styles.previewLabel, { color: p.subtext }]}>Reicht das für dein Ziel?</Text>
                {assessTraining({ distance, daysPerWeek: days, strengthPerWeek: strengthSessions }).advice.map((a, i) => (
                  <View key={i} style={styles.adviceRow}>
                    <View style={[styles.adviceDot, { backgroundColor: levelColor(a.level) }]} />
                    <Text style={[styles.adviceText, { color: p.text }]}>{a.text}</Text>
                  </View>
                ))}
              </View>
            )}
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
            {step === stepKeys.length - 1 ? 'Plan erstellen' : 'Weiter'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  progressRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20, paddingTop: 8 },
  scroll: { padding: 24, gap: 18 },
  q: { fontSize: 23, fontWeight: '700', lineHeight: 30 },
  sub: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 13, marginTop: 4 },
  subLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  adviceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8, alignSelf: 'stretch' },
  adviceDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  adviceText: { flex: 1, fontSize: 14, lineHeight: 20 },
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
