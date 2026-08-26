import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  inviteAndActivateEmployee,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function roleIdFor(testApp: TestApp, key: string): Promise<string> {
  const role = await testApp.prisma.role.findFirstOrThrow({
    where: { workspaceId: null, key },
  });
  return role.id;
}

describe('Workspace permissions', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('7. WORKSPACE_OWNER resolves the full workspace permission set, never any admin.* permission', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    const permissions: string[] = response.body.permissions;
    expect(permissions).toEqual(
      expect.arrayContaining(['workspace.manage_roles', 'team.invite']),
    );
    expect(permissions.some((key) => key.startsWith('admin.'))).toBe(false);
  });

  it('8. COMPANY_ADMIN can manage the team but has a narrower set than WORKSPACE_OWNER', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const roleId = await roleIdFor(testApp, 'COMPANY_ADMIN');
    const admin = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId,
      },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const permissions: string[] = response.body.permissions;
    expect(permissions).toEqual(
      expect.arrayContaining(['team.invite', 'team.suspend']),
    );
    expect(permissions).not.toContain('workspace.manage_roles');
  });

  it('9. AGENT has ordinary professional permissions but no team-management permissions', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const agent = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(agent.accessToken))
      .expect(200);

    const permissions: string[] = response.body.permissions;
    expect(permissions).toContain('property.create');
    expect(permissions).not.toContain('team.invite');
    expect(permissions).not.toContain('workspace.manage_members');
  });

  it('10. VIEWER has read-only access with no create/edit/archive/publish permissions', async () => {
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

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    const permissions: string[] = response.body.permissions;
    expect(permissions).toContain('property.view');
    for (const forbidden of [
      'property.create',
      'property.edit',
      'property.archive',
      'property.publish',
      'team.invite',
    ]) {
      expect(permissions).not.toContain(forbidden);
    }

    // A VIEWER also cannot exercise team.invite server-side, not just
    // lack it from the resolved list.
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set(...authHeader(viewer.accessToken))
      .send({ email: owner.email, membershipType: 'EMPLOYEE' })
      .expect(403);
  });

  it('11. a custom role can be created scoped to workspace permissions only', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'SENIOR_AGENT',
        name: 'Senior Agent',
        permissionKeys: ['property.view', 'property.create', 'property.edit'],
      })
      .expect(201);

    expect(response.body.key).toBe('SENIOR_AGENT');
    expect(response.body.permissions).toEqual(
      expect.arrayContaining([
        'property.view',
        'property.create',
        'property.edit',
      ]),
    );
  });

  it('12. creating a custom role with a platform permission is structurally rejected — a malicious company admin can never grant admin.* via a workspace role', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'ROGUE_ADMIN',
        name: 'Rogue Admin',
        permissionKeys: ['property.view', 'admin.users.deactivate'],
      })
      .expect(403);

    expect(response.body.message).toContain('admin.users.deactivate');

    const created = await testApp.prisma.role.findFirst({
      where: { workspaceId: owner.workspaceId, key: 'ROGUE_ADMIN' },
    });
    expect(created).toBeNull();
  });

  it('13. every seeded workspace-scope role resolves only WORKSPACE-scope permissions', async () => {
    const workspaceRoles = await testApp.prisma.role.findMany({
      where: { workspaceId: null, scope: 'WORKSPACE' },
      include: { permissions: { include: { permission: true } } },
    });
    expect(workspaceRoles.length).toBeGreaterThan(0);

    for (const role of workspaceRoles) {
      for (const rolePermission of role.permissions) {
        expect(rolePermission.permission.scope).toBe('WORKSPACE');
      }
    }
  });
});
