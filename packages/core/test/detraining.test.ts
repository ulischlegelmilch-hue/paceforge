import { describe, it, expect } from 'vitest';
import type { CompletedActivity } from '../src/domain/activity';
import { assessDetraining } from '../src/advice/detraining';

const REF = new Date('2026-07-27T12:00:00.000Z');

function run(daysAgo: number, id = `a${daysAgo}`): CompletedActivity {
  const t = new Date(REF.getTime() - daysAgo * 24 * 3600 * 1000);
  return {
    id,
    source: 'fit-import',
    startTime: t.toISOString(),
    totalDistanceMeters: 8000,
    totalDurationSeconds: 2400,
    avgPaceMps: 8000 / 2400,
  };
}

describe('assessDetraining', () => {
  it('gibt null ohne jede Historie zurück (kein Fehlalarm)', () => {
    expect(assessDetraining([], REF)).toBeNull();
  });

  it('gibt null bei gesunder Frequenz (≥3/Woche) zurück', () => {
    const acts = [run(1), run(3), run(5), run(8), run(10), run(12)];
    expect(assessDetraining(acts, REF)).toBeNull();
  });

  it('warnt bei >14 Tagen ohne Lauf', () => {
    const res = assessDetraining([run(20), run(25)], REF);
    expect(res?.level).toBe('warn');
    expect(res?.text).toMatch(/kein Lauf/i);
  });

  it('warnt bei 10–14 Tagen Pause', () => {
    const res = assessDetraining([run(12), run(18)], REF);
    expect(res?.level).toBe('warn');
    expect(res?.runsLast7).toBe(0);
  });

  it('gibt einen info-Hinweis bei zu geringer Frequenz (<6 in 14 Tagen)', () => {
    const acts = [run(2), run(6), run(11)];
    const res = assessDetraining(acts, REF);
    expect(res?.level).toBe('info');
    expect(res?.runsLast14).toBe(3);
  });

  it('ignoriert Aktivitäten in der Zukunft', () => {
    const acts = [run(-3), run(1), run(3), run(5), run(7), run(9), run(11)];
    // 6 gültige Läufe (1..11) in 14 Tagen -> ok; der Zukunfts-Lauf zählt nicht.
    expect(assessDetraining(acts, REF)).toBeNull();
  });
});
