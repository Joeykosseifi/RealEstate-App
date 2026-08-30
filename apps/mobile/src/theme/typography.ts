import type { TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * One typography system, the platform's own default sans-serif (San
 * Francisco / Roboto) — already modern and highly readable, and using
 * it avoids adding a font-loading dependency (`expo-font` + a Google
 * Fonts package) that cannot be verified on a real device in this
 * sandbox. See docs/DESIGN_SYSTEM.md "Typography" for the rationale.
 */
type TypeToken = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight' | 'color'>;

export const typography: Record<
  'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'label' | 'caption',
  TypeToken
> = {
  display: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: colors.text.primary },
  h1: { fontSize: 22, fontWeight: '700', lineHeight: 28, color: colors.text.primary },
  h2: { fontSize: 18, fontWeight: '700', lineHeight: 24, color: colors.text.primary },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 22, color: colors.text.primary },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21, color: colors.text.primary },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.text.secondary },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: colors.text.primary },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.text.secondary },
};

/** The one "link-style text" treatment (small, semi-bold, navy) — use instead of redefining this per screen. */
export const linkText: TypeToken = {
  fontSize: 13,
  fontWeight: '600',
  lineHeight: 18,
  color: colors.brand.primaryNavy,
};

/** Same weight/size as `linkText` but for a destructive action rendered as text (e.g. "Archive"). */
export const dangerLinkText: TypeToken = {
  fontSize: 13,
  fontWeight: '600',
  lineHeight: 18,
  color: colors.danger,
};

/** Prices get their own token — prominent without becoming oversized. */
export const priceText: TypeToken = {
  fontSize: 19,
  fontWeight: '700',
  lineHeight: 24,
  color: colors.brand.primaryNavy,
};

