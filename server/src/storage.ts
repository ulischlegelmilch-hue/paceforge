// Persistenz für die Sync-Snapshots.
//
// Bisher lag der Sync-Stand nur in einer Map im Prozess – bei jedem Neustart des
// Servers (und auf Render z. B. bei jedem Deploy oder nach dem Einschlafen des
// Free-Tier-Dienstes) war er weg. Deshalb hier eine kleine Abstraktion mit zwei
// Implementierungen:
//
//   - MemoryStore   : Fallback ohne Konfiguration (Tests, lokale Entwicklung)
//   - UpstashStore  : Upstash Redis über die REST-API (nur `fetch`, keine
//                     zusätzliche Dependency, funktioniert auf Render/Vercel)
//
// Aktiviert wird Upstash über UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.

export interface Snapshot {
  profile: unknown;
  plan: unknown;
  activities: unknown[];
  updatedAt: string;
}

export interface SnapshotStore {
  readonly kind: 'memory' | 'redis';
  get(id: string): Promise<Snapshot | null>;
  put(id: string, snap: Snapshot): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemoryStore implements SnapshotStore {
  readonly kind = 'memory' as const;
  private readonly map = new Map<string, Snapshot>();

  async get(id: string): Promise<Snapshot | null> {
    return this.map.get(id) ?? null;
  }

  async put(id: string, snap: Snapshot): Promise<void> {
    this.map.set(id, snap);
  }

  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

const KEY_PREFIX = 'paceforge:sync:';

// Upstash-REST: ein POST auf die Basis-URL mit dem Kommando als JSON-Array.
// Antwort ist immer { result: <wert> } bzw. { error: "..." }.
export class UpstashStore implements SnapshotStore {
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

  async get(id: string): Promise<Snapshot | null> {
    const raw = await this.command(['GET', KEY_PREFIX + id]);
    if (typeof raw !== 'string' || raw === '') return null;
    try {
      return JSON.parse(raw) as Snapshot;
    } catch {
      // Kaputter Eintrag soll den Abruf nicht sprengen – wie „nichts gespeichert".
      return null;
    }
  }

  async put(id: string, snap: Snapshot): Promise<void> {
    await this.command(['SET', KEY_PREFIX + id, JSON.stringify(snap)]);
  }

  async delete(id: string): Promise<void> {
    await this.command(['DEL', KEY_PREFIX + id]);
  }
}

// Wählt anhand der Umgebung den passenden Store.
export function createSnapshotStore(env: NodeJS.ProcessEnv = process.env): SnapshotStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return new UpstashStore(url, token);
  return new MemoryStore();
}
