import type { PlanPhase, PlanWeek } from '../domain/plan';

// Evidenzbasiertes Kraft-Modul für Läufer. Grundlage: Recherche (Blagrove 2018,
// Balsalobre-Fernández 2016, Lauersen 2014/2018, Rønnestad & Mujika 2014, u.a.):
// 2×/Woche schwer-aber-nicht-bis-zum-Versagen + Plyometrie verbessert die
// Laufökonomie (+2–8 %) und halbiert das Verletzungsrisiko. Periodisiert an die
// Laufphase: Grundlage → schwer → Power/Plyo → Taper. WICHTIG: verbessert NICHT
// die VO2max — Nutzen sind Ökonomie, Kraft/Power, Robustheit, Verletzungsschutz.

export type StrengthEquipment = 'gym' | 'bodyweight';
export type StrengthKind = 'foundation' | 'heavy' | 'power' | 'taper';
export type ExerciseCategory = 'squat' | 'hinge' | 'lunge' | 'calf' | 'single-leg' | 'plyo' | 'core';

export interface StrengthExercise {
  name: string;
  sets: number;
  reps: string; // z.B. "8–12", "3–6", "6–8/Seite", "30–40 Kontakte"
  load: string; // z.B. "≥80 % 1RM · 1–2 Wdh. Reserve", "Körpergewicht", "moderat"
  category: ExerciseCategory;
}

export interface StrengthSession {
  id: string;
  name: string;
  kind: StrengthKind;
  exercises: StrengthExercise[];
  focusNote: string;
  estimatedMinutes: number;
}

export function strengthKindForPhase(phase: PlanPhase): StrengthKind {
  switch (phase) {
    case 'base':
      return 'foundation';
    case 'build':
      return 'heavy';
    case 'peak':
      return 'power';
    case 'taper':
      return 'taper';
  }
}

const FOCUS: Record<StrengthKind, string> = {
  foundation: 'Grundlage/Hypertrophie · moderate Last, saubere Technik · 2×/Woche',
  heavy: 'Schwer (≥80 % 1RM), 1–2 Wiederholungen in Reserve – NICHT bis zum Versagen',
  power: 'Explosiv/Plyometrie · Qualität vor Menge · Volumen reduziert',
  taper: 'Nur leichte Aktivierung & Mobilität – erhalten, nicht aufbauen',
};

// ---- Übungsbibliotheken je Ausrüstung & Phase -------------------------------

const GYM: Record<StrengthKind, StrengthExercise[][]> = {
  foundation: [
    [
      { name: 'Kniebeuge', sets: 3, reps: '8–12', load: 'moderat', category: 'squat' },
      { name: 'Rumänisches Kreuzheben', sets: 3, reps: '8–12', load: 'moderat', category: 'hinge' },
      { name: 'Ausfallschritte', sets: 3, reps: '8–10/Seite', load: 'moderat', category: 'lunge' },
      { name: 'Wadenheben', sets: 3, reps: '12–15', load: 'moderat', category: 'calf' },
      { name: 'Unterarmstütz', sets: 3, reps: '40 s', load: 'Körpergewicht', category: 'core' },
    ],
    [
      { name: 'Beinpresse', sets: 3, reps: '8–12', load: 'moderat', category: 'squat' },
      { name: 'Hip Thrust / Glute Bridge', sets: 3, reps: '10–12', load: 'moderat', category: 'hinge' },
      { name: 'Step-ups', sets: 3, reps: '8–10/Seite', load: 'moderat', category: 'single-leg' },
      { name: 'Sitzendes Wadenheben', sets: 3, reps: '12–15', load: 'moderat', category: 'calf' },
      { name: 'Pallof-Press (Anti-Rotation)', sets: 3, reps: '10/Seite', load: 'Band', category: 'core' },
    ],
  ],
  heavy: [
    [
      { name: 'Kniebeuge', sets: 4, reps: '3–6', load: '≥80 % 1RM · 1–2 Wdh. Reserve', category: 'squat' },
      { name: 'Kreuzheben (Hip-Hinge)', sets: 4, reps: '3–5', load: '≥80 % 1RM', category: 'hinge' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '5–6/Seite', load: 'schwer', category: 'single-leg' },
      { name: 'Wadenheben schwer', sets: 4, reps: '6–8', load: 'schwer', category: 'calf' },
      { name: 'Box Jumps (Plyo-Ausklang)', sets: 3, reps: '5', load: 'explosiv', category: 'plyo' },
    ],
    [
      { name: 'Frontkniebeuge', sets: 4, reps: '4–6', load: '≥80 % 1RM · 1–2 Wdh. Reserve', category: 'squat' },
      { name: 'Rumänisches Kreuzheben', sets: 4, reps: '5–6', load: 'schwer', category: 'hinge' },
      { name: 'Ausfallschritt gehend', sets: 3, reps: '6/Seite', load: 'schwer', category: 'lunge' },
      { name: 'Einbeiniges Wadenheben', sets: 3, reps: '8/Seite', load: 'schwer', category: 'calf' },
      { name: 'Countermovement Jumps', sets: 3, reps: '5', load: 'explosiv', category: 'plyo' },
    ],
  ],
  power: [
    [
      { name: 'Countermovement Jumps', sets: 4, reps: '5', load: 'maximal explosiv', category: 'plyo' },
      { name: 'Box/Depth Jumps', sets: 4, reps: '5', load: 'explosiv', category: 'plyo' },
      { name: 'Kniebeuge explosiv', sets: 3, reps: '3', load: 'zügig, ~60–70 % 1RM', category: 'squat' },
      { name: 'Bounding / Sprünge', sets: 3, reps: '20 m', load: 'explosiv', category: 'plyo' },
      { name: 'Wadenheben', sets: 2, reps: '8', load: 'moderat', category: 'calf' },
    ],
    [
      { name: 'Pogo Hops', sets: 4, reps: '20 Kontakte', load: 'reaktiv', category: 'plyo' },
      { name: 'Einbeinige Sprünge', sets: 3, reps: '6/Seite', load: 'explosiv', category: 'plyo' },
      { name: 'Kniebeuge (Erhalt)', sets: 3, reps: '3–4', load: 'schwer, zügig', category: 'squat' },
      { name: 'Hip Thrust explosiv', sets: 3, reps: '5', load: 'zügig', category: 'hinge' },
      { name: 'Anti-Rotation Core', sets: 2, reps: '10/Seite', load: 'Band', category: 'core' },
    ],
  ],
  taper: [
    [
      { name: 'Goblet-Kniebeuge (leicht)', sets: 2, reps: '8', load: 'leicht', category: 'squat' },
      { name: 'Glute Bridge', sets: 2, reps: '10', load: 'Körpergewicht', category: 'hinge' },
      { name: 'Pogo Hops (Priming)', sets: 2, reps: '15 Kontakte', load: 'leicht reaktiv', category: 'plyo' },
      { name: 'Band-Walks / Aktivierung', sets: 2, reps: '12/Seite', load: 'Band', category: 'single-leg' },
      { name: 'Mobilität & Core leicht', sets: 2, reps: '30 s', load: 'Körpergewicht', category: 'core' },
    ],
  ],
};

const BODYWEIGHT: Record<StrengthKind, StrengthExercise[][]> = {
  foundation: [
    [
      { name: 'Einbeinige Kniebeuge / Pistol-Progression', sets: 3, reps: '6–8/Seite', load: 'Körpergewicht', category: 'single-leg' },
      { name: 'Nordic Hamstring Curls', sets: 3, reps: '5', load: 'Körpergewicht (exzentrisch)', category: 'hinge' },
      { name: 'Einbeiniges Wadenheben', sets: 3, reps: '12–15/Seite', load: 'Körpergewicht', category: 'calf' },
      { name: 'Unterarmstütz', sets: 3, reps: '40 s', load: 'Körpergewicht', category: 'core' },
      { name: 'Pogo Hops', sets: 3, reps: '20 Kontakte', load: 'reaktiv', category: 'plyo' },
    ],
    [
      { name: 'Bulgarian Split Squat', sets: 3, reps: '8–10/Seite', load: 'Körpergewicht', category: 'single-leg' },
      { name: 'Glute Bridge einbeinig', sets: 3, reps: '10/Seite', load: 'Körpergewicht', category: 'hinge' },
      { name: 'Step-ups', sets: 3, reps: '10/Seite', load: 'Körpergewicht', category: 'single-leg' },
      { name: 'Seitstütz (Anti-Rotation)', sets: 3, reps: '30 s/Seite', load: 'Körpergewicht', category: 'core' },
      { name: 'Line Hops', sets: 3, reps: '20 Kontakte', load: 'reaktiv', category: 'plyo' },
    ],
  ],
  heavy: [
    [
      { name: 'Bulgarian Split Squat (langsam-exzentrisch)', sets: 4, reps: '8/Seite', load: 'Körpergewicht, langsam', category: 'single-leg' },
      { name: 'Nordic Hamstring Curls', sets: 4, reps: '6', load: 'Körpergewicht (exzentrisch)', category: 'hinge' },
      { name: 'Einbeiniges Wadenheben', sets: 4, reps: '12/Seite', load: 'Körpergewicht', category: 'calf' },
      { name: 'Jump Squats', sets: 3, reps: '6', load: 'explosiv', category: 'plyo' },
      { name: 'Anti-Rotation Core', sets: 3, reps: '12/Seite', load: 'Körpergewicht', category: 'core' },
    ],
    [
      { name: 'Pistol-Squat-Progression', sets: 4, reps: '5–6/Seite', load: 'Körpergewicht', category: 'single-leg' },
      { name: 'Nordic Hamstring / Hamstring-Bridge', sets: 4, reps: '6', load: 'Körpergewicht', category: 'hinge' },
      { name: 'Split-Squat-Jumps', sets: 3, reps: '6/Seite', load: 'explosiv', category: 'plyo' },
      { name: 'Wadenheben einbeinig', sets: 4, reps: '12/Seite', load: 'Körpergewicht', category: 'calf' },
      { name: 'Plank-Varianten', sets: 3, reps: '45 s', load: 'Körpergewicht', category: 'core' },
    ],
  ],
  power: [
    [
      { name: 'Countermovement Jumps', sets: 4, reps: '5', load: 'maximal explosiv', category: 'plyo' },
      { name: 'Einbeinige Sprünge', sets: 3, reps: '6/Seite', load: 'explosiv', category: 'plyo' },
      { name: 'Bounding', sets: 3, reps: '20 m', load: 'explosiv', category: 'plyo' },
      { name: 'Box Jumps', sets: 3, reps: '5', load: 'explosiv', category: 'plyo' },
      { name: 'Core kurz', sets: 2, reps: '30 s', load: 'Körpergewicht', category: 'core' },
    ],
  ],
  taper: [
    [
      { name: 'Pogo Hops (leicht)', sets: 2, reps: '15 Kontakte', load: 'leicht reaktiv', category: 'plyo' },
      { name: 'Einbein-Balance', sets: 2, reps: '30 s/Seite', load: 'Körpergewicht', category: 'single-leg' },
      { name: 'Glute Bridge', sets: 2, reps: '10', load: 'Körpergewicht', category: 'hinge' },
      { name: 'Mobilität & Core leicht', sets: 2, reps: '30 s', load: 'Körpergewicht', category: 'core' },
    ],
  ],
};

const NAMES = ['A', 'B'];

/** Die 2 (bzw. 1 im Taper) Krafteinheiten für eine Laufphase. */
export function strengthSessionsForPhase(phase: PlanPhase, equipment: StrengthEquipment): StrengthSession[] {
  const kind = strengthKindForPhase(phase);
  const lib = equipment === 'gym' ? GYM : BODYWEIGHT;
  const templates = lib[kind];
  return templates.map((exercises, i) => ({
    id: `str-${kind}-${equipment}-${i}`,
    name: `Kraft ${NAMES[i] ?? String(i + 1)} · ${kindLabel(kind)}`,
    kind,
    exercises,
    focusNote: FOCUS[kind],
    estimatedMinutes: kind === 'taper' ? 20 : 35,
  }));
}

export function kindLabel(kind: StrengthKind): string {
  switch (kind) {
    case 'foundation':
      return 'Grundlage';
    case 'heavy':
      return 'Maximalkraft';
    case 'power':
      return 'Power/Plyo';
    case 'taper':
      return 'Taper';
  }
}

const QUALITY_KINDS = new Set(['tempo', 'interval', 'repetition']);

/** Harte Lauftage der Woche (Tempo/Intervall/Wiederholung) – dort Kraft platzieren. */
export function hardRunDays(week: PlanWeek): number[] {
  return week.workouts.filter((w) => QUALITY_KINDS.has(w.workout.kind)).map((w) => w.dayOfWeek);
}

/** Evidenz-/Sicherheitshinweise fürs Kraft-UI. */
export const STRENGTH_NOTES = {
  benefit:
    'Kraft verbessert Laufökonomie (+2–8 %) und senkt das Verletzungsrisiko deutlich – aber NICHT die VO2max.',
  dose: '2×/Woche, 30–45 min. Schwer, aber 1–2 Wiederholungen in Reserve (nicht bis zum Versagen).',
  interference:
    'An harten Lauftagen einplanen (Interferenz gering halten): ≥3–6 h Abstand, ideal an denselben Tagen – nie schwer direkt nach einem langen Lauf.',
  bodyweightGate:
    'Körpergewicht-Track: erst mit Plyometrie starten, wenn du 30 s sicher auf einem Bein balancierst; 48–72 h zwischen intensiven Plyo-Einheiten.',
};
