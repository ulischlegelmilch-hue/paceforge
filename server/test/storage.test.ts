import { describe, it, expect } from 'vitest';
import { createSnapshotStore, MemoryStore, UpstashStore, type Snapshot } from '../src/storage';

const snap: Snapshot = { profile: { id: 'a' }, plan: null, activities: [], updatedAt: '2026-08-03T10:00:00.000Z' };

describe('Snapshot-Persistenz', () => {
  it('MemoryStore legt ab, liest und löscht', async () => {
    const store = new MemoryStore();
    expect(await store.get('x')).toBeNull();
    await store.put('x', snap);
    expect(await store.get('x')).toEqual(snap);
    await store.delete('x');
    expect(await store.get('x')).toBeNull();
  });

  it('createSnapshotStore wählt Redis nur mit vollständiger Konfiguration', () => {
    expect(createSnapshotStore({} as NodeJS.ProcessEnv).kind).toBe('memory');
    expect(
      createSnapshotStore({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' } as NodeJS.ProcessEnv).kind,
    ).toBe('memory');
    expect(
      createSnapshotStore({
        UPSTASH_REDIS_REST_URL: 'https://x.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'tok',
      } as NodeJS.ProcessEnv).kind,
    ).toBe('redis');
  });

  it('UpstashStore spricht die REST-API mit SET/GET/DEL an', async () => {
    const calls: unknown[][] = [];
    let stored: string | null = null;
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const args = JSON.parse(String(init?.body)) as (string | number)[];
      calls.push(args);
      if (args[0] === 'SET') stored = String(args[2]);
      if (args[0] === 'DEL') stored = null;
      const result = args[0] === 'GET' ? stored : 'OK';
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as unknown as typeof fetch;

    const store = new UpstashStore('https://x.upstash.io', 'tok', fakeFetch);
    expect(await store.get('dev1')).toBeNull();
    await store.put('dev1', snap);
    expect(await store.get('dev1')).toEqual(snap);
    await store.delete('dev1');
    expect(await store.get('dev1')).toBeNull();

    expect(calls[0]).toEqual(['GET', 'paceforge:sync:dev1']);
    expect(calls[1]?.[0]).toBe('SET');
  });

  it('UpstashStore meldet HTTP-Fehler und verträgt kaputte Einträge', async () => {
    const failing = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    await expect(new UpstashStore('https://x', 't', failing).get('a')).rejects.toThrow(/HTTP 500/);

    const garbage = (async () =>
      new Response(JSON.stringify({ result: 'kein json' }), { status: 200 })) as unknown as typeof fetch;
    expect(await new UpstashStore('https://x', 't', garbage).get('a')).toBeNull();
  });
});
