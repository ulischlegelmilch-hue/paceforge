import { useColorScheme } from 'react-native';

// Eigenständige PaceForge-Palette (kein fremdes Branding). Hell + dunkel.
export interface Palette {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  accentText: string;
  chipBg: string;
}

export function usePalette(): Palette {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    bg: dark ? '#0e1116' : '#f6f7f9',
    card: dark ? '#171c24' : '#ffffff',
    text: dark ? '#f2f4f7' : '#12151a',
    subtext: dark ? '#9aa4b2' : '#5b6472',
    border: dark ? '#2a313c' : '#e4e8ec',
    accent: '#e8622c',
    accentText: '#ffffff',
    chipBg: dark ? '#232a34' : '#eef1f5',
  };
}
