import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  minimalPropertyPayload,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Property CRUD', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('19, 20, 21. an authorized member can create a property, correctly assigned to the workspace with a server-derived createdByUserId', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(owner.accessToken))
      .send(minimalPropertyPayload())
      .expect(201);

    expect(response.body.workspaceId).toBe(owner.workspaceId);
    expect(response.body.createdByUserId).toBe(owner.id);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
    expect(stored.createdByUserId).toBe(owner.id);
  });

  it('22. a client cannot choose another workspace through payload manipulation (extra fields are rejected)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const otherOwner = await registerVerifiedCompanyOwner(testApp, 'Other Co');

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/properties`)
      .set(...authHeader(owner.accessToken))
      .send({
        ...minimalPropertyPayload(),
        workspaceId: otherOwner.workspaceId,
        createdByUserId: otherOwner.id,
      })
      .expect(400); // forbidNonWhitelisted rejects unknown fields outright
  });

  it('23. property update works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ title: 'Updated Title', price: 250000 })
      .expect(200);

    expect(response.body.title).toBe('Updated Title');
    expect(response.body.price).toBe(250000);
  });

  it('24, 25. workspaceId and createdByUserId cannot be changed via PATCH', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const otherOwner = await registerVerifiedCompanyOwner(
      testApp,
      'Other Co 2',
    );
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .send({
        workspaceId: otherOwner.workspaceId,
        createdByUserId: otherOwner.id,
      })
      .expect(400); // both fields are unknown to UpdatePropertyDto -> rejected outright

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
    expect(stored.createdByUserId).toBe(owner.id);
  });

  it('26, 27. a property can be archived and remains in the database afterward', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(stored).not.toBeNull();
    expect(stored.propertyStatus).toBe('ARCHIVED');
    expect(stored.archivedAt).not.toBeNull();
    expect(stored.archivedByUserId).toBe(owner.id);
  });

  it('archiving an already-archived property is rejected', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });

  it('28. restore works: an archived property can be restored, landing on OFF_MARKET', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/restore`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(stored.propertyStatus).toBe('OFF_MARKET');
    expect(stored.archivedAt).toBeNull();
    expect(stored.archivedByUserId).toBeNull();
  });

  it('restoring a non-archived property is rejected', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/restore`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });

  it('29. status updates behave correctly: allowed transitions succeed, nonsensical ones are rejected', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'RESERVED' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'SOLD' })
      .expect(204);

    // SOLD -> RESERVED is not an allowed transition.
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'RESERVED' })
      .expect(409);

    // SOLD -> OFF_MARKET is allowed (undoing a mistaken sale mark).
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'OFF_MARKET' })
      .expect(204);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(stored.propertyStatus).toBe('OFF_MARKET');
  });

  it('status endpoint rejects ARCHIVED as a target (must go through the archive endpoint)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'ARCHIVED' })
      .expect(400);
  });

  it('status changes are blocked on an archived property until restored', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'AVAILABLE' })
      .expect(409);
  });
});
