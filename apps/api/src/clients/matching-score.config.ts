/**
 * Centralized, documented match-score weights — see docs/PERMISSIONS.md
 * "Match score formula." A candidate reaches scoring only after passing
 * every hard filter (business status, listing purpose, property type,
 * price range + currency, bedrooms/bathrooms/area range, accepted
 * location, every required feature — see MatchingService's candidate
 * query), so `BASE_SCORE` represents "meets every must-have you
 * specified." The remaining `PREFERRED_FEATURES_POOL` points are
 * distributed evenly across however many preferred (nice-to-have)
 * features the requirement lists; a requirement with zero preferred
 * features scores 100 automatically — there is nothing left to
 * differentiate on. Deliberately no graded "closeness" scoring on
 * price/bedrooms/area (e.g. cheaper-is-better) — that would be exactly
 * the kind of subjective, hard-to-justify magic number this
 * configuration is meant to avoid; every hard-filtered dimension is
 * pass/fail by design.
 */
export const MATCH_SCORE_CONFIG = {
  BASE_SCORE: 60,
  PREFERRED_FEATURES_POOL: 40,
} as const;
