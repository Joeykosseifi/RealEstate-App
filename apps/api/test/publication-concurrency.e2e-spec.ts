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
  submitPublication,
  uploadPropertyImage,
} from './utils/flows';

async function makeAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

async function submittedPublication(
  testApp: TestApp,
  owner: { workspaceId: string; accessToken: string },
) {
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
  await submitPublication(
    testApp,
    owner.workspaceId,
    property.id,
    owner.accessToken,
  );
  return testApp.prisma.propertyPublication.findUniqueOrThrow({
    where: { propertyId: property.id },
  });
}

describe('Publication & favorites concurrency', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('approve vs. reject racing on the same publication: exactly one wins, the other gets a 409, never a corrupted mixed state', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeAdmin(testApp);
    const publication = await submittedPublication(testApp, owner);

    const [approveResult, rejectResult] = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
        .set(...authHeader(admin.accessToken)),
      request(testApp.app.getHttpServer())
        .post(`/api/v1/admin/property-publications/${publication.id}/reject`)
        .set(...authHeader(admin.accessToken))
        .send({ reason: 'racing rejection' }),
    ]);

    const statuses = [approveResult, rejectResult].map((r) =>
      r.status === 'fulfilled' ? r.value.status : -1,
    );
    // Exactly one of the two succeeds (200); the other is rejected as a conflict (409).
    expect(statuses.filter((s) => s === 200).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(1);

    const finalState =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { id: publication.id },
      });
    expect(['PUBLISHED', 'REJECTED']).toContain(finalState.status);
  });

  it('two simultaneous approvals: only one actually transitions the publication; the second is rejected', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeAdmin(testApp);
    const publication = await submittedPublication(testApp, owner);

    const results = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
        .set(...authHeader(admin.accessToken)),
      request(testApp.app.getHttpServer())
        .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
        .set(...authHeader(admin.accessToken)),
    ]);

    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? r.value.status : -1,
    );
    expect(statuses.filter((s) => s === 200).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(1);
  });

  it('submit vs. concurrent draft edit: the edit either lands before submission or is rejected once pending — never a torn write', async () => {
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

    const results = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .post(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
        )
        .set(...authHeader(owner.accessToken)),
      request(testApp.app.getHttpServer())
        .put(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
        )
        .set(...authHeader(owner.accessToken))
        .send({
          publicTitle: 'Racing Edit',
          publicPrice: 200000,
          currency: 'USD',
          propertyType: 'APARTMENT',
          listingPurpose: 'SALE',
          media: [{ propertyMediaId: media.id, isMain: true }],
        }),
    ]);

    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? r.value.status : -1,
    );
    // Both requests must resolve to a well-defined status — no 500s from a data race.
    expect(statuses.every((s) => [200, 409].includes(s))).toBe(true);

    const finalPublication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.id },
      });
    // The version count must remain internally consistent regardless of ordering.
    const versionCount = await testApp.prisma.propertyPublicationVersion.count({
      where: { publicationId: finalPublication.id },
    });
    expect(versionCount).toBe(1);
  });

  it('admin approving a stale (already-decided) publication id fails safely instead of double-publishing', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeAdmin(testApp);
    const publication = await submittedPublication(testApp, owner);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    // A second admin, unaware the first already approved, retries — must be a safe 409.
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(409);
  });

  it('duplicate concurrent favorite requests never create two rows — the DB unique constraint is the real guarantee', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeAdmin(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );
    const viewer = await registerVerifiedAgent(testApp);

    await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
        .set(...authHeader(viewer.accessToken)),
      request(testApp.app.getHttpServer())
        .post(`/api/v1/marketplace/properties/${publicationId}/favorite`)
        .set(...authHeader(viewer.accessToken)),
    ]);

    const count = await testApp.prisma.marketplaceFavorite.count({
      where: { userId: viewer.id, publicationId },
    });
    expect(count).toBe(1);
  });
});
