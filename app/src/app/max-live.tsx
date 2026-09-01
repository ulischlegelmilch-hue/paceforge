import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/ui/colors';
import { title, body, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { useProfileStore } from '@/store/profile';
import { useLiveListenStore } from '@/maxlive/liveListenStore';

// "Live mithören": solange dieser Bildschirm offen und im Vordergrund ist, pollt
// er Max' gerade gesprochene Ansagen und spricht sie über Papas eigene TTS-Stimme
// nach - siehe maxlive/liveListenStore.ts. V1 bewusst nur im Vordergrund (siehe
// Plan "Live-Mithören"): Polling pausiert, sobald die App in den Hintergrund geht.

const CONNECTING_TIMEOUT_MS = 20_000;

export default function MaxLiveScreen() {
  const p = usePalette();
  const router = useRouter();
  const childCode = useProfileStore((s) => s.kidsChildCode);
  const status = useLiveListenStore((s) => s.status);
  const events = useLiveListenStore((s) => s.events);
  const start = useLiveListenStore((s) => s.start);
  const stop = useLiveListenStore((s) => s.stop);

  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    if (!childCode) return;
    start(childCode);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childCode]);

  useEffect(() => {
    if (events.length > 0) setConnecting(false);
  }, [events.length]);

  useEffect(() => {
    const timeout = setTimeout(() => setConnecting(false), CONNECTING_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  // Pausiert das Polling, sobald die App in den Hintergrund geht (V1-Scope: nur
  // im Vordergrund) - startet automatisch wieder, wenn sie zurückkommt.
  useEffect(() => {
    if (!childCode) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        start(childCode);
      } else {
        stop();
      }
    });
    return () => subscription.remove();
  }, [childCode, start, stop]);

  const listRef = useRef<ScrollView>(null);

  if (!childCode) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
        <View style={styles.center}>
          <Text style={[body, { color: p.subtext }]}>Erst mit Max' App koppeln (siehe „Max' Training").</Text>
          <Button title="Zurück" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={styles.header}>
        <Text onPress={() => router.back()} style={[caption, { color: p.accent, marginBottom: 12 }]}>
          ‹ Zurück
        </Text>
        <Text style={[title, { color: p.text }]}>Live mithören</Text>
        <Text style={[body, { color: p.subtext, marginTop: 4 }]}>
          {connecting && events.length === 0 ? 'Verbindet…' : status === 'listening' ? 'Live' : 'Gestoppt'}
        </Text>
      </View>

      <ScrollView ref={listRef} contentContainerStyle={styles.scroll} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
        {events.length === 0 && !connecting && (
          <Card>
            <Text style={[body, { color: p.subtext }]}>Noch keine Ansage von Max angekommen.</Text>
          </Card>
        )}
        {events.map((event) => (
          <Card key={event.seq} style={{ marginBottom: 8 }}>
            <Text style={[body, { color: p.text }]}>{event.text}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scroll: { padding: 20, paddingTop: 12, gap: 8 },
});
