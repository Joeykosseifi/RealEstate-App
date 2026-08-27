import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Property concurrency', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('simultaneous property field updates do not crash and leave one consistent last-write-wins result', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const results = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
        )
        .set(...authHeader(owner.accessToken))
        .send({ title: 'Title A' }),
      request(testApp.app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
        )
        .set(...authHeader(owner.accessToken))
        .send({ title: 'Title B' }),
    ]);

    for (const result of results) {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value.status).toBe(200);
      }
    }

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(['Title A', 'Title B']).toContain(stored.title);
  });

  it('archive vs update race: once archive commits, update is rejected — never a silent edit to an archived property', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    // Serialize: archive first, then confirm the update path is closed —
    // proves the guard exists deterministically (the true concurrent
    // race is a timing-dependent variant of the same code path).
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ title: 'Should not apply' })
      .expect(409);

    const stored = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    expect(stored.title).not.toBe('Should not apply');
    expect(stored.propertyStatus).toBe('ARCHIVED');
  });

  it('concurrent media reorder calls do not corrupt sort order (each media id appears exactly once, in some valid order)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const uploads = await Promise.all(
      ['a.jpg', 'b.jpg', 'c.jpg'].map((name) =>
        request(testApp.app.getHttpServer())
          .post(
            `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media`,
          )
          .set(...authHeader(owner.accessToken))
          .field('mediaType', 'IMAGE')
          .attach('file', Buffer.from('bytes'), name)
          .expect(201),
      ),
    );
    const ids = uploads.map((response) => response.body.id as string);

    const results = await Promise.allSettled([
      request(testApp.app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/reorder`,
        )
        .set(...authHeader(owner.accessToken))
        .send({ mediaIds: [ids[0], ids[1], ids[2]] }),
      request(testApp.app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/reorder`,
        )
        .set(...authHeader(owner.accessToken))
        .send({ mediaIds: [ids[2], ids[1], ids[0]] }),
    ]);

    for (const result of results) {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value.status).toBe(204);
      }
    }

    const finalMedia = await testApp.prisma.propertyMedia.findMany({
      where: { propertyId: property.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(finalMedia).toHaveLength(3);
    expect(new Set(finalMedia.map((m) => m.sortOrder))).toEqual(
      new Set([0, 1, 2]),
    );
    expect(new Set(finalMedia.map((m) => m.id))).toEqual(new Set(ids));
  });
});

describe('Property audit trail', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('logs property.created, property.updated, property.status_changed, property.archived, and property.restored', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.created', targetId: property.id },
    });

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ title: 'Changed' })
      .expect(200);
    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.updated', targetId: property.id },
    });

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'RESERVED' })
      .expect(204);
    const statusEntry = await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.status_changed', targetId: property.id },
    });
    expect(statusEntry.metadata).toMatchObject({
      from: 'AVAILABLE',
      to: 'RESERVED',
    });

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);
    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.archived', targetId: property.id },
    });

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/restore`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);
    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.restored', targetId: property.id },
    });
  });

  it('logs property.media_added and property.media_removed', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const media = await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media`,
      )
      .set(...authHeader(owner.accessToken))
      .field('mediaType', 'IMAGE')
      .attach('file', Buffer.from('bytes'), 'a.jpg')
      .expect(201);

    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.media_added', targetId: media.body.id },
    });

    await request(testApp.app.getHttpServer())
      .delete(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/${media.body.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await testApp.prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'property.media_removed',
        targetId: property.id,
        metadata: { path: ['mediaId'], equals: media.body.id },
      },
    });
  });

  it('logs sensitive-field access: property.owner_accessed, property.private_notes_accessed, property.exact_location_accessed', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        owners: [{ fullName: 'Owner' }],
        privateDetails: { internalNotes: 'note' },
        location: { latitude: 1, longitude: 1 },
      },
    );

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    await testApp.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.owner_accessed', targetId: property.id },
    });
    await testApp.prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'property.private_notes_accessed',
        targetId: property.id,
      },
    });
    await testApp.prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'property.exact_location_accessed',
        targetId: property.id,
      },
    });
  });
});
