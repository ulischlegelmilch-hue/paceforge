import {
  paceMpsToPerKm,
  type PlanPhase,
  type StepDuration,
  type StepTarget,
  type WorkoutIntensity,
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
  if (t.type === 'pace') return `${paceMpsToPerKm(t.highMps)}–${paceMpsToPerKm(t.lowMps)} /km`;
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
};
export function phaseLabel(p: PlanPhase): string {
  return PHASE[p].label;
}
export function phaseColor(p: PlanPhase): string {
  return PHASE[p].color;
}

export const DOW_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
