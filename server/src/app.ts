import Fastify, { type FastifyInstance } from 'fastify';
import { parseGoalSmart } from './parseGoalLLM';
import { registerSync } from './sync';
import { registerGarmin, type GarminConnectClient } from './garmin';
import { registerKids } from './kids';
import { createSnapshotStore, type SnapshotStore } from './storage';
import { createGarminSessionStore, type GarminSessionStore } from './garminStore';
import { createKidsStore, type KidsStore } from './kidsStore';

// Baut die Fastify-App OHNE zu lauschen – so kann sie im Test per app.inject()
// angesprochen werden. Das Lauschen passiert nur in index.ts.
// `store`/`garminStore`/`garminClientFactory`/`kidsStore` sind injizierbar (Tests);
// ohne Angabe entscheidet die Umgebung (Upstash-Redis wenn konfiguriert, sonst
// In-Memory) bzw. wird die echte garmin-connect-Bibliothek verwendet.
export function buildApp(
  opts: {
    store?: SnapshotStore;
    garminStore?: GarminSessionStore;
    garminClientFactory?: () => Promise<GarminConnectClient>;
    kidsStore?: KidsStore;
  } = {},
): FastifyInstance {
  const app = Fastify({ logger: false });
  const store = opts.store ?? createSnapshotStore();
  const garminStore = opts.garminStore ?? createGarminSessionStore();
  const kidsStore = opts.kidsStore ?? createKidsStore();

  // CORS offen (die mobile App / der Web-Simulator greifen von woanders zu).
  app.addHook('onRequest', (_req, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    done();
  });
  app.options('/*', async (_req, reply) => reply.code(204).send());

  // `storage` zeigt nach dem Deploy sofort, ob die Persistenz greift.
  app.get('/healthz', async () => ({ ok: true, storage: store.kind }));

  // Natürlichsprachliche Zieleingabe: nutzt Claude, wenn ein API-Key gesetzt ist,
  // sonst den regelbasierten Parser aus @paceforge/core. Antwort enthält `source`.
  app.post('/api/parse-goal', async (req, reply) => {
    const body = (req.body ?? {}) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) return reply.code(400).send({ error: 'Feld "text" fehlt.' });

    const { result, source } = await parseGoalSmart(text);
    return { parsed: result, source };
  });

  // Cross-Device-Sync + inoffizielle Garmin-Connect-Anbindung (Phase 2).
  registerSync(app, store);
  registerGarmin(app, garminStore, opts.garminClientFactory);
  // PaceForge Kids: Max' aktuell eingestelltes Training (Kernfunktion 4a).
  registerKids(app, kidsStore);

  return app;
}
