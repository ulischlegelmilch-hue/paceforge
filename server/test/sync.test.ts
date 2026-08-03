import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/storage';

describe('Sync + Garmin-Gerüst', () => {
  let app: FastifyInstance;
  let store: MemoryStore;
  beforeAll(async () => {
    store = new MemoryStore();
    app = buildApp({ store });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('PUT dann GET liefert den Snapshot zurück', async () => {
    const payload = { profile: { id: 'a1' }, plan: { id: 'p1' }, activities: [{ id: 'act1' }] };
    const put = await app.inject({ method: 'PUT', url: '/api/sync/device-xyz', payload });
    expect(put.statusCode).toBe(200);
    expect(put.json().ok).toBe(true);

    const get = await app.inject({ method: 'GET', url: '/api/sync/device-xyz' });
    expect(get.statusCode).toBe(200);
    const snap = get.json();
    expect(snap.profile).toEqual({ id: 'a1' });
    expect(snap.activities).toHaveLength(1);
    expect(typeof snap.updatedAt).toBe('string');
  });

  it('GET auf unbekannte ID -> 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sync/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });

  it('Überschreiben ohne den aktuellen Serverstand -> 409 mit Serverdaten', async () => {
    const first = await app.inject({
      method: 'PUT',
      url: '/api/sync/conflict-id',
      payload: { profile: { id: 'alt' }, plan: null, activities: [] },
    });
    const serverUpdatedAt = first.json().updatedAt as string;

    // Zweites Gerät kennt den Stand nicht (kein baseUpdatedAt) -> Konflikt.
    const blind = await app.inject({
      method: 'PUT',
      url: '/api/sync/conflict-id',
      payload: { profile: { id: 'neu' }, plan: null, activities: [] },
    });
    expect(blind.statusCode).toBe(409);
    expect(blind.json().serverUpdatedAt).toBe(serverUpdatedAt);
    expect(blind.json().snapshot.profile).toEqual({ id: 'alt' });

    // Veralteter Stand -> ebenfalls Konflikt.
    const stale = await app.inject({
      method: 'PUT',
      url: '/api/sync/conflict-id',
      payload: { profile: { id: 'neu' }, plan: null, activities: [], baseUpdatedAt: '2020-01-01T00:00:00.000Z' },
    });
    expect(stale.statusCode).toBe(409);

    // Mit dem passenden Stand geht es durch.
    const ok = await app.inject({
      method: 'PUT',
      url: '/api/sync/conflict-id',
      payload: { profile: { id: 'neu' }, plan: null, activities: [], baseUpdatedAt: serverUpdatedAt },
    });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/sync/conflict-id' })).json().profile).toEqual({ id: 'neu' });
  });

  it('force=1 überschreibt bewusst', async () => {
    await app.inject({ method: 'PUT', url: '/api/sync/force-id', payload: { profile: { id: 'alt' } } });
    const forced = await app.inject({
      method: 'PUT',
      url: '/api/sync/force-id?force=1',
      payload: { profile: { id: 'erzwungen' }, activities: [] },
    });
    expect(forced.statusCode).toBe(200);
    const snap = (await app.inject({ method: 'GET', url: '/api/sync/force-id' })).json();
    expect(snap.profile).toEqual({ id: 'erzwungen' });
  });

  it('DELETE entfernt den Cloud-Stand', async () => {
    await app.inject({ method: 'PUT', url: '/api/sync/del-id', payload: { profile: { id: 'x' } } });
    const del = await app.inject({ method: 'DELETE', url: '/api/sync/del-id' });
    expect(del.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/sync/del-id' })).statusCode).toBe(404);
  });

  it('healthz nennt die Art der Sync-Ablage', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.json()).toEqual({ ok: true, storage: 'memory' });
  });

  it('Garmin ist ohne Zugangsdaten nicht konfiguriert', async () => {
    delete process.env.GARMIN_CLIENT_ID;
    delete process.env.GARMIN_CLIENT_SECRET;
    const status = await app.inject({ method: 'GET', url: '/api/garmin/status' });
    expect(status.statusCode).toBe(200);
    expect(status.json().configured).toBe(false);

    const connect = await app.inject({ method: 'GET', url: '/api/garmin/connect' });
    expect(connect.statusCode).toBe(501);
  });
});
