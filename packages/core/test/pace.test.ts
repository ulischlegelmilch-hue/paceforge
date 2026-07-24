import { describe, it, expect } from 'vitest';
import { paceMpsToPerKm, paceMpsToPerMile, formatSeconds, perKmToMps } from '../src/util/pace';

describe('Pace-Formatierung', () => {
  it('formatiert m/s als m:ss pro km', () => {
    expect(paceMpsToPerKm(1000 / 300)).toBe('5:00'); // 300 s/km
    expect(paceMpsToPerKm(1000 / 256)).toBe('4:16');
  });

  it('gibt bei ungültiger Pace einen Platzhalter zurück', () => {
    expect(paceMpsToPerKm(0)).toBe('--:--');
    expect(paceMpsToPerKm(-1)).toBe('--:--');
    expect(paceMpsToPerKm(NaN)).toBe('--:--');
  });

  it('rundet Sekunden korrekt mit Überlauf', () => {
    expect(formatSeconds(59.6)).toBe('1:00');
    expect(formatSeconds(125)).toBe('2:05');
  });

  it('rechnet Meilen-Pace langsamer als km-Pace bei gleicher Geschwindigkeit', () => {
    const mps = 1000 / 300;
    const km = 1000 / mps;
    const mile = 1609.344 / mps;
    expect(mile).toBeGreaterThan(km);
    expect(paceMpsToPerMile(mps)).toBe(formatSeconds(mile));
  });

  it('perKmToMps ist konsistent zur Rückformatierung', () => {
    const mps = perKmToMps(4, 30); // 4:30/km
    expect(paceMpsToPerKm(mps)).toBe('4:30');
  });
});
