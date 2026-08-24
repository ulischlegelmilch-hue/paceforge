import { allZones, type ZoneKey } from '../vdot/zones';
import { predictRaceTime } from '../vdot/predict';
import type {
  StepTarget,
  Workout,
  WorkoutElement,
  WorkoutKind,
  WorkoutStep,
} from '../domain/workout';
import { isRepeatBlock } from '../domain/workout';

// Workout-Bausteine. Jeder Baustein erzeugt ein geräteunabhängiges Workout mit
// konkreten Pace-Targets (m/s) aus den VDOT-Zonen. Warmup/Cooldown laufen locker.

const WARMUP_COOLDOWN_SECONDS = 10 * 60; // je 10 min locker

function paceTarget(vdot: number, zone: ZoneKey): StepTarget {
  const z = allZones(vdot)[zone];
  return { type: 'pace', lowMps: z.lowMps, highMps: z.highMps };
}

function midMps(t: StepTarget): number {
  return t.type === 'pace' ? (t.lowMps + t.highMps) / 2 : 0;
}

/** Grobschätzung Distanz/Dauer eines Schritts (für Wochenvolumen & Anzeige). */
function stepEstimate(step: WorkoutStep): { meters: number; seconds: number } {
  const paceMps = midMps(step.target);
  if (step.duration.type === 'distance') {
    const meters = step.duration.meters;
    return { meters, seconds: paceMps > 0 ? meters / paceMps : 0 };
  }
  if (step.duration.type === 'time') {
    const seconds = step.duration.seconds;
    return { meters: paceMps * seconds, seconds };
  }
  return { meters: 0, seconds: 0 }; // 'open'
}

function estimate(elements: WorkoutElement[]): { meters: number; seconds: number } {
  let meters = 0;
  let seconds = 0;
  for (const el of elements) {
    if (isRepeatBlock(el)) {
      for (const s of el.steps) {
        const e = stepEstimate(s);
        meters += e.meters * el.repeats;
        seconds += e.seconds * el.repeats;
      }
    } else {
      const e = stepEstimate(el);
      meters += e.meters;
      seconds += e.seconds;
    }
  }
  return { meters: Math.round(meters), seconds: Math.round(seconds) };
}

function warmup(vdot: number): WorkoutStep {
  return { intensity: 'warmup', duration: { type: 'time', seconds: WARMUP_COOLDOWN_SECONDS }, target: paceTarget(vdot, 'easy') };
}
function cooldown(vdot: number): WorkoutStep {
  return { intensity: 'cooldown', duration: { type: 'time', seconds: WARMUP_COOLDOWN_SECONDS }, target: paceTarget(vdot, 'easy') };
}

function finalize(id: string, kind: WorkoutKind, name: string, elements: WorkoutElement[]): Workout {
  const e = estimate(elements);
  return { id, kind, name, elements, estimatedDistanceMeters: e.meters, estimatedDurationSeconds: e.seconds };
}

// ---- öffentliche Bausteine --------------------------------------------------

export function makeEasyRun(id: string, vdot: number, meters: number): Workout {
  const step: WorkoutStep = { intensity: 'active', duration: { type: 'distance', meters }, target: paceTarget(vdot, 'easy') };
  return finalize(id, 'easy', `Lockerer Dauerlauf ${Math.round(meters / 100) / 10} km`, [step]);
}

export function makeRecovery(id: string, vdot: number, meters: number): Workout {
  const step: WorkoutStep = { intensity: 'recovery', duration: { type: 'distance', meters }, target: paceTarget(vdot, 'easy') };
  return finalize(id, 'recovery', `Regenerationslauf ${Math.round(meters / 100) / 10} km`, [step]);
}

export function makeLongRun(id: string, vdot: number, meters: number): Workout {
  const step: WorkoutStep = { intensity: 'active', duration: { type: 'distance', meters }, target: paceTarget(vdot, 'easy') };
  return finalize(id, 'long', `Long Run ${Math.round(meters / 100) / 10} km`, [step]);
}

export function makeTempo(id: string, vdot: number, thresholdMinutes: number): Workout {
  const els: WorkoutElement[] = [
    warmup(vdot),
    { intensity: 'active', duration: { type: 'time', seconds: thresholdMinutes * 60 }, target: paceTarget(vdot, 'threshold') },
    cooldown(vdot),
  ];
  return finalize(id, 'tempo', `Tempolauf ${thresholdMinutes} min an der Schwelle`, els);
}

export function makeIntervals(
  id: string,
  vdot: number,
  reps: number,
  repMeters: number,
  recoveryMeters: number,
): Workout {
  const work: WorkoutStep = { intensity: 'active', duration: { type: 'distance', meters: repMeters }, target: paceTarget(vdot, 'interval') };
  const jog: WorkoutStep = { intensity: 'recovery', duration: { type: 'distance', meters: recoveryMeters }, target: paceTarget(vdot, 'easy') };
  const els: WorkoutElement[] = [warmup(vdot), { repeats: reps, steps: [work, jog] }, cooldown(vdot)];
  return finalize(id, 'interval', `Intervalle ${reps}×${repMeters} m`, els);
}

export function makeRepetitions(
  id: string,
  vdot: number,
  reps: number,
  repMeters: number,
  recoveryMeters: number,
): Workout {
  const work: WorkoutStep = { intensity: 'active', duration: { type: 'distance', meters: repMeters }, target: paceTarget(vdot, 'repetition') };
  const jog: WorkoutStep = { intensity: 'recovery', duration: { type: 'distance', meters: recoveryMeters }, target: paceTarget(vdot, 'easy') };
  const els: WorkoutElement[] = [warmup(vdot), { repeats: reps, steps: [work, jog] }, cooldown(vdot)];
  return finalize(id, 'repetition', `Wiederholungen ${reps}×${repMeters} m`, els);
}

/**
 * Wettkampf-Workout (Zwischenevent, siehe planner/events.ts): ein einzelner Schritt
 * über die volle Distanz im Zieltempo. Ohne `targetTimeSeconds` wird die Renn-Pace
 * aus der aktuellen VDOT geschätzt (predictRaceTime) - dieselbe Umkehrfunktion, die
 * auch die "Geschätzte Wettkampfzeiten"-Karte in der App speist.
 */
export function makeRace(id: string, vdot: number, distanceMeters: number, targetTimeSeconds?: number): Workout {
  const seconds = targetTimeSeconds ?? predictRaceTime(vdot, distanceMeters);
  const paceMps = seconds > 0 ? distanceMeters / seconds : 0;
  const step: WorkoutStep = {
    intensity: 'active',
    duration: { type: 'distance', meters: distanceMeters },
    target: { type: 'pace', lowMps: paceMps * 0.98, highMps: paceMps * 1.02 },
  };
  return finalize(id, 'race', `Wettkampf ${Math.round(distanceMeters / 100) / 10} km`, [step]);
}

export function makeRest(id: string): Workout {
  return { id, kind: 'rest', name: 'Ruhetag', elements: [], estimatedDistanceMeters: 0, estimatedDurationSeconds: 0 };
}
