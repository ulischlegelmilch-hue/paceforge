import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import type { FastifyInstance } from 'fastify';
import type { ActivityLap, Workout } from '@paceforge/core';
import { workoutToGarminPayload } from '@paceforge/core';
import { decodeActivity } from '@paceforge/core/fit';
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
// Nur der Ausschnitt der von "garmin-connect" gelieferten Aktivitäts-Felder,
// den mapGarminActivity() tatsächlich braucht (echtes IActivity hat >150 Felder).
export interface GarminActivitySummary {
  activityId: number | string;
  startTimeGMT: string;
  distance: number;
  duration: number;
  averageSpeed: number;
  averageHR?: number | null;
  elevationGain?: number | null;
  activityType?: { typeKey?: string } | null;
}

export interface GarminConnectClient {
  login(username: string, password: string): Promise<unknown>;
  loadToken(oauth1: unknown, oauth2: unknown): void;
  exportToken(): { oauth1: unknown; oauth2: unknown };
  addWorkout(workout: unknown): Promise<{ workoutId: number | string }>;
  post<T>(url: string, data: unknown): Promise<T>;
  getActivities(start: number, limit: number): Promise<GarminActivitySummary[]>;
  /** Lädt die Original-Aktivitätsdaten (Default-Typ "zip") in `dir` als "{activityId}.zip". */
  downloadOriginalActivityData(activity: { activityId: number | string }, dir: string): Promise<void>;
}

export type GarminClientFactory = () => GarminConnectClient;

// Garmin liefert startTimeGMT als "YYYY-MM-DD HH:mm:ss" ohne Zeitzonen-Suffix
// (implizit GMT) - hier explizit als UTC interpretieren statt der lokalen
// Zeitzone des Servers, sonst verschieben sich Läufe je nach Deploy-Region.
function parseGarminTimestamp(raw: string): string {
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const withZone = iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`;
  return new Date(withZone).toISOString();
}

function isRunningActivity(a: GarminActivitySummary): boolean {
  return (a.activityType?.typeKey ?? '').toLowerCase().includes('running');
}

// Bildet Garmins Aktivitäts-JSON auf das geräteunabhängige CompletedActivity-
// Schema ab (packages/core/src/domain/activity.ts) - ohne FIT-Datei-Download/
// -Decode, da getActivities() Distanz/Dauer/Puls/Höhenmeter schon fertig liefert.
export interface MappedGarminActivity {
  id: string;
  source: 'api';
  startTime: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  avgPaceMps: number;
  avgHeartRate?: number;
  totalAscentMeters?: number;
  laps?: ActivityLap[];
  gradeAdjustedDistanceMeters?: number;
}

export function mapGarminActivity(a: GarminActivitySummary): MappedGarminActivity {
  return {
    id: `garmin-${a.activityId}`,
    source: 'api',
    startTime: parseGarminTimestamp(a.startTimeGMT),
    totalDistanceMeters: a.distance,
    totalDurationSeconds: a.duration,
    avgPaceMps: a.averageSpeed,
    ...(a.averageHR ? { avgHeartRate: Math.round(a.averageHR) } : {}),
    ...(a.elevationGain ? { totalAscentMeters: Math.round(a.elevationGain) } : {}),
  };
}

/** Läuft-Filter + Mapping in einem Schritt, mit optionalem sinceIso-Cursor. */
function mapRunningActivities(
  raw: GarminActivitySummary[],
  sinceIso?: string,
): { raw: GarminActivitySummary; mapped: MappedGarminActivity }[] {
  return raw
    .filter(isRunningActivity)
    .map((r) => ({ raw: r, mapped: mapGarminActivity(r) }))
    .filter((x) => !sinceIso || x.mapped.startTime > sinceIso);
}

/**
 * Lädt die Original-FIT-Datei einer Garmin-Aktivität (als ZIP, siehe
 * downloadOriginalActivityData) und reichert die Summary um Laps/grade-
 * adjusted Distanz an - mit derselben Decode-Logik wie beim manuellen FIT-
 * Import (app/src/delivery/importActivity.ts), nur serverseitig aufgerufen.
 * Nicht jede Aktivität hat eine .fit-Datei im Original-Zip (z. B. manuell
 * erfasste/aus Drittanbietern synchronisierte Läufe enthalten oft nur GPX/TCX)
 * und die inoffizielle API kann jederzeit brechen - in beiden Fällen bleibt
 * die Summary unverändert (graceful degradation), der Aufrufer bekommt nie
 * einen Fehler wegen fehlgeschlagener Anreicherung.
 */
async function enrichWithFit(
  client: GarminConnectClient,
  activityId: number | string,
  base: MappedGarminActivity,
): Promise<MappedGarminActivity> {
  const dir = await mkdtemp(join(tmpdir(), 'paceforge-garmin-'));
  try {
    await client.downloadOriginalActivityData({ activityId }, dir);
    const zip = new AdmZip(join(dir, `${activityId}.zip`));
    const fitEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.fit'));
    if (!fitEntry) return base;

    const decoded = decodeActivity(fitEntry.getData(), { id: base.id, source: 'api' });
    return {
      ...base,
      ...(decoded.laps ? { laps: decoded.laps } : {}),
      ...(decoded.gradeAdjustedDistanceMeters !== undefined
        ? { gradeAdjustedDistanceMeters: decoded.gradeAdjustedDistanceMeters }
        : {}),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`FIT-Anreicherung für Garmin-Aktivität ${activityId} fehlgeschlagen:`, e instanceof Error ? e.message : e);
    return base;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Blättert durch `getActivities()`-Seiten, bis eine kürzere/leere Seite kommt
 * oder `maxPages` erreicht ist - Läufe-Filter (mapRunningActivities) läuft
 * über ALLE gesammelten Rohaktivitäten, nicht nur die erste Seite.
 *
 * Root-Cause-Fix (22.09.2026, Uli-Meldung "Lauf vom 14. fehlt komplett"):
 * der inkrementelle Abruf holte bisher IMMER nur eine einzige feste Seite
 * (Standard 20 Rohaktivitäten) und filterte danach auf "Laufen". Hat ein
 * Nutzer zwischen zwei Läufen andere Garmin-Aktivitäten (Spaziergänge,
 * Kraft, ...), können dadurch ältere Läufe aus diesem Fenster rausfallen -
 * und weil der Client-Cursor (garminLastPullAt) danach trotzdem auf die
 * neueste ERFOLGREICH abgerufene Aktivität vorrückt, wurden sie bei JEDEM
 * künftigen Abruf für immer übersprungen (sinceIso lag dann schon dahinter).
 */
async function fetchRunningActivitiesPaginated(
  client: GarminConnectClient,
  { pageSize, maxPages, startOffset = 0, sinceIso }: { pageSize: number; maxPages: number; startOffset?: number; sinceIso?: string },
): Promise<{ pairs: { raw: GarminActivitySummary; mapped: MappedGarminActivity }[]; pagesFetched: number; partial: boolean }> {
  const collected: { raw: GarminActivitySummary; mapped: MappedGarminActivity }[] = [];
  let pagesFetched = 0;
  let partial = false;
  for (let page = 0; page < maxPages; page++) {
    let raw: GarminActivitySummary[];
    try {
      raw = await client.getActivities(startOffset + page * pageSize, pageSize);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Garmin-Aktivitäten Seite ${page} fehlgeschlagen:`, e instanceof Error ? e.message : e);
      if (page === 0) throw e;
      partial = true;
      break;
    }
    pagesFetched++;
    if (raw.length === 0) break;
    collected.push(...mapRunningActivities(raw, sinceIso));
    if (raw.length < pageSize) break; // letzte Seite erreicht
  }
  return { pairs: collected, pagesFetched, partial };
}

/** Reichert die ersten `count` Aktivitäten (nach Sortierung, s. Aufrufer) an, Rest bleibt Summary-only. */
async function maybeEnrich(
  client: GarminConnectClient,
  pairs: { raw: GarminActivitySummary; mapped: MappedGarminActivity }[],
  count: number,
): Promise<MappedGarminActivity[]> {
  return Promise.all(pairs.map((x, i) => (i < count ? enrichWithFit(client, x.raw.activityId, x.mapped) : x.mapped)));
}

// Minimale Ausschnitte der axios-Typen (axios ist nur eine transitive
// Abhängigkeit über garmin-connect, kein direktes Server-Package) - nur für
// den Cookie-Jar-Patch in defaultClientFactory unten gebraucht.
interface RequestConfigLike {
  headers?: Record<string, string>;
  method?: string;
  url?: string;
}
interface ResponseLike {
  headers?: Record<string, unknown>;
}

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
  const client = new GarminConnect({ username: '', password: '' });

  // Die Bibliothek verwaltet KEINE Cookies zwischen den Requests des mehrstufigen
  // Login-Flows (kein Set-Cookie-Handling in HttpClient.js) - Garmins SSO-Server
  // verlangt aber offenbar Sitzungs-Cookie-Kontinuität zwischen dem Laden der
  // Anmeldeseite (die den CSRF-Token liefert) und dem Absenden der Zugangsdaten,
  // sonst weist er die Anfrage mit 401 zurück. Die Bibliothek verschluckt dieses
  // 401 intern still (ihr eigener Token-Refresh-Interceptor behandelt jedes 401
  // ohne vorhandenen oauth2Token als "nichts zu tun" statt es durchzureichen),
  // wodurch am Ende nur die nichtssagende Meldung "Ticket not found or MFA"
  // übrig bleibt. Einfacher In-Memory-Cookie-Jar über axios-Interceptors behebt
  // die fehlende Sitzungskontinuität.
  const innerClient = (
    client as unknown as {
      client?: {
        client?: {
          interceptors: {
            request: { use: (fn: (config: RequestConfigLike) => RequestConfigLike) => void };
            response: { use: (fn: (res: ResponseLike) => ResponseLike) => void };
          };
        };
      };
    }
  ).client;
  const axiosClient = innerClient?.client;
  if (axiosClient && !(axiosClient as unknown as { __cookieJarPatched?: boolean }).__cookieJarPatched) {
    (axiosClient as unknown as { __cookieJarPatched: boolean }).__cookieJarPatched = true;
    const cookies = new Map<string, string>();
    axiosClient.interceptors.request.use((config) => {
      if (cookies.size > 0) {
        config.headers = { ...config.headers, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
      }
      return config;
    });
    axiosClient.interceptors.response.use((response) => {
      // Die Bibliothek verwandelt manche 401-Antworten intern in ein
      // aufgelöstes "undefined" statt einer Ablehnung (siehe Kommentar oben) -
      // muss hier abgefangen werden, sonst stürzt DIESER Patch selbst ab.
      if (!response) return response;
      const setCookie = response.headers?.['set-cookie'];
      if (Array.isArray(setCookie)) {
        for (const raw of setCookie) {
          const eq = raw.indexOf('=');
          const semi = raw.indexOf(';');
          if (eq > 0) cookies.set(raw.slice(0, eq).trim(), raw.slice(eq + 1, semi > eq ? semi : undefined).trim());
        }
      }
      return response;
    });
  }

  return client as unknown as GarminConnectClient;
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
      // TEMP-DIAGNOSE (15.08.2026): kompletten Stacktrace mitloggen, um die genaue
      // Fehlerstelle in der Bibliothek zu finden - nach Diagnose wieder entfernen.
      if (e instanceof Error && e.stack) {
        console.error('GARMIN-DEBUG Stacktrace:', e.stack);
      }
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

  app.get('/api/garmin/activities', async (req, reply) => {
    const { deviceId, sinceIso, limit, offset, enrich } = (req.query ?? {}) as {
      deviceId?: string;
      sinceIso?: string;
      limit?: string;
      offset?: string;
      enrich?: string;
    };
    if (!deviceId) return reply.code(400).send({ error: 'deviceId wird benötigt.' });

    const session = await store.get(deviceId);
    if (!session) {
      return reply.code(404).send({ error: 'Nicht mit Garmin verbunden.' });
    }

    try {
      const tokens = JSON.parse(decryptText(session.encryptedTokens)) as StoredTokens;
      const client = await clientFactory();
      client.loadToken(tokens.oauth1, tokens.oauth2);

      const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
      const pageOffset = Math.max(0, Number(offset) || 0);
      // Mit Cursor (laufender Abruf seit dem letzten Mal) über mehrere Seiten
      // scannen, damit dazwischenliegende Nicht-Lauf-Aktivitäten keine Läufe
      // aus dem Fenster verdrängen (s. fetchRunningActivitiesPaginated). Ohne
      // Cursor (frisch verbunden) reicht die eine angeforderte Seite - für
      // die volle Historie gibt es extra /activities/backfill.
      const { pairs } = sinceIso
        ? await fetchRunningActivitiesPaginated(client, { pageSize, maxPages: 5, startOffset: pageOffset, sinceIso })
        : { pairs: mapRunningActivities(await client.getActivities(pageOffset, pageSize), sinceIso) };
      const activities = enrich === 'true' ? await maybeEnrich(client, pairs, pairs.length) : pairs.map((x) => x.mapped);

      const freshTokens = client.exportToken();
      await store.put(deviceId, { ...session, encryptedTokens: encryptText(JSON.stringify(freshTokens)) });

      return { activities };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Garmin-Aktivitäten abrufen fehlgeschlagen:', e instanceof Error ? e.message : e);
      return reply.code(502).send({
        error:
          'Abruf der Läufe von Garmin fehlgeschlagen. Falls die Verbindung abgelaufen ist, bitte Garmin-Konto in ' +
          'den Einstellungen neu verbinden.',
      });
    }
  });

  // Einmaliger Vollimport der Garmin-Historie (statt nur der letzten ≤50 wie
  // /api/garmin/activities): paginiert über mehrere Seiten, harte Obergrenze
  // maxPages als Schutz gegen die inoffizielle, ratenlimit-empfindliche API.
  // FIT-Anreicherung nur für die neuesten `enrichLatest` Läufe (teuer: 1
  // zusätzlicher Download+Decode je Aktivität, Render-Timeout im Blick behalten).
  app.get('/api/garmin/activities/backfill', async (req, reply) => {
    const { deviceId, sinceIso, maxPages, pageSize: pageSizeParam, enrichLatest } = (req.query ?? {}) as {
      deviceId?: string;
      sinceIso?: string;
      maxPages?: string;
      pageSize?: string;
      enrichLatest?: string;
    };
    if (!deviceId) return reply.code(400).send({ error: 'deviceId wird benötigt.' });

    const session = await store.get(deviceId);
    if (!session) {
      return reply.code(404).send({ error: 'Nicht mit Garmin verbunden.' });
    }

    const pageSize = Math.max(1, Math.min(50, Number(pageSizeParam) || 50));
    const maxPagesN = Math.max(1, Math.min(20, Number(maxPages) || 6));
    const enrichCount = Math.max(0, Math.min(50, Number(enrichLatest) || 20));

    try {
      const tokens = JSON.parse(decryptText(session.encryptedTokens)) as StoredTokens;
      const client = await clientFactory();
      client.loadToken(tokens.oauth1, tokens.oauth2);

      const { pairs: collected, pagesFetched, partial } = await fetchRunningActivitiesPaginated(client, {
        pageSize,
        maxPages: maxPagesN,
        sinceIso,
      });

      collected.sort((a, b) => b.mapped.startTime.localeCompare(a.mapped.startTime));
      const activities = await maybeEnrich(client, collected, enrichCount);

      const freshTokens = client.exportToken();
      await store.put(deviceId, { ...session, encryptedTokens: encryptText(JSON.stringify(freshTokens)) });

      return { activities, pagesFetched, partial };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Garmin-Backfill fehlgeschlagen:', e instanceof Error ? e.message : e);
      return reply.code(502).send({
        error:
          'Abruf des Garmin-Verlaufs fehlgeschlagen. Falls die Verbindung abgelaufen ist, bitte Garmin-Konto in ' +
          'den Einstellungen neu verbinden.',
      });
    }
  });
}
