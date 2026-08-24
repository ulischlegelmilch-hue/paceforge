import type { CompletedActivity } from '../domain/activity';
import type { AdviceLevel } from './index';

// Detraining-Hinweis (Recherche Teil 2, v2). Kernbefund: VO2max/Ausdauer fallen
// messbar nach ~10–14 Tagen ohne Reiz; für den Erhalt zählen ≥3 Läufe/Woche und
// die Qualitätseinheit. Der Hinweis stützt sich NUR auf geloggte Laufdaten (Datum)
// und meldet sich nur, wenn überhaupt eine Historie existiert — sonst würden
// Nutzer:innen ohne Import fälschlich gewarnt.

export interface DetrainingAssessment {
  level: AdviceLevel;
  text: string;
  /** Läufe in den letzten 7 bzw. 14 Tagen (für Anzeige/Tests). */
  runsLast7: number;
  runsLast14: number;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Tage seit dem letzten geloggten Lauf (gebrochen, nicht gerundet). `null` ohne jede
 * Historie. Auch von adaptation/returnToRunning.ts genutzt, damit der Gap nicht
 * zweimal unterschiedlich berechnet wird.
 */
export function daysSinceLastRun(activities: CompletedActivity[], referenceDate: Date = new Date()): number | null {
  if (activities.length === 0) return null;
  const ref = referenceDate.getTime();
  const since = activities
    .map((a) => (ref - new Date(a.startTime).getTime()) / DAY_MS)
    .filter((d) => d >= 0);
  return since.length > 0 ? Math.min(...since) : null;
}

/**
 * Bewertet das Detraining-Risiko aus den zuletzt geloggten Aktivitäten.
 * Gibt `null` zurück, wenn keine Historie vorliegt oder alles im grünen Bereich ist.
 */
export function assessDetraining(
  activities: CompletedActivity[],
  referenceDate: Date = new Date(),
): DetrainingAssessment | null {
  if (activities.length === 0) return null;

  const ref = referenceDate.getTime();
  const daysSince = (iso: string): number => (ref - new Date(iso).getTime()) / DAY_MS;

  const since = activities.map((a) => daysSince(a.startTime)).filter((d) => d >= 0);
  const runsLast7 = since.filter((d) => d <= 7).length;
  const runsLast14 = since.filter((d) => d <= 14).length;
  const daysSinceLast = since.length > 0 ? Math.min(...since) : Infinity;

  // Länger als ~14 Tage keine Einheit: Form baut messbar ab.
  if (daysSinceLast > 14) {
    return {
      level: 'warn',
      text: `Seit ${Math.round(daysSinceLast)} Tagen kein Lauf geloggt. VO₂max und Ausdauer fallen ohne Reiz messbar ab (~10–14 Tage). Ein lockerer Lauf plus eine Qualitätseinheit holen dich zurück.`,
      runsLast7,
      runsLast14,
    };
  }
  // 10–14 Tage Pause: früher Hinweis.
  if (daysSinceLast > 10) {
    return {
      level: 'warn',
      text: `Seit ${Math.round(daysSinceLast)} Tagen kein Lauf. Ab ~10–14 Tagen ohne Training beginnt der VO₂max-Abbau — plane bald wieder eine Einheit ein.`,
      runsLast7,
      runsLast14,
    };
  }
  // Zu geringe Frequenz (< ~3 Läufe/Woche im 14-Tage-Schnitt).
  if (runsLast14 < 6) {
    return {
      level: 'info',
      text: `Zuletzt ${runsLast14} Läufe in 14 Tagen (< 3/Woche). Für den Formerhalt sind ≥ 3 Läufe/Woche mit einer Qualitätseinheit die Untergrenze.`,
      runsLast7,
      runsLast14,
    };
  }
  return null;
}
