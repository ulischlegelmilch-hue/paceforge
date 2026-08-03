import { describe, it, expect } from 'vitest';
import { placeRolesOnAvailableDays, shiftSlotsToWeekStart } from '../src/planner/weekTemplate';

describe('shiftSlotsToWeekStart', () => {
  const slots = [
    { dayOfWeek: 2, role: 'quality1' },
    { dayOfWeek: 4, role: 'quality2' },
    { dayOfWeek: 6, role: 'long' },
    { dayOfWeek: 0, role: 'recovery' },
  ];

  it('ohne weekStartDay unverändert (aber neue Objekte)', () => {
    const out = shiftSlotsToWeekStart(slots, undefined);
    expect(out).toEqual(slots);
    expect(out[0]).not.toBe(slots[0]);
  });

  it('verschiebt alle Tage um denselben Delta relativ zum ersten Slot', () => {
    const out = shiftSlotsToWeekStart(slots, 4); // Anker war 2 (Di) -> Delta +2
    expect(out.map((s) => s.dayOfWeek)).toEqual([4, 6, 1, 2]);
    // Rollen bleiben unverändert zugeordnet
    expect(out.map((s) => s.role)).toEqual(['quality1', 'quality2', 'long', 'recovery']);
  });

  it('weekStartDay gleich Anker -> keine Änderung', () => {
    const out = shiftSlotsToWeekStart(slots, 2);
    expect(out.map((s) => s.dayOfWeek)).toEqual([2, 4, 6, 0]);
  });
});

describe('placeRolesOnAvailableDays', () => {
  it('verteilt Rollen gleichmäßig auf die sortierte verfügbare Menge', () => {
    const out = placeRolesOnAvailableDays(['q1', 'q2', 'long', 'recovery'], [5, 1, 0, 3]);
    expect(out.map((s) => s.dayOfWeek)).toEqual([0, 1, 3, 5]);
    expect(out.map((s) => s.role)).toEqual(['q1', 'q2', 'long', 'recovery']);
  });

  it('mehr verfügbare Tage als Rollen -> nutzt nur eine gleichmäßige Auswahl', () => {
    const out = placeRolesOnAvailableDays(['q1', 'long'], [0, 1, 2, 3, 4, 5, 6]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((s) => s.dayOfWeek)).size).toBe(2);
  });

  it('weniger verfügbare Tage als Rollen -> kürzt von hinten', () => {
    const out = placeRolesOnAvailableDays(['q1', 'q2', 'long', 'recovery'], [1, 4]);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.role)).toEqual(['q1', 'q2']);
    expect(out.map((s) => s.dayOfWeek)).toEqual([1, 4]);
  });

  it('leere Eingaben -> leeres Ergebnis', () => {
    expect(placeRolesOnAvailableDays([], [1, 2, 3])).toEqual([]);
    expect(placeRolesOnAvailableDays(['q1'], [])).toEqual([]);
  });

  it('Dopplungen in availableDays werden ignoriert', () => {
    const out = placeRolesOnAvailableDays(['a', 'b'], [3, 3, 5]);
    expect(out.map((s) => s.dayOfWeek)).toEqual([3, 5]);
  });
});
