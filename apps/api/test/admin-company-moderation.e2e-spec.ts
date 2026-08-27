import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  grantPlatformRole,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Admin company moderation — deactivation', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('an unauthorized user cannot deactivate a company', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const outsider = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(outsider.accessToken))
      .send({ reason: 'not authorized' })
      .expect(403);

    // The company's own owner has no platform permissions either — being
    // WORKSPACE_OWNER of the company does not grant admin.companies.deactivate.
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(owner.accessToken))
      .send({ reason: 'self-deactivate attempt' })
      .expect(403);
  });

  it('a SUPER_ADMIN can deactivate a company; it is never hard-deleted and status becomes DEACTIVATED', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'policy violation' })
      .expect(204);

    const company = await testApp.prisma.company.findUnique({
      where: { id: owner.companyId },
    });
    expect(company).not.toBeNull();
    expect(company?.accountStatus).toBe('DEACTIVATED');
  });

  it('deactivation requires a reason', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({})
      .expect(400);
  });

  it('the audit log records actor, reason, and action for the deactivation', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'audit check' })
      .expect(204);

    const entry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin.company_deactivated', targetId: owner.companyId },
    });
    expect(entry.actorUserId).toBe(admin.id);
    expect(entry.targetType).toBe('Company');
    expect(entry.metadata).toMatchObject({ reason: 'audit check' });
  });

  it('restore reactivates a deactivated company, and is itself audited', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'temporary hold' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/restore`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'hold lifted' })
      .expect(204);

    const company = await testApp.prisma.company.findUniqueOrThrow({
      where: { id: owner.companyId },
    });
    expect(company.accountStatus).toBe('ACTIVE');

    const restoreEntry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin.company_restored', targetId: owner.companyId },
    });
    expect(restoreEntry.actorUserId).toBe(admin.id);
  });

  it('restoring an already-active company is rejected', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/restore`)
      .set(...authHeader(admin.accessToken))
      .send({})
      .expect(409);
  });

  it('deactivating an already-deactivated company is rejected (idempotency guard)', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'first' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'second' })
      .expect(409);
  });

  it('deactivation preserves the company workspace, ownership, and membership history, and does not touch the owner user account or unrelated users', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);
    const unrelated = await registerVerifiedAgent(testApp);

    const unrelatedPersonalWorkspace =
      await testApp.prisma.workspace.findUniqueOrThrow({
        where: { personalOwnerUserId: unrelated.id },
      });

    const workspaceBefore = await testApp.prisma.workspace.findUniqueOrThrow({
      where: { id: owner.workspaceId },
    });
    const membershipBefore =
      await testApp.prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId: owner.workspaceId, userId: owner.id },
      });

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/companies/${owner.companyId}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'preservation check' })
      .expect(204);

    // Company workspace preserved, still linked to the same company —
    // ownership is never transferred to the admin/platform.
    const workspaceAfter = await testApp.prisma.workspace.findUniqueOrThrow({
      where: { id: owner.workspaceId },
    });
    expect(workspaceAfter.companyId).toBe(workspaceBefore.companyId);
    expect(workspaceAfter.id).toBe(workspaceBefore.id);

    const company = await testApp.prisma.company.findUniqueOrThrow({
      where: { id: owner.companyId },
    });
    expect(company.createdByUserId).toBe(owner.id);

    // Membership/history preserved untouched.
    const membershipAfter =
      await testApp.prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId: owner.workspaceId, userId: owner.id },
      });
    expect(membershipAfter.id).toBe(membershipBefore.id);
    expect(membershipAfter.membershipType).toBe('OWNER');
    expect(membershipAfter.status).toBe('ACTIVE');

    // The registering owner's own user account is a separate concept from
    // the company's status — it remains ACTIVE.
    const ownerUser = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(ownerUser.accountStatus).toBe('ACTIVE');

    // An unrelated user's personal workspace is completely untouched.
    const unrelatedPersonalWorkspaceAfter =
      await testApp.prisma.workspace.findUniqueOrThrow({
        where: { id: unrelatedPersonalWorkspace.id },
      });
    expect(unrelatedPersonalWorkspaceAfter).toEqual(unrelatedPersonalWorkspace);
    const unrelatedStillLoginable = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: unrelated.email, password: unrelated.password })
      .expect(200);
    expect(unrelatedStillLoginable.body.user.id).toBe(unrelated.id);
  });
});
