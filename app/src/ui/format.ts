import {
  paceMpsToPerKm,
  type Assessment,
  type PlanPhase,
  type StepDuration,
  type StepTarget,
  type WorkoutIntensity,
  type WorkoutKind,
} from '@paceforge/core';

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.0', '')} km` : `${meters} m`;
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
  base: { label: 'Grundlage', color: '#3b82f6' },
  build: { label: 'Aufbau', color: '#e8622c' },
  peak: { label: 'Spitze', color: '#dc2626' },
  taper: { label: 'Tapering', color: '#16a34a' },
  maintenance: { label: 'Erhaltung', color: '#0891b2' },
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
    color: '#22c55e',
    blurb: 'Lockeres, gleichmäßiges Tempo – baut die aerobe Grundlage auf, ohne den Körper stark zu belasten.',
  },
  long: {
    label: 'Long Run',
    color: '#8b5cf6',
    blurb: 'Der längste Lauf der Woche, meist locker gelaufen – trainiert Ausdauer und mentale Stärke fürs Renntempo.',
  },
  tempo: {
    label: 'Tempolauf',
    color: '#eab308',
    blurb: 'Anhaltend zügiges Tempo an der Schwelle – verschiebt den Punkt, an dem Milchsäure sich anstaut, nach oben.',
  },
  interval: {
    label: 'Intervalle',
    color: '#ef4444',
    blurb: 'Kurze, harte Belastungen mit Trabpausen – steigert die maximale Sauerstoffaufnahme (VO2max).',
  },
  repetition: {
    label: 'Wiederholungen',
    color: '#ec4899',
    blurb: 'Sehr kurze, sehr schnelle Wiederholungen mit langen Pausen – verbessert Lauftechnik und Renntempo-Gefühl.',
  },
  recovery: {
    label: 'Regeneration',
    color: '#06b6d4',
    blurb: 'Sehr lockeres Auslaufen zur aktiven Erholung nach einer harten Einheit.',
  },
  rest: { label: 'Ruhetag', color: '#94a3b8', blurb: 'Kein Training – Erholung ist Teil des Trainingsreizes.' },
  race: { label: 'Wettkampf', color: '#e8622c', blurb: 'Der Zielwettkampf oder ein Testrennen im Renntempo.' },
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
  'on-target': { label: 'im Ziel', color: '#16a34a' },
  faster: { label: 'schneller', color: '#3b82f6' },
  slower: { label: 'langsamer', color: '#d97706' },
  incomplete: { label: 'unvollständig', color: '#dc2626' },
};
export function assessmentLabel(a: Assessment): string {
  return ASSESSMENT[a].label;
}
export function assessmentColor(a: Assessment): string {
  return ASSESSMENT[a].color;
}
