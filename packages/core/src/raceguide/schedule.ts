import { fuelingPlan } from './fueling';
import { DEFAULT_SWITCH_FRACTION } from './progressFrame';

// Baut den vollständigen Ansagen-Zeitplan für einen begleiteten Wettkampf-Lauf:
// eine sortierte Liste von "Slots", jeder an einer Distanz-Marke ausgelöst.
// Jede km-Ansage trägt Distanz UND Motivation zugleich (siehe announcementCatalog.json -
// mehrere Textvorlagen je Kategorie), daher braucht es kein separates
// Motivations-Raster: das hält die Ansagen-Dichte auf ~1 pro Kilometer statt
// unnötig oft.

export type AnnouncementCategory =
  | 'start'
  | 'kmCovered'
  | 'kmRemaining'
  | 'halfway'
  | 'fueling'
  | 'finalStretch'
  | 'finish';

export interface AnnouncementSlot {
  id: string;
  category: AnnouncementCategory;
  atDistanceMeters: number;
  /** Nur für kmCovered/kmRemaining: der anzusagende Kilometerwert. */
  km?: number;
}

/** Ab dieser Gesamtdistanz gibt es zusätzliche, verdichtete Ansagen auf der Schlussgeraden. */
const FINAL_STRETCH_MIN_TOTAL_M = 5000;
/** Restdistanz-Marken (Meter bis zum Ziel) für die Schlussgeraden-Verdichtung. */
const FINAL_STRETCH_REMAINING_M = [1000, 300];
/** Mindestabstand, den ein Verpflegungs-Hinweis zu einer anderen Ansage einhalten muss. */
const FUELING_COLLISION_GUARD_M = 150;

export function buildAnnouncementSchedule(
  totalMeters: number,
  estimatedTotalSeconds: number,
  switchFraction: number = DEFAULT_SWITCH_FRACTION,
): AnnouncementSlot[] {
  const slots: AnnouncementSlot[] = [{ id: 'start', category: 'start', atDistanceMeters: 0 }];

  const switchMeters = totalMeters * switchFraction;
  const totalKm = Math.floor(totalMeters / 1000);
  for (let km = 1; km <= totalKm; km++) {
    const atDistanceMeters = km * 1000;
    if (atDistanceMeters >= totalMeters) continue;
    if (atDistanceMeters < switchMeters) {
      slots.push({ id: `kmCovered-${km}`, category: 'kmCovered', atDistanceMeters, km });
    } else {
      const remainingKm = Math.ceil((totalMeters - atDistanceMeters) / 1000);
      slots.push({ id: `kmRemaining-${km}`, category: 'kmRemaining', atDistanceMeters, km: remainingKm });
    }
  }

  slots.push({ id: 'halfway', category: 'halfway', atDistanceMeters: totalMeters / 2 });

  if (totalMeters >= FINAL_STRETCH_MIN_TOTAL_M) {
    for (const remaining of FINAL_STRETCH_REMAINING_M) {
      const atDistanceMeters = totalMeters - remaining;
      if (atDistanceMeters > 0) {
        slots.push({ id: `finalStretch-${remaining}`, category: 'finalStretch', atDistanceMeters });
      }
    }
  }

  fuelingPlan(totalMeters, estimatedTotalSeconds).forEach((checkpoint, i) => {
    const atDistanceMeters = nudgeAwayFromCollisions(checkpoint.atDistanceMeters, slots);
    slots.push({ id: `fueling-${i}`, category: 'fueling', atDistanceMeters });
  });

  slots.push({ id: 'finish', category: 'finish', atDistanceMeters: totalMeters });

  return slots.sort((a, b) => a.atDistanceMeters - b.atDistanceMeters);
}

function nudgeAwayFromCollisions(atDistanceMeters: number, existing: AnnouncementSlot[]): number {
  let at = atDistanceMeters;
  while (existing.some((s) => Math.abs(s.atDistanceMeters - at) < FUELING_COLLISION_GUARD_M)) {
    at += FUELING_COLLISION_GUARD_M;
  }
  return at;
}
