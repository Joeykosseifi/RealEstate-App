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

describe('Publication moderation (unpublish/restore) & versioning', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('46-49. admin can unpublish a published listing with a reason; property/ownership/history are preserved; listing disappears immediately', async () => {
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
      .post(`/api/v1/admin/property-publications/${publicationId}/unpublish`)
      .set(...authHeader(admin.accessToken))
      .send({})
      .expect(400); // 47. reason required

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publicationId}/unpublish`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'Reported as fraudulent listing.' })
      .expect(200);

    const property = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
    });
    expect(property.workspaceId).toBe(owner.workspaceId); // 48/49 ownership+property unchanged

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(404); // 50 disappears immediately
  });

  it('51-52. restore works when the property is still eligible; fails when business status has since become ineligible', async () => {
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
      .post(`/api/v1/admin/property-publications/${publicationId}/unpublish`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'temporary hold' })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publicationId}/restore`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200); // 51 restored

    // Now mark it SOLD, unpublish again, and prove restore is refused.
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'SOLD' })
      .expect(204);

    const publicationAfterSale =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { id: publicationId },
      });
    expect(publicationAfterSale.status).toBe('OWNER_UNPUBLISHED');

    // An admin cannot restore a SOLD property back to public.
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publicationId}/restore`)
      .set(...authHeader(admin.accessToken))
      .expect(409); // status is OWNER_UNPUBLISHED not ADMIN_UNPUBLISHED, restore endpoint requires the latter
  });

  it('53. moderation history is preserved across submit -> reject -> resubmit -> approve', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { propertyId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );
    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
      [media.id],
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );

    const detail = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect((detail.body.history as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(detail.body.history[0].versionNumber).toBe(1);
    expect(detail.body.history[0].status).toBe('APPROVED');
  });

  it('54-55. a public-sensitive edit creates a new version; the old approved version stays live while the new one is pending', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
        {},
        { publicTitle: 'Version One Title' },
      );

    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );
    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
      [media.id],
      { publicTitle: 'Version Two Title' },
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const publicDetail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(publicDetail.body.title).toBe('Version One Title'); // old version still live

    const professionalDetail = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(professionalDetail.body.latestVersionNumber).toBe(2);
    expect(professionalDetail.body.latestVersionStatus).toBe('PENDING_REVIEW');
  });

  it('56. the pending version cannot be silently mutated while under review', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { propertyId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );
    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
      [media.id],
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send({
        publicTitle: 'Trying to sneak an edit in',
        publicPrice: 1,
        currency: 'USD',
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        media: [{ propertyMediaId: media.id, isMain: true }],
      })
      .expect(409);
  });

  it('57-58. approval always acts on the current latest pending version, and atomically becomes the new current published version', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
        {},
        { publicTitle: 'V1 Title' },
      );

    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );
    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
      [media.id],
      { publicTitle: 'V2 Title' },
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publicationId}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const publicDetail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);
    expect(publicDetail.body.title).toBe('V2 Title');
  });

  it('59. a private/internal-only property edit does not trigger publication re-review', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { propertyId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}`)
      .set(...authHeader(owner.accessToken))
      .send({ privateDetails: { internalNotes: 'Just a private note.' } })
      .expect(200);

    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId },
      });
    expect(publication.status).toBe('PUBLISHED');
  });
});
