import Fastify, { type FastifyInstance } from 'fastify';
import { parseGoalSmart } from './parseGoalLLM';
import { registerSync } from './sync';
import { registerGarmin } from './garmin';

// Baut die Fastify-App OHNE zu lauschen – so kann sie im Test per app.inject()
// angesprochen werden. Das Lauschen passiert nur in index.ts.
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // CORS offen (die mobile App / der Web-Simulator greifen von woanders zu).
  app.addHook('onRequest', (_req, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    done();
  });
  app.options('/*', async (_req, reply) => reply.code(204).send());

  app.get('/healthz', async () => ({ ok: true }));

  // Natürlichsprachliche Zieleingabe: nutzt Claude, wenn ein API-Key gesetzt ist,
  // sonst den regelbasierten Parser aus @paceforge/core. Antwort enthält `source`.
  app.post('/api/parse-goal', async (req, reply) => {
    const body = (req.body ?? {}) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) return reply.code(400).send({ error: 'Feld "text" fehlt.' });

    const { result, source } = await parseGoalSmart(text);
    return { parsed: result, source };
  });

  // Cross-Device-Sync + Garmin-OAuth-Gerüst (Phase 2).
  registerSync(app);
  registerGarmin(app);

  return app;
}
