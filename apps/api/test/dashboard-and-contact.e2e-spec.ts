import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  createClient,
  createProperty,
  grantPlatformRole,
  inviteAndActivateEmployee,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

/**
 * Milestone 6 — workspace dashboard aggregate + public contact info.
 * See docs/PRODUCT.md "Professional dashboard" and "Public professional
 * contact".
 */
describe('Workspace dashboard + public contact info', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('1. dashboard reflects real property/client counts and recent items — never fabricated', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);

    const empty = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(empty.body.properties.total).toBe(0);
    expect(empty.body.properties.private).toBe(0);
    expect(empty.body.properties.recent).toEqual([]);
    expect(empty.body.clients.total).toBe(0);

    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        title: 'Dashboard Test Villa',
      },
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        firstName: 'Dash',
        lastName: 'Board',
      },
    );

    const after = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(after.body.properties.total).toBe(1);
    expect(after.body.properties.private).toBe(1);
    expect(after.body.properties.byBusinessStatus.AVAILABLE).toBe(1);
    expect(after.body.properties.published).toBe(0);
    expect(after.body.properties.pendingReview).toBe(0);
    expect(after.body.properties.recent[0].id).toBe(property.id);
    expect(after.body.clients.total).toBe(1);
    expect(after.body.clients.recent[0].id).toBe(client.id);
  });

  it('2. a member without property.view gets no properties section; one without client.view gets no clients section', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    const clientOnlyRole = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'CLIENT_ONLY_VIEWER',
        name: 'Client-only viewer',
        permissionKeys: ['workspace.view', 'client.view'],
      })
      .expect(201);

    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId: clientOnlyRole.body.id as string },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard`)
      .set(...authHeader(member.accessToken))
      .expect(200);

    expect(response.body.properties).toBeUndefined();
    expect(response.body.clients).toBeDefined();
  });

  it("3. a member cannot read or modify another workspace's dashboard/contact info", async () => {
    const ownerA = await registerVerifiedAgentWithWorkspace(testApp);
    const ownerB = await registerVerifiedAgentWithWorkspace(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${ownerA.workspaceId}/dashboard`)
      .set(...authHeader(ownerB.accessToken))
      .expect(403);

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${ownerA.workspaceId}/contact`)
      .set(...authHeader(ownerB.accessToken))
      .send({ publicContactPhone: '+15550000000' })
      .expect(403);
  });

  it('4. owner can set and clear public contact fields; an empty string clears, an omitted field is untouched', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/contact`)
      .set(...authHeader(owner.accessToken))
      .send({
        publicContactPhone: '+15551234567',
        publicContactEmail: 'agent@example.test',
        publicContactWhatsapp: '+15551234567',
      })
      .expect(204);

    const detail1 = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(detail1.body.publicContactPhone).toBe('+15551234567');
    expect(detail1.body.publicContactEmail).toBe('agent@example.test');

    // Omitting publicContactEmail leaves it untouched; clearing phone via ''.
    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/contact`)
      .set(...authHeader(owner.accessToken))
      .send({ publicContactPhone: '' })
      .expect(204);

    const detail2 = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(detail2.body.publicContactPhone).toBeNull();
    expect(detail2.body.publicContactEmail).toBe('agent@example.test');
  });

  it('5. a member without workspace.update cannot change public contact info', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const viewerRole = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'VIEW_ONLY',
        name: 'View only',
        permissionKeys: ['workspace.view'],
      })
      .expect(201);
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId: viewerRole.body.id as string },
    );

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/contact`)
      .set(...authHeader(member.accessToken))
      .send({ publicContactPhone: '+15550000000' })
      .expect(403);
  });

  it('6. rejects an invalid email but still allows the empty-string clear', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/contact`)
      .set(...authHeader(owner.accessToken))
      .send({ publicContactEmail: 'not-an-email' })
      .expect(400);

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/contact`)
      .set(...authHeader(owner.accessToken))
      .send({ publicContactEmail: '' })
      .expect(204);
  });

  it("7. an approved listing exposes only the workspace's explicit opt-in contact info — never a private login email/phone", async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/contact`)
      .set(...authHeader(owner.accessToken))
      .send({ publicContactPhone: '+15559990000' })
      .expect(204);

    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(detail.body.identity.contactPhone).toBe('+15559990000');
    expect(detail.body.identity.contactEmail).toBeUndefined();
    expect(JSON.stringify(detail.body)).not.toContain(owner.email);
    expect(JSON.stringify(detail.body)).not.toContain(owner.phone);
  });
});
