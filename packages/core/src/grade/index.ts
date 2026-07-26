// Höhenmeter → flaches Äquivalent. Quelle: Minetti et al. 2002 (J Appl Physiol
// 93:1039–1046) – Energiekosten des Laufens Cr(i) als Funktion der Steigung i
// (Bruchteil, + bergauf / − bergab). Downhill-Credit wie bei Strava's GAP-Modell
// gedeckelt (echte Läufer können den theoretischen Bergab-Vorteil nicht in Tempo
// umsetzen; exzentrische Belastung). Ergebnis (flach-äquivalente Distanz) fließt
// mit der tatsächlichen Zeit in die VDOT-Berechnung → ein hügeliger Lauf
// unterschätzt die Form nicht.

export const MINETTI_FLAT_COST = 3.6; // J·kg⁻¹·m⁻¹ (flach)

/** Minetti-Laufkosten (J·kg⁻¹·m⁻¹). Steigung auf ±45 % geklemmt (GPS-Rauschen). */
export function minettiCost(gradeFraction: number): number {
  const i = Math.max(-0.45, Math.min(0.45, gradeFraction));
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
}

/** Grade-Adjustment-Faktor a(i)=Cr(i)/Cr(0); bergab auf ≥0,88 gedeckelt (Strava). */
export function gradeFactor(gradeFraction: number): number {
  let f = minettiCost(gradeFraction) / MINETTI_FLAT_COST;
  if (gradeFraction < 0) f = Math.max(f, 0.88);
  return f;
}

export interface GradeSegment {
  meters: number;
  grade: number; // Bruchteil, + bergauf / − bergab
}

/** Bevorzugt: flach-äquivalente Distanz aus Segmenten (Höhenprofil vorhanden). */
export function gradeAdjustedDistanceSegments(segments: GradeSegment[]): number {
  return segments.reduce((sum, s) => sum + s.meters * gradeFactor(s.grade), 0);
}

/** Flache Meter je Höhenmeter (totals-only-Näherung; Minetti-Ableitung ~5,4–11). */
export const ASCENT_FLAT_EQUIV = 7;

/**
 * Totals-only-Fallback (nur Distanz + Gesamtanstieg, kein Höhenprofil):
 * flach-äquivalent = Distanz + 7 · Anstieg. Näherung mit ±10–15 % Unschärfe,
 * aber sie kollabiert – anders als „Durchschnittssteigung" – nie auf null.
 */
export function gradeAdjustedDistance(distanceMeters: number, ascentMeters: number): number {
  if (!(distanceMeters > 0)) return 0;
  const ascent = Number.isFinite(ascentMeters) && ascentMeters > 0 ? ascentMeters : 0;
  return distanceMeters + ASCENT_FLAT_EQUIV * ascent;
}
