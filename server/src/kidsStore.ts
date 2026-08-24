// Ablage für Max' aktuell eingestelltes Training (PaceForge Kids, Kernfunktion 4a:
// "gemeinsam laufen mit Papa"). EIN Eintrag pro Kind-Code (childId, von Max' App
// einmalig generiert und Papa einmalig in seiner PaceForge-App eingetragen).
//
// Bewusst ein EIGENER, kleiner Upstash/Memory-Store statt storage.ts wiederzuver-
// wenden: andere Werteform (Trainings-Vorgabe statt Trainingsplan-Snapshot), eigener
// Key-Präfix - gleiches Muster wie garminStore.ts.

export interface StoredPlannedTraining {
  opponentCharacterId: string | null;
  opponentName: string | null;
  targetPaceSecPerKm: number | null;
  intervalRunSeconds: number | null;
  intervalWalkSeconds: number | null;
  distanceGoalMeters: number | null;
  updatedAt: string;
}

export interface KidsStore {
  readonly kind: 'memory' | 'redis';
  get(childId: string): Promise<StoredPlannedTraining | null>;
  put(childId: string, training: StoredPlannedTraining): Promise<void>;
}

export class MemoryKidsStore implements KidsStore {
  readonly kind = 'memory' as const;
  private readonly map = new Map<string, StoredPlannedTraining>();

  async get(childId: string): Promise<StoredPlannedTraining | null> {
    return this.map.get(childId) ?? null;
  }

  async put(childId: string, training: StoredPlannedTraining): Promise<void> {
    this.map.set(childId, training);
  }
}

const KEY_PREFIX = 'paceforge:kids:';

export class UpstashKidsStore implements KidsStore {
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

  async get(childId: string): Promise<StoredPlannedTraining | null> {
    const raw = await this.command(['GET', KEY_PREFIX + childId]);
    if (typeof raw !== 'string' || raw === '') return null;
    try {
      return JSON.parse(raw) as StoredPlannedTraining;
    } catch {
      return null;
    }
  }

  async put(childId: string, training: StoredPlannedTraining): Promise<void> {
    await this.command(['SET', KEY_PREFIX + childId, JSON.stringify(training)]);
  }
}

export function createKidsStore(env: NodeJS.ProcessEnv = process.env): KidsStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return new UpstashKidsStore(url, token);
  return new MemoryKidsStore();
}
