import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  inviteAndActivateEmployee,
  registerClient,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
  verifyEmailAndPhone,
} from './utils/flows';

describe('Property access security', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('1. a client cannot access professional property endpoints (no workspace at all)', async () => {
    const client = await registerClient(testApp);
    await verifyEmailAndPhone(testApp, client);
    const login = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: client.email, password: client.password })
      .expect(200);
    const clientToken = login.body.tokens.accessToken as string;

    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(clientToken))
      .expect(403);
  });

  it('2. an agent cannot access another agent’s personal workspace property', async () => {
    const agentA = await registerVerifiedAgent(testApp);
    const personalWorkspaceA = await testApp.prisma.workspace.findUniqueOrThrow(
      {
        where: { personalOwnerUserId: agentA.id },
      },
    );
    await createProperty(testApp, personalWorkspaceA.id, agentA.accessToken);

    const agentB = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWorkspaceA.id}/properties`)
      .set(...authHeader(agentB.accessToken))
      .expect(403);
  });

  it('3. a company member cannot access an unauthorized (different company) workspace’s properties', async () => {
    const companyA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const companyB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const employeeB = await inviteAndActivateEmployee(
      testApp,
      companyB.workspaceId,
      companyB.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${companyA.workspaceId}/properties`)
      .set(...authHeader(employeeB.accessToken))
      .expect(403);
  });

  it('4. an active authorized member with property.view can list properties', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('5. missing property.view gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const noViewRole = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'NO_PROPERTY_VIEW',
        name: 'No Property View',
        permissionKeys: ['workspace.view'],
      })
      .expect(201);

    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: noViewRole.body.id,
      },
    );

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(member.accessToken))
      .expect(403);
  });

  it('6. missing property.create gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
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

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(viewer.accessToken))
      .send({
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        title: 'x',
        price: 1,
        currency: 'USD',
      })
      .expect(403);
  });

  it('7. missing property.edit gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
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

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
      )
      .set(...authHeader(viewer.accessToken))
      .send({ title: 'changed' })
      .expect(403);
  });

  it('8. missing property.archive gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
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

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(viewer.accessToken))
      .expect(403);
  });

  it('9. guessing a property UUID from another workspace cannot bypass workspace authorization', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const propertyInA = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );

    // ownerB IS an authorized member of their own workspace, but the
    // property id belongs to a different workspace entirely.
    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${ownerB.workspaceId}/properties/${propertyInA.id}`,
      )
      .set(...authHeader(ownerB.accessToken))
      .expect(404);
  });
});
