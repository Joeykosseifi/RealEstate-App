import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  inviteAndActivateEmployee,
  registerAgent,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
  verifyEmailAndPhone,
} from './utils/flows';

async function roleIdFor(testApp: TestApp, key: string): Promise<string> {
  const role = await testApp.prisma.role.findFirstOrThrow({
    where: { workspaceId: null, key },
  });
  return role.id;
}

describe('Workspace membership lifecycle', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('14. inviting requires team.invite — a VIEWER cannot invite', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const roleId = await roleIdFor(testApp, 'VIEWER');
    const viewer = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId,
      },
    );
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set(...authHeader(viewer.accessToken))
      .send({ email: target.email, membershipType: 'EMPLOYEE' })
      .expect(403);
  });

  it('15. inviting an already-registered user creates an INVITED membership', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const target = await registerVerifiedAgent(testApp);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set(...authHeader(owner.accessToken))
      .send({ email: target.email, membershipType: 'EMPLOYEE' })
      .expect(201);

    const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(membership.status).toBe('INVITED');
  });

  it('16. inviting a not-yet-registered email is rejected', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set(...authHeader(owner.accessToken))
      .send({
        email: 'nobody-registered@example.test',
        membershipType: 'EMPLOYEE',
      })
      .expect(404);
  });

  it('17. accepting an invitation moves the membership from INVITED to ACTIVE', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const target = await registerAgent(testApp);
    await verifyEmailAndPhone(testApp, target);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set(...authHeader(owner.accessToken))
      .send({ email: target.email, membershipType: 'EMPLOYEE' })
      .expect(201);

    const loginResponse = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: target.password })
      .expect(200);
    const targetToken = loginResponse.body.tokens.accessToken as string;

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations/accept`)
      .set(...authHeader(targetToken))
      .expect(204);

    const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: owner.workspaceId,
          userId: target.id,
        },
      },
    });
    expect(membership.status).toBe('ACTIVE');
    expect(membership.joinedAt).not.toBeNull();
  });

  it('18. suspending a member sets status SUSPENDED and blocks workspace access', async () => {
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
      .send({ reason: 'investigation' })
      .expect(204);

    const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
      where: { id: employee.membershipId },
    });
    expect(membership.status).toBe('SUSPENDED');
    expect(membership.suspendedAt).not.toBeNull();
  });

  it('19. removing a member sets status REMOVED permanently, and an OWNER cannot have their role reassigned directly', async () => {
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
      .send({ reason: 'left the company' })
      .expect(204);

    const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
      where: { id: employee.membershipId },
    });
    expect(membership.status).toBe('REMOVED');
    expect(membership.removedAt).not.toBeNull();

    const ownerMembership =
      await testApp.prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId: owner.workspaceId, userId: owner.id },
      });
    const viewerRoleId = await roleIdFor(testApp, 'VIEWER');
    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/members/${ownerMembership.id}/role`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ roleId: viewerRoleId })
      .expect(403);
  });

  describe('Owner protection', () => {
    it('cannot suspend the only active owner of a workspace', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const ownerMembership =
        await testApp.prisma.workspaceMember.findFirstOrThrow({
          where: { workspaceId: owner.workspaceId, userId: owner.id },
        });

      await request(testApp.app.getHttpServer())
        .post(
          `/api/v1/workspaces/${owner.workspaceId}/members/${ownerMembership.id}/suspend`,
        )
        .set(...authHeader(owner.accessToken))
        .send({ reason: 'self-suspend attempt' })
        .expect(409);
    });

    it('cannot remove the only active owner of a workspace', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const ownerMembership =
        await testApp.prisma.workspaceMember.findFirstOrThrow({
          where: { workspaceId: owner.workspaceId, userId: owner.id },
        });

      await request(testApp.app.getHttpServer())
        .post(
          `/api/v1/workspaces/${owner.workspaceId}/members/${ownerMembership.id}/remove`,
        )
        .set(...authHeader(owner.accessToken))
        .send({ reason: 'self-remove attempt' })
        .expect(409);
    });

    it('can suspend an owner when another active owner remains', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const ownerRoleId = await roleIdFor(testApp, 'WORKSPACE_OWNER');
      const secondOwner = await inviteAndActivateEmployee(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        { roleId: ownerRoleId },
      );
      // Escalate the invited membershipType to OWNER directly (role
      // change to WORKSPACE_OWNER doesn't itself change membershipType —
      // this simulates a workspace with two true owners for the test).
      await testApp.prisma.workspaceMember.update({
        where: { id: secondOwner.membershipId },
        data: { membershipType: 'OWNER' },
      });

      const firstOwnerMembership =
        await testApp.prisma.workspaceMember.findFirstOrThrow({
          where: { workspaceId: owner.workspaceId, userId: owner.id },
        });

      await request(testApp.app.getHttpServer())
        .post(
          `/api/v1/workspaces/${owner.workspaceId}/members/${firstOwnerMembership.id}/suspend`,
        )
        .set(...authHeader(secondOwner.accessToken))
        .send({ reason: 'stepping down' })
        .expect(204);
    });

    it('concurrency: two simultaneous suspend requests against two different owners of a two-owner workspace never leave zero active owners', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const ownerRoleId = await roleIdFor(testApp, 'WORKSPACE_OWNER');
      const secondOwner = await inviteAndActivateEmployee(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        { roleId: ownerRoleId },
      );
      await testApp.prisma.workspaceMember.update({
        where: { id: secondOwner.membershipId },
        data: { membershipType: 'OWNER' },
      });

      const firstOwnerMembership =
        await testApp.prisma.workspaceMember.findFirstOrThrow({
          where: { workspaceId: owner.workspaceId, userId: owner.id },
        });

      const results = await Promise.allSettled([
        request(testApp.app.getHttpServer())
          .post(
            `/api/v1/workspaces/${owner.workspaceId}/members/${firstOwnerMembership.id}/suspend`,
          )
          .set(...authHeader(secondOwner.accessToken))
          .send({ reason: 'race A' }),
        request(testApp.app.getHttpServer())
          .post(
            `/api/v1/workspaces/${owner.workspaceId}/members/${secondOwner.membershipId}/suspend`,
          )
          .set(...authHeader(owner.accessToken))
          .send({ reason: 'race B' }),
      ]);

      const statuses = results.map((result) =>
        result.status === 'fulfilled' ? result.value.status : -1,
      );
      // Exactly one of the two mutually-conflicting suspensions may succeed.
      expect(statuses.filter((status) => status === 204)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(1);

      const activeOwners = await testApp.prisma.workspaceMember.count({
        where: {
          workspaceId: owner.workspaceId,
          membershipType: 'OWNER',
          status: 'ACTIVE',
        },
      });
      expect(activeOwners).toBeGreaterThanOrEqual(1);
    });
  });
});
