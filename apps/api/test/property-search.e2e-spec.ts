import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function listProperties(
  testApp: TestApp,
  workspaceId: string,
  token: string,
  qs: string,
) {
  return request(testApp.app.getHttpServer())
    .get(`/api/v1/workspaces/${workspaceId}/properties${qs}`)
    .set(...authHeader(token))
    .expect(200);
}

describe('Property search & pagination', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('53. the property list paginates', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    for (let i = 0; i < 3; i += 1) {
      await createProperty(testApp, owner.workspaceId, owner.accessToken, {
        title: `Prop ${i}`,
      });
    }

    const response = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?page=1&pageSize=2',
    );
    expect(response.body.items).toHaveLength(2);
    expect(response.body.meta.totalItems).toBe(3);
    expect(response.body.meta.totalPages).toBe(2);
  });

  it('54, 55. filters by property type and listing purpose', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      propertyType: 'VILLA',
      listingPurpose: 'RENT',
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      propertyType: 'APARTMENT',
      listingPurpose: 'SALE',
    });

    const byType = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?propertyType=VILLA',
    );
    expect(byType.body.items).toHaveLength(1);
    expect(byType.body.items[0].propertyType).toBe('VILLA');

    const byPurpose = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?listingPurpose=RENT',
    );
    expect(byPurpose.body.items).toHaveLength(1);
    expect(byPurpose.body.items[0].listingPurpose).toBe('RENT');
  });

  it('56. filters by price range', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      price: 50000,
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      price: 500000,
    });

    const response = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?priceMin=100000&priceMax=1000000',
    );
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].price).toBe(500000);
  });

  it('57, 58. filters by minimum bedrooms and bathrooms', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      bedrooms: 1,
      bathrooms: 1,
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      bedrooms: 4,
      bathrooms: 3,
    });

    const byBedrooms = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?bedroomsMin=3',
    );
    expect(byBedrooms.body.items).toHaveLength(1);
    expect(byBedrooms.body.items[0].bedrooms).toBe(4);

    const byBathrooms = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?bathroomsMin=2',
    );
    expect(byBathrooms.body.items).toHaveLength(1);
    expect(byBathrooms.body.items[0].bathrooms).toBe(3);
  });

  it('59. filters by area range', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      areaSqm: 50,
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      areaSqm: 300,
    });

    const response = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?areaMin=100&areaMax=500',
    );
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].areaSqm).toBe(300);
  });

  it('60, 64. filters by property status, and archived records are included/excluded intentionally', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const active = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const toArchive = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${toArchive.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const defaultList = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '',
    );
    const defaultIds = (defaultList.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(defaultIds).toContain(active.id);
    expect(defaultIds).not.toContain(toArchive.id);

    const includeArchived = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?includeArchived=true',
    );
    const includedIds = (includeArchived.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(includedIds).toContain(toArchive.id);

    const onlyArchived = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?propertyStatus=ARCHIVED',
    );
    const archivedIds = (onlyArchived.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(archivedIds).toEqual([toArchive.id]);
  });

  it('61, 62. filters by city and by area/neighborhood', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      location: {
        city: 'Beirut',
        area: 'Achrafieh',
        latitude: 1,
        longitude: 1,
      },
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      location: { city: 'Jounieh', area: 'Kaslik', latitude: 1, longitude: 1 },
    });

    const byCity = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?city=Beirut',
    );
    expect(byCity.body.items).toHaveLength(1);

    const byArea = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?area=Kaslik',
    );
    expect(byArea.body.items).toHaveLength(1);
  });

  it('63. filters by feature', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      featureKeys: ['pool', 'garden'],
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      featureKeys: ['parking'],
    });

    const response = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?features=pool',
    );
    expect(response.body.items).toHaveLength(1);
  });

  it('text search matches title, city, and area', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      title: 'Sunny Seaside Villa',
    });
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      title: 'Downtown Loft',
    });

    const response = await listProperties(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      '?search=Seaside',
    );
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].title).toBe('Sunny Seaside Villa');
  });

  it('65. search/list never leaks another workspace’s property', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    await createProperty(testApp, ownerA.workspaceId, ownerA.accessToken, {
      title: 'Shared Title Match',
    });
    await createProperty(testApp, ownerB.workspaceId, ownerB.accessToken, {
      title: 'Shared Title Match',
    });

    const response = await listProperties(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
      '?search=Shared Title Match',
    );
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].workspaceId).toBe(ownerA.workspaceId);
  });
});
