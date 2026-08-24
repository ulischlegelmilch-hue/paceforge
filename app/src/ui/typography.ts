import { Platform, type TextStyle } from 'react-native';

// Typografie-Skala für den Runna-Qualitätslevel-Relaunch (2026-08-22): Manrope statt
// System-Font - geometrisch-humanistisch, gute Ziffern-Anmutung fürs Zeigen von
// VDOT/Distanz/Pace als Hero-Zahlen. Fonts werden per useFonts() in _layout.tsx
// geladen (rein JS/Asset-Ebene, kein natives Rebuild nötig -> OTA-fähig).

export const FONT = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

/** Für Text-Elemente VOR dem Laden der Fonts (z. B. Splash) - vermeidet FOUT-Sprung. */
export const FALLBACK_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: undefined });

interface TypeStyle extends TextStyle {
  fontFamily: string;
}

/** Sehr große Hero-Zahl (VDOT, Distanz-Highlight). Enge Laufweite für Zahlen-Anmutung. */
export const display: TypeStyle = { fontFamily: FONT.extrabold, fontSize: 48, lineHeight: 52, letterSpacing: -1 };
/** Bildschirmtitel. */
export const title: TypeStyle = { fontFamily: FONT.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 };
/** Karten-/Abschnittsüberschrift. */
export const heading: TypeStyle = { fontFamily: FONT.bold, fontSize: 18, lineHeight: 24 };
/** Eyebrow-Label (kleine Großbuchstaben-Zeile über einem Wert, z. B. "DEIN ZIEL"). */
export const eyebrow: TypeStyle = {
  fontFamily: FONT.semibold,
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
};
/** Standard-Fließtext/Werte. */
export const body: TypeStyle = { fontFamily: FONT.medium, fontSize: 15, lineHeight: 21 };
/** Betonter Fließtext (z. B. Workout-Name in einer Zeile). */
export const bodyStrong: TypeStyle = { fontFamily: FONT.bold, fontSize: 15, lineHeight: 21 };
/** Kleingedrucktes/Meta. */
export const caption: TypeStyle = { fontFamily: FONT.medium, fontSize: 13, lineHeight: 18 };
/** Button-Beschriftung. */
export const button: TypeStyle = { fontFamily: FONT.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0.1 };
