import { describe, it, expect } from 'vitest';
import { assessTraining, recommendedRunDays } from '../src/advice/index';

describe('recommendedRunDays', () => {
  it('empfiehlt mehr Lauftage für längere Ziele', () => {
    expect(recommendedRunDays('5k')).toBeLessThan(recommendedRunDays('marathon'));
    expect(recommendedRunDays('marathon')).toBe(5);
  });
});

describe('assessTraining – Lauftage', () => {
  it('warnt, wenn zu wenige Lauftage fürs Ziel', () => {
    const a = assessTraining({ distance: 'marathon', daysPerWeek: 3, strengthPerWeek: 2 });
    expect(a.runDaysOk).toBe(false);
    expect(a.recommendedRunDays).toBe(5);
    expect(a.advice.some((x) => x.level === 'warn')).toBe(true);
  });
  it('bestätigt ausreichende Lauftage', () => {
    const a = assessTraining({ distance: '5k', daysPerWeek: 3, strengthPerWeek: 2 });
    expect(a.runDaysOk).toBe(true);
    expect(a.advice.some((x) => x.level === 'good')).toBe(true);
  });
});

describe('assessTraining – Kraft', () => {
  it('info bei 0×, good bei 2×, warn bei >2×', () => {
    const none = assessTraining({ distance: '10k', daysPerWeek: 4, strengthPerWeek: 0 });
    expect(none.advice.some((x) => x.text.includes('Ohne Krafttraining'))).toBe(true);

    const two = assessTraining({ distance: '10k', daysPerWeek: 4, strengthPerWeek: 2 });
    expect(two.advice.some((x) => x.level === 'good' && x.text.includes('Sweet Spot'))).toBe(true);

    const three = assessTraining({ distance: '10k', daysPerWeek: 4, strengthPerWeek: 3 });
    expect(three.advice.some((x) => x.level === 'warn')).toBe(true);
  });

  it('weist bei hohem Gesamtumfang auf Erholung hin', () => {
    const a = assessTraining({ distance: 'marathon', daysPerWeek: 6, strengthPerWeek: 2 });
    expect(a.advice.some((x) => x.text.includes('Gesamtumfang'))).toBe(true);
  });
});
