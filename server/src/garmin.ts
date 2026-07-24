import type { FastifyInstance } from 'fastify';

// Phase-2-Gerüst für die offizielle Garmin Training API (OAuth-Push direkt auf die
// Uhr). NICHT funktionsfähig ohne echten Garmin-Developer-Zugang – das Garmin
// Connect Developer Program ist für neue Anträge pausiert und nur für Firmen offen.
// Struktur/Routen sind vorbereitet; ohne GARMIN_CLIENT_ID/SECRET liefern sie 501.
// Sobald Zugang besteht, wird hier der OAuth-1.0a/2.0-Flow + Workout-Push ergänzt,
// und app-seitig greift der GarminApiProvider hinter dem WorkoutDeliveryProvider-
// Interface – Plan-Engine und übrige App bleiben unberührt.

function isConfigured(): boolean {
  return Boolean(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET);
}

export function registerGarmin(app: FastifyInstance): void {
  app.get('/api/garmin/status', async () => ({
    configured: isConfigured(),
    note: isConfigured()
      ? 'Garmin-Zugangsdaten gesetzt; OAuth-Flow noch nicht implementiert.'
      : 'Garmin-Integration nicht konfiguriert (Phase 2, Developer-Zugang nötig).',
  }));

  app.get('/api/garmin/connect', async (_req, reply) => {
    if (!isConfigured()) {
      return reply
        .code(501)
        .send({ error: 'Garmin-Integration nicht konfiguriert (Phase 2).' });
    }
    // TODO Phase 2: OAuth-Authorize-URL bauen und dorthin weiterleiten.
    return reply.code(501).send({ error: 'Garmin-OAuth-Flow noch nicht implementiert.' });
  });

  app.get('/api/garmin/callback', async (_req, reply) => {
    // TODO Phase 2: OAuth-Callback -> Token tauschen und speichern.
    return reply.code(501).send({ error: 'Garmin-OAuth-Callback noch nicht implementiert.' });
  });
}
