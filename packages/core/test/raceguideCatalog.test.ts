import { describe, it, expect } from 'vitest';
import {
  announcementCatalog,
  announcementAssetId,
  announcementText,
  pickVariantIndex,
  variantsFor,
} from '../src/raceguide/catalog';

describe('announcementCatalog', () => {
  it('deckt km 1..21 ab und hat für jede Kategorie mindestens 2 Varianten', () => {
    expect(announcementCatalog.kmRange).toEqual({ min: 1, max: 21 });
    for (const category of ['start', 'kmCovered', 'kmRemaining', 'halfway', 'fueling', 'finalStretch', 'finish'] as const) {
      expect(variantsFor(category).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('announcementAssetId', () => {
  it('hängt km bei kmCovered/kmRemaining an', () => {
    expect(announcementAssetId('kmCovered', 0, 5)).toBe('kmCovered_5_0');
    expect(announcementAssetId('kmRemaining', 2, 11)).toBe('kmRemaining_11_2');
  });
  it('lässt km bei anderen Kategorien weg', () => {
    expect(announcementAssetId('finish', 1)).toBe('finish_1');
    expect(announcementAssetId('start', 0)).toBe('start_0');
  });
});

describe('announcementText', () => {
  it('ersetzt {km} in kmCovered/kmRemaining', () => {
    const text = announcementText('kmCovered', 0, 7);
    expect(text).toContain('7');
    expect(text).not.toContain('{km}');
  });
  it('funktioniert ohne km für andere Kategorien', () => {
    const text = announcementText('finish', 0);
    expect(text.length).toBeGreaterThan(0);
  });
});

describe('pickVariantIndex', () => {
  it('gibt 0 zurück bei nur einer Variante', () => {
    expect(pickVariantIndex(1, [])).toBe(0);
  });
  it('vermeidet die zuletzt genutzten Indizes (Fenster 2)', () => {
    // 4 Varianten, zuletzt 0 und 1 genutzt -> darf nur 2 oder 3 liefern
    for (let i = 0; i < 20; i++) {
      const picked = pickVariantIndex(4, [0, 1], () => i / 20);
      expect([2, 3]).toContain(picked);
    }
  });
  it('fällt auf den vollen Pool zurück, wenn der Ausschluss alles leert', () => {
    // nur 2 Varianten, beide "kürzlich benutzt" -> Ausschluss wäre leer, Fallback auf [0,1]
    const picked = pickVariantIndex(2, [0, 1], () => 0.9);
    expect([0, 1]).toContain(picked);
  });
});
