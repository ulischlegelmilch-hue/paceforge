// Geräteunabhängiges Workout-Schema. Am FIT-workout_step-Modell orientiert
// (duration_type / target_type / intensity / repeats), aber bewusst Garmin-agnostisch,
// damit später auch andere Wearables bedient werden können.

export type WorkoutIntensity = 'warmup' | 'active' | 'recovery' | 'rest' | 'cooldown';

export type StepDuration =
  | { type: 'time'; seconds: number }
  | { type: 'distance'; meters: number }
  | { type: 'open' };                 // Schritt endet per Lap-Tastendruck

export type StepTarget =
  | { type: 'pace'; lowMps: number; highMps: number }        // intern m/s (langsam→schnell)
  | { type: 'heartRate'; lowBpm: number; highBpm: number }
  | { type: 'none' };

export interface WorkoutStep {
  intensity: WorkoutIntensity;
  duration: StepDuration;
  target: StepTarget;
  notes?: string;
}

/** Ein N-fach wiederholter Block (z.B. 5× (1000m schnell + 400m Trab)). */
export interface RepeatBlock {
  repeats: number;
  steps: WorkoutStep[];
}

export type WorkoutElement = WorkoutStep | RepeatBlock;

export function isRepeatBlock(el: WorkoutElement): el is RepeatBlock {
  return (el as RepeatBlock).repeats !== undefined;
}

export type WorkoutKind =
  | 'easy' | 'long' | 'tempo' | 'interval' | 'repetition' | 'recovery' | 'rest' | 'race';

export interface Workout {
  id: string;
  kind: WorkoutKind;
  name: string;                       // z.B. "Intervalle 5×1000m"
  elements: WorkoutElement[];         // leer = Ruhetag
  estimatedDistanceMeters?: number;
  estimatedDurationSeconds?: number;
}
