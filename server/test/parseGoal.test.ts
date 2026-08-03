import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

// Ohne API-Key -> deterministischer Regel-Fallback (kein echter Claude-Call im Test).
describe('POST /api/parse-goal (Regel-Fallback)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    app = buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('healthz liefert ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('parst ein deutsches Ziel per Regeln', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/parse-goal',
      payload: { text: '10k unter 45 min in 12 Wochen, 4x pro Woche' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('rules');
    expect(body.parsed.distance).toBe('10k');
    expect(body.parsed.targetTimeSeconds).toBe(45 * 60);
    expect(body.parsed.weeks).toBe(12);
    expect(body.parsed.daysPerWeek).toBe(4);
  });

  it('antwortet 400 bei leerem Text', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/parse-goal', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
