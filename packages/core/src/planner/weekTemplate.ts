// Verschiebt ein Wochen-Slot-Template (generatePlan/maintenance) auf einen
// gewünschten Wochenstart-Tag. Anker ist der erste im Template deklarierte
// Slot (in beiden Templates konsistent der "erste Lauf der Woche", z. B.
// Dienstag) – alle Slots werden um denselben Betrag verschoben, sodass die
// gesamte Tagesverteilung (nicht nur der Long Run) beweglich bleibt.

export function shiftSlotsToWeekStart<T extends { dayOfWeek: number }>(
  slots: readonly T[],
  weekStartDay: number | undefined,
): T[] {
  if (weekStartDay === undefined || slots.length === 0) return slots.map((s) => ({ ...s }));
  const anchor = slots[0]!.dayOfWeek;
  const delta = ((weekStartDay - anchor) % 7 + 7) % 7;
  return slots.map((s) => ({ ...s, dayOfWeek: (s.dayOfWeek + delta) % 7 }));
}

/**
 * Verteilt eine Rollen-Reihenfolge (z. B. aus einem der festen Templates
 * extrahiert: [quality1, quality2, long, recovery]) auf eine Menge vom Nutzer
 * grundsätzlich verfügbarer Wochentage. Die Tage werden gleichmäßig aus der
 * verfügbaren Menge ausgewählt (Index-Spreizung über die sortierte Menge),
 * die Rollen behalten ihre ursprüngliche Reihenfolge/Priorität. Gibt es
 * weniger verfügbare Tage als Rollen, werden die HINTEREN (in den Templates
 * am wenigsten kritischen) Rollen weggelassen.
 */
export function placeRolesOnAvailableDays<R>(
  roles: readonly R[],
  availableDays: readonly number[],
): { dayOfWeek: number; role: R }[] {
  const avail = Array.from(new Set(availableDays)).sort((a, b) => a - b);
  if (avail.length === 0 || roles.length === 0) return [];
  const n = Math.min(roles.length, avail.length);
  const picked: number[] = [];
  for (let i = 0; i < n; i++) {
    picked.push(avail[Math.floor((i * avail.length) / n)]!);
  }
  return roles.slice(0, n).map((role, i) => ({ dayOfWeek: picked[i]!, role }));
}
