/**
 * A deliberately narrow, fixed-shape property summary used by both the
 * matching engine's results and PDF presentation generation. Unlike
 * `PropertyProfessionalDetail`, this shape has no permission-gated
 * optional sections at all — it structurally cannot carry owner
 * information, commission notes, private notes, or exact coordinates,
 * because this type has no fields for them. See
 * apps/api/src/clients/matching.mapper.ts.
 */
export interface PresentationSafePropertySnapshot {
  id: string;
  title: string;
  description: string | null;
  propertyType: string;
  listingPurpose: 'SALE' | 'RENT';
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  propertyStatus: string;
  city: string | null;
  area: string | null;
  country: string | null;
  featureKeys: string[];
  primaryImageUrl: string | null;
}

/** Deterministic, non-generative explanation of why a property did or didn't fully match a requirement. */
export interface MatchExplanation {
  matchedCriteria: string[];
  missingPreferredCriteria: string[];
}

/** One ranked candidate returned by `GET .../requirements/:id/matches`. */
export interface PropertyMatchResult {
  property: PresentationSafePropertySnapshot;
  score: number;
  explanation: MatchExplanation;
}
