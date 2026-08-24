import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { usePalette } from '@/ui/colors';
import { eyebrow } from '@/ui/typography';

/** Kleine Großbuchstaben-Label-Zeile über einem Wert (z. B. "DEIN ZIEL"). */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return <Text style={[eyebrow, { color: p.subtext }, style]}>{children}</Text>;
}
