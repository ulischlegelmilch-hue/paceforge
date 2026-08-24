import { useColorScheme } from 'react-native';

// Eigenständige PaceForge-Palette (kein fremdes Branding) - Grundlage: das Kupfer/
// Fast-Schwarz aus dem App-Icon (Uli-Entscheidung 2026-08-21: Runna-Qualitätsniveau,
// eigene Identität, keine Runna-Farben). Zurückhaltender Akzent-Einsatz statt vieler
// orangener Links (vorher fast jeder Link/Badge in Akzentfarbe -> wirkte unruhig):
// Akzent nur für primäre CTAs, Hero-Zahlen und gezielte Hervorhebungen, sonst Text
// in neutralen Tönen. Zwei Oberflächen-Ebenen (surface/surfaceRaised) statt
// durchgängiger 1px-Rahmen, damit Tiefe über Farbe statt Linien entsteht.
export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceRaised: string;
  /** @deprecated Alias für surface - für schrittweise Migration alter Screens. */
  card: string;
  text: string;
  subtext: string;
  faint: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  /** @deprecated Alias für accentSoft - für schrittweise Migration alter Screens. */
  chipBg: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export function usePalette(): Palette {
  const dark = useColorScheme() === 'dark';

  const bg = dark ? '#0A0A0C' : '#F7F5F2';
  const surface = dark ? '#16171B' : '#FFFFFF';
  const surfaceRaised = dark ? '#202227' : '#EFEBE6';
  const text = dark ? '#F5F3F0' : '#1A1815';
  const subtext = dark ? '#9B9691' : '#6B6863';
  const faint = dark ? '#6B6863' : '#9B9691';
  const border = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const accent = dark ? '#C97A3E' : '#B8672E';
  const accentSoft = dark ? 'rgba(201,122,62,0.16)' : 'rgba(184,103,46,0.10)';
  const accentText = '#0A0A0C';

  return {
    dark,
    bg,
    surface,
    surfaceRaised,
    card: surface,
    text,
    subtext,
    faint,
    border,
    accent,
    accentSoft,
    accentText,
    chipBg: surfaceRaised,
    success: dark ? '#6FAE84' : '#3F8759',
    warning: dark ? '#D9A441' : '#B8842A',
    danger: dark ? '#C97066' : '#B24A3F',
    info: dark ? '#6E9BB8' : '#4A7891',
  };
}
