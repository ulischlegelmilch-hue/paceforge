# Projekt: "PaceForge" – Adaptiver Lauf-Trainingsplan mit Garmin-Sync

## Ziel
Baue eine Cross-Platform Mobile App (iOS/Android) mit React Native (Expo, TypeScript),
die personalisierte Lauf-Trainingspläne generiert, strukturierte Workouts (Intervalle,
Pace-Ziele, Wiederholungen) auf Garmin-Uhren überträgt, und nach jedem Lauf die
abgeschlossene Aktivität zurückliest, um den Plan adaptiv anzupassen. Funktionsumfang
vergleichbar mit Runna, aber komplett eigenständige Implementierung, eigenes Branding,
eigene UI — keine Screenshots, Assets, Texte oder Markennamen von Runna oder Garmin
verwenden.

## Wichtiger Kontext: Garmin-Integration
Die offizielle Garmin Training API (Push von Workouts direkt auf den Kalender/die Uhr)
ist Teil des Garmin Connect Developer Program und aktuell (Stand Recherche 2026) für
neue Anträge pausiert und ohnehin nur für Firmen zugänglich, nicht für Einzelentwickler.
Baue die App daher so, dass der "Workout-Delivery"-Layer AUSTAUSCHBAR ist:

1. **Phase 1 (jetzt bauen):** Workout-Export als FIT-Datei (offizielles, offen
   dokumentiertes FIT SDK Format), die der Nutzer manuell per USB/MTP auf die Uhr
   kopiert (Ordner NewFiles/Workouts). Zusätzlich: Connect IQ Datenfeld/App als
   Fallback-UI direkt auf der Uhr, falls native Workout-Injection nicht möglich ist.
2. **Phase 2 (vorbereiten, aber nicht blockierend):** Interface/Abstraktionsschicht
   `WorkoutDeliveryProvider`, sodass später ein Provider für die offizielle Garmin
   Training API (falls Zugang erteilt wird) oder für inoffizielle Libraries
   (z.B. python-garminconnect-Äquivalent) eingehängt werden kann, OHNE dass
   Plan-Generierung oder UI angefasst werden müssen.
3. Verwende für Aktivitäts-Rücklese (abgeschlossene Läufe) primär manuellen
   FIT-Datei-Import durch den Nutzer als MVP; baue die Parsing-Logik so, dass sie
   später auch von einer API-gespeisten Quelle Daten empfangen kann.

## Tech-Stack
- React Native mit Expo (managed workflow, TypeScript strict mode)
- Zustand oder Redux Toolkit für State Management
- SQLite (expo-sqlite) oder WatermelonDB für lokale Persistenz von Plänen/Aktivitäten
- Backend: Node.js + Fastify oder FastAPI (Python), je nachdem was sich für die
  Plan-Generierungs-Logik besser eignet — schlage die passendere Option vor und
  begründe kurz
- FIT-Datei-Encoding/Decoding: nutze eine bestehende, gepflegte FIT-SDK-Bibliothek
  für die gewählte Sprache (z.B. fit-tool für Dart/JS-Ports, oder eine Python-FIT-
  Bibliothek im Backend) statt das Binärformat von Hand zu implementieren
- Kein localStorage/sessionStorage im RN-Kontext verwenden (nicht zutreffend, aber
  generell: nur unterstützte Persistenz-APIs)

## Kernfunktionen (in dieser Reihenfolge implementieren)

### 1. Onboarding & Zieldefinition
- Nutzer gibt Ziel-Distanz an (5K/10K/Halbmarathon/Marathon/frei), Zieldatum oder
  Wochenanzahl, aktuelles Fitnesslevel (z.B. via aktuelle Bestzeit oder
  geschätztes VDOT), verfügbare Trainingstage pro Woche, Ausrüstung (Garmin-Modell)
- Ergebnis: strukturiertes Athleten-Profil-Objekt (TypeScript-Interface definieren)

### 2. Plan-Generierungs-Engine (regelbasiert, KEIN LLM für die Kernlogik)
- Implementiere einen Algorithmus basierend auf etablierten Trainingsmethoden
  (z.B. Jack-Daniels-VDOT-Zonen oder 80/20-Polarized-Training) — recherchiere und
  dokumentiere im Code, welcher Ansatz gewählt wurde und warum
- Output: Mehrwöchiger Plan mit einzelnen Workout-Objekten pro Tag (Ruhetag,
  lockerer Lauf, Tempolauf, Intervalle, Long Run, Regeneration)
- Jedes Workout-Objekt muss in ein internes, geräteunabhängiges Schema passen
  (Schritte mit duration_type, target_type, intensity, repeats) — orientiere dich
  am FIT-Workout-Step-Modell, aber halte das interne Schema Garmin-agnostisch,
  damit später auch andere Wearables unterstützt werden könnten
- Optional/Phase 2: ein LLM-Layer, der NATÜRLICHSPRACHLICHE Zieleingaben
  ("ich will unter 45 Minuten laufen") in das strukturierte Athleten-Profil
  übersetzt — aber die eigentliche Trainingslogik bleibt regelbasiert

### 3. Workout-Delivery
- FIT-Workout-Encoder: konvertiert internes Workout-Schema in eine valide
  FIT-Workout-Datei (file_id, workout, workout_step Messages; korrekte
  duration_type/target_type-Enums; Pace-Targets in mm/s; Repeat-Steps korrekt
  mit message_index-Rücksprung)
- Export-Flow: Nutzer verbindet Uhr per USB, App zeigt Anleitung, Datei wird in
  den korrekten Ordner kopiert (bzw. auf Desktop exportiert falls kein direkter
  Dateisystemzugriff vom Handy aus möglich ist — recherchiere die technische
  Machbarkeit für iOS vs. Android und dokumentiere die Einschränkungen)
- Baue eine klare Abstraktion (Interface `WorkoutDeliveryProvider` mit Methoden
  wie `exportWorkout()`, `getDeliveryInstructions()`), sodass ein späterer
  API-basierter Provider ohne Änderungen am Rest der App eingesetzt werden kann

### 4. Aktivitäts-Rücklese & Plan-Anpassung
- FIT-Activity-Parser: liest abgeschlossene Lauf-Daten (Distanz, Pace, HR falls
  vorhanden, Dauer) aus einer vom Nutzer importierten FIT-Datei
- Vergleichslogik: geplantes vs. tatsächliches Workout (Soll-Pace vs. Ist-Pace,
  ausgelassene/verkürzte Einheiten)
- Adaptions-Regeln: wann wird der Plan angepasst (z.B. 2 verpasste Läufe in
  Folge → Reduktion der nächsten Woche; durchgängig zu leichte Läufe →
  Steigerung der Intensität)

### 5. UI (eigenständiges Design, keine fremden Assets)
- Wochenübersicht mit Trainingskalender
- Detailansicht pro Workout (Warmup/Intervalle/Cooldown visualisiert, Pace-Ziele)
- Fortschrittsansicht (VDOT/Fitness-Trend über Zeit, absolvierte vs. geplante Läufe)
- Export-/Sync-Screen mit klarer Anleitung für den FIT-Datei-Workflow

## Vorgehen
1. Schlage zunächst eine Projektstruktur vor (Ordner, Module, wichtigste
   TypeScript-Interfaces für Athlete Profile, TrainingPlan, Workout, WorkoutStep,
   CompletedActivity) — zur Abstimmung, BEVOR Code geschrieben wird
2. Baue iterativ in der oben genannten Reihenfolge; nach jedem Abschnitt kurz
   zusammenfassen was gebaut wurde und was als Nächstes ansteht
3. Schreibe für die Plan-Generierungs-Engine und den FIT-Encoder Unit-Tests
   (Vitest/Jest), da das die fehleranfälligsten Teile sind
4. Halte Delivery- und Datenquellen-Layer strikt hinter Interfaces, damit sich
   die Garmin-API-Zugangslage später ändern kann, ohne den Rest der App
   umzubauen
5. Frage aktiv nach, wenn eine Design- oder Architekturentscheidung mehrdeutig
   ist (z.B. Backend-Sprache, ob Onboarding-Fragen als Wizard oder Formular)

## Nicht tun
- Keine Runna-Marken, -Texte, -Farbschemata, -Screenshots oder -Icons kopieren
- Keine Garmin-Marken/Logos außerhalb korrekter, lizenzkonformer Nutzung
  (z.B. "Made for Garmin"-Richtlinien) verwenden
- Keine inoffizielle Garmin-Login-Bibliothek fest in die Kernarchitektur
  einbauen — nur als optionaler, klar gekennzeichneter Delivery-Provider
  hinter dem Interface aus Abschnitt 3
