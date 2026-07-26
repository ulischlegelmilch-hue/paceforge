import type { RaceDistance } from '../domain/athlete';

// Bewertet den gewählten Trainingsumfang (Lauftage + Krafteinheiten) gegen das
// Ziel und gibt konkrete Tipps. Evidenzbasiert: längere Ziele brauchen mehr
// Lauftage (v.a. den langen Lauf); Kraft-Sweet-Spot ist 2×/Woche (1× erhält,
// >2× bringt kaum Zusatznutzen und erhöht Interferenz/Ermüdung).

export type AdviceLevel = 'good' | 'info' | 'warn';

export interface TrainingAdvice {
  level: AdviceLevel;
  text: string;
}

export interface TrainingAssessmentInput {
  distance: RaceDistance;
  daysPerWeek: number;
  strengthPerWeek: number;
}

export interface TrainingAssessment {
  recommendedRunDays: number;
  runDaysOk: boolean;
  advice: TrainingAdvice[];
}

const MIN_RUN_DAYS: Record<RaceDistance, number> = {
  '5k': 3,
  '10k': 3,
  half: 4,
  marathon: 5,
  custom: 4,
};

const DIST_LABEL: Record<RaceDistance, string> = {
  '5k': '5 km',
  '10k': '10 km',
  half: 'einen Halbmarathon',
  marathon: 'einen Marathon',
  custom: 'dein Ziel',
};

export function recommendedRunDays(distance: RaceDistance): number {
  return MIN_RUN_DAYS[distance];
}

export function assessTraining(input: TrainingAssessmentInput): TrainingAssessment {
  const { distance, daysPerWeek, strengthPerWeek } = input;
  const min = MIN_RUN_DAYS[distance];
  const runDaysOk = daysPerWeek >= min;
  const advice: TrainingAdvice[] = [];

  // --- Lauftage ---
  if (!runDaysOk) {
    advice.push({
      level: 'warn',
      text: `Für ${DIST_LABEL[distance]} werden mindestens ${min} Lauftage/Woche empfohlen – du hast ${daysPerWeek}. Mehr Umfang (besonders der lange Lauf) bringt dich dem Ziel deutlich näher.`,
    });
  } else {
    advice.push({
      level: 'good',
      text: `${daysPerWeek} Lauftage/Woche passen gut für ${DIST_LABEL[distance]}.`,
    });
    if (daysPerWeek >= min + 2) {
      advice.push({
        level: 'info',
        text: 'Viel Umfang bringt zusätzliche Ausdauer – achte auf genug lockere Tage und Schlaf, damit du die Belastung verträgst.',
      });
    }
  }

  // --- Krafttraining ---
  if (strengthPerWeek <= 0) {
    advice.push({
      level: 'info',
      text: 'Ohne Krafttraining lässt du einen belegten Vorteil liegen: 2×/Woche verbessern die Laufökonomie (+2–8 %) und senken das Verletzungsrisiko deutlich. Schon 1× hilft.',
    });
  } else if (strengthPerWeek === 1) {
    advice.push({
      level: 'info',
      text: '1× Kraft/Woche erhält die Kraft; 2× ist der evidenzbasierte Sweet Spot für Ökonomie und Verletzungsschutz.',
    });
  } else if (strengthPerWeek === 2) {
    advice.push({ level: 'good', text: '2× Kraft/Woche ist der evidenzbasierte Sweet Spot.' });
  } else {
    advice.push({
      level: 'warn',
      text: `${strengthPerWeek}× Kraft/Woche bringt gegenüber 2× kaum Zusatznutzen und erhöht Interferenz & Ermüdung – 2× reicht meist aus.`,
    });
  }

  // --- Kombinierte Belastung / Interferenz ---
  if (daysPerWeek >= 6 && strengthPerWeek >= 2) {
    advice.push({
      level: 'info',
      text: 'Hoher Gesamtumfang (6 Lauftage + 2× Kraft): Kraft an harte Lauftage legen, lockere Tage locker halten und Erholung einplanen.',
    });
  }

  return { recommendedRunDays: min, runDaysOk, advice };
}
