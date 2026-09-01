import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isoDay, predictRaceTime, recoveryDaysFor, taperDaysFor } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, display, eyebrow, heading, body, bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { Button } from '@/ui/components/Button';
import { formatDistance, formatRaceTime } from '@/ui/format';
import { useProfileStore } from '@/store/profile';

const DISTANCES: { label: string; meters: number }[] = [
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: 'Halbmarathon', meters: 21097.5 },
  { label: 'Marathon', meters: 42195 },
];

export default function AddEventScreen() {
  const p = usePalette();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const addRaceEvent = useProfileStore((s) => s.addRaceEvent);
  const removeRaceEvent = useProfileStore((s) => s.removeRaceEvent);

  const [meters, setMeters] = useState<number | 'custom'>(21097.5);
  const [customMeters, setCustomMeters] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [name, setName] = useState('');
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [sec, setSec] = useState('');

  const distanceMeters = meters === 'custom' ? parseInt(customMeters, 10) : meters;
  const validDistance = Number.isFinite(distanceMeters) && distanceMeters! > 0;

  const eventDate: Date | null = useMemo(() => {
    const d = parseInt(day, 10);
    const mo = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return null;
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
    const date = new Date(y, mo - 1, d);
    if (date.getMonth() !== mo - 1) return null; // z. B. 31. Feb rollt sonst über
    return date;
  }, [day, month, year]);

  const targetTimeSeconds = useMemo(() => {
    const hh = h === '' ? 0 : parseInt(h, 10);
    const mm = m === '' ? 0 : parseInt(m, 10);
    const ss = sec === '' ? 0 : parseInt(sec, 10);
    if ([hh, mm, ss].some((n) => !Number.isFinite(n)) || mm >= 60 || ss >= 60) return undefined;
    const total = hh * 3600 + mm * 60 + ss;
    return total > 0 ? total : undefined;
  }, [h, m, sec]);

  const predictedSeconds =
    validDistance && profile ? targetTimeSeconds ?? predictRaceTime(profile.currentVdot, distanceMeters!) : null;
  const taperDays = validDistance ? taperDaysFor(distanceMeters!) : null;
  const recoveryDays = validDistance ? recoveryDaysFor(distanceMeters!) : null;

  const canSubmit = validDistance && eventDate !== null;

  function numField(value: string, set: (v: string) => void, ph: string, maxLen: number, width: number) {
    return (
      <TextInput
        value={value}
        onChangeText={(t) => set(t.replace(/[^0-9]/g, '').slice(0, maxLen))}
        keyboardType="number-pad"
        placeholder={ph}
        placeholderTextColor={p.faint}
        style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width }]}
      />
    );
  }

  function submit() {
    if (!eventDate || !validDistance) return;
    const status = addRaceEvent({
      date: isoDay(eventDate),
      distanceMeters: distanceMeters!,
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(targetTimeSeconds ? { targetTimeSeconds } : {}),
    });
    if (status === 'applied') {
      Alert.alert(
        'Eingetragen',
        'Der Wettkampf ist in deinem Plan eingetragen, Taper davor und Erholung danach wurden angepasst.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } else if (status === 'out-of-range') {
      Alert.alert('Außerhalb des Plans', 'Dieses Datum liegt außerhalb deines aktuellen Trainingsplans.');
    } else {
      Alert.alert('Datum in der Vergangenheit', 'Bitte ein Datum in der Zukunft eintragen.');
    }
  }

  function confirmRemove(eventId: string, label: string) {
    Alert.alert('Wettkampf entfernen?', `„${label}" wird aus dem Plan entfernt, Taper/Erholung werden zurückgesetzt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => removeRaceEvent(eventId) },
    ]);
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[caption, { color: p.accent }]}>‹ Zurück</Text>
        </Pressable>
        <Text style={[title, { color: p.text, marginTop: 6 }]}>Wettkampf eintragen</Text>
        <Text style={[body, { color: p.subtext }]}>
          Ein Testrennen oder ein zusätzlicher Wettkampf mitten im Plan? Trag ihn ein – die Tage davor werden getapert,
          danach bekommst du ein Erholungsfenster, der Rest deines Plans bleibt unangetastet.
        </Text>

        <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Distanz</Text>
        <View style={styles.chipWrap}>
          {DISTANCES.map((d) => (
            <Chip key={d.meters} label={d.label} selected={meters === d.meters} onPress={() => setMeters(d.meters)} />
          ))}
          <Chip label="Freie Distanz" selected={meters === 'custom'} onPress={() => setMeters('custom')} />
        </View>
        {meters === 'custom' && (
          <TextInput
            value={customMeters}
            onChangeText={(t) => setCustomMeters(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="Meter, z. B. 15000"
            placeholderTextColor={p.faint}
            style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: 150 }]}
          />
        )}

        <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Datum</Text>
        <View style={styles.timeRow}>
          {numField(day, setDay, 'TT', 2, 70)}
          <Text style={[title, { color: p.text }]}>.</Text>
          {numField(month, setMonth, 'MM', 2, 70)}
          <Text style={[title, { color: p.text }]}>.</Text>
          {numField(year, setYear, 'JJJJ', 4, 90)}
        </View>

        <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Name (optional)</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="z. B. Herbst-Halbmarathon"
          placeholderTextColor={p.faint}
          style={[styles.timeInput, { color: p.text, backgroundColor: p.surfaceRaised, width: '100%', textAlign: 'left' }]}
        />

        <Text style={[eyebrow, { color: p.subtext, marginTop: 4 }]}>Zielzeit (optional, Std : Min : Sek)</Text>
        <View style={styles.timeRow}>
          {numField(h, setH, 'h', 2, 60)}
          <Text style={[title, { color: p.text }]}>:</Text>
          {numField(m, setM, 'mm', 2, 60)}
          <Text style={[title, { color: p.text }]}>:</Text>
          {numField(sec, setSec, 'ss', 2, 60)}
        </View>
        <Text style={[caption, { color: p.subtext }]}>Ohne Angabe wird deine Renn-Pace aus der aktuellen VDOT geschätzt.</Text>

        {validDistance && predictedSeconds != null && taperDays != null && recoveryDays != null && (
          <Card style={{ alignItems: 'flex-start' }}>
            <Text style={[eyebrow, { color: p.subtext }]}>Geschätzte Zielzeit</Text>
            <Text style={[display, { color: p.accent, fontSize: 32, lineHeight: 36 }]}>{formatRaceTime(predictedSeconds)}</Text>
            <Text style={[caption, { color: p.text, marginTop: 8 }]}>
              {formatDistance(distanceMeters!)} · {taperDays} {taperDays === 1 ? 'Tag' : 'Tage'} Taper davor,{' '}
              {recoveryDays} {recoveryDays === 1 ? 'Tag' : 'Tage'} Erholung danach.
            </Text>
          </Card>
        )}
        {eventDate === null && (day || month || year) && (
          <Text style={[caption, { color: p.warning }]}>Bitte ein gültiges Datum eingeben.</Text>
        )}

        <Button title="Eintragen & Plan anpassen" onPress={submit} disabled={!canSubmit} style={{ marginTop: 4 }} />

        {profile?.raceEvents && profile.raceEvents.length > 0 && (
          <>
            <Text style={[heading, { color: p.text, marginTop: 18 }]}>Deine Zusatz-Wettkämpfe</Text>
            {profile.raceEvents.map((ev) => {
              const label = ev.name ?? formatDistance(ev.distanceMeters);
              const dateLabel = new Date(`${ev.date}T12:00:00`).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
              return (
                <Card key={ev.id} style={styles.eventRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[bodyStrong, { color: p.text }]}>{label}</Text>
                    <Text style={[caption, { color: p.subtext, marginTop: 2 }]}>
                      {dateLabel} · {formatDistance(ev.distanceMeters)}
                    </Text>
                    <Pressable onPress={() => router.push({ pathname: '/race-guide', params: { eventId: ev.id } })} hitSlop={6}>
                      <Text style={[caption, { color: p.accent, marginTop: 4 }]}>Audioguide testen ›</Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => confirmRemove(ev.id, label)} hitSlop={10}>
                    <Text style={{ color: p.warning, fontSize: 16 }}>✕</Text>
                  </Pressable>
                </Card>
              );
            })}
          </>
        )}
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
    textAlign: 'center',
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
