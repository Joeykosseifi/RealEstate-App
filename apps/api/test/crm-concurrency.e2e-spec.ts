import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createPresentation,
  createProperty,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('CRM / matching / presentation concurrency', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('simultaneous shortlist insertion of the same property for the same client: exactly one succeeds (DB uniqueness, not just an app-level check)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        request(testApp.app.getHttpServer())
          .post(
            `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
          )
          .set(...authHeader(owner.accessToken))
          .send({ propertyId: property.id }),
      ),
    );

    const succeeded = attempts.filter(
      (result) => result.status === 'fulfilled' && result.value.status === 201,
    );
    const conflicted = attempts.filter(
      (result) => result.status === 'fulfilled' && result.value.status === 409,
    );
    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(4);

    const rows = await testApp.prisma.clientPropertyShortlist.findMany({
      where: { clientId: client.id, propertyId: property.id },
    });
    expect(rows).toHaveLength(1);
  });

  it('concurrent presentation generation does not corrupt state — both requests succeed and the final record is internally consistent', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );

    const attempts = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        request(testApp.app.getHttpServer())
          .post(
            `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
          )
          .set(...authHeader(owner.accessToken)),
      ),
    );

    for (const attempt of attempts) {
      expect(attempt.status).toBe('fulfilled');
      if (attempt.status === 'fulfilled') {
        expect(attempt.value.status).toBe(200);
      }
    }

    const stored = await testApp.prisma.propertyPresentation.findUniqueOrThrow({
      where: { id: presentation.id },
    });
    expect(stored.status).toBe('GENERATED');
    expect(stored.storageKey).not.toBeNull();
    expect(stored.generatedAt).not.toBeNull();
  });

  it('concurrent client updates never corrupt the row — last write wins cleanly, no partial/mixed state', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const attempts = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ firstName: 'FirstUpdate' }),
      request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ firstName: 'SecondUpdate' }),
    ]);

    for (const attempt of attempts) {
      expect(attempt.status).toBe('fulfilled');
      if (attempt.status === 'fulfilled') {
        expect(attempt.value.status).toBe(200);
      }
    }

    const stored = await testApp.prisma.clientRecord.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(['FirstUpdate', 'SecondUpdate']).toContain(stored.firstName);
  });

  it('presentation item reorder is race-safe under concurrent update calls', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const propertyA = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const propertyB = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: propertyA.id }, { propertyId: propertyB.id }],
    );

    const attempts = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}`,
        )
        .set(...authHeader(owner.accessToken))
        .send({
          items: [{ propertyId: propertyA.id }, { propertyId: propertyB.id }],
        }),
      request(testApp.app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}`,
        )
        .set(...authHeader(owner.accessToken))
        .send({
          items: [{ propertyId: propertyB.id }, { propertyId: propertyA.id }],
        }),
    ]);

    for (const attempt of attempts) {
      expect(attempt.status).toBe('fulfilled');
      if (attempt.status === 'fulfilled') {
        expect(attempt.value.status).toBe(200);
      }
    }

    const items = await testApp.prisma.propertyPresentationItem.findMany({
      where: { presentationId: presentation.id },
    });
    // Whichever request landed last, exactly one row per property survives — no duplicates, no crash.
    expect(items).toHaveLength(2);
    const propertyIds = items.map((item) => item.propertyId).sort();
    expect(propertyIds).toEqual([propertyA.id, propertyB.id].sort());
  });
});
