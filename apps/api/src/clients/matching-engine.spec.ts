import {
  scoreMatch,
  type MatchCandidateProperty,
  type MatchRequirementCriteria,
} from './matching-engine';

const BASE_REQUIREMENT: MatchRequirementCriteria = {
  listingPurpose: 'SALE',
  propertyTypes: ['APARTMENT'],
  minPrice: null,
  maxPrice: 180000,
  currency: 'USD',
  minBedrooms: 3,
  maxBedrooms: null,
  minBathrooms: null,
  minAreaSqm: null,
  maxAreaSqm: null,
  countries: [],
  cities: ['Jounieh'],
  areas: [],
  requiredFeatures: ['parking'],
  preferredFeatures: ['sea_view', 'balcony'],
};

const BASE_PROPERTY: MatchCandidateProperty = {
  currency: 'USD',
  propertyType: 'APARTMENT',
  city: 'Jounieh',
  area: null,
  country: 'Lebanon',
  featureKeys: ['parking', 'balcony'],
};

describe('scoreMatch', () => {
  it('scores 100 when a requirement has no preferred features to differentiate on', () => {
    const requirement: MatchRequirementCriteria = {
      ...BASE_REQUIREMENT,
      preferredFeatures: [],
    };
    const result = scoreMatch(requirement, BASE_PROPERTY);
    expect(result.score).toBe(100);
    expect(result.missingPreferredCriteria).toEqual([]);
  });

  it('awards partial credit proportional to matched preferred features', () => {
    // 1 of 2 preferred features matched (balcony, not sea_view) -> 60 + round(40 * 1/2) = 80
    const result = scoreMatch(BASE_REQUIREMENT, BASE_PROPERTY);
    expect(result.score).toBe(80);
    expect(result.missingPreferredCriteria).toEqual(['sea_view']);
    expect(result.matchedCriteria).toContain('Preferred feature: balcony');
  });

  it('awards full preferred-feature credit when every preferred feature matches', () => {
    const property: MatchCandidateProperty = {
      ...BASE_PROPERTY,
      featureKeys: ['parking', 'balcony', 'sea_view'],
    };
    const result = scoreMatch(BASE_REQUIREMENT, property);
    expect(result.score).toBe(100);
    expect(result.missingPreferredCriteria).toEqual([]);
  });

  it('awards zero preferred-feature credit when none match, but still returns the base score', () => {
    const property: MatchCandidateProperty = {
      ...BASE_PROPERTY,
      featureKeys: ['parking'],
    };
    const result = scoreMatch(BASE_REQUIREMENT, property);
    expect(result.score).toBe(60);
    expect(result.missingPreferredCriteria).toEqual(['sea_view', 'balcony']);
  });

  it('is deterministic — identical inputs always produce identical output', () => {
    const first = scoreMatch(BASE_REQUIREMENT, BASE_PROPERTY);
    const second = scoreMatch(BASE_REQUIREMENT, BASE_PROPERTY);
    expect(first).toEqual(second);
  });

  it('explains every hard criterion the requirement actually specified', () => {
    const result = scoreMatch(BASE_REQUIREMENT, BASE_PROPERTY);
    expect(result.matchedCriteria).toEqual(
      expect.arrayContaining([
        'Listing purpose: SALE',
        'Property type: APARTMENT',
        'Price at or under 180000 USD',
        'Bedrooms at least 3',
        'Location: Jounieh',
        'Required feature: parking',
      ]),
    );
  });

  it('omits unspecified dimensions from the explanation', () => {
    const requirement: MatchRequirementCriteria = {
      ...BASE_REQUIREMENT,
      maxPrice: null,
      minBedrooms: null,
      cities: [],
      requiredFeatures: [],
    };
    const result = scoreMatch(requirement, BASE_PROPERTY);
    expect(result.matchedCriteria.some((c) => c.startsWith('Price'))).toBe(
      false,
    );
    expect(result.matchedCriteria.some((c) => c.startsWith('Bedrooms'))).toBe(
      false,
    );
    expect(result.matchedCriteria.some((c) => c.startsWith('Location'))).toBe(
      false,
    );
    expect(
      result.matchedCriteria.some((c) => c.startsWith('Required feature')),
    ).toBe(false);
  });
});
