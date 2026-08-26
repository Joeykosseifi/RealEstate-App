import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  grantPlatformRole,
  login,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

/**
 * The "last active SUPER_ADMIN" invariant is deliberately global (a
 * SUPER_ADMIN administers the whole platform, not a single workspace),
 * so tests that exercise it can't assume they're the only SUPER_ADMIN in
 * the database — earlier tests in this file create their own. This
 * deactivates every OTHER currently-active SUPER_ADMIN directly (bypassing
 * the API, since going through it would hit the very guard under test),
 * isolating the invariant to exactly the user ids passed in.
 */
async function isolateActiveSuperAdmins(
  testApp: TestApp,
  keepUserIds: string[],
): Promise<void> {
  await testApp.prisma.user.updateMany({
    where: {
      id: { notIn: keepUserIds },
      accountStatus: 'ACTIVE',
      platformRoles: { some: { role: { key: 'SUPER_ADMIN' } } },
    },
    data: { accountStatus: 'DEACTIVATED' },
  });
}

/**
 * A platform role that can view users but not their email — not part of
 * the seeded catalog, built directly for this test. `findFirst` + manual
 * create (not `upsert` on the compound key) because Prisma's compound
 * unique selector rejects an explicit `null` even on a nullable column.
 */
async function grantViewOnlyRole(
  testApp: TestApp,
  userId: string,
): Promise<void> {
  let role = await testApp.prisma.role.findFirst({
    where: { workspaceId: null, key: 'TEST_VIEW_ONLY' },
  });
  if (!role) {
    const permission = await testApp.prisma.permission.findUniqueOrThrow({
      where: { key: 'admin.users.view' },
    });
    role = await testApp.prisma.role.create({
      data: {
        key: 'TEST_VIEW_ONLY',
        name: 'Test View Only',
        scope: 'PLATFORM',
        isSystem: false,
        permissions: { create: [{ permissionId: permission.id }] },
      },
    });
  }
  await testApp.prisma.userPlatformRole.create({
    data: { userId, roleId: role.id },
  });
}

describe('Platform admin', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('20. a non-admin user cannot access the admin user directory', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/users')
      .set(...authHeader(user.accessToken))
      .expect(403);
  });

  it('21. SUPER_ADMIN can list users with pagination', async () => {
    const admin = await makeSuperAdmin(testApp);
    await registerVerifiedAgent(testApp);
    await registerVerifiedAgent(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/users?page=1&pageSize=2')
      .set(...authHeader(admin.accessToken))
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(2);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(2);
    expect(response.body.meta.totalItems).toBeGreaterThanOrEqual(3);
  });

  it('22. search filters users by name/email', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/users?search=${encodeURIComponent(target.email)}`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(target.id);
  });

  it('23. filters by accountType', async () => {
    const admin = await makeSuperAdmin(testApp);
    const owner = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/users?accountType=COMPANY')
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const items = response.body.items as { id: string; accountType: string }[];
    expect(items.map((item) => item.id)).toContain(owner.id);
    expect(items.every((item) => item.accountType === 'COMPANY')).toBe(true);
  });

  it('24. filters by accountStatus', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'filter test' })
      .expect(204);

    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/users?accountStatus=SUSPENDED')
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const items = response.body.items as { id: string }[];
    expect(items.map((item) => item.id)).toContain(target.id);
  });

  it('25. filters by verification status', async () => {
    const admin = await makeSuperAdmin(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/admin/users?verification=verified')
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const items = response.body.items as {
      emailVerifiedAt: string | null;
      phoneVerifiedAt: string | null;
    }[];
    expect(
      items.every(
        (item) =>
          item.emailVerifiedAt !== null && item.phoneVerifiedAt !== null,
      ),
    ).toBe(true);
  });

  it('26. user detail includes workspace memberships and platform roles', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/users/${target.id}`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    expect(response.body.workspaceMemberships).toHaveLength(1);
    expect(response.body.workspaceMemberships[0].workspaceId).toBe(
      target.workspaceId,
    );

    const adminDetail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/users/${admin.id}`)
      .set(...authHeader(admin.accessToken))
      .expect(200);
    expect(adminDetail.body.platformRoles).toContain('SUPER_ADMIN');
  });

  it('27. an admin without admin.users.view_email never receives email/phone (omitted, not masked)', async () => {
    const viewOnlyAdmin = await registerVerifiedAgent(testApp);
    await grantViewOnlyRole(testApp, viewOnlyAdmin.id);
    const target = await registerVerifiedAgent(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/users/${target.id}`)
      .set(...authHeader(viewOnlyAdmin.accessToken))
      .expect(200);

    expect(response.body.email).toBeUndefined();
    expect(response.body.phone).toBeUndefined();
  });

  it('28. an admin with admin.users.view_email receives the real email/phone', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/users/${target.id}`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    expect(response.body.email).toBe(target.email);
    expect(response.body.phone).toBe(target.phone);
  });

  it('29. suspend requires a reason', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({})
      .expect(400);
  });

  it('30 & 31. suspend blocks login and immediately invalidates existing access tokens', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'policy violation' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(...authHeader(target.accessToken))
      .expect(401);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: target.password })
      .expect(401);
  });

  it('32. deactivate blocks login and invalidates existing sessions', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'account closure requested' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(...authHeader(target.accessToken))
      .expect(401);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: target.password })
      .expect(401);
  });

  it('33. restore only works on suspended/deactivated accounts', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/restore`)
      .set(...authHeader(admin.accessToken))
      .send({})
      .expect(409);
  });

  it('34. restore reactivates a suspended account and login works again', async () => {
    const admin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'temporary hold' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/restore`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'hold lifted' })
      .expect(204);

    await login(testApp, target);

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(stored.accountStatus).toBe('ACTIVE');
  });

  it('35. cannot suspend the last active SUPER_ADMIN', async () => {
    const admin = await makeSuperAdmin(testApp);
    await isolateActiveSuperAdmins(testApp, [admin.id]);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${admin.id}/suspend`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'self-suspend attempt' })
      .expect(409);
  });

  it('36. cannot deactivate the last active SUPER_ADMIN', async () => {
    const admin = await makeSuperAdmin(testApp);
    await isolateActiveSuperAdmins(testApp, [admin.id]);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${admin.id}/deactivate`)
      .set(...authHeader(admin.accessToken))
      .send({ reason: 'self-deactivate attempt' })
      .expect(409);
  });

  it('37. can suspend a SUPER_ADMIN when another active SUPER_ADMIN exists', async () => {
    const firstAdmin = await makeSuperAdmin(testApp);
    const secondAdmin = await makeSuperAdmin(testApp);
    await isolateActiveSuperAdmins(testApp, [firstAdmin.id, secondAdmin.id]);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${firstAdmin.id}/suspend`)
      .set(...authHeader(secondAdmin.accessToken))
      .send({ reason: 'stepping down' })
      .expect(204);
  });

  it('38. granting a platform role is idempotent-safe (duplicate grant rejected) and gated by admin.roles.manage', async () => {
    const superAdmin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/platform-roles`)
      .set(...authHeader(superAdmin.accessToken))
      .send({ roleKey: 'SUPPORT_ADMIN' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/platform-roles`)
      .set(...authHeader(superAdmin.accessToken))
      .send({ roleKey: 'SUPPORT_ADMIN' })
      .expect(409);

    // A workspace company owner — no platform role at all — can never
    // reach this endpoint, regardless of how powerful they are in their
    // own workspace.
    const companyOwner = await registerVerifiedCompanyOwner(testApp);
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/platform-roles`)
      .set(...authHeader(companyOwner.accessToken))
      .send({ roleKey: 'SUPPORT_ADMIN' })
      .expect(403);
  });

  it('39. revoking a platform role: last-SUPER_ADMIN protection applies only to the SUPER_ADMIN grant itself', async () => {
    const superAdmin = await makeSuperAdmin(testApp);
    const target = await registerVerifiedAgent(testApp);
    await grantPlatformRole(testApp, target.id, 'SUPPORT_ADMIN');
    await grantPlatformRole(testApp, target.id, 'SUPER_ADMIN');
    await isolateActiveSuperAdmins(testApp, [superAdmin.id, target.id]);

    // Revoking SUPPORT_ADMIN from someone who separately also holds
    // SUPER_ADMIN must not be blocked by the last-super-admin rule.
    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/admin/users/${target.id}/platform-roles/SUPPORT_ADMIN`)
      .set(...authHeader(superAdmin.accessToken))
      .expect(204);

    // With exactly two SUPER_ADMINs (superAdmin, target), revoking one is fine.
    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/admin/users/${target.id}/platform-roles/SUPER_ADMIN`)
      .set(...authHeader(superAdmin.accessToken))
      .expect(204);

    // Now only superAdmin remains — revoking the last SUPER_ADMIN is blocked.
    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/admin/users/${superAdmin.id}/platform-roles/SUPER_ADMIN`)
      .set(...authHeader(superAdmin.accessToken))
      .expect(409);
  });

  describe('Concurrency', () => {
    it('two simultaneous suspend requests against two different active SUPER_ADMINs never leave zero active', async () => {
      const first = await makeSuperAdmin(testApp);
      const second = await makeSuperAdmin(testApp);
      await isolateActiveSuperAdmins(testApp, [first.id, second.id]);

      const results = await Promise.allSettled([
        request(testApp.app.getHttpServer())
          .post(`/api/v1/admin/users/${first.id}/suspend`)
          .set(...authHeader(second.accessToken))
          .send({ reason: 'race A' }),
        request(testApp.app.getHttpServer())
          .post(`/api/v1/admin/users/${second.id}/suspend`)
          .set(...authHeader(first.accessToken))
          .send({ reason: 'race B' }),
      ]);

      const statuses = results.map((result) =>
        result.status === 'fulfilled' ? result.value.status : -1,
      );
      expect(statuses.filter((status) => status === 204)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(1);

      const activeSuperAdmins = await testApp.prisma.user.count({
        where: {
          accountStatus: 'ACTIVE',
          platformRoles: { some: { role: { key: 'SUPER_ADMIN' } } },
        },
      });
      expect(activeSuperAdmins).toBeGreaterThanOrEqual(1);
    });

    it('two simultaneous platform-role removals against two different SUPER_ADMINs never leave zero', async () => {
      const first = await makeSuperAdmin(testApp);
      const second = await makeSuperAdmin(testApp);
      await isolateActiveSuperAdmins(testApp, [first.id, second.id]);

      const results = await Promise.allSettled([
        request(testApp.app.getHttpServer())
          .delete(`/api/v1/admin/users/${first.id}/platform-roles/SUPER_ADMIN`)
          .set(...authHeader(second.accessToken)),
        request(testApp.app.getHttpServer())
          .delete(`/api/v1/admin/users/${second.id}/platform-roles/SUPER_ADMIN`)
          .set(...authHeader(first.accessToken)),
      ]);

      const statuses = results.map((result) =>
        result.status === 'fulfilled' ? result.value.status : -1,
      );
      expect(statuses.filter((status) => status === 204)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(1);

      const remainingSuperAdmins = await testApp.prisma.userPlatformRole.count({
        where: { role: { key: 'SUPER_ADMIN' } },
      });
      expect(remainingSuperAdmins).toBeGreaterThanOrEqual(1);
    });
  });
});
