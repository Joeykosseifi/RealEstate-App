import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  minimalClientPayload,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Client CRUD', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('11, 12, 13. an authorized member can create a client, correctly assigned to the workspace with a server-derived createdByUserId', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(owner.accessToken))
      .send(minimalClientPayload())
      .expect(201);

    expect(response.body.workspaceId).toBe(owner.workspaceId);
    expect(response.body.createdByUserId).toBe(owner.id);

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
    expect(stored.createdByUserId).toBe(owner.id);
  });

  it('14. a caller cannot choose another workspace through payload manipulation (extra fields rejected)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const otherOwner = await registerVerifiedCompanyOwner(testApp, 'Other Co');

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(owner.accessToken))
      .send({
        ...minimalClientPayload(),
        workspaceId: otherOwner.workspaceId,
        createdByUserId: otherOwner.id,
      })
      .expect(400); // forbidNonWhitelisted rejects unknown fields outright
  });

  it('15. client update works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
      .set(...authHeader(owner.accessToken))
      .send({ firstName: 'Updated', status: 'ACTIVE' })
      .expect(200);

    expect(response.body.firstName).toBe('Updated');
    expect(response.body.status).toBe('ACTIVE');
  });

  it('16, 17. workspaceId and createdByUserId cannot be changed via PATCH', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const otherOwner = await registerVerifiedCompanyOwner(
      testApp,
      'Other Co 2',
    );
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
      .set(...authHeader(owner.accessToken))
      .send({
        workspaceId: otherOwner.workspaceId,
        createdByUserId: otherOwner.id,
      })
      .expect(400); // both fields are unknown to UpdateClientDto -> rejected outright

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
    expect(stored.createdByUserId).toBe(owner.id);
  });

  it('18. archive preserves the DB record (status flips, row stays)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(stored.status).toBe('ARCHIVED');
    expect(stored.archivedAt).not.toBeNull();
    expect(stored.archivedByUserId).toBe(owner.id);

    // Excluded from the default (active) list...
    const list = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const listItems = list.body.items as { id: string }[];
    expect(listItems.find((item) => item.id === client.id)).toBeUndefined();

    // ...but still fetchable by id, and archiving twice is rejected.
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });

  it('19. restore works and lands on INACTIVE, never the prior status', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { status: undefined },
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/restore`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(stored.status).toBe('INACTIVE');
    expect(stored.archivedAt).toBeNull();
    expect(stored.archivedByUserId).toBeNull();

    // Restoring a non-archived client is rejected.
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/restore`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });

  it('20. client detail returns requirements/shortlist/presentation sections', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.requirements).toEqual([]);
    expect(response.body.shortlist).toEqual([]);
    expect(response.body.presentationCount).toBe(0);
  });
});
