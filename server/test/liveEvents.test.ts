import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoryLiveEventsStore } from '../src/liveEventsStore';

describe('Live-Events (PaceForge Kids "Papa hört live mit")', () => {
  let app: FastifyInstance;
  let liveEventsStore: MemoryLiveEventsStore;
  beforeAll(async () => {
    liveEventsStore = new MemoryLiveEventsStore();
    app = buildApp({ liveEventsStore });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET auf einen unbekannten Code liefert ein leeres Array (kein 404)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/kids/does-not-exist/live-events?since=0' });
    expect(res.statusCode).toBe(200);
    expect(res.json().events).toEqual([]);
  });

  it('POST dann GET-since-0 liefert das Ereignis zurück', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/kids/max-abc123/live-events',
      payload: { text: 'Noch 500 Meter!', category: 'DISTANCE_MILESTONE', createdAtMillis: 1000 },
    });
    expect(post.statusCode).toBe(200);
    expect(post.json().ok).toBe(true);
    expect(typeof post.json().seq).toBe('number');

    const get = await app.inject({ method: 'GET', url: '/api/kids/max-abc123/live-events?since=0' });
    expect(get.statusCode).toBe(200);
    const { events } = get.json();
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe('Noch 500 Meter!');
    expect(events[0].category).toBe('DISTANCE_MILESTONE');
    expect(events[0].createdAtMillis).toBe(1000);
  });

  it('zwei POSTs, GET-since-ersterSeq liefert nur das zweite Ereignis', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/kids/max-def456/live-events',
      payload: { text: 'Los geht’s!' },
    });
    const firstSeq = first.json().seq as number;

    await app.inject({
      method: 'POST',
      url: '/api/kids/max-def456/live-events',
      payload: { text: 'Weiter so!' },
    });

    const get = await app.inject({ method: 'GET', url: `/api/kids/max-def456/live-events?since=${firstSeq}` });
    const { events } = get.json();
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe('Weiter so!');
  });

  it('fehlender Text wird abgelehnt', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/kids/max-ghi789/live-events', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE dann GET-since-0 liefert wieder ein leeres Array', async () => {
    await app.inject({ method: 'POST', url: '/api/kids/max-jkl012/live-events', payload: { text: 'Ziel erreicht!' } });
    const del = await app.inject({ method: 'DELETE', url: '/api/kids/max-jkl012/live-events' });
    expect(del.statusCode).toBe(200);
    expect(del.json().ok).toBe(true);

    const get = await app.inject({ method: 'GET', url: '/api/kids/max-jkl012/live-events?since=0' });
    expect(get.json().events).toEqual([]);
  });
});
