// Athleten-Profil & Zieldefinition (Abschnitt 1 der CLAUDE.md).
// Alle Distanzen in Metern, Zeiten in Sekunden, Pace intern in m/s.

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon' | 'custom';

export interface Goal {
  distance: RaceDistance;
  /** Nur wenn distance === 'custom'. */
  customDistanceMeters?: number;
  /** Entweder ein konkretes Zieldatum (ISO) ... */
  targetDate?: string;
  /** ... oder eine Planlänge in Wochen. Genau eines von beiden setzen. */
  weeks?: number;
  /** Optionale Wunsch-Zielzeit in Sekunden. */
  targetTimeSeconds?: number;
}

export type SelfRatedLevel = 'beginner' | 'intermediate' | 'advanced';

/** Eingabe zur Ableitung der Start-VDOT. Genau eine Quelle genügt. */
export interface FitnessInput {
  /** Beste Quelle: eine kürzliche Wettkampf-/Testleistung. */
  recentRace?: { distanceMeters: number; timeSeconds: number };
  /** Alternativ: direkt geschätzte VDOT. */
  estimatedVdot?: number;
  /** Fallback: grobe Selbsteinschätzung. */
  selfRatedLevel?: SelfRatedLevel;
}

export type Units = 'metric' | 'imperial';

export interface StrengthPrefs {
  /** Krafteinheiten pro Woche (0 = aus). */
  sessionsPerWeek: number;
  equipment: 'gym' | 'bodyweight';
}

export interface AthleteProfile {
  id: string;
  createdAt: string;              // ISO
  goal: Goal;
  fitness: FitnessInput;
  /** Aus fitness abgeleitet; wird über die Zeit durch Adaption aktualisiert. */
  currentVdot: number;
  /** Verfügbare Trainingstage pro Woche (typ. 3–6). */
  daysPerWeek: number;
  /** Bevorzugte Wochentage (0=So .. 6=Sa). */
  preferredDays?: number[];
  /** Wochentag für den Long Run (0=So .. 6=Sa). */
  longRunDay?: number;
  device?: { brand: 'garmin'; model?: string };
  units: Units;
  /** Körpergewicht in kg (optional) – für Ernährungs-Gramm-Ziele. */
  weightKg?: number;
  /** Kraft-Modul-Einstellungen (optional; Default: aktiv, Körpergewicht). */
  strength?: StrengthPrefs;
}
