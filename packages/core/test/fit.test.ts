import { describe, it, expect } from 'vitest';
import { Decoder, Stream } from '@garmin/fitsdk';
import { encodeWorkoutToFit, workoutToStepFields } from '../src/fit/encodeWorkout';
import { makeEasyRun, makeIntervals, makeTempo } from '../src/planner/workouts';
import { allZones } from '../src/vdot/zones';

const CREATED = new Date('2026-01-01T00:00:00Z');

function decode(bytes: Uint8Array) {
  const stream = Stream.fromByteArray(bytes);
  expect(Decoder.isFIT(stream)).toBe(true);
  const { messages, errors } = new Decoder(stream).read();
  expect(errors).toEqual([]);
  return messages;
}

describe('FIT-Workout-Encoder', () => {
  it('erzeugt eine gültige FIT-Workout-Datei (Header + CRC intakt)', () => {
    const bytes = encodeWorkoutToFit(makeEasyRun('e', 50, 8000), { timeCreated: CREATED });
    const stream = Stream.fromByteArray(bytes);
    expect(Decoder.isFIT(stream)).toBe(true);
    expect(new Decoder(stream).checkIntegrity()).toBe(true);

    const m = decode(bytes);
    expect(m.fileIdMesgs?.[0]?.type).toBe('workout');
    expect(m.workoutMesgs?.[0]?.sport).toBe('running');
    expect(m.workoutMesgs?.[0]?.wktName).toBe('Lockerer Dauerlauf 8 km');
  });

  it('numValidSteps stimmt mit der Anzahl workout_step-Messages überein', () => {
    const w = makeIntervals('i', 50, 5, 1000, 400);
    const m = decode(encodeWorkoutToFit(w, { timeCreated: CREATED }));
    expect(m.workoutMesgs?.[0]?.numValidSteps).toBe(m.workoutStepMesgs?.length);
    expect(m.workoutStepMesgs).toHaveLength(5); // warmup, work, jog, repeat, cooldown
  });

  it('Tempolauf: warmup(time) -> Schwelle(time) -> cooldown(time) mit passenden Pace-Zielen', () => {
    const m = decode(encodeWorkoutToFit(makeTempo('t', 50, 20), { timeCreated: CREATED }));
    const steps = m.workoutStepMesgs!;
    expect(steps.map((s) => s.intensity)).toEqual(['warmup', 'active', 'cooldown']);
    expect(steps.map((s) => s.durationType)).toEqual(['time', 'time', 'time']);
    // Schwellenschritt: 20 min, Threshold-Zone
    const threshold = steps[1]!;
    expect(threshold.durationTime).toBe(20 * 60);
    const zone = allZones(50).threshold;
    expect(threshold.customTargetSpeedLow).toBeCloseTo(zone.lowMps, 2);
    expect(threshold.customTargetSpeedHigh).toBeCloseTo(zone.highMps, 2);
  });

  it('Intervalle: Repeat-Step springt korrekt zurück und wiederholt N-mal', () => {
    const m = decode(encodeWorkoutToFit(makeIntervals('i', 50, 5, 1000, 400), { timeCreated: CREATED }));
    const steps = m.workoutStepMesgs!;

    const work = steps[1]!;
    expect(work.durationType).toBe('distance');
    expect(work.durationDistance).toBe(1000);
    const iZone = allZones(50).interval;
    expect(work.customTargetSpeedLow).toBeCloseTo(iZone.lowMps, 2);
    expect(work.customTargetSpeedHigh).toBeCloseTo(iZone.highMps, 2);

    const repeat = steps[3]!;
    expect(repeat.durationType).toBe('repeatUntilStepsCmplt');
    expect(repeat.durationStep).toBe(1); // zurück zum Arbeitsintervall (messageIndex 1)
    expect(repeat.repeatSteps).toBe(5);
  });

  it('Pace-Targets überstehen den Round-Trip (m/s, Skalierung 1000)', () => {
    const m = decode(encodeWorkoutToFit(makeEasyRun('e', 48, 6000), { timeCreated: CREATED }));
    const easy = m.workoutStepMesgs![0]!;
    const zone = allZones(48).easy;
    expect(easy.targetType).toBe('speed');
    expect(easy.customTargetSpeedLow).toBeCloseTo(zone.lowMps, 3);
    expect(easy.customTargetSpeedHigh).toBeCloseTo(zone.highMps, 3);
  });

  it('workoutToStepFields linearisiert Repeat-Bloecke korrekt', () => {
    expect(workoutToStepFields(makeIntervals('i', 50, 6, 800, 200))).toHaveLength(5);
    expect(workoutToStepFields(makeEasyRun('e', 50, 8000))).toHaveLength(1);
  });
});
