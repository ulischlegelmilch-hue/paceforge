import type { FastifyInstance } from 'fastify';

// Cross-Device-Sync (Phase 2). In-Memory-Store (MVP) – persistente DB ist ein
// Folgeschritt. Ein Gerät legt seinen Snapshot (Profil + Plan + Aktivitäten)
// unter einer eigenen ID ab und kann ihn auf einem anderen Gerät wieder laden.

interface Snapshot {
  profile: unknown;
  plan: unknown;
  activities: unknown[];
  updatedAt: string;
}

const store = new Map<string, Snapshot>();

export function registerSync(app: FastifyInstance): void {
  app.get('/api/sync/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const snap = store.get(id);
    if (!snap) return reply.code(404).send({ error: 'Kein Snapshot für diese ID.' });
    return snap;
  });

  app.put('/api/sync/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!id) return reply.code(400).send({ error: 'ID fehlt.' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const snap: Snapshot = {
      profile: body.profile ?? null,
      plan: body.plan ?? null,
      activities: Array.isArray(body.activities) ? body.activities : [],
      updatedAt: new Date().toISOString(),
    };
    store.set(id, snap);
    return { ok: true, updatedAt: snap.updatedAt };
  });
}
