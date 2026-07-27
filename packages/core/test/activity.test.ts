import { describe, it, expect } from 'vitest';
import { Encoder, Profile, type Mesg } from '@garmin/fitsdk';
import { decodeActivity } from '../src/fit/decodeActivity';

const MN = Profile.MesgNum as Record<string, number>;
const START = new Date('2026-01-06T07:00:00.000Z');

type Fields = Record<string, unknown>;

/** Baut eine synthetische FIT-Activity (file_id + optional session + laps). */
function encodeActivity(opts: { withSession: boolean }): Uint8Array {
  const enc = new Encoder();
  const w = (mesgNum: number, f: Fields) => enc.onMesg(mesgNum, f as unknown as Mesg);

  w(MN.FILE_ID!, { type: 'activity', manufacturer: 'development', product: 0, timeCreated: START });
  w(MN.LAP!, {
    messageIndex: 0, startTime: START, totalTimerTime: 900, totalElapsedTime: 900,
    totalDistance: 3000, avgSpeed: 3000 / 900, avgHeartRate: 145,
  });
  w(MN.LAP!, {
    messageIndex: 1, startTime: new Date(START.getTime() + 900_000), totalTimerTime: 900,
    totalElapsedTime: 900, totalDistance: 3000, avgSpeed: 3000 / 900, avgHeartRate: 155,
  });
  if (opts.withSession) {
    w(MN.SESSION!, {
      messageIndex: 0, startTime: START, sport: 'running', totalTimerTime: 1800,
      totalElapsedTime: 1800, totalDistance: 6000, avgSpeed: 6000 / 1800, avgHeartRate: 150,
    });
  }
  return enc.close();
}

/** Baut eine FIT-Activity mit Höhenprofil-Records (flach hoch, dann flach). */
function encodeWithHills(opts: { flat: boolean }): Uint8Array {
  const enc = new Encoder();
  const w = (mesgNum: number, f: Fields) => enc.onMesg(mesgNum, f as unknown as Mesg);
  w(MN.FILE_ID!, { type: 'activity', manufacturer: 'development', product: 0, timeCreated: START });
  // 20 Records à 100 m = 2000 m. Bei !flat: 500 m Anstieg auf +50 m, Rest eben.
  let alt = 100;
  for (let i = 0; i <= 20; i++) {
    const distance = i * 100;
    if (!opts.flat && i >= 5 && i < 10) alt += 10; // +10 m je 100 m = 10 % Steigung, 500 m lang
    w(MN.RECORD!, {
      timestamp: new Date(START.getTime() + i * 30_000),
      distance,
      altitude: alt,
    });
  }
  w(MN.SESSION!, {
    messageIndex: 0, startTime: START, sport: 'running', totalTimerTime: 600,
    totalElapsedTime: 600, totalDistance: 2000, avgSpeed: 2000 / 600,
    totalAscent: opts.flat ? 0 : 50,
  });
  return enc.close();
}

describe('decodeActivity', () => {
  it('liest Distanz, Zeit, Pace, HR und Laps aus der Session', () => {
    const a = decodeActivity(encodeActivity({ withSession: true }), { id: 'a1' });
    expect(a.id).toBe('a1');
    expect(a.source).toBe('fit-import');
    expect(a.totalDistanceMeters).toBe(6000);
    expect(a.totalDurationSeconds).toBe(1800);
    expect(a.avgPaceMps).toBeCloseTo(6000 / 1800, 2);
    expect(a.avgHeartRate).toBe(150);
    expect(a.startTime).toBe('2026-01-06T07:00:00.000Z');
    expect(a.laps).toHaveLength(2);
    expect(a.laps?.[0]?.distanceMeters).toBe(3000);
    expect(a.laps?.[1]?.avgHeartRate).toBe(155);
  });

  it('aggregiert aus Laps, wenn keine Session vorhanden ist', () => {
    const a = decodeActivity(encodeActivity({ withSession: false }));
    expect(a.totalDistanceMeters).toBe(6000); // 2×3000
    expect(a.totalDurationSeconds).toBe(1800); // 2×900
    expect(a.avgPaceMps).toBeCloseTo(6000 / 1800, 2);
  });

  it('wirft bei Nicht-FIT-Daten', () => {
    expect(() => decodeActivity(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });

  it('rechnet die flach-äquivalente Distanz per-Segment aus dem Höhenprofil', () => {
    const hilly = decodeActivity(encodeWithHills({ flat: false }));
    expect(hilly.totalDistanceMeters).toBe(2000);
    // 500 m mit +10 % kosten deutlich mehr -> flach-äquivalent klar über 2000 m.
    expect(hilly.gradeAdjustedDistanceMeters).toBeGreaterThan(2000);
    expect(hilly.gradeAdjustedDistanceMeters).toBeLessThan(2400);
  });

  it('setzt bei ebenem Profil kein nennenswertes Grade-Adjustment', () => {
    const flat = decodeActivity(encodeWithHills({ flat: true }));
    expect(flat.gradeAdjustedDistanceMeters).toBeGreaterThanOrEqual(1990);
    expect(flat.gradeAdjustedDistanceMeters).toBeLessThanOrEqual(2010);
  });

  it('lässt gradeAdjustedDistanceMeters ohne Höhen-Records offen', () => {
    const a = decodeActivity(encodeActivity({ withSession: true }));
    expect(a.gradeAdjustedDistanceMeters).toBeUndefined();
  });
});
