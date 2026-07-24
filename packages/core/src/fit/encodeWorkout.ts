import { Encoder, Profile, type Mesg } from '@garmin/fitsdk';
import type { StepDuration, StepTarget, Workout, WorkoutStep } from '../domain/workout';
import { isRepeatBlock } from '../domain/workout';

// FIT-Workout-Encoder: internes, geräteunabhängiges Workout-Schema -> valide
// FIT-Workout-Datei (file_id + workout + workout_step Messages).
//
// Wichtig: Der FIT-Encoder liest nur die HAUPTFELDER (Subfelder wie duration_time
// werden ignoriert, laut SDK-README). Wir schreiben daher die Hauptfelder direkt
// mit dem Rohwert, den das FIT-Profil erwartet (vor-skaliert).

const M = Profile.MesgNum;
const MESG_FILE_ID = M.FILE_ID as number;
const MESG_WORKOUT = M.WORKOUT as number;
const MESG_WORKOUT_STEP = M.WORKOUT_STEP as number;

const SPEED_SCALE = 1000; // m/s -> mm/s (custom_target_speed)
const TIME_SCALE = 1000; //  s  -> ms  (duration_time)
const DIST_SCALE = 100; //   m  -> cm  (duration_distance)
const HR_BPM_OFFSET = 100; // FIT custom-HR: Wert > 100 => absolute bpm

type Fields = Record<string, unknown>;

function durationFields(d: StepDuration): Fields {
  switch (d.type) {
    case 'time':
      return { durationType: 'time', durationValue: Math.round(d.seconds * TIME_SCALE) };
    case 'distance':
      return { durationType: 'distance', durationValue: Math.round(d.meters * DIST_SCALE) };
    case 'open':
      return { durationType: 'open' };
  }
}

function targetFields(t: StepTarget): Fields {
  switch (t.type) {
    case 'pace':
      return {
        targetType: 'speed',
        targetValue: 0, // 0 = benutzerdefiniertes Ziel (custom low/high)
        customTargetValueLow: Math.round(t.lowMps * SPEED_SCALE),
        customTargetValueHigh: Math.round(t.highMps * SPEED_SCALE),
      };
    case 'heartRate':
      return {
        targetType: 'heartRate',
        targetValue: 0,
        customTargetValueLow: t.lowBpm + HR_BPM_OFFSET,
        customTargetValueHigh: t.highBpm + HR_BPM_OFFSET,
      };
    case 'none':
      return { targetType: 'open', targetValue: 0 };
  }
}

function stepFields(s: WorkoutStep): Fields {
  return { intensity: s.intensity, ...durationFields(s.duration), ...targetFields(s.target) };
}

/** Linearisiert die Workout-Elemente zu FIT-workout_step-Feldern inkl. Repeat-Steps. */
export function workoutToStepFields(workout: Workout): Fields[] {
  const steps: Fields[] = [];
  let index = 0;
  const push = (fields: Fields) => {
    steps.push({ messageIndex: index, ...fields });
    index++;
  };
  for (const el of workout.elements) {
    if (isRepeatBlock(el)) {
      const loopStart = index;
      for (const s of el.steps) push(stepFields(s));
      // Repeat-Step: springt zu loopStart zurück und wiederholt el.repeats-mal.
      push({
        durationType: 'repeatUntilStepsCmplt',
        durationValue: loopStart,
        targetType: 'open',
        targetValue: el.repeats,
      });
    } else {
      push(stepFields(el));
    }
  }
  return steps;
}

/** Kodiert ein Workout als valide FIT-Workout-Datei. */
export function encodeWorkoutToFit(workout: Workout, opts: { timeCreated?: Date } = {}): Uint8Array {
  const encoder = new Encoder();
  const write = (mesgNum: number, fields: Fields) => encoder.onMesg(mesgNum, fields as unknown as Mesg);

  write(MESG_FILE_ID, {
    type: 'workout',
    manufacturer: 'development',
    product: 0,
    timeCreated: opts.timeCreated ?? new Date(),
    serialNumber: 0,
  });

  const stepList = workoutToStepFields(workout);

  write(MESG_WORKOUT, {
    sport: 'running',
    numValidSteps: stepList.length,
    wktName: workout.name,
  });

  for (const sf of stepList) write(MESG_WORKOUT_STEP, sf);

  return encoder.close();
}
