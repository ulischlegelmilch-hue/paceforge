import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoryKidsStore } from '../src/kidsStore';

describe('Kids (PaceForge Kids Cloud-Anbindung)', () => {
  let app: FastifyInstance;
  let kidsStore: MemoryKidsStore;
  beforeAll(async () => {
    kidsStore = new MemoryKidsStore();
    app = buildApp({ kidsStore });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET auf einen unbekannten Code -> 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/kids/does-not-exist/planned-training' });
    expect(res.statusCode).toBe(404);
  });

  it('PUT dann GET liefert das geplante Training zurück', async () => {
    const payload = {
      opponentCharacterId: 'fuchs',
      opponentName: 'Fuchs',
      targetPaceSecPerKm: 390,
      distanceGoalMeters: 3000,
    };
    const put = await app.inject({ method: 'PUT', url: '/api/kids/max-abc123/planned-training', payload });
    expect(put.statusCode).toBe(200);
    expect(put.json().ok).toBe(true);

    const get = await app.inject({ method: 'GET', url: '/api/kids/max-abc123/planned-training' });
    expect(get.statusCode).toBe(200);
    const training = get.json();
    expect(training.opponentCharacterId).toBe('fuchs');
    expect(training.opponentName).toBe('Fuchs');
    expect(training.targetPaceSecPerKm).toBe(390);
    expect(training.distanceGoalMeters).toBe(3000);
    expect(typeof training.updatedAt).toBe('string');
  });

  it('fehlende/unbekannte Felder werden als null gespeichert statt den Request abzulehnen', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/kids/max-def456/planned-training',
      payload: { intervalRunSeconds: 60, intervalWalkSeconds: 30 },
    });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({ method: 'GET', url: '/api/kids/max-def456/planned-training' });
    const training = get.json();
    expect(training.opponentCharacterId).toBeNull();
    expect(training.intervalRunSeconds).toBe(60);
    expect(training.intervalWalkSeconds).toBe(30);
  });

  it('ein erneutes PUT überschreibt den vorherigen Stand für denselben Code', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/kids/max-ghi789/planned-training',
      payload: { opponentCharacterId: 'igel', opponentName: 'Igel' },
    });
    await app.inject({
      method: 'PUT',
      url: '/api/kids/max-ghi789/planned-training',
      payload: { opponentCharacterId: 'gepard', opponentName: 'Gepard' },
    });
    const get = await app.inject({ method: 'GET', url: '/api/kids/max-ghi789/planned-training' });
    expect(get.json().opponentCharacterId).toBe('gepard');
  });
});
