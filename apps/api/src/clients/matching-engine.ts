import { MATCH_SCORE_CONFIG } from './matching-score.config';

/**
 * Pure, deterministic scoring logic — no Prisma/NestJS imports, so it's
 * unit-testable without a database (see matching-engine.spec.ts).
 * MatchingService is responsible for building `MatchCandidateProperty`/
 * `MatchRequirementCriteria` from real rows and for the hard filtering
 * itself (a SQL `WHERE`, not this module) — only candidates that
 * already satisfy every hard criterion are ever scored here. Every
 * explanation string is built from the requirement/property data
 * actually compared — never invented or generated.
 */

export interface MatchCandidateProperty {
  currency: string;
  propertyType: string;
  city: string | null;
  area: string | null;
  country: string | null;
  /** Feature keys the property actually has with `value: true`. */
  featureKeys: string[];
}

export interface MatchRequirementCriteria {
  listingPurpose: string;
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minBathrooms: number | null;
  minAreaSqm: number | null;
  maxAreaSqm: number | null;
  countries: string[];
  cities: string[];
  areas: string[];
  requiredFeatures: string[];
  preferredFeatures: string[];
}

export interface MatchScoreResult {
  score: number;
  matchedCriteria: string[];
  missingPreferredCriteria: string[];
}

function describePriceCriterion(
  requirement: MatchRequirementCriteria,
): string | null {
  const currency = requirement.currency ?? '';
  if (requirement.minPrice != null && requirement.maxPrice != null) {
    return `Price between ${requirement.minPrice} and ${requirement.maxPrice} ${currency}`.trim();
  }
  if (requirement.maxPrice != null) {
    return `Price at or under ${requirement.maxPrice} ${currency}`.trim();
  }
  if (requirement.minPrice != null) {
    return `Price at or above ${requirement.minPrice} ${currency}`.trim();
  }
  return null;
}

/**
 * Scores one already-hard-filtered candidate against a requirement.
 * Assumes every hard criterion is already satisfied (the caller's SQL
 * query guarantees this) — this function only computes the score and
 * builds the human-readable explanation of what matched.
 */
export function scoreMatch(
  requirement: MatchRequirementCriteria,
  property: MatchCandidateProperty,
): MatchScoreResult {
  const matchedCriteria: string[] = [
    `Listing purpose: ${requirement.listingPurpose}`,
  ];

  if (requirement.propertyTypes.length > 0) {
    matchedCriteria.push(`Property type: ${property.propertyType}`);
  }

  const priceCriterion = describePriceCriterion(requirement);
  if (priceCriterion) {
    matchedCriteria.push(priceCriterion);
  }

  if (requirement.minBedrooms != null) {
    matchedCriteria.push(`Bedrooms at least ${requirement.minBedrooms}`);
  }
  if (requirement.maxBedrooms != null) {
    matchedCriteria.push(`Bedrooms at most ${requirement.maxBedrooms}`);
  }
  if (requirement.minBathrooms != null) {
    matchedCriteria.push(`Bathrooms at least ${requirement.minBathrooms}`);
  }
  if (requirement.minAreaSqm != null) {
    matchedCriteria.push(`Area at least ${requirement.minAreaSqm} sqm`);
  }
  if (requirement.maxAreaSqm != null) {
    matchedCriteria.push(`Area at most ${requirement.maxAreaSqm} sqm`);
  }

  if (
    requirement.countries.length > 0 ||
    requirement.cities.length > 0 ||
    requirement.areas.length > 0
  ) {
    const label =
      property.area ?? property.city ?? property.country ?? 'Accepted location';
    matchedCriteria.push(`Location: ${label}`);
  }

  for (const featureKey of requirement.requiredFeatures) {
    matchedCriteria.push(`Required feature: ${featureKey}`);
  }

  const matchedPreferred = requirement.preferredFeatures.filter((key) =>
    property.featureKeys.includes(key),
  );
  const missingPreferredCriteria = requirement.preferredFeatures.filter(
    (key) => !property.featureKeys.includes(key),
  );
  for (const featureKey of matchedPreferred) {
    matchedCriteria.push(`Preferred feature: ${featureKey}`);
  }

  const score =
    requirement.preferredFeatures.length === 0
      ? 100
      : MATCH_SCORE_CONFIG.BASE_SCORE +
        Math.round(
          (MATCH_SCORE_CONFIG.PREFERRED_FEATURES_POOL *
            matchedPreferred.length) /
            requirement.preferredFeatures.length,
        );

  return { score, matchedCriteria, missingPreferredCriteria };
}
