import { buildApp } from './app';
import { createSnapshotStore } from './storage';

// Einstiegspunkt: baut die App und lauscht. Port via PORT (Default 8787).
const store = createSnapshotStore();
const app = buildApp({ store });
const port = Number(process.env.PORT ?? 8787);

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`PaceForge-Server läuft auf ${addr} (Sync-Ablage: ${store.kind})`);
    if (store.kind === 'memory') {
      // eslint-disable-next-line no-console
      console.warn(
        'Hinweis: Sync-Snapshots liegen nur im Arbeitsspeicher und sind nach einem Neustart weg. ' +
          'Für dauerhafte Ablage UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN setzen.',
      );
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
