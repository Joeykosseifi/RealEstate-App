import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  inviteAndActivateEmployee,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Client assignment', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('21. an authorized user can assign a client to a workspace member', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/assign`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ assignedToUserId: employee.id })
      .expect(200);

    expect(response.body.assignedToUserId).toBe(employee.id);
  });

  it('22. assignment target must belong to the same workspace', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const outsider = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/assign`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ assignedToUserId: outsider.id })
      .expect(409);
  });

  it('23. a suspended member cannot receive a new assignment', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/members/${employee.membershipId}/suspend`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/assign`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ assignedToUserId: employee.id })
      .expect(409);
  });

  it('24. a removed member cannot receive an assignment', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/members/${employee.membershipId}/remove`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/assign`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ assignedToUserId: employee.id })
      .expect(409);
  });

  it('25. a user without client.assign cannot assign a client', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    // AGENT has client.view/create/edit but not client.assign (see roles.catalog.ts).
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
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/assign`,
      )
      .set(...authHeader(agentMember.accessToken))
      .send({ assignedToUserId: agentMember.id })
      .expect(403);
  });

  it('26. assignment does not change workspace ownership (workspaceId/createdByUserId stay put)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/assign`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ assignedToUserId: employee.id })
      .expect(200);

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
    expect(stored.createdByUserId).toBe(owner.id);
  });
});
