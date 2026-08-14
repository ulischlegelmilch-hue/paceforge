// Ablage für Garmin-Connect-Sessions, EIN Eintrag pro Geräte-ID (dieselbe
// deviceId, die auch für den Cross-Device-Sync genutzt wird, siehe sync.ts).
// Gespeichert werden NIEMALS Nutzername/Passwort, sondern nur die von der
// inoffiziellen garmin-connect-Bibliothek nach dem Login gelieferten Session-
// Tokens (oauth1Token/oauth2Token) - verschlüsselt per tokenCrypto (AES-256-GCM).
//
// Bewusst ein EIGENER, kleiner Upstash/Memory-Store statt storage.ts'
// SnapshotStore wiederzuverwenden: andere Werteform (Tokens statt Trainingsplan-
// Snapshot), eigener Key-Präfix, und so bleibt der bereits getestete Sync-Store
// unangetastet.

export interface StoredGarminSession {
  username: string; // nur zur Anzeige in der UI ("verbunden als ..."), keine Anmeldedaten
  encryptedTokens: string; // tokenCrypto.encryptText(JSON.stringify({oauth1Token, oauth2Token}))
  connectedAt: string;
}

export interface GarminSessionStore {
  readonly kind: 'memory' | 'redis';
  get(deviceId: string): Promise<StoredGarminSession | null>;
  put(deviceId: string, session: StoredGarminSession): Promise<void>;
  delete(deviceId: string): Promise<void>;
}

export class MemoryGarminSessionStore implements GarminSessionStore {
  readonly kind = 'memory' as const;
  private readonly map = new Map<string, StoredGarminSession>();

  async get(deviceId: string): Promise<StoredGarminSession | null> {
    return this.map.get(deviceId) ?? null;
  }

  async put(deviceId: string, session: StoredGarminSession): Promise<void> {
    this.map.set(deviceId, session);
  }

  async delete(deviceId: string): Promise<void> {
    this.map.delete(deviceId);
  }
}

const KEY_PREFIX = 'paceforge:garmin:';

export class UpstashGarminSessionStore implements GarminSessionStore {
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

  async get(deviceId: string): Promise<StoredGarminSession | null> {
    const raw = await this.command(['GET', KEY_PREFIX + deviceId]);
    if (typeof raw !== 'string' || raw === '') return null;
    try {
      return JSON.parse(raw) as StoredGarminSession;
    } catch {
      return null;
    }
  }

  async put(deviceId: string, session: StoredGarminSession): Promise<void> {
    await this.command(['SET', KEY_PREFIX + deviceId, JSON.stringify(session)]);
  }

  async delete(deviceId: string): Promise<void> {
    await this.command(['DEL', KEY_PREFIX + deviceId]);
  }
}

export function createGarminSessionStore(env: NodeJS.ProcessEnv = process.env): GarminSessionStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return new UpstashGarminSessionStore(url, token);
  return new MemoryGarminSessionStore();
}
