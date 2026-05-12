/**
 * FitGenome AI — Design Tokens
 *
 * Dark-Mode Luxury + Pastel-Minimalist aesthetic.
 */

export const Colors = {
  // ── Base ────────────────────────────────────────────
  background: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1C1C2E',
  card: 'rgba(255, 255, 255, 0.05)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',

  // ── Text ────────────────────────────────────────────
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.35)',

  // ── Pastel Accents ─────────────────────────────────
  lavender: '#B8A9E8',
  mint: '#7EDEC4',
  coral: '#F4A896',
  gold: '#F2D06B',
  sky: '#7EC8E3',

  // ── Gradients ──────────────────────────────────────
  gradientPurpleCyan: ['#B8A9E8', '#7EC8E3'] as const,
  gradientCoralGold: ['#F4A896', '#F2D06B'] as const,
  gradientMintSky: ['#7EDEC4', '#7EC8E3'] as const,
  gradientDark: ['#141420', '#0A0A0F'] as const,

  // ── Macros ─────────────────────────────────────────
  protein: '#F4A896',
  carbs: '#7EDEC4',
  fat: '#F2D06B',

  // ── Status ─────────────────────────────────────────
  success: '#7EDEC4',
  warning: '#F2D06B',
  error: '#E87878',
  info: '#7EC8E3',

  // ── Tab Bar ────────────────────────────────────────
  tabActive: '#B8A9E8',
  tabInactive: 'rgba(255, 255, 255, 0.3)',
  tabBackground: '#0D0D14',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  hero: 36,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }),
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
};
