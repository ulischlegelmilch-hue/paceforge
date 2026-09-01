import {
  announcementAssetId,
  announcementText,
  pickVariantIndex,
  variantsFor,
  type AnnouncementCategory,
} from '@paceforge/core';

import type { QueuedAnnouncement } from './audioQueue';

// Wählt pro Kategorie eine Textvariante mit Wiederholungs-Vermeidung (siehe
// pickVariantIndex in packages/core) - hält den Zustand der "zuletzt genutzten
// Varianten" pro Kategorie für die Dauer eines Guide-Laufs.

const RECENT_HISTORY_LENGTH = 4;
const recentByCategory = new Map<AnnouncementCategory, number[]>();

export function resetPhraseResolver(): void {
  recentByCategory.clear();
}

export function resolveAnnouncement(category: AnnouncementCategory, km?: number): QueuedAnnouncement {
  const variantCount = variantsFor(category).length;
  const recent = recentByCategory.get(category) ?? [];
  const variantIndex = pickVariantIndex(variantCount, recent);
  recentByCategory.set(category, [...recent, variantIndex].slice(-RECENT_HISTORY_LENGTH));

  return {
    id: announcementAssetId(category, variantIndex, km),
    text: announcementText(category, variantIndex, km),
  };
}
