import type { FastifyInstance } from 'fastify';
import type { Workout } from '@paceforge/core';
import { workoutToGarminPayload } from '@paceforge/core';
import type { GarminSessionStore } from './garminStore';
import { decryptText, encryptText, isEncryptionConfigured } from './tokenCrypto';

// Inoffizielle Garmin-Connect-Anbindung (13.08.2026 Uli-Entscheidung: die
// OFFIZIELLE Garmin Training API ist für Einzelentwickler pausiert und nur für
// Firmen offen, siehe CLAUDE.md - eine "echte" automatische Übertragung aufs
// Handgelenk ist deshalb nur über die reverse-engineerte Web-API von Garmin
// Connect selbst möglich, wie sie auch die offizielle Website/App benutzt).
//
// Ablauf: Nutzer gibt Garmin-Zugangsdaten EINMALIG in der App ein -> Server
// meldet sich damit an, speichert NUR die resultierenden Session-Tokens
// (verschlüsselt, siehe tokenCrypto.ts), das Passwort selbst wird NIE
// gespeichert. Spätere Workout-Uploads laden die Tokens wieder und erneuern sie
// bei Bedarf automatisch (übernimmt die garmin-connect-Bibliothek selbst).
//
// Risiko, das Uli bewusst akzeptiert hat: das ist keine von Garmin unterstützte
// Schnittstelle und kann jederzeit ohne Vorwarnung brechen, wenn Garmin seine
// private Web-API ändert.

// Nur der Ausschnitt der echten GarminConnect-Klasse (Paket "garmin-connect"),
// den wir tatsächlich brauchen - hält die Klasse per Dependency Injection
// austauschbar, damit Tests NIEMALS echte Netzwerkaufrufe an Garmin machen
// (siehe garmin.test.ts, das einen Fake-Client einsetzt).
export interface GarminConnectClient {
  login(username: string, password: string): Promise<unknown>;
  loadToken(oauth1: unknown, oauth2: unknown): void;
  exportToken(): { oauth1: unknown; oauth2: unknown };
  addWorkout(workout: unknown): Promise<{ workoutId: number | string }>;
  post<T>(url: string, data: unknown): Promise<T>;
}

export type GarminClientFactory = () => GarminConnectClient;

// Der Schedule-Endpunkt gehört (wie WORKOUT()) zur "connectapi"-Variante der
// privaten API, die diese Bibliothek für addWorkout() nutzt - siehe
// node_modules/garmin-connect UrlClass.WORKOUT(). Es gibt dafür keine
// öffentliche Doku; der Pfad ist unabhängig durch das seit Jahren produktiv
// genutzte Projekt github.com/mkuthan/garmin-workouts bestätigt (dort über die
// "/proxy/workout-service"-Variante desselben Endpunkts erreicht).
function scheduleUrl(workoutId: number | string): string {
  return `https://connectapi.garmin.com/workout-service/schedule/${workoutId}`;
}

async function defaultClientFactory(): Promise<GarminConnectClient> {
  const { GarminConnect } = await import('garmin-connect');
  // Der Konstruktor wirft "Missing credentials", wenn ihm KEIN (auch leeres)
  // Credentials-Objekt übergeben wird - login(username, password) setzt die
  // echten Werte danach ohnehin selbst (siehe GarminConnect.js login()).
  return new GarminConnect({ username: '', password: '' }) as unknown as GarminConnectClient;
}

interface StoredTokens {
  oauth1: unknown;
  oauth2: unknown;
}

export function registerGarmin(
  app: FastifyInstance,
  store: GarminSessionStore,
  clientFactory: () => Promise<GarminConnectClient> = defaultClientFactory,
): void {
  app.get('/api/garmin/status', async (req) => {
    const { deviceId } = (req.query ?? {}) as { deviceId?: string };
    if (!deviceId) return { configured: isEncryptionConfigured(), connected: false };
    const session = await store.get(deviceId);
    return {
      configured: isEncryptionConfigured(),
      connected: Boolean(session),
      username: session?.username ?? null,
      connectedAt: session?.connectedAt ?? null,
    };
  });

  app.post('/api/garmin/login', async (req, reply) => {
    if (!isEncryptionConfigured()) {
      return reply
        .code(503)
        .send({ error: 'Garmin-Integration nicht konfiguriert (GARMIN_TOKEN_ENCRYPTION_KEY fehlt).' });
    }
    const body = (req.body ?? {}) as { deviceId?: string; username?: string; password?: string };
    const { deviceId, username, password } = body;
    if (!deviceId || !username || !password) {
      return reply.code(400).send({ error: 'deviceId, username und password werden benötigt.' });
    }

    try {
      const client = await clientFactory();
      await client.login(username, password);
      const tokens = client.exportToken();
      await store.put(deviceId, {
        username,
        encryptedTokens: encryptText(JSON.stringify(tokens)),
        connectedAt: new Date().toISOString(),
      });
      return { ok: true, username };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Garmin-Login fehlgeschlagen:', e instanceof Error ? e.message : e);
      return reply.code(401).send({
        error:
          'Anmeldung bei Garmin fehlgeschlagen. Bitte Zugangsdaten prüfen (Zwei-Faktor-Codes/Sicherheitsabfragen ' +
          'werden von dieser inoffiziellen Anbindung nicht unterstützt).',
      });
    }
  });

  app.post('/api/garmin/disconnect', async (req, reply) => {
    const { deviceId } = (req.body ?? {}) as { deviceId?: string };
    if (!deviceId) return reply.code(400).send({ error: 'deviceId fehlt.' });
    await store.delete(deviceId);
    return { ok: true };
  });

  app.post('/api/garmin/push-workout', async (req, reply) => {
    const body = (req.body ?? {}) as { deviceId?: string; workout?: Workout; date?: string };
    const { deviceId, workout, date } = body;
    if (!deviceId || !workout || !date) {
      return reply.code(400).send({ error: 'deviceId, workout und date werden benötigt.' });
    }

    const session = await store.get(deviceId);
    if (!session) {
      return reply.code(404).send({ error: 'Nicht mit Garmin verbunden.' });
    }

    try {
      const tokens = JSON.parse(decryptText(session.encryptedTokens)) as StoredTokens;
      const client = await clientFactory();
      client.loadToken(tokens.oauth1, tokens.oauth2);

      const payload = workoutToGarminPayload(workout);
      const created = await client.addWorkout(payload);
      await client.post(scheduleUrl(created.workoutId), { date });

      // Die Bibliothek erneuert abgelaufene OAuth2-Tokens automatisch im
      // laufenden Request - den (evtl. erneuerten) Stand zurückschreiben,
      // damit der nächste Push nicht unnötig eine Erneuerung auslösen muss.
      const freshTokens = client.exportToken();
      await store.put(deviceId, {
        ...session,
        encryptedTokens: encryptText(JSON.stringify(freshTokens)),
      });

      return { ok: true, workoutId: created.workoutId, scheduledDate: date };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Garmin-Workout-Push fehlgeschlagen:', e instanceof Error ? e.message : e);
      return reply.code(502).send({
        error:
          'Übertragung an Garmin fehlgeschlagen. Falls die Verbindung abgelaufen ist, bitte Garmin-Konto in den ' +
          'Einstellungen neu verbinden.',
      });
    }
  });
}
