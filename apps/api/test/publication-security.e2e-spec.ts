import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  createProperty,
  grantPlatformRole,
  inviteAndActivateEmployee,
  minimalPublicationDraftPayload,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
  registerVerifiedClient,
  registerVerifiedCompanyOwner,
  savePublicationDraft,
  submitPublication,
  uploadPropertyImage,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Publication security & authorization', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it("1. a CLIENT account (no workspace of its own) cannot create a publication draft on another workspace's property", async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const client = await registerVerifiedClient(testApp);

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(client.accessToken))
      .send(minimalPublicationDraftPayload([]))
      .expect(403);
  });

  it('2. an agent without property.publish cannot save/submit a publication draft', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const viewerRole = await testApp.prisma.role.findFirstOrThrow({
      where: { key: 'VIEWER', scope: 'WORKSPACE' },
    });
    const viewer = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: viewerRole.id,
      },
    );

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(viewer.accessToken))
      .send(minimalPublicationDraftPayload([]))
      .expect(403);
  });

  it("3. an agent cannot publish another workspace's property (404, not 403)", async () => {
    const ownerA = await registerVerifiedAgentWithWorkspace(testApp);
    const ownerB = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${ownerB.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(ownerB.accessToken))
      .send(minimalPublicationDraftPayload([]))
      .expect(404);
  });

  it('4. a company member without property.publish cannot publish a company property', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const managerRole = await testApp.prisma.role.findFirstOrThrow({
      where: { key: 'VIEWER', scope: 'WORKSPACE' },
    });
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId: managerRole.id },
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(employee.accessToken))
      .expect(403);
  });

  it('5. guessing a UUID cannot bypass workspace isolation on the publication detail endpoint', async () => {
    const ownerA = await registerVerifiedAgentWithWorkspace(testApp);
    const ownerB = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const media = await uploadPropertyImage(
      testApp,
      ownerA.workspaceId,
      property.id,
      ownerA.accessToken,
    );
    await savePublicationDraft(
      testApp,
      ownerA.workspaceId,
      property.id,
      ownerA.accessToken,
      [media.id],
    );

    // ownerB guesses ownerA's propertyId under their OWN workspace path.
    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${ownerB.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(ownerB.accessToken))
      .expect(404);
  });

  it('6. a DRAFT (never submitted) property never appears in the marketplace', async () => {
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

    const viewer = await registerVerifiedAgent(testApp);
    const marketplace = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties')
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(
      (marketplace.body.items as { title: string }[]).some(
        (item) => item.title === (property.title as string),
      ),
    ).toBe(false);
  });

  it('7. a PENDING_REVIEW property never appears in the marketplace', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        title: 'Pending Review Unique Title',
      },
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

    const viewer = await registerVerifiedAgent(testApp);
    const marketplace = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties')
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(
      (marketplace.body.items as { title: string }[]).some(
        (item) => item.title === 'Pending Review Unique Title',
      ),
    ).toBe(false);
  });

  it('8. a REJECTED property never appears in the marketplace', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        title: 'Rejected Unique Title',
      },
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
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/reject`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'Photos are low quality.' })
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const marketplace = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties')
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(
      (marketplace.body.items as { title: string }[]).some(
        (item) => item.title === 'Rejected Unique Title',
      ),
    ).toBe(false);
  });

  it('9. a CHANGES_REQUESTED property never appears in the marketplace', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        title: 'Changes Requested Unique Title',
      },
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
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/admin/property-publications/${publication.id}/request-changes`,
      )
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'Please add a floor plan.' })
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const marketplace = await request(testApp.app.getHttpServer())
      .get('/api/v1/marketplace/properties')
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(
      (marketplace.body.items as { title: string }[]).some(
        (item) => item.title === 'Changes Requested Unique Title',
      ),
    ).toBe(false);
  });

  it('10. an ADMIN_UNPUBLISHED property never appears in the marketplace', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      { title: 'Admin Unpublished Unique Title' },
    );

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publicationId}/unpublish`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'Policy violation.' })
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(404);
  });

  it('11. only the currently-published version appears — an older, superseded version is never mistakenly exposed', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
        {},
        { publicTitle: 'Original Title V1' },
      );

    // Edit + resubmit a new version — the published one must stay V1 until approved again.
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
      { publicTitle: 'Updated Title V2' },
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      propertyId,
      owner.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(detail.body.title).toBe('Original Title V1');
  });

  it('12. workspace-level authorization never grants platform admin moderation power', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
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

    // The company OWNER — full workspace authorization — has zero platform permissions.
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(owner.accessToken))
      .expect(403);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/property-publications')
      .set(...authHeader(owner.accessToken))
      .expect(403);
  });
});
