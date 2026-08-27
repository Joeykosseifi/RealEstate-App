import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  inviteAndActivateEmployee,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Property location', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('30, 33, 35. valid coordinates and a Google Place ID save and can be retrieved later', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        location: {
          city: 'Beirut',
          area: 'Achrafieh',
          latitude: 33.888629,
          longitude: 35.495479,
          googlePlaceId: 'ChIJ-test-place-id',
          locationSource: 'GOOGLE_SEARCH',
        },
      },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.location.latitude).toBeCloseTo(33.888629, 5);
    expect(response.body.location.longitude).toBeCloseTo(35.495479, 5);
    expect(response.body.location.googlePlaceId).toBe('ChIJ-test-place-id');
    expect(response.body.location.locationSource).toBe('GOOGLE_SEARCH');
  });

  it('31. an invalid latitude is rejected', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(owner.accessToken))
      .send({
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        title: 'Bad lat',
        price: 1000,
        currency: 'USD',
        location: { latitude: 91, longitude: 10 },
      })
      .expect(400);
  });

  it('32. an invalid longitude is rejected', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(owner.accessToken))
      .send({
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        title: 'Bad lng',
        price: 1000,
        currency: 'USD',
        location: { latitude: 10, longitude: 181 },
      })
      .expect(400);
  });

  it('34. a manually-pinned location persists with its source recorded', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        location: {
          latitude: 40.0,
          longitude: -74.0,
          locationSource: 'MAP_PIN',
        },
      },
    );

    const stored = await testApp.prisma.propertyLocation.findUniqueOrThrow({
      where: { propertyId: property.id },
    });
    expect(stored.locationSource).toBe('MAP_PIN');
    expect(Number(stored.latitude)).toBeCloseTo(40.0, 5);
    expect(Number(stored.longitude)).toBeCloseTo(-74.0, 5);
  });

  it('36, 37. exact location is omitted without property.view_exact_location and returned with it', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        location: { latitude: 1, longitude: 2 },
      },
    );
    const viewerRole = await testApp.prisma.role.findFirstOrThrow({
      where: { workspaceId: null, key: 'VIEWER' },
    });
    const viewer = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: viewerRole.id,
      },
    );

    const asViewer = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(asViewer.body).not.toHaveProperty('location');

    const asOwner = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(asOwner.body.location).toBeDefined();
  });

  it('38. updating location cannot move a property across workspace (scoped by route, workspaceId not accepted in body)', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const propertyInA = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );

    // ownerB is authorized in their OWN workspace but the property belongs to A.
    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${ownerB.workspaceId}/properties/${propertyInA.id}/location`,
      )
      .set(...authHeader(ownerB.accessToken))
      .send({ latitude: 5, longitude: 5 })
      .expect(404);

    // The dedicated location DTO has no workspaceId field at all.
    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${ownerA.workspaceId}/properties/${propertyInA.id}/location`,
      )
      .set(...authHeader(ownerA.accessToken))
      .send({ latitude: 5, longitude: 5, workspaceId: ownerB.workspaceId })
      .expect(400);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: propertyInA.id },
    });
    expect(stored.workspaceId).toBe(ownerA.workspaceId);
  });
});
