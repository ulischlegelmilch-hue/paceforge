// Athleten-Profil & Zieldefinition (Abschnitt 1 der CLAUDE.md).
// Alle Distanzen in Metern, Zeiten in Sekunden, Pace intern in m/s.

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon' | 'custom';

export interface Goal {
  /**
   * 'race' = auf eine Zieldistanz/-zeit hintrainieren (periodisiert base→…→taper).
   * 'maintain' = Form halten ohne Wettkampf (fortlaufender rollierender Wochenrhythmus,
   * 80/20, 1 Qualitätseinheit/Woche; für Läufer:innen mit vorhandener Grundlage).
   * Default: 'race'.
   */
  mode?: 'race' | 'maintain';
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
  /** Beste Quelle: eine kürzliche Wettkampf-/Testleistung (optional mit Höhenmetern). */
  recentRace?: { distanceMeters: number; timeSeconds: number; ascentMeters?: number };
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
  /**
   * Wochentag des ersten Laufs der Trainingswoche (0=So .. 6=Sa). Verschiebt
   * das gesamte Tages-Muster (nicht nur den Long Run) auf den gewünschten
   * Rhythmus. Ohne Angabe bleibt der bisherige Standard-Anker (Dienstag/Montag
   * je nach Tagesanzahl) erhalten.
   */
  weekStartDay?: number;
  device?: { brand: 'garmin'; model?: string };
  units: Units;
  /** Körpergewicht in kg (optional) – für Ernährungs-Gramm-Ziele. */
  weightKg?: number;
  /** Kraft-Modul-Einstellungen (optional; Default: aktiv, Körpergewicht). */
  strength?: StrengthPrefs;
}
