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

import { usePalette } from '@/ui/colors';
import { title, eyebrow, display, body, caption, button as buttonType } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { Button } from '@/ui/components/Button';
import { useProfileStore } from '@/store/profile';
import { parseGoalSmart } from '@/api/parseGoal';

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
    return l === 'good' ? p.success : l === 'warn' ? p.warning : p.accent;
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      {/* Fortschritt: Balken pro Schritt + Label nur für den aktuellen Schritt
          (bei jetzt bis zu 7 Schritten laufen sonst die Beschriftungen ineinander). */}
      <View style={styles.progressRow}>
        {stepKeys.map((key, i) => (
          <View
            key={key}
            style={[styles.progressDot, { backgroundColor: i <= step ? p.accent : p.surfaceRaised }]}
          />
        ))}
      </View>
      <Text style={[eyebrow, { color: p.subtext, paddingHorizontal: 20, paddingTop: 10 }]}>{STEP_LABEL[currentKey]}</Text>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {currentKey === 'goal' && (
          <>
            <Text style={[title, { color: p.text }]}>Was ist dein Ziel?</Text>
            <View style={styles.chipWrap}>
              <Chip label="Auf ein Ziel hintrainieren" selected={goalMode === 'race'} onPress={() => setGoalMode('race')} />
              <Chip label="Nur Form halten" selected={goalMode === 'maintain'} onPress={() => setGoalMode('maintain')} />
            </View>

            {goalMode === 'maintain' ? (
              <Card style={{ marginTop: 6 }}>
                <Text style={[body, { color: p.text, fontFamily: buttonType.fontFamily }]}>
                  Fortlaufender Plan, der deine Fitness hält – ohne Wettkampf.
                </Text>
                <Text style={[caption, { color: p.subtext, marginTop: 8 }]}>
                  Rollierender Wochenrhythmus: 1 Long Run + 1 Qualitätseinheit + lockere Läufe,
                  ~80/20 leicht/hart. Für Läufer:innen mit vorhandener Grundlage (etwa
                  halbmarathon-fähig). Intensität – nicht Umfang – erhält die Form.
                </Text>
              </Card>
            ) : (
              <>
                <Card>
                  <Text style={[eyebrow, { color: p.subtext }]}>Ziel in einem Satz (optional)</Text>
                  <TextInput
                    value={quickText}
                    onChangeText={setQuickText}
                    placeholder="z. B. 10k unter 45 min in 12 Wochen, 4x pro Woche"
                    placeholderTextColor={p.faint}
                    style={[styles.quickInput, { color: p.text, backgroundColor: p.surfaceRaised }]}
                    multiline
                  />
                  <Pressable onPress={applyQuick} style={styles.quickBtn}>
                    <Text style={[caption, { color: p.accent, fontFamily: buttonType.fontFamily }]}>Übernehmen</Text>
                  </Pressable>
                  {quickHint && <Text style={[caption, { color: p.subtext, marginTop: 4 }]}>{quickHint}</Text>}
                </Card>

                <Text style={[title, { color: p.text }]}>Welche Distanz ist dein Ziel?</Text>
                <View style={styles.chipWrap}>
                  {DISTANCES.map((d) => (
                    <Chip key={d.key} label={d.label} selected={distance === d.key} onPress={() => setDistance(d.key)} />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {currentKey === 'startDate' && (
          <>
            <Text style={[title, { color: p.text }]}>Wann soll dein Plan beginnen?</Text>
            <Text style={[body, { color: p.subtext }]}>
              Wähle ein Startdatum, das für dich passt – du kannst es später jederzeit ändern.
            </Text>
            <View style={styles.chipWrap}>
              <Chip label="Heute" selected={startChoice === 'today'} onPress={() => setStartChoice('today')} />
              <Chip label="Morgen" selected={startChoice === 'tomorrow'} onPress={() => setStartChoice('tomorrow')} />
              <Chip label="Nächster Montag" selected={startChoice === 'monday'} onPress={() => setStartChoice('monday')} />
              <Chip label="Eigenes Datum" selected={startChoice === 'custom'} onPress={() => setStartChoice('custom')} />
            </View>
            {startChoice === 'custom' && (
              <View style={styles.timeRow}>
                <TextInput
                  value={startDay}
                  onChangeText={(t) => setStartDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="TT"
                  placeholderTextColor={p.faint}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 70 }]}
                />
                <Text style={[title, { color: p.text }]}>.</Text>
                <TextInput
                  value={startMonth}
                  onChangeText={(t) => setStartMonth(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="MM"
                  placeholderTextColor={p.faint}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 70 }]}
                />
                <Text style={[title, { color: p.text }]}>.</Text>
                <TextInput
                  value={startYear}
                  onChangeText={(t) => setStartYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="JJJJ"
                  placeholderTextColor={p.faint}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 90 }]}
                />
              </View>
            )}
            {startChoice === 'custom' && customStartDate === null ? (
              <Text style={[caption, { color: p.warning }]}>Bitte ein gültiges Datum eingeben.</Text>
            ) : (
              <Text style={[caption, { color: p.subtext }]}>
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
            <Text style={[title, { color: p.text }]}>Wie lange soll dein Plan laufen?</Text>
            <View style={styles.chipWrap}>
              {WEEK_OPTIONS.map((w) => (
                <Chip key={w} label={`${w} Wochen`} selected={weeks === w} onPress={() => setWeeks(w)} />
              ))}
            </View>
          </>
        )}

        {currentKey === 'terrain' && (
          <>
            <Text style={[title, { color: p.text }]}>Wie bergig ist deine Zielstrecke?</Text>
            <Text style={[body, { color: p.subtext }]}>
              Nur eine grobe Einschätzung – hilft uns, gezielt Bergreize in dein Training einzubauen,
              falls nötig. Du kannst das später jederzeit ändern.
            </Text>
            <View style={{ gap: 10 }}>
              {(['flat', 'rolling', 'moderate', 'hilly'] as CourseTerrain[]).map((t) => (
                <Pressable key={t} onPress={() => setCourseTerrain(t)}>
                  <Card outlined={courseTerrain === t} style={styles.optionCard}>
                    <Text style={[body, { color: p.text, fontFamily: buttonType.fontFamily }]}>{TERRAIN_LABEL[t]}</Text>
                    <Text style={[caption, { color: p.subtext, marginTop: 4 }]}>{TERRAIN_RANGE_LABEL[t]}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {currentKey === 'fitness' && (
          <>
            <Text style={[title, { color: p.text }]}>Machen wir einen kurzen Einstiegslauf</Text>
            <Text style={[body, { color: p.subtext }]}>
              Ein echter Testlauf kalibriert dein Training viel zuverlässiger als eine Selbst-
              einschätzung. Wähle, was für dich passt:
            </Text>
            <View style={styles.chipWrap}>
              <Chip label="12-Minuten-Test" selected={fitnessMode === 'cooper'} onPress={() => setFitnessMode('cooper')} />
              <Chip label="Testlauf / letzter Lauf" selected={fitnessMode === 'race'} onPress={() => setFitnessMode('race')} />
              <Chip label="Nur grob schätzen" selected={fitnessMode === 'level'} onPress={() => setFitnessMode('level')} />
            </View>

            {fitnessMode === 'cooper' && (
              <View style={{ gap: 14, marginTop: 6 }}>
                <Card>
                  <Text style={[body, { color: p.text, fontFamily: buttonType.fontFamily }]}>
                    Lauf 12 Minuten so weit du kannst.
                  </Text>
                  <Text style={[caption, { color: p.subtext, marginTop: 6 }]}>
                    Kurz locker einlaufen, dann 12 Minuten gleichmäßig zügig (nicht Sprint). Am besten
                    auf flacher Runde oder Bahn. Danach die gelaufene Distanz eintragen.
                  </Text>
                </Card>
                <Text style={[eyebrow, { color: p.subtext }]}>Gelaufene Distanz in Metern</Text>
                <TextInput
                  value={cooperMeters}
                  onChangeText={(t) => setCooperMeters(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="z. B. 2400"
                  placeholderTextColor={p.faint}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 140 }]}
                />
                <Text style={[eyebrow, { color: p.subtext }]}>Höhenmeter (optional)</Text>
                <TextInput
                  value={raceAscent}
                  onChangeText={(t) => setRaceAscent(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="z. B. 15"
                  placeholderTextColor={p.faint}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 110 }]}
                />
              </View>
            )}

            {fitnessMode === 'race' && (
              <View style={{ gap: 14, marginTop: 6 }}>
                <Text style={[eyebrow, { color: p.subtext }]}>Distanz</Text>
                <View style={styles.chipWrap}>
                  <Chip label="3 km" selected={raceMeters === 3000} onPress={() => setRaceMeters(3000)} />
                  <Chip label="5 km" selected={raceMeters === 5000} onPress={() => setRaceMeters(5000)} />
                  <Chip label="10 km" selected={raceMeters === 10000} onPress={() => setRaceMeters(10000)} />
                </View>
                <Text style={[eyebrow, { color: p.subtext }]}>Zeit (Minuten : Sekunden)</Text>
                <View style={styles.timeRow}>
                  <TextInput
                    value={raceMin}
                    onChangeText={(t) => setRaceMin(t.replace(/[^0-9]/g, '').slice(0, 3))}
                    keyboardType="number-pad"
                    placeholder="mm"
                    placeholderTextColor={p.faint}
                    style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised }]}
                  />
                  <Text style={[title, { color: p.text }]}>:</Text>
                  <TextInput
                    value={raceSec}
                    onChangeText={(t) => setRaceSec(t.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    placeholder="ss"
                    placeholderTextColor={p.faint}
                    style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised }]}
                  />
                </View>
                <Text style={[eyebrow, { color: p.subtext }]}>Höhenmeter (optional)</Text>
                <TextInput
                  value={raceAscent}
                  onChangeText={(t) => setRaceAscent(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="z. B. 40"
                  placeholderTextColor={p.faint}
                  style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 110 }]}
                />
              </View>
            )}

            {fitnessMode === 'level' && (
              <View style={{ gap: 10 }}>
                {LEVELS.map((l) => (
                  <Pressable key={l.key} onPress={() => setLevel(l.key)}>
                    <Card outlined={level === l.key} style={styles.optionCard}>
                      <Text style={[body, { color: p.text, fontFamily: buttonType.fontFamily }]}>{l.label}</Text>
                      <Text style={[caption, { color: p.subtext, marginTop: 4 }]}>{l.criterion}</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}

            {previewVdot !== null && (
              <Card style={{ alignItems: 'flex-start' }}>
                <Text style={[eyebrow, { color: p.subtext }]}>Geschätzte VDOT</Text>
                <Text style={[display, { color: p.accent, fontSize: 40, lineHeight: 44 }]}>{previewVdot}</Text>
                <Text style={[caption, { color: p.text, marginTop: 4 }]}>
                  Lockere Läufe ~ {paceMpsToPerKm(zonePaceMps(previewVdot, 'easy').lowMps)}–
                  {paceMpsToPerKm(zonePaceMps(previewVdot, 'easy').highMps)} /km
                </Text>
              </Card>
            )}
          </>
        )}

        {currentKey === 'days' && (
          <>
            <Text style={[title, { color: p.text }]}>An wie vielen Tagen pro Woche willst du laufen?</Text>
            <View style={styles.chipWrap}>
              {DAY_OPTIONS.map((d) => (
                <Chip key={d} label={`${d} Tage`} selected={days === d} onPress={() => setDays(d)} />
              ))}
            </View>

            <Text style={[eyebrow, { color: p.subtext, marginTop: 8 }]}>
              An welchen Wochentagen kannst du grundsätzlich laufen? (optional)
            </Text>
            <Text style={[body, { color: p.subtext }]}>
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
                />
              ))}
            </View>
            {days !== null && availableDays.size > 0 && availableDays.size < days && (
              <Text style={[caption, { color: p.warning }]}>
                Nur {availableDays.size} von {days} gewünschten Tagen ausgewählt – dein Plan bekommt
                entsprechend weniger Trainingstage.
              </Text>
            )}
          </>
        )}

        {currentKey === 'strength' && (
          <>
            <Text style={[title, { color: p.text }]}>Krafttraining dazu?</Text>
            <Text style={[eyebrow, { color: p.subtext }]}>Einheiten pro Woche (2× empfohlen)</Text>
            <View style={styles.chipWrap}>
              {[0, 1, 2, 3].map((n) => (
                <Chip key={n} label={n === 0 ? 'Aus' : `${n}×`} selected={strengthSessions === n} onPress={() => setStrengthSessions(n)} />
              ))}
            </View>
            <Text style={[eyebrow, { color: p.subtext }]}>
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
                />
              ))}
            </View>
            <Text style={[caption, { color: p.subtext }]}>
              {strengthEquipment === 'gym'
                ? 'Deine Krafteinheiten nutzen die verfügbaren Gewichte.'
                : 'Deine Krafteinheiten laufen mit Körpergewichtsübungen.'}
            </Text>

            {distance && days && (
              <Card>
                <Text style={[eyebrow, { color: p.subtext }]}>Reicht das für dein Ziel?</Text>
                {assessTraining({ distance, daysPerWeek: days, strengthPerWeek: strengthSessions }).advice.map((a, i) => (
                  <View key={i} style={styles.adviceRow}>
                    <View style={[styles.adviceDot, { backgroundColor: levelColor(a.level) }]} />
                    <Text style={[body, { flex: 1, color: p.text }]}>{a.text}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navBar, { borderTopColor: p.border }]}>
        <Pressable onPress={onBack} style={styles.navBack}>
          <Text style={[body, { color: p.subtext, fontFamily: buttonType.fontFamily }]}>Zurück</Text>
        </Pressable>
        <Button
          title={step === stepKeys.length - 1 ? 'Plan erstellen' : 'Weiter'}
          onPress={onNext}
          disabled={!canNext}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  progressRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  scroll: { padding: 24, gap: 16 },
  adviceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 10, alignSelf: 'stretch' },
  adviceDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  optionCard: { gap: 0 },
  quickInput: { borderRadius: 14, padding: 14, fontSize: 15, minHeight: 64, textAlignVertical: 'top' },
  quickBtn: { paddingVertical: 10, marginTop: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeInput: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '700',
    width: 90,
    textAlign: 'center',
  },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderTopWidth: 1 },
  navBack: { paddingVertical: 14, paddingHorizontal: 8 },
});
