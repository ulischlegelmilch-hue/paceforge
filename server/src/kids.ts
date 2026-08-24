import type { FastifyInstance } from 'fastify';
import type { KidsStore, StoredPlannedTraining } from './kidsStore';

// Kernfunktion 4a von "PaceForge Kids" (Max' eigene, separate native App): Max
// wählt vor einem Lauf einen Gegner-Charakter oder ein Walk/Run-Intervall-Programm
// - das lädt seine App hoch, wenn WLAN da ist. Papa sieht es in seiner PaceForge-
// App (neue "Max"-Rubrik) und kann dieselbe Vorgabe für sich übernehmen, um
// gemeinsam zu laufen. Kein Login/Auth nötig: der childId-Code ist unerraten und
// wird einmalig zwischen den beiden Apps ausgetauscht - gleiche Sicherheitslage
// wie der bestehende Cross-Device-Sync (sync.ts).

export function registerKids(app: FastifyInstance, store: KidsStore): void {
  app.get('/api/kids/:childId/planned-training', async (req, reply) => {
    const { childId } = req.params as { childId: string };
    const training = await store.get(childId);
    if (!training) return reply.code(404).send({ error: 'Kein Training für diesen Code hinterlegt.' });
    return training;
  });

  app.put('/api/kids/:childId/planned-training', async (req, reply) => {
    const { childId } = req.params as { childId: string };
    if (!childId) return reply.code(400).send({ error: 'Code fehlt.' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const training: StoredPlannedTraining = {
      opponentCharacterId: typeof body.opponentCharacterId === 'string' ? body.opponentCharacterId : null,
      opponentName: typeof body.opponentName === 'string' ? body.opponentName : null,
      targetPaceSecPerKm: typeof body.targetPaceSecPerKm === 'number' ? body.targetPaceSecPerKm : null,
      intervalRunSeconds: typeof body.intervalRunSeconds === 'number' ? body.intervalRunSeconds : null,
      intervalWalkSeconds: typeof body.intervalWalkSeconds === 'number' ? body.intervalWalkSeconds : null,
      distanceGoalMeters: typeof body.distanceGoalMeters === 'number' ? body.distanceGoalMeters : null,
      updatedAt: new Date().toISOString(),
    };
    await store.put(childId, training);
    return { ok: true, updatedAt: training.updatedAt };
  });
}
