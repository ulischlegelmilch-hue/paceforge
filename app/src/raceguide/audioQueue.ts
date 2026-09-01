import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

import { raceGuideAudioAssets } from './audioAssets';

// Audio-Warteschlange für den Wettkampf-Audioguide, portiert vom bewährten Muster
// aus PaceForge Kids' AnnouncementQueue/HybridSpeechEngine: FIFO, nie überlappend,
// UND ein Watchdog-Timeout, der die Queue zwangsweise weiterschaltet, falls kein
// Fertig-Event kommt (Bluetooth-Aussetzer, fehlendes Sample o.ä.) - das ist genau
// die Lehre aus dem dort bereits gefundenen und gefixten "Audio-Queue-Hänger-Bug",
// hier präventiv gleich eingebaut statt live neu zu entdecken.
//
// Hybrid-Fallback: fehlt eine ID im vorgenerierten ElevenLabs-Katalog (z. B. ein
// später ergänzter Slot), wird der Text stattdessen per On-Device-TTS (expo-speech)
// gesprochen - App bleibt funktionsfähig, auch ohne den vollen Clip-Satz.

const WATCHDOG_TIMEOUT_MS = 12_000;

export interface QueuedAnnouncement {
  /** ID aus raceGuideAudioAssets (Katalog-Schema, siehe audioAssets.ts). */
  id: string;
  /** Gesprochener Text - Untertitel-Anzeige in der UI, und Fallback-Text für expo-speech. */
  text: string;
}

type AnnounceListener = (item: QueuedAnnouncement) => void;

class RaceGuideAudioQueue {
  private queue: QueuedAnnouncement[] = [];
  private playing = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private listener: AnnounceListener | null = null;

  /** Muss einmal vor dem ersten enqueue() aufgerufen werden (z. B. beim Start des Guides). */
  async configureAudioSession(): Promise<void> {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: true,
    });
  }

  setOnAnnounce(listener: AnnounceListener | null): void {
    this.listener = listener;
  }

  enqueue(item: QueuedAnnouncement): void {
    this.queue.push(item);
    this.maybePlayNext();
  }

  /** Leert die Warteschlange und beendet eine laufende Ansage sofort (z. B. bei Stopp/Pause). */
  clear(): void {
    this.queue = [];
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    Speech.stop();
    this.playing = false;
  }

  private maybePlayNext(): void {
    if (this.playing || this.queue.length === 0) return;
    const next = this.queue.shift();
    if (!next) return;
    this.playing = true;
    this.listener?.(next);
    this.playOne(next);
  }

  private playOne(item: QueuedAnnouncement): void {
    let finished = false;
    let player: AudioPlayer | null = null;
    let subscription: { remove: () => void } | null = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.watchdog) {
        clearTimeout(this.watchdog);
        this.watchdog = null;
      }
      subscription?.remove();
      player?.remove();
      this.playing = false;
      this.maybePlayNext();
    };

    this.watchdog = setTimeout(finish, WATCHDOG_TIMEOUT_MS);

    const assetModule = raceGuideAudioAssets[item.id];
    if (assetModule === undefined) {
      Speech.speak(item.text, { language: 'de-DE', onDone: finish, onStopped: finish, onError: finish });
      return;
    }

    player = createAudioPlayer(assetModule);
    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) finish();
    });
    player.setActiveForLockScreen(true);
    player.play();
  }
}

export const raceGuideAudioQueue = new RaceGuideAudioQueue();
