import * as Speech from 'expo-speech';

// Eigene, kleine Audio-Warteschlange für "Papa hört live mit" - bewusst NICHT
// raceGuideAudioQueue wiederverwendet: die ist eng an die eigene GPS-Session/
// Permissions/den eigenen ElevenLabs-Asset-Namespace des Wettkampf-Audioguides
// gekoppelt. Uli könnte theoretisch gleichzeitig seinen eigenen Audioguide laufen
// lassen, während er Max zuhört - eine geteilte Queue würde beide Features um
// Sprechzeit konkurrieren lassen und riskiert falsche Audio-Clips durch
// ID-Kollision (Max' Ansagen haben keine passende Asset-ID in diesem Katalog).
// Deshalb hier: IMMER expo-speech, kein Clip-Katalog-Lookup. FIFO/nie-überlappend/
// Watchdog-Muster 1:1 von raceGuideAudioQueue übernommen.

const WATCHDOG_TIMEOUT_MS = 12_000;

class LiveAudioQueue {
  private queue: string[] = [];
  private playing = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  enqueue(text: string): void {
    this.queue.push(text);
    this.maybeSpeakNext();
  }

  clear(): void {
    this.queue = [];
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    Speech.stop();
    this.playing = false;
  }

  private maybeSpeakNext(): void {
    if (this.playing || this.queue.length === 0) return;
    const next = this.queue.shift();
    if (next === undefined) return;
    this.playing = true;

    const finish = () => {
      if (this.watchdog) {
        clearTimeout(this.watchdog);
        this.watchdog = null;
      }
      this.playing = false;
      this.maybeSpeakNext();
    };
    this.watchdog = setTimeout(finish, WATCHDOG_TIMEOUT_MS);

    Speech.speak(next, { language: 'de-DE', onDone: finish, onStopped: finish, onError: finish });
  }
}

export const liveAudioQueue = new LiveAudioQueue();
