import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  inviteAndActivateEmployee,
  registerVerifiedAgent,
  registerVerifiedCompanyOwner,
} from './utils/flows';

function uploadMedia(
  testApp: TestApp,
  workspaceId: string,
  propertyId: string,
  accessToken: string,
  filename: string,
  isPrimary?: boolean,
) {
  const req = request(testApp.app.getHttpServer())
    .post(`/api/v1/workspaces/${workspaceId}/properties/${propertyId}/media`)
    .set(...authHeader(accessToken))
    .field('mediaType', 'IMAGE')
    .attach('file', Buffer.from('fake-image-bytes'), filename);
  if (isPrimary !== undefined) {
    return req.field('isPrimary', String(isPrimary));
  }
  return req;
}

describe('Property media', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('39, 41. an authorized user can add media, correctly associated with the right property', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const response = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'photo1.jpg',
    ).expect(201);

    expect(response.body.mediaType).toBe('IMAGE');
    expect(response.body.originalFileName).toBe('photo1.jpg');
    expect(response.body).not.toHaveProperty('storageKey');

    const stored = await testApp.prisma.propertyMedia.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(stored.propertyId).toBe(property.id);
  });

  it('40. an unauthorized user cannot add media', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const viewerRole = await testApp.prisma.role.findFirstOrThrow({
      where: { workspaceId: null, key: 'VIEWER' },
    });
    const viewer = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: viewerRole.id,
      },
    );

    await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      viewer.accessToken,
      'photo.jpg',
    ).expect(403);
  });

  it('42. media from another workspace cannot be accessed', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const propertyA = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const media = await uploadMedia(
      testApp,
      ownerA.workspaceId,
      propertyA.id,
      ownerA.accessToken,
      'a.jpg',
    ).expect(201);

    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${ownerB.workspaceId}/properties/${propertyA.id}/media/${media.body.id}/access-url`,
      )
      .set(...authHeader(ownerB.accessToken))
      .expect(404);
  });

  it('43. media ordering works', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const first = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'first.jpg',
    ).expect(201);
    const second = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'second.jpg',
    ).expect(201);

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/reorder`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ mediaIds: [second.body.id, first.body.id] })
      .expect(204);

    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(detail.body.media[0].id).toBe(second.body.id);
    expect(detail.body.media[1].id).toBe(first.body.id);
  });

  it('reordering rejects a mediaIds list that does not exactly match the property’s media', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'first.jpg',
    ).expect(201);

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/reorder`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ mediaIds: ['00000000-0000-0000-0000-000000000000'] })
      .expect(400);
  });

  it('44. the main-photo rule is deterministic: first image is auto-primary; setting a new primary unsets the old one; never two at once', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const first = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'first.jpg',
    ).expect(201);
    expect(first.body.isPrimary).toBe(true);

    const second = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'second.jpg',
    ).expect(201);
    expect(second.body.isPrimary).toBe(false);

    const third = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'third.jpg',
      true,
    ).expect(201);
    expect(third.body.isPrimary).toBe(true);

    const primaryCount = await testApp.prisma.propertyMedia.count({
      where: { propertyId: property.id, isPrimary: true },
    });
    expect(primaryCount).toBe(1);

    const firstAfter = await testApp.prisma.propertyMedia.findUniqueOrThrow({
      where: { id: first.body.id },
    });
    expect(firstAfter.isPrimary).toBe(false);
  });

  it('45. media removal cannot delete arbitrary storage keys — the key is always resolved from the DB, never accepted from the client', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'photo.jpg',
    ).expect(201);

    // The delete route only ever takes a mediaId — there is no request
    // shape that lets a client name a storage key to delete directly.
    await request(testApp.app.getHttpServer())
      .delete(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/${media.body.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.propertyMedia.findUnique({
      where: { id: media.body.id },
    });
    expect(stored).toBeNull();

    // Deleting again (already gone) is a clean 404, not an arbitrary-key operation.
    await request(testApp.app.getHttpServer())
      .delete(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/${media.body.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(404);
  });

  it('46. private media is never exposed through an unauthenticated request, and access requires a valid signature', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadMedia(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'photo.jpg',
    ).expect(201);

    // Getting an access URL requires authorization.
    const outsider = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/${media.body.id}/access-url`,
      )
      .set(...authHeader(outsider.accessToken))
      .expect(403);

    // Hitting the storage endpoint without a valid signature never serves the file.
    await request(testApp.app.getHttpServer())
      .get('/api/v1/storage/access')
      .expect(401);
    await request(testApp.app.getHttpServer())
      .get('/api/v1/storage/access?key=whatever&exp=9999999999999&sig=deadbeef')
      .expect(401);

    // A correctly-authorized caller does get a working, time-limited URL.
    const accessResponse = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/${media.body.id}/access-url`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(accessResponse.body.url).toContain('/api/v1/storage/access');

    const url = new URL(accessResponse.body.url as string);
    const fetched = await request(testApp.app.getHttpServer())
      .get(url.pathname + url.search)
      .expect(200);
    expect((fetched.body as Buffer).toString()).toBe('fake-image-bytes');
  });
});
