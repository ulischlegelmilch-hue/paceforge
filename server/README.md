# @paceforge/server — Phase-2-Backend

Fastify-Backend (TypeScript, ESM). Teilt sich die Domain-/Logik-Typen mit der App
über `@paceforge/core`.

## Endpunkte

- `GET /healthz` → `{ ok: true, storage: "memory" | "redis" }` (zeigt, ob Sync-Snapshots
  dauerhaft abgelegt werden).
- `POST /api/parse-goal` `{ text }` → `{ parsed: ParsedGoal, source: "llm" | "rules" }`
  Natürlichsprachliche Zieleingabe. Mit gesetztem `ANTHROPIC_API_KEY` extrahiert
  **Claude** (`claude-opus-4-8`, Structured Output) robust auch umgangssprachlichen
  Text; sonst greift der deterministische Regel-Parser aus `@paceforge/core`
  (`source: "rules"`). Die Trainingslogik bleibt in beiden Fällen regelbasiert.
- `GET/PUT/DELETE /api/sync/:id` — Cross-Device-Sync-Snapshot (Profil+Plan+Aktivitäten).
  `PUT` erwartet optional `baseUpdatedAt` (Stand, auf dem das Gerät aufsetzt); passt
  das nicht zum gespeicherten Stand, antwortet der Server mit **409** + dem aktuellen
  Serverstand (Konflikt: ein anderes Gerät hat inzwischen geschrieben). `?force=1`
  überschreibt bewusst.
- `GET /api/garmin/status?deviceId=` → `{ configured, connected, username?, connectedAt? }`.
  `configured` zeigt, ob `GARMIN_TOKEN_ENCRYPTION_KEY` gesetzt ist.
- `POST /api/garmin/login` `{ deviceId, username, password }` — meldet sich einmalig bei
  Garmin Connect an (inoffizielle Web-API, siehe `src/garmin.ts`) und speichert nur die
  resultierenden Session-Tokens verschlüsselt; das Passwort wird nicht persistiert.
  2FA/Sicherheitsabfragen werden nicht unterstützt → dann **401**.
- `POST /api/garmin/disconnect` `{ deviceId }` — löscht die gespeicherte Session.
- `POST /api/garmin/push-workout` `{ deviceId, workout, date }` — überträgt ein Workout
  in den Garmin-Connect-Kalender des Nutzers (von dort synct Garmin es selbst aufs
  Handgelenk). **404** ohne Verbindung, **502** bei Garmin-seitigem Fehler.

## Start

```bash
npm install
ANTHROPIC_API_KEY=... npm run dev --workspace @paceforge/server   # mit LLM
npm run dev --workspace @paceforge/server                          # nur Regeln
```

Port via `PORT` (Default 8787).

## Deploy (Render)

`render.yaml` (im Repo-Root) ist ein Blueprint: in render.com „New +" → „Blueprint" →
dieses Repo. Deploy läuft vom Monorepo-Root (damit die Workspaces installiert werden),
Start = `npm start --workspace @paceforge/server`, Health-Check `/healthz`.
`ANTHROPIC_API_KEY` optional im Dashboard setzen. Danach in der App
`EXPO_PUBLIC_API_BASE_URL=https://<service>.onrender.com` setzen.

## Sync-Persistenz (Upstash Redis, optional)

Ohne Konfiguration liegen Sync-Snapshots nur im Arbeitsspeicher des Prozesses und
sind nach jedem Neustart/Deploy/Einschlafen (Render Free-Tier) weg. Für dauerhafte
Ablage: bei [upstash.com](https://upstash.com) eine kostenlose Redis-Datenbank
anlegen, „REST API"-URL + Token kopieren, im Render-Dashboard als
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` setzen (siehe `.env.example`).
`GET /healthz` zeigt danach `storage: "redis"`. Kein zusätzliches SDK nötig — die
Anbindung (`src/storage.ts`) spricht die REST-API direkt per `fetch` an.

## Garmin-Connect-Anbindung (inoffiziell)

Die offizielle Garmin Training API ist für Einzelentwickler pausiert (siehe
Projekt-`CLAUDE.md`). Statt darauf zu warten, spricht `src/garmin.ts` die
reverse-engineerte, undokumentierte Garmin-Connect-Web-API an (`garmin-connect`-npm-
Paket) — echte, kabellose Übertragung aufs Handgelenk, aber technisch gegen Garmins
Nutzungsbedingungen und ohne Garantie, dass Garmin die private API nicht ändert.

Setup: `GARMIN_TOKEN_ENCRYPTION_KEY` im Dashboard setzen (zufälliger langer String,
z.B. `openssl rand -hex 32`) — ohne diesen Wert bleibt `/api/garmin/login` mit **503**
deaktiviert. Session-Tokens landen in derselben Ablage wie Sync-Snapshots (Upstash,
sonst In-Memory und weg nach Neustart), aber unter eigenem Key-Präfix
(`src/garminStore.ts`) und AES-256-GCM-verschlüsselt (`src/tokenCrypto.ts`).
