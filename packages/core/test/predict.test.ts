import { describe, it, expect } from 'vitest';
import { vdotFromRace } from '../src/vdot/formulas';
import { predictRaceTime, predictedRaceTimes } from '../src/vdot/predict';

describe('predictRaceTime', () => {
  it('ist die Umkehrung von vdotFromRace (Round-Trip)', () => {
    for (const vdot of [40, 50, 60]) {
      for (const dist of [5000, 10000, 21097.5, 42195]) {
        const t = predictRaceTime(vdot, dist);
        expect(vdotFromRace(dist, t)).toBeCloseTo(vdot, 1);
      }
    }
  });

  it('VDOT 50 sagt ~19:57 auf 5 km voraus (Daniels-Referenz)', () => {
    const t = predictRaceTime(50, 5000);
    expect(t).toBeGreaterThan(19 * 60 + 30); // > 19:30
    expect(t).toBeLessThan(20 * 60 + 30); // < 20:30
  });

  it('höhere VDOT -> schnellere Zeit', () => {
    expect(predictRaceTime(60, 5000)).toBeLessThan(predictRaceTime(50, 5000));
  });
});

describe('predictedRaceTimes', () => {
  it('liefert alle Standard-Distanzen, aufsteigend in der Zeit', () => {
    const t = predictedRaceTimes(50);
    expect(t['5k']).toBeLessThan(t['10k']);
    expect(t['10k']).toBeLessThan(t.half);
    expect(t.half).toBeLessThan(t.marathon);
  });

  it('VDOT 50 Marathon liegt plausibel bei ~3:10 h', () => {
    const t = predictedRaceTimes(50).marathon;
    expect(t).toBeGreaterThan(3 * 3600 + 3 * 60); // > 3:03
    expect(t).toBeLessThan(3 * 3600 + 18 * 60); // < 3:18
  });
});
