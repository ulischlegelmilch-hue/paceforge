import { describe, it, expect } from 'vitest';
import {
  NUTRITION_LIBRARY,
  preRunCarb,
  postRunRecovery,
  raceWeekCarbPerDay,
  recipesForPhase,
} from '../src/nutrition/index';

describe('Guidance-Rechner', () => {
  it('preRunCarb: ~1 g/kg bei 1 h, ~3 g/kg bei 3 h Vorlauf', () => {
    expect(preRunCarb(60, 1)).toEqual({ perKg: 1, grams: 60 });
    expect(preRunCarb(60, 3)).toEqual({ perKg: 3, grams: 180 });
  });

  it('postRunRecovery: ~1,1 g/kg KH + 0,3 g/kg Protein', () => {
    expect(postRunRecovery(60)).toEqual({ carbG: 66, proteinG: 18 });
  });

  it('raceWeekCarbPerDay: voller Load nur für lange Events', () => {
    const mara = raceWeekCarbPerDay(60, 'marathon');
    expect(mara.fullLoad).toBe(true);
    expect(mara.perKgLow).toBe(10);
    expect(mara.grams).toBe(Math.round(60 * 11));

    const fivek = raceWeekCarbPerDay(60, '5k');
    expect(fivek.fullLoad).toBe(false);
    expect(fivek.perKgHigh).toBe(7);
  });
});

describe('Rezeptbibliothek', () => {
  it('jedes Rezept hat Titel und benannte Quelle', () => {
    for (const r of NUTRITION_LIBRARY) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.source.length).toBeGreaterThan(0);
    }
  });

  it('nennt Makros nur, wo die Quelle sie angibt – „Run Fast Eat Slow" ohne Makros', () => {
    const rfes = NUTRITION_LIBRARY.find((r) => r.id === 'post-cant-beet-me')!;
    expect(rfes.macros).toBeUndefined();
    expect(rfes.noMacrosByDesign).toBe(true);
  });

  it('das Eisen-Rezept beziffert Eisen', () => {
    const iron = recipesForPhase('iron')[0]!;
    expect(iron.macros?.ironMg).toBeGreaterThan(0);
  });
});
