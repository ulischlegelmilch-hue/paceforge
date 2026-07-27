import type { FitnessInput, SelfRatedLevel } from '../domain/athlete';
import { vdotFromRace } from './formulas';
import { gradeAdjustedDistance } from '../grade/index';

// Ableitung der Start-VDOT aus der Onboarding-Fitness-Eingabe.
// Priorität: echte Bestzeit > direkte VDOT-Schätzung > Selbsteinschätzung.

// Konservative Stufen nach Recherche (Freizeitläufer): 30–35 / 38–44 / 46–52 → 32/40/48.
const LEVEL_VDOT: Record<SelfRatedLevel, number> = {
  beginner: 32,
  intermediate: 40,
  advanced: 48,
};

/** Konservativer Default, falls gar keine Angabe vorliegt. */
export const DEFAULT_VDOT = 40;

export function vdotFromFitness(fitness: FitnessInput): number {
  if (fitness.recentRace) {
    const eq = gradeAdjustedDistance(
      fitness.recentRace.distanceMeters,
      fitness.recentRace.ascentMeters ?? 0,
    );
    return vdotFromRace(eq, fitness.recentRace.timeSeconds);
  }
  if (typeof fitness.estimatedVdot === 'number') {
    return fitness.estimatedVdot;
  }
  if (fitness.selfRatedLevel) {
    return LEVEL_VDOT[fitness.selfRatedLevel];
  }
  return DEFAULT_VDOT;
}
