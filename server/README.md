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

## Noch offen (Phase 2, gesperrt)

- **Garmin Training API / OAuth-Provider** — braucht einen echten Garmin-Developer-
  Zugang (Programm derzeit pausiert). Hier entsteht später der OAuth-Flow + ein
  serverseitiger `WorkoutDeliveryProvider`; App und Plan-Engine bleiben durch das
  bestehende Interface unberührt.
