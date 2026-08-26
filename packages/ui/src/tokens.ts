/**
 * Platform-agnostic design tokens shared between apps/admin-web (React DOM)
 * and apps/mobile (React Native). Plain data only — no React or React
 * Native imports here, so both platforms can consume this module directly.
 * Actual component primitives are added per-platform as screens are built,
 * starting from the milestones that need them.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#F5F6F8',
  border: '#E2E4E9',
  textPrimary: '#111318',
  textSecondary: '#5B616E',
  primary: '#1F6FEB',
  danger: '#D1242F',
  success: '#1A7F37',
  warning: '#9A6700',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
} as const;
