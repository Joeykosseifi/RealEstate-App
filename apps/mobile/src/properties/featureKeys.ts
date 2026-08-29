/**
 * Mirrors `apps/api/src/properties/property-features.catalog.ts` — the
 * backend validates feature keys against this exact list (a typo here
 * would surface as a real 400, not silently drop the feature).
 */
export const PROPERTY_FEATURE_KEYS = [
  'parking',
  'balcony',
  'elevator',
  'generator',
  'sea_view',
  'mountain_view',
  'garden',
  'pool',
  'storage',
  'furnished',
  'air_conditioning',
  'heating',
  'concierge',
  'security',
  'terrace',
  'solar_system',
  'private_entrance',
] as const;
