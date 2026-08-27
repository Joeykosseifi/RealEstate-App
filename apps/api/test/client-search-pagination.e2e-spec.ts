import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  inviteAndActivateEmployee,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Client search & pagination', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('87. pagination works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    for (let i = 0; i < 5; i += 1) {
      await createClient(testApp, owner.workspaceId, owner.accessToken, {
        firstName: `Client${i}`,
        phone: `+9617000${1000 + i}`,
      });
    }

    const page1 = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients?page=1&pageSize=2`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.meta.totalItems).toBe(5);
    expect(page1.body.meta.totalPages).toBe(3);

    const page2 = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients?page=2&pageSize=2`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
  });

  it('88. search by first/last name works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createClient(testApp, owner.workspaceId, owner.accessToken, {
      firstName: 'Zenobia',
      lastName: 'Karam',
      phone: '+96170011111',
    });
    await createClient(testApp, owner.workspaceId, owner.accessToken, {
      firstName: 'Other',
      lastName: 'Person',
      phone: '+96170022222',
    });

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients?search=zenobia`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].firstName).toBe('Zenobia');
  });

  it('89. search by phone works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createClient(testApp, owner.workspaceId, owner.accessToken, {
      phone: '+96176543210',
    });
    await createClient(testApp, owner.workspaceId, owner.accessToken, {
      phone: '+96170000001',
    });

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients?search=76543210`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].phone).toBe('+96176543210');
  });

  it('90. search by email works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createClient(testApp, owner.workspaceId, owner.accessToken, {
      email: 'unique-search-target@example.com',
    });
    await createClient(testApp, owner.workspaceId, owner.accessToken, {
      phone: '+96170000002',
    });

    const response = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients?search=unique-search-target`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].email).toBe(
      'unique-search-target@example.com',
    );
  });

  it('91. status filtering works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const lead = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { phone: '+96170000003' },
    );
    const other = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { phone: '+96170000004' },
    );
    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/clients/${other.id}`)
      .set(...authHeader(owner.accessToken))
      .send({ status: 'WON' })
      .expect(200);

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients?status=LEAD`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    const ids = (response.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(ids).toContain(lead.id);
    expect(ids).not.toContain(other.id);
  });

  it('92. assigned-agent filtering works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const employee = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const assigned = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { phone: '+96170000005' },
    );
    const unassigned = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        phone: '+96170000006',
      },
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${assigned.id}/assign`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ assignedToUserId: employee.id })
      .expect(200);

    const response = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients?assignedToUserId=${employee.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    const ids = (response.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(ids).toContain(assigned.id);
    expect(ids).not.toContain(unassigned.id);
  });

  it('93, 94. archived clients are excluded by default but can be intentionally included', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const active = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { phone: '+96170000007' },
    );
    const archived = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        phone: '+96170000008',
      },
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${archived.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const defaultList = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const defaultIds = (defaultList.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(defaultIds).toContain(active.id);
    expect(defaultIds).not.toContain(archived.id);

    const withArchived = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients?includeArchived=true`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const includedIds = (withArchived.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(includedIds).toContain(active.id);
    expect(includedIds).toContain(archived.id);
  });

  it('95. no search/filter combination leaks another workspace', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    await createClient(testApp, ownerB.workspaceId, ownerB.accessToken, {
      firstName: 'CrossWorkspace',
      phone: '+96170000009',
      email: 'crossworkspace@example.com',
    });

    const response = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${ownerA.workspaceId}/clients?search=crossworkspace`,
      )
      .set(...authHeader(ownerA.accessToken))
      .expect(200);

    expect(response.body.items).toEqual([]);
  });
});
