import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createClientRequirement,
  createProperty,
  registerVerifiedCompanyOwner,
} from './utils/flows';

interface MatchResultBody {
  items: {
    property: { id: string };
    score: number;
    explanation: {
      matchedCriteria: string[];
      missingPreferredCriteria: string[];
    };
  }[];
}

describe('Matching logic', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  async function getMatches(
    owner: { workspaceId: string; accessToken: string },
    clientId: string,
    requirementId: string,
  ): Promise<MatchResultBody> {
    const response = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${clientId}/requirements/${requirementId}/matches`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    return response.body as MatchResultBody;
  }

  it('45. wrong listing purpose is excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const rentProperty = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        listingPurpose: 'RENT',
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        listingPurpose: 'SALE',
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === rentProperty.id),
    ).toBeUndefined();
  });

  it('46. wrong property type is excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const land = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { propertyType: 'LAND' },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        propertyTypes: ['APARTMENT'],
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === land.id),
    ).toBeUndefined();
  });

  it('47. a property over the hard maximum budget is excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const expensive = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        price: 300000,
        currency: 'USD',
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        maxPrice: 180000,
        currency: 'USD',
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === expensive.id),
    ).toBeUndefined();
  });

  it('48. a property below the minimum bedrooms is excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const small = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { bedrooms: 1 },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        minBedrooms: 3,
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === small.id),
    ).toBeUndefined();
  });

  it('49. a property outside every accepted location is excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const elsewhere = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        location: {
          latitude: 33.9,
          longitude: 35.5,
          city: 'Beirut',
          locationSource: 'MANUAL',
        },
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        cities: ['Jounieh'],
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === elsewhere.id),
    ).toBeUndefined();
  });

  it('50. a property missing a required feature is excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const noParking = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        featureKeys: ['balcony'],
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        requiredFeatures: ['parking'],
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === noParking.id),
    ).toBeUndefined();
  });

  it('51, 52. a missing preferred feature lowers the score but does not exclude; matching one raises it', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const withoutSeaView = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        featureKeys: ['balcony'],
      },
    );
    const withSeaView = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        featureKeys: ['balcony', 'sea_view'],
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        preferredFeatures: ['sea_view', 'balcony'],
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    const withoutResult = matches.items.find(
      (item) => item.property.id === withoutSeaView.id,
    )!;
    const withResult = matches.items.find(
      (item) => item.property.id === withSeaView.id,
    )!;

    expect(withoutResult).toBeDefined();
    expect(withResult).toBeDefined();
    expect(withoutResult.score).toBeLessThan(withResult.score);
    expect(withResult.score).toBe(100);
  });

  it('53, 54, 55, 56. only AVAILABLE properties match — SOLD, RENTED, and ARCHIVED are excluded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const available = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const sold = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${sold.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'SOLD' })
      .expect(204);
    const rented = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${rented.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'RENTED' })
      .expect(204);
    const archived = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${archived.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    const matchedIds = matches.items.map((item) => item.property.id);
    expect(matchedIds).toContain(available.id);
    expect(matchedIds).not.toContain(sold.id);
    expect(matchedIds).not.toContain(rented.id);
    expect(matchedIds).not.toContain(archived.id);
  });

  it('57. a property in a different currency is excluded from a price-bounded requirement', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const eurProperty = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        price: 100000,
        currency: 'EUR',
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        maxPrice: 200000,
        currency: 'USD',
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(
      matches.items.find((item) => item.property.id === eurProperty.id),
    ).toBeUndefined();
  });

  it('58, 59. scores are deterministic and equal scores use stable (id-ascending) ordering', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      price: 100000,
      currency: 'USD',
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      price: 110000,
      currency: 'USD',
    });
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        maxPrice: 200000,
        currency: 'USD',
      },
    );

    const first = await getMatches(owner, client.id, requirement.id);
    const second = await getMatches(owner, client.id, requirement.id);
    expect(first).toEqual(second);

    const ids = first.items.map((item) => item.property.id);
    const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
    // Both properties score identically (no preferred features specified) -> id-ascending tiebreak.
    expect(ids).toEqual(sortedIds);
  });

  it('60. the explanation correctly identifies matched and missing criteria', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      propertyType: 'APARTMENT',
      price: 150000,
      currency: 'USD',
      bedrooms: 3,
      featureKeys: ['parking'],
    });
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        propertyTypes: ['APARTMENT'],
        maxPrice: 180000,
        currency: 'USD',
        minBedrooms: 3,
        requiredFeatures: ['parking'],
        preferredFeatures: ['sea_view'],
      },
    );

    const matches = await getMatches(owner, client.id, requirement.id);
    expect(matches.items.length).toBe(1);
    const { explanation } = matches.items[0];
    expect(explanation.matchedCriteria).toEqual(
      expect.arrayContaining([
        'Property type: APARTMENT',
        'Price at or under 180000 USD',
        'Bedrooms at least 3',
        'Required feature: parking',
      ]),
    );
    expect(explanation.missingPreferredCriteria).toEqual(['sea_view']);
  });
});
