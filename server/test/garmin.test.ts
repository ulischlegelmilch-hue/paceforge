import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeEasyRun } from '@paceforge/core';
import { buildApp } from '../src/app';
import { MemoryGarminSessionStore } from '../src/garminStore';
import type { GarminConnectClient } from '../src/garmin';

// Fake-Client statt der echten garmin-connect-Bibliothek - Tests dürfen NIE
// echte Netzwerkaufrufe an Garmin machen (siehe garmin.ts-Kommentar).
class FakeGarminClient implements GarminConnectClient {
  loginCalls: { username: string; password: string }[] = [];
  loadedTokens: { oauth1: unknown; oauth2: unknown } | null = null;
  addedWorkouts: unknown[] = [];
  posts: { url: string; data: unknown }[] = [];
  failLogin = false;
  failAdd = false;

  async login(username: string, password: string): Promise<unknown> {
    if (this.failLogin) throw new Error('ungültige Zugangsdaten');
    this.loginCalls.push({ username, password });
    return {};
  }

  loadToken(oauth1: unknown, oauth2: unknown): void {
    this.loadedTokens = { oauth1, oauth2 };
  }

  exportToken(): { oauth1: unknown; oauth2: unknown } {
    return { oauth1: 'fake-oauth1', oauth2: 'fake-oauth2' };
  }

  async addWorkout(workout: unknown): Promise<{ workoutId: number | string }> {
    if (this.failAdd) throw new Error('Garmin-API abgelehnt');
    this.addedWorkouts.push(workout);
    return { workoutId: 42 };
  }

  async post<T>(url: string, data: unknown): Promise<T> {
    this.posts.push({ url, data });
    return {} as T;
  }
}

describe('Garmin-Connect-Anbindung', () => {
  let app: FastifyInstance;
  let fakeClient: FakeGarminClient;
  const workout = makeEasyRun('w1', 45, 8000);

  beforeEach(async () => {
    process.env.GARMIN_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-nur-fuer-tests';
    fakeClient = new FakeGarminClient();
    app = buildApp({
      garminStore: new MemoryGarminSessionStore(),
      garminClientFactory: async () => fakeClient,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.GARMIN_TOKEN_ENCRYPTION_KEY;
  });

  it('status ohne deviceId meldet nur configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/garmin/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ configured: true, connected: false });
  });

  it('status für unbekanntes Gerät ist nicht verbunden', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/garmin/status?deviceId=dev1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ configured: true, connected: false, username: null, connectedAt: null });
  });

  it('login speichert nur verschlüsselte Tokens, nie das Passwort', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/login',
      payload: { deviceId: 'dev1', username: 'uli@example.com', password: 'geheim123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, username: 'uli@example.com' });
    expect(fakeClient.loginCalls).toEqual([{ username: 'uli@example.com', password: 'geheim123' }]);

    const status = await app.inject({ method: 'GET', url: '/api/garmin/status?deviceId=dev1' });
    const body = status.json();
    expect(body.connected).toBe(true);
    expect(body.username).toBe('uli@example.com');
    expect(JSON.stringify(body)).not.toContain('geheim123');
  });

  it('login mit fehlenden Feldern -> 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/garmin/login', payload: { deviceId: 'dev1' } });
    expect(res.statusCode).toBe(400);
  });

  it('login schlägt fehl -> 401, nichts gespeichert', async () => {
    fakeClient.failLogin = true;
    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/login',
      payload: { deviceId: 'dev1', username: 'u', password: 'p' },
    });
    expect(res.statusCode).toBe(401);
    const status = await app.inject({ method: 'GET', url: '/api/garmin/status?deviceId=dev1' });
    expect(status.json().connected).toBe(false);
  });

  it('login ohne GARMIN_TOKEN_ENCRYPTION_KEY -> 503', async () => {
    delete process.env.GARMIN_TOKEN_ENCRYPTION_KEY;
    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/login',
      payload: { deviceId: 'dev1', username: 'u', password: 'p' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('disconnect entfernt die Session', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/garmin/login',
      payload: { deviceId: 'dev1', username: 'u', password: 'p' },
    });
    const disconnect = await app.inject({ method: 'POST', url: '/api/garmin/disconnect', payload: { deviceId: 'dev1' } });
    expect(disconnect.statusCode).toBe(200);
    const status = await app.inject({ method: 'GET', url: '/api/garmin/status?deviceId=dev1' });
    expect(status.json().connected).toBe(false);
  });

  it('push-workout ohne Verbindung -> 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/push-workout',
      payload: { deviceId: 'unbekannt', workout, date: '2026-08-20' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('push-workout lädt Tokens, überträgt das Workout und plant es ein', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/garmin/login',
      payload: { deviceId: 'dev1', username: 'u', password: 'p' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/push-workout',
      payload: { deviceId: 'dev1', workout, date: '2026-08-20' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, workoutId: 42, scheduledDate: '2026-08-20' });

    expect(fakeClient.loadedTokens).toEqual({ oauth1: 'fake-oauth1', oauth2: 'fake-oauth2' });
    expect(fakeClient.addedWorkouts).toHaveLength(1);
    expect(fakeClient.posts).toEqual([
      { url: 'https://connectapi.garmin.com/workout-service/schedule/42', data: { date: '2026-08-20' } },
    ]);
  });

  it('push-workout mit fehlenden Feldern -> 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/push-workout',
      payload: { deviceId: 'dev1' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('push-workout meldet Fehler von Garmin als 502', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/garmin/login',
      payload: { deviceId: 'dev1', username: 'u', password: 'p' },
    });
    fakeClient.failAdd = true;

    const res = await app.inject({
      method: 'POST',
      url: '/api/garmin/push-workout',
      payload: { deviceId: 'dev1', workout, date: '2026-08-20' },
    });
    expect(res.statusCode).toBe(502);
  });
});
