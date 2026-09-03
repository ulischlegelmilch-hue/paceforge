import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as KeepAwake from 'expo-keep-awake';
import { fuelingSummary, predictRaceTime, ymdOf, type PlanEvent } from '@paceforge/core';

import { usePalette } from '@/ui/colors';
import { title, heading, display, body, bodyStrong, caption, eyebrow } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { formatDistance, formatDuration, fuelingPrepText, formatRaceTime } from '@/ui/format';
import { useProfileStore } from '@/store/profile';
import { currentElapsedSeconds, useRaceGuideStore } from '@/raceguide/runSessionStore';

const KEEP_AWAKE_TAG = 'race-guide';

export default function RaceGuideScreen() {
  const p = usePalette();
  const router = useRouter();
  const { eventId, distanceMeters: distanceParam, estimatedTotalSeconds: durationParam, name: nameParam } =
    useLocalSearchParams<{ eventId?: string; distanceMeters?: string; estimatedTotalSeconds?: string; name?: string }>();

  const profile = useProfileStore((s) => s.profile);
  const raceEvent = useMemo(
    () => profile?.raceEvents?.find((e) => e.id === eventId) ?? null,
    [profile?.raceEvents, eventId],
  );
  // Alternative zum Wettkampf-Event: ein Trainings-Long-Run ohne festen
  // PlanEvent-Eintrag (siehe workout.tsx "Audioguide starten") - derselbe Guide
  // (GPS, km-Ansagen, Verpflegung) funktioniert für jeden langen Lauf, nicht nur
  // fürs Zielrennen.
  const adhocEvent = useMemo<PlanEvent | null>(() => {
    const distanceMeters = Number(distanceParam);
    const targetTimeSeconds = Number(durationParam);
    if (!distanceParam || !durationParam || !(distanceMeters > 0) || !(targetTimeSeconds > 0)) return null;
    return { id: `adhoc-${distanceParam}-${durationParam}`, date: ymdOf(new Date()), distanceMeters, targetTimeSeconds, name: nameParam };
  }, [distanceParam, durationParam, nameParam]);
  const event = raceEvent ?? adhocEvent;
  const isAdhoc = !raceEvent && !!adhocEvent;

  const status = useRaceGuideStore((s) => s.status);
  const distanceMeters = useRaceGuideStore((s) => s.distanceMeters);
  const lastAnnouncementText = useRaceGuideStore((s) => s.lastAnnouncementText);
  const backgroundGranted = useRaceGuideStore((s) => s.backgroundGranted);
  const weakSignal = useRaceGuideStore((s) => s.weakSignal);
  const lastAccuracyMeters = useRaceGuideStore((s) => s.lastAccuracyMeters);
  const gpsDisabled = useRaceGuideStore((s) => s.gpsDisabled);
  const start = useRaceGuideStore((s) => s.start);
  const pause = useRaceGuideStore((s) => s.pause);
  const resume = useRaceGuideStore((s) => s.resume);
  const stop = useRaceGuideStore((s) => s.stop);
  const reset = useRaceGuideStore((s) => s.reset);

  const [starting, setStarting] = useState(false);
  const [, forceTick] = useState(0);

  // Erzwingt einen Re-Render pro Sekunde, damit die verstrichene Zeit tickt -
  // Store selbst hält keinen eigenen Ticker (siehe runSessionStore.ts).
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === 'running' || status === 'paused') {
      void KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } else {
      void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
    return () => {
      void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [status]);

  useEffect(() => {
    return () => {
      // Verlässt der Nutzer den Screen während eines laufenden Guides ungeplant,
      // lieber sauber stoppen als einen verwaisten Hintergrund-Task zurücklassen.
      if (useRaceGuideStore.getState().status === 'running' || useRaceGuideStore.getState().status === 'paused') {
        void useRaceGuideStore.getState().stop();
      }
    };
  }, []);

  if (!profile || !event) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.center}>
          <Text style={[body, { color: p.subtext }]}>Lauf nicht gefunden.</Text>
          <Button title="Zurück" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const estimatedTotalSeconds = event.targetTimeSeconds ?? predictRaceTime(profile.currentVdot, event.distanceMeters);
  const fueling = fuelingSummary(event.distanceMeters, estimatedTotalSeconds);

  async function onStart() {
    if (Platform.OS === 'web') {
      Alert.alert('Nicht im Web verfügbar', 'Der Audioguide braucht Live-GPS und läuft nur auf dem Gerät.');
      return;
    }
    setStarting(true);
    const result = await start(event!, estimatedTotalSeconds);
    setStarting(false);
    if (result === 'permission-denied') {
      Alert.alert(
        'Standortzugriff nötig',
        'Der Audioguide braucht Zugriff auf deinen Standort, um deine Distanz zu tracken. Bitte in den Systemeinstellungen erlauben.',
      );
    }
  }

  function onStop() {
    Alert.alert('Guide beenden?', 'Das Tracking wird gestoppt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden', style: 'destructive', onPress: () => void stop() },
    ]);
  }

  if (status === 'idle') {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[eyebrow, { color: p.accent }]}>{isAdhoc ? 'Lauf-Audioguide' : 'Wettkampf-Audioguide'}</Text>
          <Text style={[title, { color: p.text, marginTop: 6 }]}>{event.name ?? formatDistance(event.distanceMeters)}</Text>
          <Text style={[body, { color: p.subtext, marginTop: 8 }]}>
            Ich begleite dich per Ansage durch die Strecke: Distanz kilometerweise, Verpflegungs-Hinweise und
            Motivation bis ins Ziel. Läuft auch mit gesperrtem Bildschirm weiter, sobald du den Hintergrund-
            Standortzugriff erlaubst.
          </Text>

          <Card style={{ marginTop: 20, gap: 6, alignItems: 'flex-start' }}>
            <Text style={[caption, { color: p.subtext }]}>Distanz</Text>
            <Text style={[display, { color: p.accent, fontSize: 32, lineHeight: 36 }]}>
              {formatDistance(event.distanceMeters)}
            </Text>
            <Text style={[caption, { color: p.text, marginTop: 6 }]}>
              Geschätzte Zielzeit: {formatRaceTime(estimatedTotalSeconds)}
            </Text>
          </Card>

          {fueling && (
            <Card style={{ marginTop: 14 }}>
              <Text style={[body, { color: p.text }]}>{fuelingPrepText(fueling)}</Text>
            </Card>
          )}

          <Button
            title={starting ? 'Starte…' : 'Guide starten'}
            onPress={onStart}
            loading={starting}
            style={{ marginTop: 24 }}
          />
          <Text style={[caption, { color: p.faint, marginTop: 10 }]}>
            Tipp: einmal vorher testen (z. B. bei einem lockeren Lauf), statt es zum ersten Mal im Wettkampf
            auszuprobieren.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (status === 'finished') {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.center}>
          <Text style={[eyebrow, { color: p.accent }]}>Geschafft!</Text>
          <Text style={[display, { color: p.text, marginTop: 10, fontSize: 40 }]}>{formatDistance(distanceMeters)}</Text>
          <Text style={[body, { color: p.subtext, marginTop: 8, textAlign: 'center' }]}>
            {event.name ?? formatDistance(event.distanceMeters)} ist im Ziel angekommen. Stark gelaufen!
          </Text>
          <Button
            title="Fertig"
            onPress={() => {
              reset();
              router.back();
            }}
            style={{ marginTop: 28, paddingHorizontal: 32 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // running | paused
  const elapsed = currentElapsedSeconds(useRaceGuideStore.getState());
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.center}>
        <Text style={[eyebrow, { color: p.subtext }]}>{event.name ?? formatDistance(event.distanceMeters)}</Text>
        <Text style={[display, { color: p.text, marginTop: 8, fontSize: 56 }]}>{formatDistance(distanceMeters)}</Text>
        <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
          von {formatDistance(event.distanceMeters)} · {formatDuration(Math.round(elapsed))}
        </Text>

        {!backgroundGranted && (
          <Text style={[caption, { color: p.warning, marginTop: 10, textAlign: 'center', maxWidth: 280 }]}>
            Kein Hintergrund-Standortzugriff erlaubt – der Guide funktioniert nur, solange die App im
            Vordergrund bleibt.
          </Text>
        )}

        {gpsDisabled ? (
          <Text style={[caption, { color: p.warning, marginTop: 10, textAlign: 'center', maxWidth: 280 }]}>
            GPS ist ausgeschaltet – bitte in den Systemeinstellungen aktivieren. Der Guide erkennt das automatisch
            und trackt dann weiter, ohne dass du ihn neu starten musst.
          </Text>
        ) : (
          weakSignal && (
            <Text style={[caption, { color: p.warning, marginTop: 10, textAlign: 'center', maxWidth: 280 }]}>
              Schwaches GPS-Signal{lastAccuracyMeters != null ? ` (~${Math.round(lastAccuracyMeters)}m Ungenauigkeit)` : ''} –
              freien Himmel suchen, Distanz kann ungenau oder verzögert sein.
            </Text>
          )
        )}

        {lastAnnouncementText && (
          <Card style={{ marginTop: 24, maxWidth: 320 }}>
            <Text style={[bodyStrong, { color: p.text, textAlign: 'center' }]}>„{lastAnnouncementText}"</Text>
          </Card>
        )}

        <View style={styles.controls}>
          {status === 'running' ? (
            <Button title="Pause" variant="secondary" onPress={() => void pause()} style={styles.controlButton} />
          ) : (
            <Button title="Weiter" onPress={() => void resume()} style={styles.controlButton} />
          )}
          <Button title="Beenden" variant="ghost" onPress={onStop} style={styles.controlButton} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 24, gap: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 32 },
  controlButton: { paddingHorizontal: 22 },
});
