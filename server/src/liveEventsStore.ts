// Ablage für Max' live gesprochene Audio-Coach-Ansagen während eines laufenden
// Trainings (PaceForge Kids, "Live mithören"-Erweiterung von Kernfunktion 4a).
// Anders als kidsStore.ts (EIN Wert pro Kind-Code) brauchen wir hier eine kleine,
// gedeckelte LISTE pro Kind-Code plus einen monotonen Cursor ("seq"), damit Papas
// App per "since" nur die neuen Ereignisse abholt statt jedes Mal alles.

export interface LiveEvent {
  seq: number;
  category: string;
  text: string;
  createdAtMillis: number;
}

export interface LiveEventsStore {
  readonly kind: 'memory' | 'redis';
  append(childId: string, event: Omit<LiveEvent, 'seq'>): Promise<LiveEvent>;
  since(childId: string, afterSeq: number, limit?: number): Promise<LiveEvent[]>;
  clear(childId: string): Promise<void>;
}

const MAX_EVENTS = 40;

export class MemoryLiveEventsStore implements LiveEventsStore {
  readonly kind = 'memory' as const;
  private readonly events = new Map<string, LiveEvent[]>();
  private readonly seqCounters = new Map<string, number>();

  async append(childId: string, event: Omit<LiveEvent, 'seq'>): Promise<LiveEvent> {
    const seq = (this.seqCounters.get(childId) ?? 0) + 1;
    this.seqCounters.set(childId, seq);
    const stored: LiveEvent = { ...event, seq };
    const list = this.events.get(childId) ?? [];
    list.push(stored);
    if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
    this.events.set(childId, list);
    return stored;
  }

  async since(childId: string, afterSeq: number, limit = MAX_EVENTS): Promise<LiveEvent[]> {
    const list = this.events.get(childId) ?? [];
    return list.filter((e) => e.seq > afterSeq).slice(0, limit);
  }

  async clear(childId: string): Promise<void> {
    this.events.delete(childId);
    this.seqCounters.delete(childId);
  }
}

const KEY_PREFIX = 'paceforge:kids:live:';
const SEQ_PREFIX = 'paceforge:kids:liveseq:';
const TTL_SECONDS = 3600; // räumt verwaiste Laufsessions von selbst auf, kein Cronjob nötig

export class UpstashLiveEventsStore implements LiveEventsStore {
  readonly kind = 'redis' as const;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async command(args: (string | number)[]): Promise<unknown> {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Upstash-Fehler (HTTP ${res.status}).`);
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`Upstash-Fehler: ${body.error}`);
    return body.result ?? null;
  }

  async append(childId: string, event: Omit<LiveEvent, 'seq'>): Promise<LiveEvent> {
    const seqRaw = await this.command(['INCR', SEQ_PREFIX + childId]);
    const seq = Number(seqRaw);
    const stored: LiveEvent = { ...event, seq };
    await this.command(['RPUSH', KEY_PREFIX + childId, JSON.stringify(stored)]);
    await this.command(['LTRIM', KEY_PREFIX + childId, -MAX_EVENTS, -1]);
    await this.command(['EXPIRE', KEY_PREFIX + childId, TTL_SECONDS]);
    await this.command(['EXPIRE', SEQ_PREFIX + childId, TTL_SECONDS]);
    return stored;
  }

  async since(childId: string, afterSeq: number, limit = MAX_EVENTS): Promise<LiveEvent[]> {
    const raw = await this.command(['LRANGE', KEY_PREFIX + childId, 0, -1]);
    if (!Array.isArray(raw)) return [];
    const events: LiveEvent[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      try {
        events.push(JSON.parse(item) as LiveEvent);
      } catch {
        // Kaputten Eintrag überspringen statt die ganze Abfrage scheitern zu lassen.
      }
    }
    return events.filter((e) => e.seq > afterSeq).slice(0, limit);
  }

  async clear(childId: string): Promise<void> {
    await this.command(['DEL', KEY_PREFIX + childId]);
    await this.command(['DEL', SEQ_PREFIX + childId]);
  }
}

export function createLiveEventsStore(env: NodeJS.ProcessEnv = process.env): LiveEventsStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return new UpstashLiveEventsStore(url, token);
  return new MemoryLiveEventsStore();
}
