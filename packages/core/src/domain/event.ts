// Ad-hoc-Wettkampf mitten im laufenden Plan ("Zwischenevent", z. B. ein Halbmarathon
// als Testrennen während einer Marathon-Vorbereitung). Getrennt vom Haupt-`Goal`
// (domain/athlete.ts) - ein Zwischenevent ändert nicht das eigentliche Trainingsziel,
// sondern wird lokal in den bestehenden Plan eingewoben (siehe planner/events.ts).

export interface PlanEvent {
  id: string;
  /** Datum des Wettkampfs, ISO 'YYYY-MM-DD' (wie ScheduledWorkout.date). */
  date: string;
  distanceMeters: number;
  name?: string;
  /** Optionale Zielzeit; ohne sie wird die Renn-Pace aus der aktuellen VDOT geschätzt. */
  targetTimeSeconds?: number;
}
