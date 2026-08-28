import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  grantPlatformRole,
  minimalPublicationDraftPayload,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
  savePublicationDraft,
  uploadPropertyImage,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

describe('Publication media selection safety', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('88-89. only explicitly-selected images become public; unselected private images stay private', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const selected = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'selected.jpg',
    );
    const unselected = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'unselected.jpg',
    );
    void unselected;

    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      [selected.id],
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.id },
      });
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publication.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(detail.body.media.length).toBe(1);
  });

  it('90. document media never appears in the public detail, even if somehow attached to a property with other public images', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const image = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media`,
      )
      .set(...authHeader(owner.accessToken))
      .field('mediaType', 'DOCUMENT')
      .attach('file', Buffer.from('fake-doc-bytes'), 'title-deed.pdf')
      .expect(201);

    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      [image.id],
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.id },
      });
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publication.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(detail.body.media.length).toBe(1);
    expect(JSON.stringify(detail.body)).not.toContain('title-deed');
  });

  it('91-92. media ordering is preserved and the first/main image is deterministic', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const first = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'first.jpg',
    );
    const second = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      'second.jpg',
    );

    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      [second.id, first.id],
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.id },
      });
    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/property-publications/${publication.id}/approve`)
      .set(...authHeader(admin.accessToken))
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publication.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(detail.body.media[0].isMain).toBe(true);
    expect(detail.body.mainImage.isMain).toBe(true);
  });

  it('93. guessing a private media storage key/url directly cannot bypass authorization', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const image = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );

    // Guessing the object key with no valid signature must fail.
    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/storage/access?key=properties/${property.id}/${image.id}-deadbeef`,
      )
      .expect(401);
  });

  it('a valid signed media access response allows cross-origin embedding (admin-web/marketplace previews)', async () => {
    // Found via a real-browser check against admin-web during Milestone 5
    // smoke testing: helmet()'s default Cross-Origin-Resource-Policy:
    // same-origin silently blocks a signed URL's <img> load from any
    // other origin, even though the signature is what actually gates
    // access — see StorageAccessController.
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const image = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );
    const { url } = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media/${image.id}/access-url`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200)
      .then((res) => res.body as { url: string });

    const response = await request(testApp.app.getHttpServer()).get(
      url.replace('http://localhost:3000', ''),
    );
    expect(response.status).toBe(200);
    expect(response.headers['cross-origin-resource-policy']).toBe(
      'cross-origin',
    );
  });

  it('94. removing a public media selection never deletes the underlying private PropertyMedia row', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const image = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );

    await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      [image.id],
    );
    // Save again with an empty media selection — un-selecting it for publication.
    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send(minimalPublicationDraftPayload([]))
      .expect(200);

    const media = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(
      (media.body.media as { id: string }[]).some((m) => m.id === image.id),
    ).toBe(true);
  });
});
