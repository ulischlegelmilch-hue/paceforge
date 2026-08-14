import { buildApp } from './app';
import { createSnapshotStore } from './storage';
import { createGarminSessionStore } from './garminStore';
import { isEncryptionConfigured } from './tokenCrypto';

// Einstiegspunkt: baut die App und lauscht. Port via PORT (Default 8787).
const store = createSnapshotStore();
const garminStore = createGarminSessionStore();
const app = buildApp({ store, garminStore });
const port = Number(process.env.PORT ?? 8787);

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(
      `PaceForge-Server läuft auf ${addr} (Sync-Ablage: ${store.kind}, Garmin-Session-Ablage: ${garminStore.kind})`,
    );
    if (store.kind === 'memory') {
      // eslint-disable-next-line no-console
      console.warn(
        'Hinweis: Sync-Snapshots liegen nur im Arbeitsspeicher und sind nach einem Neustart weg. ' +
          'Für dauerhafte Ablage UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN setzen.',
      );
    }
    if (!isEncryptionConfigured()) {
      // eslint-disable-next-line no-console
      console.warn(
        'Hinweis: GARMIN_TOKEN_ENCRYPTION_KEY nicht gesetzt - die Garmin-Connect-Anbindung bleibt deaktiviert.',
      );
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
