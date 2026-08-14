import type { RepeatBlock, StepDuration, StepTarget, Workout, WorkoutIntensity, WorkoutStep } from '../domain/workout';
import { isRepeatBlock } from '../domain/workout';

// Übersetzt unser geräteunabhängiges Workout-Schema in das (private, nicht offiziell
// dokumentierte) JSON-Format, das Garmin Connects workout-service-API erwartet
// (POST /workout-service/workout). Es gibt keine offizielle Doku dazu (der Zugang
// zum Garmin Connect Developer Program ist für Einzelentwickler pausiert, siehe
// CLAUDE.md) – die Feldnamen/IDs hier sind durch mehrere unabhängige, seit Jahren
// produktiv genutzte Open-Source-Projekte reverse-engineered und untereinander
// gegengeprüft:
//   - github.com/Pythe1337N/garmin-connect (TS, liefert die IWorkoutStep-Form
//     inkl. ExecutableStepDTO/RepeatGroupDTO-Wrapper, sportTypeId/stepTypeId
//     für "interval" und "repeat")
//   - github.com/mkuthan/garmin-workouts (Python, liefert dieselbe Struktur für
//     Cycling/power.zone, bestätigt endCondition/targetType-Aufbau)
// Da Garmin diese API jederzeit ändern kann, bleibt diese Datei die EINZIGE Stelle,
// an der diese Magic Numbers vorkommen – Rest der App kennt nur unser eigenes,
// stabiles Workout-Schema (siehe domain/workout.ts).

const RUNNING_SPORT_TYPE = { sportTypeId: 1, sportTypeKey: 'running' } as const;

// stepTypeId 1-7: warmup/cooldown/interval/recovery/rest/repeat/other. "interval"（3)
// und "repeat" (6) sind aus echtem Bibliotheks-Quellcode bestätigt, die übrigen
// folgen derselben (branchenweit konsistent zitierten) Reihenfolge.
const STEP_TYPE: Record<WorkoutIntensity | 'repeat', { stepTypeId: number; stepTypeKey: string }> = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  active: { stepTypeId: 3, stepTypeKey: 'interval' },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery' },
  rest: { stepTypeId: 5, stepTypeKey: 'rest' },
  repeat: { stepTypeId: 6, stepTypeKey: 'repeat' },
};

// conditionTypeId 1/2/3 = lap.button/time/distance (bestätigt).
const END_CONDITION = {
  open: { conditionTypeId: 1, conditionTypeKey: 'lap.button' },
  time: { conditionTypeId: 2, conditionTypeKey: 'time' },
  distance: { conditionTypeId: 3, conditionTypeKey: 'distance' },
};

// workoutTargetTypeId: 1 = no.target (bestätigt), 6 = pace.zone (bestätigt, Beispiel
// 8:00-8:30 min/km == 1.9607843-2.0833333 m/s). 4 = heart.rate.zone folgt derselben
// zitierten Reihenfolge (1 no.target, 2 power.zone, 3 cadence.zone, 4 heart.rate.zone,
// 5 speed.zone, 6 pace.zone), ist aber NICHT unabhängig aus echtem Quellcode belegt
// wie die anderen beiden - bei Problemen zuerst hier nachschauen.
const TARGET_TYPE = {
  none: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  heartRate: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' },
  pace: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' },
};

export interface GarminExecutableStep {
  type: 'ExecutableStepDTO';
  stepId: null;
  stepOrder: number;
  childStepId: number | null;
  description: string | null;
  stepType: { stepTypeId: number; stepTypeKey: string };
  endCondition: { conditionTypeId: number; conditionTypeKey: string };
  preferredEndConditionUnit: { unitKey: string } | null;
  endConditionValue: number | null;
  endConditionCompare: null;
  endConditionZone: null;
  targetType: { workoutTargetTypeId: number; workoutTargetTypeKey: string };
  targetValueOne: number | null;
  targetValueTwo: number | null;
  zoneNumber: null;
}

export interface GarminRepeatStep {
  type: 'RepeatGroupDTO';
  stepOrder: number;
  stepType: { stepTypeId: number; stepTypeKey: string };
  childStepId: number;
  numberOfIterations: number;
  workoutSteps: GarminExecutableStep[];
  smartRepeat: false;
}

export type GarminWorkoutStep = GarminExecutableStep | GarminRepeatStep;

export interface GarminWorkoutPayload {
  workoutId?: string;
  ownerId?: string;
  workoutName: string;
  description?: string;
  sportType: typeof RUNNING_SPORT_TYPE;
  workoutSegments: [
    {
      segmentOrder: 1;
      sportType: typeof RUNNING_SPORT_TYPE;
      workoutSteps: GarminWorkoutStep[];
    },
  ];
}

function durationFields(d: StepDuration): Pick<
  GarminExecutableStep,
  'endCondition' | 'endConditionValue' | 'preferredEndConditionUnit'
> {
  switch (d.type) {
    case 'time':
      return { endCondition: END_CONDITION.time, endConditionValue: Math.round(d.seconds), preferredEndConditionUnit: null };
    case 'distance':
      // Meter direkt (KEINE Umrechnung nötig - anders als beim FIT-Encoder, der
      // Zentimeter erwartet). preferredEndConditionUnit ist nur eine Anzeige-
      // Präferenz für Garmin Connects eigene Web-UI (km vs. Meilen).
      return {
        endCondition: END_CONDITION.distance,
        endConditionValue: Math.round(d.meters),
        preferredEndConditionUnit: { unitKey: 'kilometer' },
      };
    case 'open':
      return { endCondition: END_CONDITION.open, endConditionValue: null, preferredEndConditionUnit: null };
  }
}

function targetFields(t: StepTarget): Pick<GarminExecutableStep, 'targetType' | 'targetValueOne' | 'targetValueTwo'> {
  switch (t.type) {
    case 'pace':
      // Unser Schema speichert Pace-Ziele schon in m/s (langsam→schnell) - exakt
      // die Einheit, die Garmins pace.zone-Target erwartet. Keine Umrechnung nötig.
      return { targetType: TARGET_TYPE.pace, targetValueOne: t.lowMps, targetValueTwo: t.highMps };
    case 'heartRate':
      return { targetType: TARGET_TYPE.heartRate, targetValueOne: t.lowBpm, targetValueTwo: t.highBpm };
    case 'none':
      return { targetType: TARGET_TYPE.none, targetValueOne: null, targetValueTwo: null };
  }
}

function executableStep(step: WorkoutStep, stepOrder: number, childStepId: number | null): GarminExecutableStep {
  return {
    type: 'ExecutableStepDTO',
    stepId: null,
    stepOrder,
    childStepId,
    description: step.notes ?? null,
    stepType: STEP_TYPE[step.intensity],
    ...durationFields(step.duration),
    ...targetFields(step.target),
    endConditionCompare: null,
    endConditionZone: null,
    zoneNumber: null,
  };
}

function repeatStep(
  block: RepeatBlock,
  stepOrder: number,
  childStepId: number,
  nestedSteps: GarminExecutableStep[],
): GarminRepeatStep {
  return {
    type: 'RepeatGroupDTO',
    stepOrder,
    stepType: STEP_TYPE.repeat,
    childStepId,
    numberOfIterations: block.repeats,
    workoutSteps: nestedSteps,
    smartRepeat: false,
  };
}

/** Baut die vollständige workoutSteps-Liste inkl. korrekter stepOrder/childStepId-
 *  Zählung. Unser Domain-Modell erlaubt nur EINE Verschachtelungsebene (ein
 *  RepeatBlock enthält WorkoutStep[], keine weiteren RepeatBlocks) - das
 *  vereinfacht die Zählung gegenüber Garmins theoretisch beliebig tiefer
 *  Verschachtelung deutlich. */
function mapElements(workout: Workout): GarminWorkoutStep[] {
  const steps: GarminWorkoutStep[] = [];
  let stepOrder = 0;
  let childStepId = 0;

  for (const el of workout.elements) {
    stepOrder += 1;
    if (isRepeatBlock(el)) {
      childStepId += 1;
      const repeatOrder = stepOrder;
      const repeatChildId = childStepId;
      const nested = el.steps.map((s) => {
        stepOrder += 1;
        return executableStep(s, stepOrder, repeatChildId);
      });
      steps.push(repeatStep(el, repeatOrder, repeatChildId, nested));
    } else {
      steps.push(executableStep(el, stepOrder, null));
    }
  }
  return steps;
}

/** Übersetzt ein Workout in den JSON-Payload für POST /workout-service/workout.
 *  `description` bewusst weggelassen, wenn nicht gesetzt (Garmin ergänzt sonst
 *  nichts Sinnvolles von selbst). */
export function workoutToGarminPayload(workout: Workout): GarminWorkoutPayload {
  return {
    workoutName: workout.name,
    sportType: RUNNING_SPORT_TYPE,
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType: RUNNING_SPORT_TYPE,
        workoutSteps: mapElements(workout),
      },
    ],
  };
}
