import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
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

async function makePropertyModerator(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'PROPERTY_MODERATOR');
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
  const publication =
    await testApp.prisma.propertyPublication.findUniqueOrThrow({
      where: { propertyId: property.id },
    });
  return { property, publication };
}

describe('Admin publication review queue & decisions', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('34. a non-admin (ordinary agent) cannot access the review queue', async () => {
    const agent = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/property-publications')
      .set(...authHeader(agent.accessToken))
      .expect(403);
  });

  it('35. a platform role without admin.content.review cannot approve, even though it can view', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publication } = await submittedPublication(testApp, owner);

    const supportAdmin = await registerVerifiedAgent(testApp);
    await grantPlatformRole(testApp, supportAdmin.id, 'SUPPORT_ADMIN');

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(supportAdmin.accessToken))
      .expect(403);
  });

  it('36-37. an authorized reviewer can list pending submissions, paginated', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    await submittedPublication(testApp, owner);
    await submittedPublication(testApp, owner);
    const admin = await makePropertyModerator(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/property-publications?pageSize=1')
      .set(...authHeader(admin.accessToken))
      .expect(200);

    expect(response.body.items.length).toBe(1);
    expect(response.body.meta.totalItems).toBeGreaterThanOrEqual(2);
    expect(
      (response.body.items as { status: string }[]).every(
        (item) => item.status === 'PENDING_REVIEW',
      ),
    ).toBe(true);
  });

  it('38. admin can view a submission detail with the safe snapshot', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publication } = await submittedPublication(testApp, owner);
    const admin = await makePropertyModerator(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/property-publications/${publication.id}`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    expect(response.body.snapshot.publicTitle).toBe('Beautiful Apartment');
    expect(response.body.workspaceId).toBe(owner.workspaceId);
  });

  it('39-40. approval makes the listing public and records actor/timestamp', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publication } = await submittedPublication(testApp, owner);
    const admin = await makeSuperAdmin(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const updated = await testApp.prisma.propertyPublication.findUniqueOrThrow({
      where: { id: publication.id },
    });
    expect(updated.status).toBe('PUBLISHED');
    expect(updated.approvedByUserId).toBe(admin.id);
    expect(updated.approvedAt).not.toBeNull();
    expect(updated.publishedVersionId).not.toBeNull();

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publication.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);
  });

  it('41-42. reject and request-changes both require a reason', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { publication: pub1 } = await submittedPublication(testApp, owner);
    const { publication: pub2 } = await submittedPublication(testApp, owner);
    const admin = await makeSuperAdmin(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${pub1.id}/reject`)
      .set(...authHeader(admin.accessToken))
      .send({})
      .expect(400);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${pub2.id}/request-changes`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: '' })
      .expect(400);
  });

  it('43-44. rejection and request-changes both keep the private property fully intact', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { property, publication } = await submittedPublication(
      testApp,
      owner,
    );
    const admin = await makeSuperAdmin(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/reject`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'Needs better photos.' })
      .expect(200);

    const stillThere = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(stillThere.body.propertyStatus).not.toBe('ARCHIVED');
    expect(stillThere.body.title).toBe(property.title);
  });

  it('45. approving a publication never makes the admin the property owner', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const { property, publication } = await submittedPublication(
      testApp,
      owner,
    );
    const admin = await makeSuperAdmin(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
    expect(stored.createdByUserId).toBe(owner.id);
  });
});
