import { describe, it, expect } from 'vitest';
import { makeRace } from '../src/planner/workouts';
import { predictRaceTime } from '../src/vdot/predict';

describe('makeRace', () => {
  it('erzeugt ein Workout mit kind "race" und der vollen Zieldistanz als einzelnem Schritt', () => {
    const w = makeRace('r1', 50, 10000, 2400);
    expect(w.kind).toBe('race');
    expect(w.elements).toHaveLength(1);
    expect(w.estimatedDistanceMeters).toBe(10000);
    expect(w.estimatedDurationSeconds).toBe(2400);
  });

  it('nutzt targetTimeSeconds für die Pace, wenn angegeben', () => {
    const w = makeRace('r2', 50, 10000, 2400);
    expect(w.estimatedDurationSeconds).toBe(2400);
  });

  it('fällt ohne targetTimeSeconds auf predictRaceTime(vdot, distance) zurück', () => {
    const w = makeRace('r3', 50, 10000);
    const expected = predictRaceTime(50, 10000);
    expect(w.estimatedDurationSeconds).toBe(expected);
  });
});
