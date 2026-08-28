import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  grantPlatformRole,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Business-status safety — SOLD/RENTED/ARCHIVED never stay marketed', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('61. a SOLD property disappears from the marketplace and its publication is auto-unpublished', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
      );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'SOLD' })
      .expect(204);

    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { id: publicationId },
      });
    expect(publication.status).toBe('OWNER_UNPUBLISHED');

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(404);
  });

  it('62. a RENTED property disappears from the marketplace and its publication is auto-unpublished', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
        { listingPurpose: 'RENT' },
        { listingPurpose: 'RENT' },
      );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'RENTED' })
      .expect(204);

    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { id: publicationId },
      });
    expect(publication.status).toBe('OWNER_UNPUBLISHED');

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(404);
  });

  it('63. archiving a published property auto-transitions its publication to ARCHIVED and removes it from the marketplace', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
      );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { id: publicationId },
      });
    expect(publication.status).toBe('ARCHIVED');

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(404);
  });

  it('64. an AVAILABLE published property remains visible (no false-positive unpublish)', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
      );

    // A no-op / unrelated status transition must not disturb publication.
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'AVAILABLE' })
      .expect(204);

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);
  });

  it('65. a RESERVED published property remains visible — documented product decision (see docs/PERMISSIONS.md)', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
      );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'RESERVED' })
      .expect(204);

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);
  });
});
