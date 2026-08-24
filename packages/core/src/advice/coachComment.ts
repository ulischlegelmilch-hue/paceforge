import type { CompletedActivity } from '../domain/activity';
import type { Assessment, WorkoutComparison } from '../adaptation/adapt';
import type { FreeRunClassification } from '../adaptation/classifyFreeRun';
import type { WeeklyAnalysis } from '../adaptation/weeklyAnalysis';

// Regelbasierte Trainer-Formulierung (KEIN LLM, wie die übrige Kernlogik) -
// wandelt die bereits vorhandenen strukturierten Auswertungen (compareWorkout/
// classifyFreeRun/weeklyAnalysis) in einen kurzen, im Trainer-Ton geschriebenen
// Absatz mit konkretem Tipp um. Ergänzt die Zahlen-Auswertung, ersetzt sie nicht.

export interface ActivityCoachContext {
  comparison?: WorkoutComparison;
  freeZone?: FreeRunClassification;
  /** Sekunden/km Unterschied zwischen schnellster und langsamster Runde, falls Rundendaten vorhanden. */
  paceSpreadSeconds?: number;
}

const ASSESSMENT_LINES: Record<Assessment, string[]> = {
  'on-target': ['Sauber im Ziel-Tempo gelaufen – genau das, was diese Einheit bringen sollte.'],
  faster: [
    'Deutlich schneller als angesetzt – ein gutes Zeichen für deine aktuelle Form.',
    'Achte trotzdem darauf, lockere Einheiten wirklich locker zu halten, sonst fehlt am Renntag die Frische.',
  ],
  slower: [
    'Etwas langsamer als geplant – kann Tagesform, Wetter oder Nachwirkungen der letzten Tage sein, bei einem einzelnen Lauf kein Grund zur Sorge.',
    'Häuft sich das über mehrere Einheiten, wäre ein zusätzlicher Ruhetag sinnvoller als mehr Druck.',
  ],
  incomplete: [
    'Nicht ganz bis zum Ende durchgezogen – lieber einmal kürzer treten als sich zu verletzen.',
    'Wenn das öfter passiert, reden wir über weniger Umfang statt über mehr Willenskraft.',
  ],
};

const FREE_ZONE_LINES: Record<FreeRunClassification['zone'], string> = {
  'below-easy': 'Ein sehr ruhiger, eigenständiger Lauf – wirkt wie aktive Erholung und zählt genauso als Trainingsreiz.',
  easy: 'Ein lockerer, eigenständiger Lauf – genau solche Einheiten bauen still und leise die aerobe Grundlage aus.',
  marathon: 'Zügiges Tempo für einen freien Lauf – zähl das ruhig als kleine Qualitätseinheit, nicht nur als Kilometer.',
  threshold: 'Ordentliches Tempo für einen freien Lauf – das war eher eine Schwellen- als eine lockere Einheit.',
  interval: 'Richtig hartes Tempo für einen freien Lauf – starker Reiz, aber achte in den nächsten Tagen auf genug Erholung.',
  repetition:
    'Sehr hartes Tempo für einen freien Lauf – ein kurzer, intensiver Reiz. Plane danach bewusst einen lockeren Tag ein.',
  'above-repetition':
    'Extrem hohes Tempo für einen freien Lauf – falls das kein Wettkampf war, im Zweifel etwas vorsichtiger angehen.',
};

/** Kurzer, im Trainer-Ton formulierter Kommentar zu EINER Aktivität, mit Tipp. */
export function coachCommentForActivity(activity: CompletedActivity, ctx: ActivityCoachContext): string {
  const sentences: string[] = [];

  if (ctx.comparison) {
    sentences.push(...ASSESSMENT_LINES[ctx.comparison.assessment]);
  } else if (ctx.freeZone) {
    sentences.push(FREE_ZONE_LINES[ctx.freeZone.zone]);
  } else {
    const km = (activity.totalDistanceMeters / 1000).toFixed(1).replace(/\.0$/, '');
    sentences.push(`${km} km im Kasten.`);
  }

  if (ctx.paceSpreadSeconds != null && ctx.paceSpreadSeconds > 30) {
    sentences.push(
      `Die Pace ist zwischen den Runden ziemlich gesprungen (${ctx.paceSpreadSeconds} Sek/km Unterschied) – ein gleichmäßigeres Tempo würde dir gegen Ende mehr Kraft lassen.`,
    );
  }
  if (activity.totalAscentMeters && activity.totalAscentMeters > 100) {
    sentences.push('Mit den Höhenmetern war das mehr Belastung, als die reine Distanz zeigt – gute Arbeit.');
  }

  return sentences.join(' ');
}

/** Kurzer, im Trainer-Ton formulierter Rückblick auf EINE Woche, mit Tipp. */
export function coachCommentForWeek(analysis: WeeklyAnalysis): string {
  const { plannedRunCount, completedRunCount, extraActivities, assessmentCounts, plannedDistanceMeters, actualDistanceMeters } =
    analysis;

  if (plannedRunCount === 0 && extraActivities.length === 0) {
    return 'Eine trainingsfreie Woche. Falls das eine bewusste Pause war, gut so – falls nicht, versuch nächste Woche wieder etwas regelmäßiger dranzubleiben.';
  }

  const sentences: string[] = [];
  const adherence = plannedRunCount > 0 ? completedRunCount / plannedRunCount : 1;
  if (plannedRunCount === 0) {
    sentences.push('Kein fester Plan für diese Woche, aber trotzdem gelaufen – das zählt.');
  } else if (adherence >= 1) {
    sentences.push('Plan komplett abgearbeitet – sauber.');
  } else if (adherence >= 0.66) {
    sentences.push('Den Großteil des Plans geschafft, ein bisschen ist liegengeblieben.');
  } else {
    sentences.push('Diese Woche ist einiges vom Plan liegengeblieben.');
  }

  if (extraActivities.length > 0) {
    const n = extraActivities.length;
    sentences.push(`Dazu ${n} eigene${n === 1 ? 'r' : ''} Lauf${n === 1 ? '' : 'e'} obendrauf – zählt genauso als Trainingsreiz.`);
  }

  const harderThanPlanned = assessmentCounts.faster;
  const softerThanPlanned = assessmentCounts.slower + assessmentCounts.incomplete;
  if (harderThanPlanned >= 2) {
    sentences.push('Mehrere Läufe liefen schneller als angesetzt – deine Form zieht gerade an.');
  } else if (softerThanPlanned >= 2) {
    sentences.push('Ein paar Läufe liefen zäher als geplant – schau auf Schlaf und Erholung, bevor du das Tempo forcierst.');
  }

  const volumeRatio = plannedDistanceMeters > 0 ? actualDistanceMeters / plannedDistanceMeters : 1;
  if (plannedRunCount > 0 && volumeRatio < 0.7) {
    sentences.push('Beim Umfang ist noch Luft nach oben, bevor die nächste Belastungssteigerung ansteht.');
  }

  return sentences.join(' ');
}
