import { describe, it, expect } from 'vitest';
import { workoutToGarminPayload, type GarminExecutableStep, type GarminRepeatStep } from '../src/garmin/workoutMapper';
import { makeEasyRun, makeIntervals, makeRest } from '../src/planner/workouts';
import type { Workout } from '../src/domain/workout';
import { allZones } from '../src/vdot/zones';

describe('workoutToGarminPayload', () => {
  it('setzt sportType auf running (sportTypeId 1) auf Workout- und Segment-Ebene', () => {
    const payload = workoutToGarminPayload(makeEasyRun('e', 50, 8000));
    expect(payload.sportType).toEqual({ sportTypeId: 1, sportTypeKey: 'running' });
    expect(payload.workoutSegments[0].sportType).toEqual({ sportTypeId: 1, sportTypeKey: 'running' });
    expect(payload.workoutSegments[0].segmentOrder).toBe(1);
  });

  it('übernimmt den Workout-Namen unverändert', () => {
    const payload = workoutToGarminPayload(makeEasyRun('e', 50, 8000));
    expect(payload.workoutName).toBe('Lockerer Dauerlauf 8 km');
  });

  it('ein einzelner Distanz-Schritt: stepType interval, endCondition distance in Metern (unskaliert)', () => {
    const payload = workoutToGarminPayload(makeEasyRun('e', 50, 8000));
    const steps = payload.workoutSegments[0].workoutSteps;
    expect(steps).toHaveLength(1);
    const step = steps[0] as GarminExecutableStep;
    expect(step.type).toBe('ExecutableStepDTO');
    expect(step.stepOrder).toBe(1);
    expect(step.childStepId).toBeNull();
    expect(step.stepType).toEqual({ stepTypeId: 3, stepTypeKey: 'interval' });
    expect(step.endCondition).toEqual({ conditionTypeId: 3, conditionTypeKey: 'distance' });
    expect(step.endConditionValue).toBe(8000); // Meter, NICHT Zentimeter (anders als FIT-Encoder)
    expect(step.preferredEndConditionUnit).toEqual({ unitKey: 'kilometer' });
  });

  it('Pace-Ziel wird 1:1 in m/s übernommen (targetType pace.zone, id 6)', () => {
    const vdot = 50;
    const payload = workoutToGarminPayload(makeEasyRun('e', vdot, 8000));
    const step = payload.workoutSegments[0].workoutSteps[0] as GarminExecutableStep;
    const easyZone = allZones(vdot).easy;
    expect(step.targetType).toEqual({ workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' });
    expect(step.targetValueOne).toBeCloseTo(easyZone.lowMps, 6);
    expect(step.targetValueTwo).toBeCloseTo(easyZone.highMps, 6);
  });

  it('Ruhetag (keine Elemente) ergibt eine leere workoutSteps-Liste', () => {
    const payload = workoutToGarminPayload(makeRest('r'));
    expect(payload.workoutSegments[0].workoutSteps).toEqual([]);
  });

  it('Intervall-Workout: korrekte stepOrder-Zählung + childStepId-Gruppierung über den Repeat-Block', () => {
    // warmup(1) + repeat(2: work(3)+recovery(4)) + cooldown(5)
    const payload = workoutToGarminPayload(makeIntervals('i', 50, 5, 1000, 400));
    const steps = payload.workoutSegments[0].workoutSteps;
    expect(steps).toHaveLength(3); // warmup, repeat-gruppe, cooldown (top-level)

    const warmupStep = steps[0] as GarminExecutableStep;
    expect(warmupStep.stepOrder).toBe(1);
    expect(warmupStep.childStepId).toBeNull();
    expect(warmupStep.stepType).toEqual({ stepTypeId: 1, stepTypeKey: 'warmup' });

    const repeatStep = steps[1] as GarminRepeatStep;
    expect(repeatStep.type).toBe('RepeatGroupDTO');
    expect(repeatStep.stepOrder).toBe(2);
    expect(repeatStep.stepType).toEqual({ stepTypeId: 6, stepTypeKey: 'repeat' });
    expect(repeatStep.childStepId).toBe(1);
    expect(repeatStep.numberOfIterations).toBe(5);
    expect(repeatStep.smartRepeat).toBe(false);
    expect(repeatStep.workoutSteps).toHaveLength(2);

    const work = repeatStep.workoutSteps[0]!;
    const recovery = repeatStep.workoutSteps[1]!;
    expect(work.stepOrder).toBe(3);
    expect(work.childStepId).toBe(1); // gehört zur Repeat-Gruppe 1
    expect(work.stepType).toEqual({ stepTypeId: 3, stepTypeKey: 'interval' });
    expect(recovery.stepOrder).toBe(4);
    expect(recovery.childStepId).toBe(1);
    expect(recovery.stepType).toEqual({ stepTypeId: 4, stepTypeKey: 'recovery' });

    const cooldownStep = steps[2] as GarminExecutableStep;
    expect(cooldownStep.stepOrder).toBe(5);
    expect(cooldownStep.childStepId).toBeNull();
    expect(cooldownStep.stepType).toEqual({ stepTypeId: 2, stepTypeKey: 'cooldown' });
  });

  it('zwei aufeinanderfolgende Repeat-Blöcke bekommen unterschiedliche childStepId', () => {
    const workout: Workout = {
      id: 'w',
      kind: 'interval',
      name: 'Doppelblock',
      elements: [
        { repeats: 3, steps: [{ intensity: 'active', duration: { type: 'distance', meters: 400 }, target: { type: 'none' } }] },
        { repeats: 2, steps: [{ intensity: 'active', duration: { type: 'distance', meters: 200 }, target: { type: 'none' } }] },
      ],
    };
    const payload = workoutToGarminPayload(workout);
    const steps = payload.workoutSegments[0].workoutSteps as GarminRepeatStep[];
    const first = steps[0]!;
    const second = steps[1]!;
    expect(first.childStepId).toBe(1);
    expect(second.childStepId).toBe(2);
    expect(first.stepOrder).toBe(1);
    expect(second.stepOrder).toBe(3); // 1 (repeat) + 1 (nested step) + 1
  });

  it('Zeit-Dauer: endCondition time, Wert in Sekunden (unskaliert), kein preferredEndConditionUnit', () => {
    const workout: Workout = {
      id: 'w',
      kind: 'tempo',
      name: 'Zeitschritt',
      elements: [{ intensity: 'active', duration: { type: 'time', seconds: 1800 }, target: { type: 'none' } }],
    };
    const step = workoutToGarminPayload(workout).workoutSegments[0].workoutSteps[0] as GarminExecutableStep;
    expect(step.endCondition).toEqual({ conditionTypeId: 2, conditionTypeKey: 'time' });
    expect(step.endConditionValue).toBe(1800);
    expect(step.preferredEndConditionUnit).toBeNull();
  });

  it('offene Dauer (Lap-Taste): endCondition lap.button, kein endConditionValue', () => {
    const workout: Workout = {
      id: 'w',
      kind: 'easy',
      name: 'Offener Schritt',
      elements: [{ intensity: 'active', duration: { type: 'open' }, target: { type: 'none' } }],
    };
    const step = workoutToGarminPayload(workout).workoutSegments[0].workoutSteps[0] as GarminExecutableStep;
    expect(step.endCondition).toEqual({ conditionTypeId: 1, conditionTypeKey: 'lap.button' });
    expect(step.endConditionValue).toBeNull();
  });

  it('Herzfrequenz-Ziel: targetType heart.rate.zone mit bpm-Werten unverändert', () => {
    const workout: Workout = {
      id: 'w',
      kind: 'easy',
      name: 'HF-Schritt',
      elements: [
        {
          intensity: 'active',
          duration: { type: 'time', seconds: 600 },
          target: { type: 'heartRate', lowBpm: 130, highBpm: 150 },
        },
      ],
    };
    const step = workoutToGarminPayload(workout).workoutSegments[0].workoutSteps[0] as GarminExecutableStep;
    expect(step.targetType).toEqual({ workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' });
    expect(step.targetValueOne).toBe(130);
    expect(step.targetValueTwo).toBe(150);
  });

  it('kein Ziel: targetType no.target, targetValueOne/Two null', () => {
    const workout: Workout = {
      id: 'w',
      kind: 'easy',
      name: 'Ohne Ziel',
      elements: [{ intensity: 'active', duration: { type: 'open' }, target: { type: 'none' } }],
    };
    const step = workoutToGarminPayload(workout).workoutSegments[0].workoutSteps[0] as GarminExecutableStep;
    expect(step.targetType).toEqual({ workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' });
    expect(step.targetValueOne).toBeNull();
    expect(step.targetValueTwo).toBeNull();
  });

  it('Notizen landen unverändert im description-Feld, sonst null', () => {
    const withNotes: Workout = {
      id: 'w',
      kind: 'easy',
      name: 'Mit Notiz',
      elements: [{ intensity: 'active', duration: { type: 'open' }, target: { type: 'none' }, notes: 'Locker starten' }],
    };
    const withoutNotes: Workout = {
      id: 'w2',
      kind: 'easy',
      name: 'Ohne Notiz',
      elements: [{ intensity: 'active', duration: { type: 'open' }, target: { type: 'none' } }],
    };
    expect((workoutToGarminPayload(withNotes).workoutSegments[0].workoutSteps[0] as GarminExecutableStep).description).toBe(
      'Locker starten',
    );
    expect(
      (workoutToGarminPayload(withoutNotes).workoutSegments[0].workoutSteps[0] as GarminExecutableStep).description,
    ).toBeNull();
  });
});
