// Тёмная тема МемКарти. Только системные шрифты — никаких сетевых загрузок,
// чтобы исключить «белый экран» из-за незарегистрированных шрифтов.
export const colors = {
  bg: '#0B1020',
  bgAlt: '#11182B',
  card: '#1E293B',
  cardBorder: '#334155',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  accent: '#8B5CF6',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#FBBF24',
  text: '#F8FAFC',
  textDim: '#94A3B8',
  textFaint: '#64748B',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
