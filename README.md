# PaceForge

Adaptive Lauf-Trainingsplan-App mit Kraft- und Ernährungscoaching und Garmin-FIT-Anbindung.
Funktionsumfang vergleichbar mit Runna, aber komplett eigenständig – kein fremdes Branding,
keine kopierten Assets. Voll offline-nutzbar; ein optionales Backend fügt LLM-gestützte
Zieleingabe und Cross-Device-Sync hinzu.

> **Status:** Kern + App laufen; per `tsc` und Web-Bundle verifiziert, aber noch nicht auf
> echtem Gerät/Emulator getestet. Backend (LLM/Sync) ist gebaut, aber noch nicht deployt.

## Monorepo

npm-Workspaces (TypeScript strict überall):

| Paket | Zweck |
|---|---|
| `packages/core` (`@paceforge/core`) | Framework-agnostische Kernlogik, komplett unit-getestet: VDOT-Engine, Plan-Generierung, Adaption, FIT-Encode/Decode, Kraft- & Ernährungs-Module, Coaching-Tipps, Kalender-Export, NL-Zielparser. |
| `app` (`@paceforge/app`) | React-Native/Expo-App (SDK 57, expo-router). |
| `server` (`@paceforge/server`) | Fastify-Backend (Phase 2): `/api/parse-goal` (LLM + Regel-Fallback), Sync, Garmin-OAuth-Gerüst. |

`packages/core` ist die einzige Wahrheit für die Trainingslogik und wird von App **und** Server geteilt.

## Schnellstart

```bash
npm install                 # installiert alle Workspaces

# App (Gerät/Emulator/Web)
cd app && npm run android   # oder: npm run ios / npm run web

# Backend (optional)
cd server && npm run dev            # nur Regeln
ANTHROPIC_API_KEY=... npm run dev   # mit LLM-Zieleingabe (claude-opus-4-8)

# App ans Backend hängen (optional): in der App-Umgebung
EXPO_PUBLIC_API_BASE_URL=http://<host>:8787

# Tests & Typecheck (alle Workspaces)
npm test
npm run typecheck
```

## Funktionen

- **Onboarding & Ziel** – Distanz, Zeitrahmen, Fitness (Bestzeit → VDOT), Trainingstage; optional
  „Ziel in einem Satz" (Regel-Parser, mit Backend LLM).
- **Adaptiver Plan** – Periodisierung base → build → peak → taper (Jack-Daniels-VDOT), Wochen-
  übersicht, Workout-Detail mit Pace-Zielen.
- **Kraftmodul** – 2×/Woche periodisiert (Grundlage/Maximalkraft ≥80 % 1RM/Power-Plyo/Taper),
  Studio- **und** Körpergewicht-Track, auf harte Lauftage gelegt, in „Heute"/Wochenkalender eingewoben.
- **Ernährungscoach** – phasenbasierte Rezepte benannter Sport-RDs + persönliche KH/Protein-Ziele
  (Gewicht), Race-Week-Carb-Load, Eisen-Guidance.
- **Trainingsumfang** – Lauftage (3–6) und Krafteinheiten (0–3) frei wählbar, mit ehrlicher
  Einschätzung, ob das fürs Ziel reicht.
- **Wettkampfprognosen**, **Fitness-Rekalibrierung** (neue Bestzeit → Plan neu).
- **FIT-Export** einzelner Workouts (Garmin), **FIT-Import** absolvierter Läufe → Soll-Ist +
  automatische Plananpassung.
- **Kalender-Export** (.ics) des ganzen Plans, **Cloud-Sync** (mit Backend).

## Architektur-Notizen

- **Offline-first:** Ohne `EXPO_PUBLIC_API_BASE_URL` läuft alles lokal (Persistenz via
  expo-sqlite; Web nutzt In-Memory). Backend-Aufrufe haben immer einen lokalen Fallback.
- **Austauschbare Auslieferung:** `WorkoutDeliveryProvider`-Interface – aktuell FIT-Datei
  (`FitFileProvider`); ein `GarminApiProvider` (Phase 2) lässt sich ohne UI-/Plan-Änderung einhängen.
- **FIT:** offizielles `@garmin/fitsdk` (Encode/Decode), im `@paceforge/core/fit`-Subpfad, damit es
  nur bei Bedarf gebündelt wird.

## Evidenzbasis & wichtige Hinweise

Kraft- und Ernährungsinhalte basieren auf einer Literatur-Recherche (u. a. Blagrove 2018,
Balsalobre-Fernández 2016, Lauersen 2014/2018, Rønnestad & Mujika 2014; ACSM/ISSN-Kohlenhydrat-
Periodisierung). Bewusst umgesetzte Vorbehalte:

- **Kraft** verbessert Laufökonomie (+2–8 %) und senkt das Verletzungsrisiko – **nicht** die VO2max.
  Sweet Spot 2×/Woche, schwer aber nicht bis zum Versagen (RPE 8–9), an harte Lauftage gelegt.
- **Ernährungsrezepte** werden ihren benannten Quellen (Sport-RDs) zugeschrieben; **Makros nur, wo
  die Quelle sie angibt** (keine erfundenen Zahlen). „Run Fast. Eat Slow." – Autorinnen sind keine
  RDs, der Verlag nennt keine Nährwerte → nur als Inspiration.
- **Eisen** food-first; Ferritin < 35 µg/L als Signal; Supplementierung nur ärztlich begleitet.
- **Keine medizinische oder individuelle Ernährungsberatung** – allgemeine, quellenbasierte Orientierung.

## Tests

`packages/core` ist umfassend mit Vitest getestet (VDOT/Formeln, Plan-Generierung, Adaption,
FIT-Round-Trip, Kraft/Ernährung, Coaching-Tipps, Kalender, NL-Parser). Server: Route-Tests via
`app.inject`. Lauf: `npm test`.

## Offen (braucht externen Zugang/Hardware)

- Test auf echtem Gerät/Emulator.
- LLM-Pfad mit echtem `ANTHROPIC_API_KEY` (Fallback ist getestet).
- Echte Garmin-Training-API (OAuth) – Developer-Zugang nötig; Gerüst steht.
- Backend-Deploy (z. B. Render) + Sync-Persistenz auf eine DB (aktuell In-Memory).
- App-Icon-Grafik.
