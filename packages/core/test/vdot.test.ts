import { describe, it, expect } from 'vitest';
import {
  vo2ForVelocity,
  velocityForVo2,
  percentMaxForDuration,
  vdotFromRace,
} from '../src/vdot/formulas';
import { allZones, zonePaceMps, ZONE_FRACTIONS } from '../src/vdot/zones';
import { vdotFromFitness, DEFAULT_VDOT } from '../src/vdot/profile';
import { paceMpsToPerKm } from '../src/util/pace';

describe('VDOT-Formeln', () => {
  it('leitet aus 5K in 20:00 eine VDOT von ~49.8 ab', () => {
    // Referenz: Daniels-Tabelle VDOT 50 ≈ 5K 19:57, also 20:00 knapp darunter.
    const vdot = vdotFromRace(5000, 20 * 60);
    expect(vdot).toBeCloseTo(49.8, 0);
  });

  it('velocityForVo2 ist die Umkehrung von vo2ForVelocity', () => {
    for (const v of [180, 220, 260, 300]) {
      expect(velocityForVo2(vo2ForVelocity(v))).toBeCloseTo(v, 5);
    }
  });

  it('percentMaxForDuration fällt mit steigender Dauer (kürzere Rennen -> höher)', () => {
    const p5 = percentMaxForDuration(5);
    const p30 = percentMaxForDuration(30);
    const p120 = percentMaxForDuration(120);
    expect(p5).toBeGreaterThan(p30);
    expect(p30).toBeGreaterThan(p120);
    // Sehr kurze Rennen (~5 min) liegen anteilig ÜBER VO2max (anaerob gestützt),
    // daher darf p5 > 1 sein. Ab typischer VO2max-Renndauer (~15 min) ist es <= 1.
    expect(percentMaxForDuration(15)).toBeLessThanOrEqual(1);
    expect(p120).toBeLessThan(percentMaxForDuration(15));
  });

  it('schnellere Zeit über gleiche Distanz -> höhere VDOT', () => {
    const slower = vdotFromRace(5000, 25 * 60);
    const faster = vdotFromRace(5000, 20 * 60);
    expect(faster).toBeGreaterThan(slower);
  });
});

describe('Pace-Zonen', () => {
  it('sind aufsteigend schneller: easy < marathon < threshold < interval < repetition', () => {
    const z = allZones(50);
    // Vergleich am schnellen Ende (highMps) jeder Zone.
    expect(z.easy.highMps).toBeLessThan(z.marathon.highMps);
    expect(z.marathon.highMps).toBeLessThan(z.threshold.highMps);
    expect(z.threshold.highMps).toBeLessThan(z.interval.highMps);
    expect(z.interval.highMps).toBeLessThan(z.repetition.highMps);
  });

  it('lowMps ist stets langsamer als highMps innerhalb einer Zone', () => {
    const z = allZones(50);
    for (const key of Object.keys(ZONE_FRACTIONS) as (keyof typeof ZONE_FRACTIONS)[]) {
      expect(z[key].lowMps).toBeLessThan(z[key].highMps);
    }
  });

  it('höhere VDOT -> schnellere Threshold-Pace', () => {
    const slow = zonePaceMps(45, 'threshold').highMps;
    const fast = zonePaceMps(55, 'threshold').highMps;
    expect(fast).toBeGreaterThan(slow);
  });

  it('Threshold-Pace für VDOT 50 liegt plausibel bei ~4:16/km', () => {
    // Sanity-Check gegen grobe Erwartung (T ~15–20 s/km langsamer als 5K-Pace).
    const t = zonePaceMps(50, 'threshold').highMps;
    const secPerKm = 1000 / t;
    expect(secPerKm).toBeGreaterThan(240); // schneller als 4:00 wäre unrealistisch
    expect(secPerKm).toBeLessThan(290);    // langsamer als 4:50 ebenso
    expect(paceMpsToPerKm(t)).toMatch(/^4:\d{2}$/);
  });
});

describe('vdotFromFitness', () => {
  it('nutzt bevorzugt die Bestzeit', () => {
    const v = vdotFromFitness({
      recentRace: { distanceMeters: 5000, timeSeconds: 20 * 60 },
      estimatedVdot: 30,
      selfRatedLevel: 'beginner',
    });
    expect(v).toBeCloseTo(49.8, 0);
  });

  it('fällt auf estimatedVdot zurück, wenn keine Bestzeit da ist', () => {
    expect(vdotFromFitness({ estimatedVdot: 42, selfRatedLevel: 'advanced' })).toBe(42);
  });

  it('nutzt sonst die Selbsteinschätzung', () => {
    expect(vdotFromFitness({ selfRatedLevel: 'intermediate' })).toBe(40);
  });

  it('liefert einen konservativen Default ohne jede Angabe', () => {
    expect(vdotFromFitness({})).toBe(DEFAULT_VDOT);
  });
});
