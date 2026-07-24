import { describe, it, expect } from 'vitest';
import { parseGoalText } from '../src/nlp/parseGoal';

describe('parseGoalText', () => {
  it('parst Distanz, Zielzeit, Wochen und Trainingstage aus einem Satz', () => {
    const g = parseGoalText('Ich will einen 10k unter 45 Minuten laufen in 12 Wochen, 4x pro Woche');
    expect(g.distance).toBe('10k');
    expect(g.targetTimeSeconds).toBe(45 * 60);
    expect(g.weeks).toBe(12);
    expect(g.daysPerWeek).toBe(4);
  });

  it('erkennt Halbmarathon vor Marathon und liest Stunden:Minuten', () => {
    const g = parseGoalText('Halbmarathon in 1:45');
    expect(g.distance).toBe('half');
    expect(g.targetTimeSeconds).toBe(1 * 3600 + 45 * 60);
  });

  it('liest Marathon mit hh:mm:ss', () => {
    const g = parseGoalText('Mein Ziel: Marathon in 3:30:00');
    expect(g.distance).toBe('marathon');
    expect(g.targetTimeSeconds).toBe(3 * 3600 + 30 * 60);
  });

  it('interpretiert m:ss bei kurzen Distanzen als Minuten:Sekunden', () => {
    const g = parseGoalText('5 km in 22:30');
    expect(g.distance).toBe('5k');
    expect(g.targetTimeSeconds).toBe(22 * 60 + 30);
  });

  it('versteht „sub" und Minuten-Angaben', () => {
    const g = parseGoalText('sub 50 min auf 10 km');
    expect(g.distance).toBe('10k');
    expect(g.targetTimeSeconds).toBe(50 * 60);
  });

  it('gibt nur Gefundenes zurück', () => {
    const g = parseGoalText('einfach fitter werden');
    expect(g.distance).toBeUndefined();
    expect(g.targetTimeSeconds).toBeUndefined();
    expect(g.weeks).toBeUndefined();
  });

  it('parst Stunden-Minuten-Schreibweise', () => {
    const g = parseGoalText('Marathon unter 4 Stunden 15');
    expect(g.distance).toBe('marathon');
    expect(g.targetTimeSeconds).toBe(4 * 3600 + 15 * 60);
  });
});
