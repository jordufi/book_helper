import { useColorScheme } from 'react-native';

/** Misma paleta que `react/src/styles.css`, para que las dos apps se reconozcan. */
const light = {
  bg: '#faf8f5',
  surface: '#ffffff',
  surface2: '#f2eee8',
  border: '#e0d9cf',
  text: '#2a2521',
  textDim: '#6f665c',
  accent: '#8c5a3c',
  accentSoft: '#f0e4da',
  danger: '#a33a2c',
  ok: '#3f7d52',
};

const dark = {
  bg: '#1a1715',
  surface: '#232019',
  surface2: '#2c2822',
  border: '#3d372f',
  text: '#ece6de',
  textDim: '#a1968a',
  accent: '#cf9d72',
  accentSoft: '#3a2f25',
  danger: '#e08072',
  ok: '#7fbf95',
};

export type Theme = typeof light;

export const RADIUS = 10;
export const SPACING = 12;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Colores por rol de personaje, equivalentes a los badges de la web. */
export function roleColors(theme: Theme, role: string): { bg: string; fg: string } {
  if (role === 'PROTAGONIST') return { bg: theme.accentSoft, fg: theme.accent };
  if (role === 'ANTAGONIST') return { bg: theme.accentSoft, fg: theme.danger };
  return { bg: theme.surface2, fg: theme.textDim };
}
