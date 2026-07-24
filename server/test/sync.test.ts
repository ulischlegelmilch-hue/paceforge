import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('Sync + Garmin-Gerüst', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildApp();
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
