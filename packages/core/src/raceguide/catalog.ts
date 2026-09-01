import raw from './announcementCatalog.json';
import type { AnnouncementCategory } from './schedule';

// Ansagen-Textkatalog - Single Source of Truth, auch vom Python-Generierungsscript
// (tools/audio-generation/generate_raceguide_lines.py) gelesen. Mehrere
// Formulierungsvarianten je Kategorie, damit sich Ansagen über einen ganzen
// Halbmarathon hinweg nicht wiederholen (siehe pickVariantIndex).

export interface AnnouncementCatalogShape {
  kmRange: { min: number; max: number };
  start: string[];
  kmCovered: string[];
  kmRemaining: string[];
  halfway: string[];
  fueling: string[];
  finalStretch: string[];
  finish: string[];
}

export const announcementCatalog = raw as AnnouncementCatalogShape;

/** Kategorien, deren Vorlagen einen {km}-Platzhalter enthalten und pro km-Wert vorgeneriert wurden. */
const KM_CATEGORIES: ReadonlySet<AnnouncementCategory> = new Set(['kmCovered', 'kmRemaining']);

export function variantsFor(category: AnnouncementCategory): string[] {
  if (category === 'start') return announcementCatalog.start;
  if (category === 'kmCovered') return announcementCatalog.kmCovered;
  if (category === 'kmRemaining') return announcementCatalog.kmRemaining;
  if (category === 'halfway') return announcementCatalog.halfway;
  if (category === 'fueling') return announcementCatalog.fueling;
  if (category === 'finalStretch') return announcementCatalog.finalStretch;
  return announcementCatalog.finish;
}

/**
 * ID, unter der der vorgenerierte Audio-Clip abgelegt ist (siehe
 * generate_raceguide_lines.py: "<category>_<km>_<variantIndex>" bzw.
 * "<category>_<variantIndex>" für Kategorien ohne km-Bezug).
 */
export function announcementAssetId(category: AnnouncementCategory, variantIndex: number, km?: number): string {
  if (KM_CATEGORIES.has(category)) {
    return `${category}_${km}_${variantIndex}`;
  }
  return `${category}_${variantIndex}`;
}

export function announcementText(category: AnnouncementCategory, variantIndex: number, km?: number): string {
  const template = variantsFor(category)[variantIndex] ?? '';
  return km !== undefined ? template.replaceAll('{km}', String(km)) : template;
}

/** Wie viele zuletzt genutzte Varianten je Kategorie ausgeschlossen werden, bevor neu gewürfelt wird. */
const REPEAT_AVOIDANCE_WINDOW = 2;

/**
 * Wählt zufällig eine Variante, vermeidet aber die zuletzt genutzten (Ring-Fenster),
 * damit sich dieselbe Formulierung nicht kurz hintereinander wiederholt - Muster aus
 * PaceForge Kids' AudioCoachManager.pickVariant. Fällt auf den vollen Pool zurück,
 * falls der Ausschluss alle Optionen leert (z. B. nur 2 Varianten insgesamt).
 */
export function pickVariantIndex(
  variantCount: number,
  recentIndices: readonly number[],
  random: () => number = Math.random,
): number {
  if (variantCount <= 1) return 0;
  const excluded = new Set(recentIndices.slice(-REPEAT_AVOIDANCE_WINDOW));
  const pool: number[] = [];
  for (let i = 0; i < variantCount; i++) {
    if (!excluded.has(i)) pool.push(i);
  }
  const candidates = pool.length > 0 ? pool : Array.from({ length: variantCount }, (_, i) => i);
  return candidates[Math.floor(random() * candidates.length)]!;
}
