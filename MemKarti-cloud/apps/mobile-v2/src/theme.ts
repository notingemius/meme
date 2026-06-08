// Theme definitions: light + dark color palettes.
// useTheme() hook provides { colors, isDark, toggle }.

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryText: string;
  border: string;
  inputBg: string;
  cardBg: string;
  // Game-specific
  situationBg: string;
  situationText: string;
  winnerBg: string;
  winnerBorder: string;
  winnerText: string;
  // Status
  error: string;
  errorBg: string;
  warning: string;
  warningBg: string;
  // Buttons
  btnSecondaryBg: string;
  btnTertiaryBg: string;
};

export const LightTheme: ThemeColors = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryText: '#2563EB',
  border: '#E5E7EB',
  inputBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  situationBg: '#2563EB',
  situationText: '#FFFFFF',
  winnerBg: '#FEF3C7',
  winnerBorder: '#F59E0B',
  winnerText: '#78350F',
  error: '#B91C1C',
  errorBg: '#FEF2F2',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  btnSecondaryBg: '#EFF6FF',
  btnTertiaryBg: '#EEF2FF',
};

export const DarkTheme: ThemeColors = {
  background: '#111827',
  surface: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  primaryText: '#93C5FD',
  border: '#374151',
  inputBg: '#1F2937',
  cardBg: '#1F2937',
  situationBg: '#1D4ED8',
  situationText: '#FFFFFF',
  winnerBg: '#78350F',
  winnerBorder: '#F59E0B',
  winnerText: '#FEF3C7',
  error: '#FCA5A5',
  errorBg: '#7F1D1D',
  warning: '#FDE68A',
  warningBg: '#78350F',
  btnSecondaryBg: '#1E3A5F',
  btnTertiaryBg: '#1E3A5F',
};
