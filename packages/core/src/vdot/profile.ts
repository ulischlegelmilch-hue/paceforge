import type { FitnessInput, SelfRatedLevel } from '../domain/athlete';
import { vdotFromRace } from './formulas';

// Ableitung der Start-VDOT aus der Onboarding-Fitness-Eingabe.
// Priorität: echte Bestzeit > direkte VDOT-Schätzung > Selbsteinschätzung.

const LEVEL_VDOT: Record<SelfRatedLevel, number> = {
  beginner: 32,
  intermediate: 42,
  advanced: 50,
};

/** Konservativer Default, falls gar keine Angabe vorliegt. */
export const DEFAULT_VDOT = 40;

export function vdotFromFitness(fitness: FitnessInput): number {
  if (fitness.recentRace) {
    return vdotFromRace(fitness.recentRace.distanceMeters, fitness.recentRace.timeSeconds);
  }
  if (typeof fitness.estimatedVdot === 'number') {
    return fitness.estimatedVdot;
  }
  if (fitness.selfRatedLevel) {
    return LEVEL_VDOT[fitness.selfRatedLevel];
  }
  return DEFAULT_VDOT;
}
