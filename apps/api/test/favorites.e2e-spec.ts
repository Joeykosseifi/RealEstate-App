import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  createProperty,
  grantPlatformRole,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
  savePublicationDraft,
  uploadPropertyImage,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Marketplace favorites', () => {
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

  it('95-96. an authenticated user can favorite a published listing; duplicate favorite is idempotent, not an error', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    const viewer = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
      .set(...authHeader(viewer.accessToken))
      .expect(204);

    // Duplicate — idempotent, never a 500 or leaked constraint error.
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
      .set(...authHeader(viewer.accessToken))
      .expect(204);

    const count = await testApp.prisma.marketplaceFavorite.count({
      where: { userId: viewer.id, publicationId },
    });
    expect(count).toBe(1);
  });

  it('97. a user can unfavorite', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
      .set(...authHeader(viewer.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/marketplace/properties/${publicationId}/favorite`)
      .set(...authHeader(viewer.accessToken))
      .expect(204);

    const count = await testApp.prisma.marketplaceFavorite.count({
      where: { userId: viewer.id, publicationId },
    });
    expect(count).toBe(0);
  });

  it('98. favorites lists are isolated per user', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    const viewerA = await registerVerifiedAgent(testApp);
    const viewerB = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
      .set(...authHeader(viewerA.accessToken))
      .expect(204);

    const listA = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/favorites')
      .set(...authHeader(viewerA.accessToken))
      .expect(200);
    expect(listA.body.items.length).toBe(1);

    const listB = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/favorites')
      .set(...authHeader(viewerB.accessToken))
      .expect(200);
    expect(listB.body.items.length).toBe(0);
  });

  it('99. a user cannot favorite a private (never-submitted) publication', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );
    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      [media.id],
    );
    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.id },
      });

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/marketplace/properties/${publication.id}/favorite`)
      .set(...authHeader(viewer.accessToken))
      .expect(404);
  });

  it('100-101. a favorite of a listing that later becomes unavailable is hidden (listing: null), never resurrected or granting private access', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
      .set(...authHeader(viewer.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publicationId}/unpublish`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'testing hidden favorite behavior' })
      .expect(200);

    const list = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/favorites')
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(list.body.items.length).toBe(1);
    expect(list.body.items[0].listing).toBeNull();
    expect(JSON.stringify(list.body)).not.toContain('storageKey');
  });
});
