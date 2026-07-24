import type { RaceDistance } from '../domain/athlete';

// Regelbasierter Parser für natürlichsprachliche Zieleingaben (deutsch), z. B.
// „10k unter 45 Minuten in 12 Wochen, 4x pro Woche". Extrahiert strukturierte
// Werte, die das Onboarding vorbefüllen. KEIN LLM: deterministisch + testbar.
//
// Phase 2: An dieser Stelle ließe sich alternativ ein LLM-Aufruf einhängen, der
// freien Text robuster in dasselbe ParsedGoal übersetzt – die Trainingslogik
// (VDOT/Plan) bleibt davon unberührt regelbasiert.

export interface ParsedGoal {
  distance?: RaceDistance;
  targetTimeSeconds?: number;
  weeks?: number;
  daysPerWeek?: number;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseTime(text: string, distance?: RaceDistance): number | undefined {
  // hh:mm:ss
  let m = text.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return +m[1]! * 3600 + +m[2]! * 60 + +m[3]!;

  // „X Stunden Y (Minuten)" / „Xh YY"
  m = text.match(/(\d{1,2})\s*(?:std\.?|stunden?|h)\s*(?:und\s*)?(\d{1,2})?/);
  if (m) return +m[1]! * 3600 + (m[2] ? +m[2] * 60 : 0);

  // „X:YY" – bei langen Distanzen als Stunden:Minuten, sonst Minuten:Sekunden.
  m = text.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const a = +m[1]!;
    const b = +m[2]!;
    return distance === 'marathon' || distance === 'half' ? a * 3600 + b * 60 : a * 60 + b;
  }

  // „(unter/sub/in) X Minuten"
  m = text.match(/(?:unter|sub|in)?\s*(\d{1,3})\s*(?:minuten?|min)\b/);
  if (m) return +m[1]! * 60;

  return undefined;
}

export function parseGoalText(input: string): ParsedGoal {
  const text = input.toLowerCase();
  const result: ParsedGoal = {};

  // Distanz – Halbmarathon VOR Marathon prüfen.
  if (/halbmarathon|halbe?\s*marathon|halbmara|\bhm\b|21[.,]?1?\s*km|\b21k\b/.test(text)) {
    result.distance = 'half';
  } else if (/marathon|42[.,]?2?\s*km|\b42k\b/.test(text)) {
    result.distance = 'marathon';
  } else if (/\b10\s*km?\b|zehn\s*kilometer/.test(text)) {
    result.distance = '10k';
  } else if (/\b5\s*km?\b|fünf\s*kilometer/.test(text)) {
    result.distance = '5k';
  }

  const t = parseTime(text, result.distance);
  if (t !== undefined) result.targetTimeSeconds = t;

  const weeks = text.match(/(\d{1,2})\s*wochen?/);
  if (weeks) result.weeks = clampInt(+weeks[1]!, 4, 52);

  const days =
    text.match(/(\d)\s*(?:mal|x|tage?|trainingstage?)\b[^.]*?woche/) ||
    text.match(/(\d)\s*trainingstage?/);
  if (days) result.daysPerWeek = clampInt(+days[1]!, 3, 6);

  return result;
}
