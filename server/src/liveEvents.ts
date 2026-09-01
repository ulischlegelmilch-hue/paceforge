import type { FastifyInstance } from 'fastify';
import type { LiveEventsStore } from './liveEventsStore';

// "Live mithören"-Erweiterung von Kernfunktion 4a: während Max läuft, schickt
// seine App jede tatsächlich gesprochene Audio-Coach-Ansage hierher; Papas App
// pollt in kurzen Abständen "since" und spricht neue Ansagen über die eigene
// TTS-Stimme nach. Gleiches Vertrauensmodell wie planned-training: der
// unerraten Kind-Code IST die Berechtigung, kein zusätzliches Auth nötig.

export function registerLiveEvents(app: FastifyInstance, store: LiveEventsStore): void {
  app.post('/api/kids/:childId/live-events', async (req, reply) => {
    const { childId } = req.params as { childId: string };
    if (!childId) return reply.code(400).send({ error: 'Code fehlt.' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) return reply.code(400).send({ error: 'Feld "text" fehlt.' });

    const stored = await store.append(childId, {
      category: typeof body.category === 'string' ? body.category : 'UNKNOWN',
      text,
      createdAtMillis: typeof body.createdAtMillis === 'number' ? body.createdAtMillis : Date.now(),
    });
    return { ok: true, seq: stored.seq };
  });

  app.get('/api/kids/:childId/live-events', async (req, reply) => {
    const { childId } = req.params as { childId: string };
    if (!childId) return reply.code(400).send({ error: 'Code fehlt.' });

    const query = (req.query ?? {}) as { since?: string };
    const since = Number(query.since ?? 0);
    const events = await store.since(childId, Number.isFinite(since) ? since : 0);
    return { events };
  });

  app.delete('/api/kids/:childId/live-events', async (req, reply) => {
    const { childId } = req.params as { childId: string };
    if (!childId) return reply.code(400).send({ error: 'Code fehlt.' });

    await store.clear(childId);
    return { ok: true };
  });
}
