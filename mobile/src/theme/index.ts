export const colors = {
  bg: '#0E0B1A',
  surface: '#1A1530',
  surfaceAlt: '#241D40',
  border: '#2F2752',
  primary: '#8B5CF6',
  primaryDark: '#6D28D9',
  primarySoft: 'rgba(139, 92, 246, 0.16)',
  accent: '#EC4899',
  text: '#F5F3FF',
  textMuted: '#A59FC4',
  textFaint: '#6E6893',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.16)',
  warning: '#F59E0B',
  coin: '#FBBF24',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const gradients = {
  primary: ['#8B5CF6', '#EC4899'] as const,
  call: ['#2A1B5C', '#0E0B1A'] as const,
  coin: ['#F59E0B', '#EC4899'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
} as const;
