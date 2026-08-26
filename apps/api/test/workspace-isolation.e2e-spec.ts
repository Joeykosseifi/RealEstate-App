import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  inviteAndActivateEmployee,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Workspace isolation', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('1. a user cannot access a workspace they do not belong to', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const outsider = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(outsider.accessToken))
      .expect(403);
  });

  it('2. a removed member cannot access the workspace', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/members/${employee.membershipId}/remove`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ reason: 'no longer needed' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(employee.accessToken))
      .expect(403);
  });

  it('3. a suspended member cannot access the workspace', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/members/${employee.membershipId}/suspend`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ reason: 'under review' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(employee.accessToken))
      .expect(403);
  });

  it('4. an active member can access a workspace they are permitted in', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(employee.accessToken))
      .expect(200);

    expect(response.body.id).toBe(owner.workspaceId);
  });

  it('5. a user belonging to two workspaces gets correct access per workspace', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');

    // Same person joins both companies as an employee.
    const agent = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/invitations`)
      .set(...authHeader(ownerA.accessToken))
      .send({ email: agent.email, membershipType: 'EMPLOYEE' })
      .expect(201);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/invitations/accept`)
      .set(...authHeader(agent.accessToken))
      .expect(204);

    // Not invited to workspace B — must still be forbidden there.
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${ownerB.workspaceId}`)
      .set(...authHeader(agent.accessToken))
      .expect(403);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${ownerA.workspaceId}`)
      .set(...authHeader(agent.accessToken))
      .expect(200);
  });

  it('6. personal and company workspace permissions remain isolated', async () => {
    const agent = await registerVerifiedAgent(testApp);
    const companyOwner = await registerVerifiedCompanyOwner(testApp);

    const personalWorkspace = await testApp.prisma.workspace.findUniqueOrThrow({
      where: { personalOwnerUserId: agent.id },
    });

    // Being OWNER of their own personal workspace grants no access to an
    // unrelated company workspace.
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${companyOwner.workspaceId}`)
      .set(...authHeader(agent.accessToken))
      .expect(403);

    // And the company owner has no access to the agent's personal workspace.
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWorkspace.id}`)
      .set(...authHeader(companyOwner.accessToken))
      .expect(403);

    // A personal workspace is not a COMPANY workspace — inviting into it
    // is rejected even though its owner holds the WORKSPACE_OWNER role.
    const otherAgent = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWorkspace.id}/invitations`)
      .set(...authHeader(agent.accessToken))
      .send({ email: otherAgent.email, membershipType: 'EMPLOYEE' })
      .expect(400);
  });
});
