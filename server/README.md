# @paceforge/server — Phase-2-Backend

Fastify-Backend (TypeScript, ESM). Teilt sich die Domain-/Logik-Typen mit der App
über `@paceforge/core`.

## Endpunkte

- `GET /healthz` → `{ ok: true }`
- `POST /api/parse-goal` `{ text }` → `{ parsed: ParsedGoal, source: "llm" | "rules" }`
  Natürlichsprachliche Zieleingabe. Mit gesetztem `ANTHROPIC_API_KEY` extrahiert
  **Claude** (`claude-opus-4-8`, Structured Output) robust auch umgangssprachlichen
  Text; sonst greift der deterministische Regel-Parser aus `@paceforge/core`
  (`source: "rules"`). Die Trainingslogik bleibt in beiden Fällen regelbasiert.

## Start

```bash
npm install
ANTHROPIC_API_KEY=... npm run dev --workspace @paceforge/server   # mit LLM
npm run dev --workspace @paceforge/server                          # nur Regeln
```

Port via `PORT` (Default 8787).

## Noch offen (Phase 2, gesperrt)

- **Garmin Training API / OAuth-Provider** — braucht einen echten Garmin-Developer-
  Zugang (Programm derzeit pausiert). Hier entsteht später der OAuth-Flow + ein
  serverseitiger `WorkoutDeliveryProvider`; App und Plan-Engine bleiben durch das
  bestehende Interface unberührt.
- **Cross-Device-Sync** — REST-Endpunkte für Profil/Plan/Aktivitäten + ein
  App-seitiger Sync-Client.
