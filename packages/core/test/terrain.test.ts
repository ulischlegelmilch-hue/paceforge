import { describe, it, expect } from 'vitest';
import { terrainAdvice, TERRAIN_LABEL, TERRAIN_RANGE_LABEL, type CourseTerrain } from '../src/advice/terrain';

const ALL: CourseTerrain[] = ['flat', 'rolling', 'moderate', 'hilly'];

describe('terrain', () => {
  it('liefert für jede Kategorie ein Label, eine Bereichsangabe und einen Hinweis', () => {
    for (const t of ALL) {
      expect(TERRAIN_LABEL[t].length).toBeGreaterThan(0);
      expect(TERRAIN_RANGE_LABEL[t].length).toBeGreaterThan(0);
      expect(terrainAdvice(t).length).toBeGreaterThan(0);
    }
  });

  it('bergig empfiehlt gezieltes Bergtraining, flach explizit nicht', () => {
    expect(terrainAdvice('hilly')).toMatch(/integriere.*Bergtraining/i);
    expect(terrainAdvice('flat')).toMatch(/kein gezieltes Bergtraining/);
  });
});
