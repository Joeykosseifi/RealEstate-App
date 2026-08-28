import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  grantPlatformRole,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
  savePublicationDraft,
  submitPublication,
  uploadPropertyImage,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Marketplace browsing, search, and location privacy', () => {
  let testApp: TestApp;
  let admin: Awaited<ReturnType<typeof makeSuperAdmin>>;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await makeSuperAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('66-67. a published property appears in the marketplace, and pagination works', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const page1 = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?pageSize=1&page=1')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(page1.body.items.length).toBe(1);
    expect(page1.body.meta.totalItems).toBeGreaterThanOrEqual(2);

    const page2 = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?pageSize=1&page=2')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(page2.body.items[0].publicationId).not.toBe(
      page1.body.items[0].publicationId,
    );
  });

  it('68. text search matches title/description/city', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { publicTitle: 'Searchable Unique Palace' },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?search=Searchable Unique')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(
      (response.body.items as { title: string }[]).some(
        (i) => i.title === 'Searchable Unique Palace',
      ),
    ).toBe(true);
  });

  it('69-70. property type and SALE/RENT filters work', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      { propertyType: 'VILLA', listingPurpose: 'RENT' },
      { propertyType: 'VILLA', listingPurpose: 'RENT' },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(
        '/api/v1/marketplace/properties?propertyType=VILLA&listingPurpose=RENT',
      )
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(
      (
        response.body.items as {
          propertyType: string;
          listingPurpose: string;
        }[]
      ).every((i) => i.propertyType === 'VILLA' && i.listingPurpose === 'RENT'),
    ).toBe(true);
  });

  it('71. price range filter works', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { publicPrice: 999999 },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?priceMin=999000&priceMax=1000000')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(
      (response.body.items as { price: number }[]).every(
        (i) => i.price === 999999,
      ),
    ).toBe(true);
  });

  it('72-73. bedrooms/bathrooms minimum filters work', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { bedrooms: 5, bathrooms: 4 },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?bedroomsMin=5&bathroomsMin=4')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(
      (response.body.items as { bedrooms: number; bathrooms: number }[]).every(
        (i) => i.bedrooms >= 5 && i.bathrooms >= 4,
      ),
    ).toBe(true);
  });

  it('74. area range filter works', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { areaSqm: 321 },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?areaMin=320&areaMax=322')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(
      (response.body.items as { areaSqm: number }[]).every(
        (i) => i.areaSqm === 321,
      ),
    ).toBe(true);
  });

  it('75-76. city and area filters work', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      {
        publicCity: 'Byblos',
        publicArea: 'Old Souk',
        locationVisibility: 'PUBLIC_APPROXIMATE',
      },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?city=Byblos&area=Old Souk')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(
      (
        response.body.items as { location: { city: string; area: string } }[]
      ).every(
        (i) => i.location.city === 'Byblos' && i.location.area === 'Old Souk',
      ),
    ).toBe(true);
  });

  it('77. feature filter works', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { publicFeatureKeys: ['sea_view', 'pool'] },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?features=sea_view')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('78-80. newest / price ascending / price descending sorts work', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { publicTitle: 'Cheap One', publicPrice: 50000 },
    );
    await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { publicTitle: 'Expensive One', publicPrice: 5000000 },
    );

    const viewer = await registerVerifiedAgent(testApp);

    const asc = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?sort=price_asc&pageSize=50')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    const ascPrices = (asc.body.items as { price: number }[]).map(
      (i) => i.price,
    );
    expect([...ascPrices].sort((a, b) => a - b)).toEqual(ascPrices);

    const desc = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?sort=price_desc&pageSize=50')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    const descPrices = (desc.body.items as { price: number }[]).map(
      (i) => i.price,
    );
    expect([...descPrices].sort((a, b) => b - a)).toEqual(descPrices);

    const newest = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties?sort=newest&pageSize=50')
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(newest.body.items.length).toBeGreaterThanOrEqual(2);
  });

  it('81. the detail endpoint returns the full public detail', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body.publicationId).toBe(publicationId);
    expect(response.body.description).toBeDefined();
    expect(Array.isArray(response.body.media)).toBe(true);
  });

  it('82. an unavailable/nonexistent publication returns a safe 404 (never distinguishable)', async () => {
    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(
        '/api/v1/marketplace/properties/00000000-0000-0000-0000-000000000000',
      )
      .set(...authHeader(viewer.accessToken))
      .expect(404);
  });

  it('83-84. PRIVATE/WORKSPACE location never exposes coordinates or even city/area', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { locationVisibility: 'PRIVATE', publicCity: 'ShouldBeHidden' },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body.location.city).toBeNull();
    expect(response.body.location.area).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain('ShouldBeHidden');
  });

  it('85. PUBLIC_APPROXIMATE exposes city/area but never exact coordinates', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { locationVisibility: 'PUBLIC_APPROXIMATE', publicCity: 'Batroun' },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body.location.city).toBe('Batroun');
    expect(response.body.location.exactLatitude).toBeUndefined();
    expect(response.body.location.exactLongitude).toBeUndefined();
  });

  it('86. PUBLIC_EXACT exposes the approved public coordinates', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(owner.accessToken))
      .send({
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        title: 'Exact Location Property',
        price: 100000,
        currency: 'USD',
        location: { latitude: 33.98, longitude: 35.62, city: 'Jounieh' },
      })
      .expect(201);

    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.body.id,
      owner.accessToken,
    );
    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.body.id,
      owner.accessToken,
      [media.id],
      { locationVisibility: 'PUBLIC_EXACT', publicCity: 'Jounieh' },
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      property.body.id,
      owner.accessToken,
    );
    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.body.id },
      });
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publication.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body.location.exactLatitude).toBeCloseTo(33.98);
    expect(response.body.location.exactLongitude).toBeCloseTo(35.62);
  });

  it('87. a marketplace viewer cannot call the professional exact-location endpoint without workspace authorization', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { propertyId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(403);
  });
});
