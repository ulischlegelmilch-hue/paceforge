import { buildApp } from './app';

// Einstiegspunkt: baut die App und lauscht. Port via PORT (Default 8787).
const app = buildApp();
const port = Number(process.env.PORT ?? 8787);

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`PaceForge-Server läuft auf ${addr}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
