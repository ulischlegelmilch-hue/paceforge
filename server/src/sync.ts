import type { FastifyInstance } from 'fastify';
import type { Snapshot, SnapshotStore } from './storage';

// Cross-Device-Sync (Phase 2). Ein Gerät legt seinen Snapshot (Profil + Plan +
// Aktivitäten) unter einer eigenen ID ab und kann ihn auf einem anderen Gerät
// wieder laden. Die Ablage steckt hinter `SnapshotStore` (In-Memory oder Redis).
//
// Konfliktschutz: Beim PUT schickt die App mit, auf welchem Serverstand sie
// aufsetzt (`baseUpdatedAt` = das `updatedAt` des zuletzt gesehenen Snapshots).
// Passt das nicht zum tatsächlich gespeicherten Stand, hat inzwischen ein anderes
// Gerät geschrieben -> 409 mit dem Serverstand, statt fremde Daten zu überschreiben.
// `?force=1` überschreibt bewusst (die App fragt vorher nach).

export function registerSync(app: FastifyInstance, store: SnapshotStore): void {
  app.get('/api/sync/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const snap = await store.get(id);
    if (!snap) return reply.code(404).send({ error: 'Kein Snapshot für diese ID.' });
    return snap;
  });

  app.put('/api/sync/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!id) return reply.code(400).send({ error: 'ID fehlt.' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const { force } = (req.query ?? {}) as { force?: string };
    const baseUpdatedAt = typeof body.baseUpdatedAt === 'string' ? body.baseUpdatedAt : null;

    const existing = await store.get(id);
    const isForced = force === '1' || force === 'true';
    if (existing && !isForced && existing.updatedAt !== baseUpdatedAt) {
      return reply.code(409).send({
        error: 'In der Cloud liegt ein neuerer Stand von einem anderen Gerät.',
        serverUpdatedAt: existing.updatedAt,
        snapshot: existing,
      });
    }

    const snap: Snapshot = {
      profile: body.profile ?? null,
      plan: body.plan ?? null,
      activities: Array.isArray(body.activities) ? body.activities : [],
      updatedAt: new Date().toISOString(),
    };
    await store.put(id, snap);
    return { ok: true, updatedAt: snap.updatedAt };
  });

  app.delete('/api/sync/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!id) return reply.code(400).send({ error: 'ID fehlt.' });
    await store.delete(id);
    return reply.code(200).send({ ok: true });
  });
}
