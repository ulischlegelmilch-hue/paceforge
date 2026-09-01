import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../src/raceguide/geo';
import { progressFrameFor } from '../src/raceguide/progressFrame';
import { fuelingPlan, MIN_DURATION_FOR_FUELING_S } from '../src/raceguide/fueling';
import { buildAnnouncementSchedule } from '../src/raceguide/schedule';

describe('haversineMeters', () => {
  it('gibt 0 für identische Punkte', () => {
    expect(haversineMeters({ latitude: 50, longitude: 10 }, { latitude: 50, longitude: 10 })).toBe(0);
  });
  it('schätzt ~111km pro Breitengrad', () => {
    const d = haversineMeters({ latitude: 50, longitude: 10 }, { latitude: 51, longitude: 10 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
});

describe('progressFrameFor', () => {
  const total = 21097.5; // Halbmarathon

  it('zeigt "geschafft" vor dem Wechselpunkt', () => {
    expect(progressFrameFor(3000, total)).toEqual({ mode: 'covered', km: 3 });
  });
  it('zeigt "übrig" ab dem Wechselpunkt (50%)', () => {
    const atHalf = total * 0.5;
    const frame = progressFrameFor(atHalf, total);
    expect(frame.mode).toBe('remaining');
  });
  it('rundet Restdistanz auf', () => {
    // 15000m von 21097.5m => 6097.5m übrig => aufgerundet 7 km
    expect(progressFrameFor(15000, total)).toEqual({ mode: 'remaining', km: 7 });
  });
  it('klemmt auf [0, total]', () => {
    expect(progressFrameFor(-500, total).km).toBe(0);
    expect(progressFrameFor(total + 5000, total)).toEqual({ mode: 'remaining', km: 0 });
  });
  it('respektiert einen benutzerdefinierten switchFraction', () => {
    expect(progressFrameFor(total * 0.6, total, 0.7).mode).toBe('covered');
  });
});

describe('fuelingPlan', () => {
  it('keine Verpflegung für ein kurzes 10k (~50 Min)', () => {
    expect(fuelingPlan(10000, 50 * 60)).toEqual([]);
  });
  it('leer knapp unter der Mindestdauer', () => {
    expect(fuelingPlan(15000, MIN_DURATION_FOR_FUELING_S - 1)).toEqual([]);
  });
  it('2-3 Checkpoints für einen ~2h-Halbmarathon', () => {
    const plan = fuelingPlan(21097.5, 2 * 60 * 60);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.length).toBeLessThanOrEqual(3);
    // monoton steigend, alle innerhalb der Strecke
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.atDistanceMeters).toBeGreaterThan(plan[i - 1]!.atDistanceMeters);
    }
    for (const cp of plan) {
      expect(cp.atDistanceMeters).toBeGreaterThan(0);
      expect(cp.atDistanceMeters).toBeLessThan(21097.5);
    }
  });
});

describe('buildAnnouncementSchedule', () => {
  const total = 21097.5;
  const estimatedSeconds = 2 * 60 * 60;

  it('enthält genau einen start/halfway/finish-Slot', () => {
    const schedule = buildAnnouncementSchedule(total, estimatedSeconds);
    expect(schedule.filter((s) => s.category === 'start')).toHaveLength(1);
    expect(schedule.filter((s) => s.category === 'halfway')).toHaveLength(1);
    expect(schedule.filter((s) => s.category === 'finish')).toHaveLength(1);
  });

  it('ist nach Distanz monoton steigend sortiert', () => {
    const schedule = buildAnnouncementSchedule(total, estimatedSeconds);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i]!.atDistanceMeters).toBeGreaterThanOrEqual(schedule[i - 1]!.atDistanceMeters);
    }
  });

  it('hat eindeutige IDs', () => {
    const schedule = buildAnnouncementSchedule(total, estimatedSeconds);
    const ids = schedule.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deckt kmCovered 1..10 und kmRemaining für den Rest ab (Wechsel bei 50%)', () => {
    const schedule = buildAnnouncementSchedule(total, estimatedSeconds);
    const covered = schedule.filter((s) => s.category === 'kmCovered');
    const remaining = schedule.filter((s) => s.category === 'kmRemaining');
    expect(covered.length).toBeGreaterThan(0);
    expect(remaining.length).toBeGreaterThan(0);
    expect(Math.max(...covered.map((s) => s.atDistanceMeters))).toBeLessThan(total / 2);
    expect(Math.min(...remaining.map((s) => s.atDistanceMeters))).toBeGreaterThanOrEqual(total / 2);
  });

  it('fügt finalStretch nur für Distanzen >= 5km hinzu', () => {
    const short = buildAnnouncementSchedule(3000, 20 * 60);
    const half = buildAnnouncementSchedule(total, estimatedSeconds);
    expect(short.some((s) => s.category === 'finalStretch')).toBe(false);
    expect(half.some((s) => s.category === 'finalStretch')).toBe(true);
  });

  it('funktioniert für ein kurzes 5k ohne Fueling-Slots', () => {
    const schedule = buildAnnouncementSchedule(5000, 25 * 60);
    expect(schedule.some((s) => s.category === 'fueling')).toBe(false);
    expect(schedule[0]!.category).toBe('start');
    expect(schedule[schedule.length - 1]!.category).toBe('finish');
  });
});
