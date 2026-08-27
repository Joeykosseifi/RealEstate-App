import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createPresentation,
  createProperty,
  registerVerifiedCompanyOwner,
} from './utils/flows';

function uploadMedia(
  testApp: TestApp,
  workspaceId: string,
  propertyId: string,
  accessToken: string,
) {
  return request(testApp.app.getHttpServer())
    .post(`/api/v1/workspaces/${workspaceId}/properties/${propertyId}/media`)
    .set(...authHeader(accessToken))
    .field('mediaType', 'IMAGE')
    .field('isPrimary', 'true')
    .attach('file', Buffer.from('fake-image-bytes'), 'photo.jpg');
}

describe('Presentation functional', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('77, 78. a presentation can contain multiple properties and their order persists', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const propertyA = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { title: 'A' },
    );
    const propertyB = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { title: 'B' },
    );
    const propertyC = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { title: 'C' },
    );

    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [
        { propertyId: propertyC.id },
        { propertyId: propertyA.id },
        { propertyId: propertyB.id },
      ],
    );

    expect(presentation.items).toHaveLength(3);
    const orderedIds = (
      presentation.items as { propertyId: string; sortOrder: number }[]
    )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.propertyId);
    expect(orderedIds).toEqual([propertyC.id, propertyA.id, propertyB.id]);
  });

  it('79. client-facing agent notes persist', async () => {
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
      [{ propertyId: property.id, agentNote: 'Great value for the area.' }],
    );

    const item = (presentation.items as { agentNote: string | null }[])[0];
    expect(item.agentNote).toBe('Great value for the area.');
  });

  it('80. generating a presentation produces a valid PDF', async () => {
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

    const response = await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.status).toBe('GENERATED');
    expect(response.body.generatedAt).not.toBeNull();
  });

  it('81. generation succeeds when the property has a primary image available', async () => {
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
    ).expect(201);
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
  });

  it('82. a missing image does not break generation', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    // No media uploaded at all.
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
  });

  it('83. the generated artifact is stored via StorageService and retrievable', async () => {
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
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    const stored = await testApp.prisma.propertyPresentation.findUniqueOrThrow({
      where: { id: presentation.id },
    });
    expect(stored.storageKey).not.toBeNull();
    expect(stored.storageKey).toContain('presentations/');

    const accessResponse = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/access-url`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const url = new URL(accessResponse.body.url as string);
    const fetched = await request(testApp.app.getHttpServer())
      .get(url.pathname + url.search)
      .expect(200);
    expect((fetched.body as Buffer).subarray(0, 5).toString('latin1')).toBe(
      '%PDF-',
    );
  });

  it('84. regenerating a presentation produces a new artifact under a new key', async () => {
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

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const firstStored =
      await testApp.prisma.propertyPresentation.findUniqueOrThrow({
        where: { id: presentation.id },
      });

    // Editing the title moves it back to DRAFT without touching the artifact.
    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ title: 'Updated Title' })
      .expect(200);
    const afterEdit =
      await testApp.prisma.propertyPresentation.findUniqueOrThrow({
        where: { id: presentation.id },
      });
    expect(afterEdit.status).toBe('DRAFT');
    expect(afterEdit.storageKey).toBe(firstStored.storageKey); // still points at the old artifact

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const secondStored =
      await testApp.prisma.propertyPresentation.findUniqueOrThrow({
        where: { id: presentation.id },
      });

    expect(secondStored.storageKey).not.toBe(firstStored.storageKey);
    expect(secondStored.status).toBe('GENERATED');
  });

  it('85. presentation history remains linked to the client', async () => {
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
    await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
      {
        clientId: client.id,
      },
    );

    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(detail.body.presentationCount).toBe(1);
  });

  it('86. archiving a presentation preserves the record', async () => {
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

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.propertyPresentation.findUniqueOrThrow({
      where: { id: presentation.id },
    });
    expect(stored.status).toBe('ARCHIVED');
    expect(stored.archivedAt).not.toBeNull();

    const items = await testApp.prisma.propertyPresentationItem.findMany({
      where: { presentationId: presentation.id },
    });
    expect(items).toHaveLength(1);
  });
});
