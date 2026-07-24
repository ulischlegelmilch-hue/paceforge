// VDOT-Modell nach Jack Daniels & Jimmy Gilbert ("Daniels' Running Formula").
//
// Warum dieser Ansatz (dokumentiert lt. CLAUDE.md Abschnitt 2):
// VDOT liefert aus EINER Leistungsangabe (einer Bestzeit) sowohl ein Fitness-Maß
// als auch direkt die konkreten Trainings-Paces (Easy/Marathon/Threshold/Interval/
// Repetition). Genau diese Paces brauchen wir als `pace`-Targets im Workout-Schema.
// Eine 80/20-Volumenverteilung lässt sich später DARÜBER legen, ohne dieses Modell
// zu ersetzen.
//
// Die Original-Regression ist in Geschwindigkeit v = Meter/Minute definiert; alle
// Funktionen hier rechnen intern in m/min. Nach außen (Zonen) geben wir m/s zurück.

/** VO2 (ml/kg/min), den eine Laufgeschwindigkeit v (m/min) kostet. */
export function vo2ForVelocity(vMetersPerMin: number): number {
  return -4.6 + 0.182258 * vMetersPerMin + 0.000104 * vMetersPerMin * vMetersPerMin;
}

/** Umkehrung von vo2ForVelocity: Geschwindigkeit (m/min) für einen VO2-Wert. */
export function velocityForVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  const disc = b * b - 4 * a * c;
  // Positive Wurzel (physikalisch sinnvolle Geschwindigkeit).
  return (-b + Math.sqrt(disc)) / (2 * a);
}

/**
 * Anteil des VO2max, der über eine Renndauer von t Minuten aufrechterhalten
 * werden kann (Daniels' "Drop-off"-Kurve). Kürzere Rennen -> näher an 100%.
 */
export function percentMaxForDuration(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

/**
 * VDOT aus einer Wettkampfleistung.
 * @param distanceMeters zurückgelegte Distanz in Metern
 * @param timeSeconds    benötigte Zeit in Sekunden
 */
export function vdotFromRace(distanceMeters: number, timeSeconds: number): number {
  const minutes = timeSeconds / 60;
  const vMetersPerMin = distanceMeters / minutes;
  const vo2 = vo2ForVelocity(vMetersPerMin);
  return vo2 / percentMaxForDuration(minutes);
}
