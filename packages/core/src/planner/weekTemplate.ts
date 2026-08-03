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
