/** 4/8-based spacing scale (Milestone 7). Screen horizontal padding is `md`/`lg` (16-20). */
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Restrained modern rounding — see docs/DESIGN_SYSTEM.md "Shape". */
export const radii = {
  control: 8,
  input: 10,
  button: 12,
  card: 14,
  cardLarge: 16,
  image: 16,
  pill: 999,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;
