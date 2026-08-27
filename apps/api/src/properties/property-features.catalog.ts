/**
 * Single source of truth for recognized property feature/amenity keys —
 * the same "catalog constant" pattern as
 * `apps/api/src/authorization/permissions.catalog.ts`. `PropertyFeature`
 * stores an arbitrary `featureKey` string + boolean `value` (see
 * schema.prisma), deliberately NOT a DB enum or foreign key, so adding a
 * new feature is a one-line change here — never a migration. DTOs
 * validate incoming keys against this list so typos become a `400`, not
 * silently-stored junk data.
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

export type PropertyFeatureKey = (typeof PROPERTY_FEATURE_KEYS)[number];
