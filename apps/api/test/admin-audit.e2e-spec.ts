import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  grantPlatformRole,
  inviteAndActivateEmployee,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Audit trail', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('40. inviting a workspace member is audit-logged with actor and target', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const target = await registerVerifiedAgent(testApp);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set(...authHeader(owner.accessToken))
      .send({ email: target.email, membershipType: 'EMPLOYEE' })
      .expect(201);

    const entry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'workspace.member_invited', targetId: response.body.id },
    });
    expect(entry.actorUserId).toBe(owner.id);
    expect(entry.metadata).toMatchObject({
      workspaceId: owner.workspaceId,
      invitedUserId: target.id,
    });
  });

  it('41. suspending a workspace member is audit-logged', async () => {
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
      .send({ reason: 'audit check' })
      .expect(204);

    const entry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'workspace.member_suspended',
        targetId: employee.membershipId,
      },
    });
    expect(entry.actorUserId).toBe(owner.id);
    expect(entry.metadata).toMatchObject({
      workspaceId: owner.workspaceId,
      reason: 'audit check',
    });
  });

  it('42. admin suspend/deactivate/restore actions are audit-logged with the reason in metadata', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'audit check suspend' })
      .expect(204);

    const suspendEntry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin.user_suspended', targetId: target.id },
    });
    expect(suspendEntry.actorUserId).toBe(admin.id);
    expect(suspendEntry.metadata).toMatchObject({
      reason: 'audit check suspend',
    });

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/restore`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'audit check restore' })
      .expect(204);

    const restoreEntry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin.user_restored', targetId: target.id },
    });
    expect(restoreEntry.metadata).toMatchObject({
      reason: 'audit check restore',
    });
  });

  it('43. granting and revoking a platform role are both audit-logged', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/platform-roles`)
      .set(...authHeader(admin.accessToken))
      .send({ roleKey: 'ANALYST' })
      .expect(204);

    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin.platform_role_assigned', targetId: target.id },
    });

    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/admin/users/${target.id}/platform-roles/ANALYST`)
      .set(...authHeader(admin.accessToken))
      .expect(204);

    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin.platform_role_removed', targetId: target.id },
    });
  });

  it('44. moderation is reversible: the user row is never deleted, and the audit trail is append-only', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'first' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/restore`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'second' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'third' })
      .expect(204);

    const stillExists = await testApp.prisma.user.findUnique({
      where: { id: target.id },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.accountStatus).toBe('DEACTIVATED');

    const entries = await testApp.prisma.auditLog.findMany({
      where: {
        targetId: target.id,
        targetType: 'User',
        action: { startsWith: 'admin.' },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'admin.user_suspended',
      'admin.user_restored',
      'admin.user_deactivated',
    ]);
  });
});
