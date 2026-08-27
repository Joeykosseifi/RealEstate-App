import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  getPersonalWorkspaceId,
  inviteAndActivateEmployee,
  registerClient,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
  verifyEmailAndPhone,
} from './utils/flows';

describe('Client CRM access security', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('1. a platform CLIENT account cannot access professional CRM endpoints (no workspace at all)', async () => {
    const client = await registerClient(testApp);
    await verifyEmailAndPhone(testApp, client);
    const login = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: client.email, password: client.password })
      .expect(200);
    const clientToken = login.body.tokens.accessToken as string;

    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(clientToken))
      .expect(403);
  });

  it("2. an agent cannot access another agent's personal workspace clients", async () => {
    const agentA = await registerVerifiedAgent(testApp);
    const workspaceA = await getPersonalWorkspaceId(testApp, agentA.id);
    await createClient(testApp, workspaceA, agentA.accessToken);

    const agentB = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceA}/clients`)
      .set(...authHeader(agentB.accessToken))
      .expect(403);
  });

  it("3. a company member cannot access an unauthorized (different company) workspace's clients", async () => {
    const companyA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const companyB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const employeeB = await inviteAndActivateEmployee(
      testApp,
      companyB.workspaceId,
      companyB.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${companyA.workspaceId}/clients`)
      .set(...authHeader(employeeB.accessToken))
      .expect(403);
  });

  it('4. an authorized member with client.view can list clients', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createClient(testApp, owner.workspaceId, owner.accessToken);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('5. missing client.view gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const role = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'NO_CLIENT_VIEW',
        name: 'No Client View',
        permissionKeys: ['workspace.view'],
      })
      .expect(201);
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: role.body.id,
      },
    );

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(member.accessToken))
      .expect(403);
  });

  it('6. missing client.create gives 403', async () => {
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
      .post(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(viewer.accessToken))
      .send({ firstName: 'Jane', lastName: 'Doe', phone: '+96170000000' })
      .expect(403);
  });

  it('7. missing client.edit gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
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
      .patch(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
      .set(...authHeader(viewer.accessToken))
      .send({ firstName: 'Changed' })
      .expect(403);
  });

  it('8. missing client.archive gives 403', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    // AGENT has client.view/create/edit but not client.archive (see roles.catalog.ts).
    const agentRole = await testApp.prisma.role.findFirstOrThrow({
      where: { workspaceId: null, key: 'AGENT' },
    });
    const agentMember = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: agentRole.id,
      },
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/archive`,
      )
      .set(...authHeader(agentMember.accessToken))
      .expect(403);
  });

  it('9. guessing a client UUID from another workspace cannot bypass workspace isolation', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const clientInA = await createClient(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${ownerB.workspaceId}/clients/${clientInA.id}`)
      .set(...authHeader(ownerB.accessToken))
      .expect(404);
  });

  it('10. a CRM client record does not require a platform account — platformUserId stays null', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(stored.platformUserId).toBeNull();
  });
});
