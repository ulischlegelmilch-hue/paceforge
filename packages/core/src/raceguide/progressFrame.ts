// Wechsel zwischen "X km geschafft" und "noch X km" während eines begleiteten
// Wettkampf-Laufs. Nicht willkürlich: die Goal-Gradient-Hypothese (Hull/Kivetz)
// zeigt, dass Motivation mit der GEFÜHLTEN, relativen Nähe zum Ziel steigt -
// deshalb wird ab der Streckenhälfte auf "Restdistanz" umgeschaltet (deckt sich
// mit gängiger Lauf-Coaching-Praxis: ab dem Halbierungspunkt "nach Gefühl"
// laufen und die Restdistanz stärker betonen). Reine, testbare Funktion, kein
// GPS/State involviert.

export type ProgressMode = 'covered' | 'remaining';

export interface ProgressFrame {
  mode: ProgressMode;
  /** Ganzzahliger km-Wert für die Ansage (geschafft: abgerundet, übrig: aufgerundet). */
  km: number;
}

export const DEFAULT_SWITCH_FRACTION = 0.5;

export function progressFrameFor(
  coveredMeters: number,
  totalMeters: number,
  switchFraction: number = DEFAULT_SWITCH_FRACTION,
): ProgressFrame {
  const covered = Math.max(0, Math.min(coveredMeters, totalMeters));
  const fraction = totalMeters > 0 ? covered / totalMeters : 0;

  if (fraction < switchFraction) {
    return { mode: 'covered', km: Math.floor(covered / 1000) };
  }
  const remainingMeters = totalMeters - covered;
  return { mode: 'remaining', km: Math.ceil(remainingMeters / 1000) };
}
