import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  inviteAndActivateEmployee,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Workspace member pagination', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('default pagination returns a bounded page with sane defaults', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(20);
    expect(response.body.meta.totalItems).toBe(3);
    expect(response.body.meta.totalPages).toBe(1);
    expect(response.body.items).toHaveLength(3);
  });

  it('custom page/pageSize is honored', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members?page=1&pageSize=2`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(2);
    expect(response.body.meta.totalItems).toBe(4);
    expect(response.body.meta.totalPages).toBe(2);
    expect(response.body.items).toHaveLength(2);
  });

  it('rejects a pageSize above the maximum', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members?pageSize=101`)
      .set(...authHeader(owner.accessToken))
      .expect(400);
  });

  it('multiple pages together cover every member exactly once, in stable order', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const second = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const third = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const fourth = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const page1 = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members?page=1&pageSize=2`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const page2 = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members?page=2&pageSize=2`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(page1.body.items).toHaveLength(2);
    expect(page2.body.items).toHaveLength(2);

    const page1Items = page1.body.items as { id: string }[];
    const page2Items = page2.body.items as { id: string }[];
    const combined = [
      ...page1Items.map((m) => m.id),
      ...page2Items.map((m) => m.id),
    ];

    // No overlap between pages, and no member missed or duplicated.
    expect(new Set(combined).size).toBe(4);
    expect(combined).toEqual(
      expect.arrayContaining([
        second.membershipId,
        third.membershipId,
        fourth.membershipId,
      ]),
    );
  });

  it('a user outside the workspace still cannot list members', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const outsider = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members`)
      .set(...authHeader(outsider.accessToken))
      .expect(403);
  });

  it('a suspended member cannot list members even paginated', async () => {
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
      .send({ reason: 'pagination access test' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members`)
      .set(...authHeader(employee.accessToken))
      .expect(403);
  });

  it('a removed member cannot list members', async () => {
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
      .send({ reason: 'pagination access test' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/members`)
      .set(...authHeader(employee.accessToken))
      .expect(403);
  });
});
