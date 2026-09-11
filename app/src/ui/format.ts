import {
  paceMpsToPerKm,
  type Assessment,
  type FuelingSummary,
  type PlanPhase,
  type StepDuration,
  type StepTarget,
  type WorkoutIntensity,
  type WorkoutKind,
} from '@paceforge/core';

/** Vorbereitungs-Hinweis fürs Detail eines langen Laufs/Wettkampfs, VOR dem Start. */
export function fuelingPrepText(summary: FuelingSummary): string {
  const times = summary.count === 1 ? '1×' : `${summary.count}×`;
  return `Nimm Flüssigkeit und Gels mit – bei dieser Länge ist ca. alle ${summary.intervalMinutes} Min eine Verpflegungspause sinnvoll (${times} insgesamt).`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.0', '')} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${totalMin} min`;
}

export function durationText(d: StepDuration): string {
  if (d.type === 'time') return formatDuration(d.seconds);
  if (d.type === 'distance') return formatDistance(d.meters);
  return 'bis Rundentaste';
}

export function targetText(t: StepTarget): string {
  // Bewusst langsames → schnelles Ende (z. B. "6:03–5:03"): locker läuft man am
  // langsamen Ende; das schnelle Ende zuerst zu zeigen verleitet zu hohem Tempo.
  if (t.type === 'pace') return `${paceMpsToPerKm(t.lowMps)}–${paceMpsToPerKm(t.highMps)} /km`;
  if (t.type === 'heartRate') return `${t.lowBpm}–${t.highBpm} bpm`;
  return 'frei';
}

const INTENSITY: Record<WorkoutIntensity, string> = {
  warmup: 'Einlaufen',
  active: 'Belastung',
  recovery: 'Trab',
  rest: 'Pause',
  cooldown: 'Auslaufen',
};
export function intensityLabel(i: WorkoutIntensity): string {
  return INTENSITY[i];
}

const PHASE: Record<PlanPhase, { label: string; color: string }> = {
  base: { label: 'Grundlage', color: '#4C7A9E' },
  build: { label: 'Aufbau', color: '#C97A3E' },
  peak: { label: 'Spitze', color: '#B24A3F' },
  taper: { label: 'Tapering', color: '#4C9468' },
  maintenance: { label: 'Erhaltung', color: '#4A8791' },
};
export function phaseLabel(p: PlanPhase): string {
  return PHASE[p].label;
}
export function phaseColor(p: PlanPhase): string {
  return PHASE[p].color;
}

export const DOW_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Eigene Farbkodierung je Workout-Art (durchgängig auf Home/Plan/Workout-Detail
// verwendet) + Kurzerklärung fürs Glossar. Eigenständige Palette, keine fremde
// Zuordnung übernommen.
const WORKOUT_KIND: Record<WorkoutKind, { label: string; color: string; blurb: string }> = {
  easy: {
    label: 'Dauerlauf',
    color: '#4C9468',
    blurb: 'Lockeres, gleichmäßiges Tempo – baut die aerobe Grundlage auf, ohne den Körper stark zu belasten.',
  },
  long: {
    label: 'Long Run',
    color: '#8B6FB0',
    blurb: 'Der längste Lauf der Woche, meist locker gelaufen – trainiert Ausdauer und mentale Stärke fürs Renntempo.',
  },
  tempo: {
    label: 'Tempolauf',
    color: '#C9A23E',
    blurb: 'Anhaltend zügiges Tempo an der Schwelle – verschiebt den Punkt, an dem Milchsäure sich anstaut, nach oben.',
  },
  interval: {
    label: 'Intervalle',
    color: '#B2554A',
    blurb: 'Kurze, harte Belastungen mit Trabpausen – steigert die maximale Sauerstoffaufnahme (VO2max).',
  },
  repetition: {
    label: 'Wiederholungen',
    color: '#B5628A',
    blurb: 'Sehr kurze, sehr schnelle Wiederholungen mit langen Pausen – verbessert Lauftechnik und Renntempo-Gefühl.',
  },
  recovery: {
    label: 'Regeneration',
    color: '#4A93A0',
    blurb: 'Sehr lockeres Auslaufen zur aktiven Erholung nach einer harten Einheit.',
  },
  rest: { label: 'Ruhetag', color: '#8A8580', blurb: 'Kein Training – Erholung ist Teil des Trainingsreizes.' },
  race: { label: 'Wettkampf', color: '#C97A3E', blurb: 'Der Zielwettkampf oder ein Testrennen im Renntempo.' },
};

export function workoutKindLabel(k: WorkoutKind): string {
  return WORKOUT_KIND[k].label;
}
export function workoutKindColor(k: WorkoutKind): string {
  return WORKOUT_KIND[k].color;
}
export function workoutKindBlurb(k: WorkoutKind): string {
  return WORKOUT_KIND[k].blurb;
}
/** Alle Workout-Arten in fester Anzeige-Reihenfolge (fürs Glossar). */
export const WORKOUT_KIND_ORDER: WorkoutKind[] = [
  'easy',
  'long',
  'tempo',
  'interval',
  'repetition',
  'recovery',
];

/** Wettkampfzeit: "H:MM:SS" ab 1 Stunde, sonst "M:SS". */
export function formatRaceTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

const ASSESSMENT: Record<Assessment, { label: string; color: string }> = {
  'on-target': { label: 'im Ziel', color: '#4C9468' },
  faster: { label: 'schneller', color: '#4C7A9E' },
  slower: { label: 'langsamer', color: '#C08A3E' },
  incomplete: { label: 'unvollständig', color: '#B24A3F' },
};
export function assessmentLabel(a: Assessment): string {
  return ASSESSMENT[a].label;
}
export function assessmentColor(a: Assessment): string {
  return ASSESSMENT[a].color;
}
