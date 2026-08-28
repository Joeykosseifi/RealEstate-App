import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  minimalPublicationDraftPayload,
  registerVerifiedAgentWithWorkspace,
  savePublicationDraft,
  submitPublication,
  uploadPropertyImage,
} from './utils/flows';

describe('Publication draft & submission', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('24-26. an authorized professional can create a draft; it belongs to the correct property/workspace with a server-derived workspaceId', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadPropertyImage(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );

    const draft = await savePublicationDraft(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
      [media.id],
    );

    expect(draft.propertyId).toBe(property.id);
    expect(draft.workspaceId).toBe(owner.workspaceId);
    expect(draft.status).toBe('DRAFT');

    const stored = await testApp.prisma.propertyPublication.findUniqueOrThrow({
      where: { propertyId: property.id },
    });
    expect(stored.workspaceId).toBe(owner.workspaceId);
  });

  it('27. the submitter is server-derived from the JWT, never trusted from the request body', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadPropertyImage(
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
      [media.id],
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ submittedByUserId: 'attacker-controlled-id' })
      .expect(200);

    const publication =
      await testApp.prisma.propertyPublication.findUniqueOrThrow({
        where: { propertyId: property.id },
      });
    expect(publication.submittedByUserId).toBe(owner.id);
  });

  it('28. submission creates an immutable version — the same version cannot be silently overwritten while pending', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadPropertyImage(
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
      [media.id],
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send(
        minimalPublicationDraftPayload([media.id], {
          publicTitle: 'Sneaky Edit',
        }),
      )
      .expect(409);
  });

  it('29. missing required public fields are rejected (400) at submission time', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    // No image selected — required before submission.
    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send(minimalPublicationDraftPayload([]))
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(400);
  });

  it('30. an archived property cannot start or submit a publication draft', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
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
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send(minimalPublicationDraftPayload([]))
      .expect(409);
  });

  it('31. a SOLD property cannot be newly submitted for publication', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadPropertyImage(
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
      [media.id],
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/status`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyStatus: 'SOLD' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });

  it('32. a duplicate submission while already PENDING_REVIEW is rejected', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const media = await uploadPropertyImage(
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
      [media.id],
    );
    await submitPublication(
      testApp,
      owner.workspaceId,
      property.id,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication/submit`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });

  it('33. selecting a media id that does not belong to the property, or is not an IMAGE, is rejected', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const otherOwner = await registerVerifiedAgentWithWorkspace(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const otherProperty = await createProperty(
      testApp,
      otherOwner.workspaceId,
      otherOwner.accessToken,
    );
    const foreignMedia = await uploadPropertyImage(
      testApp,
      otherOwner.workspaceId,
      otherProperty.id,
      otherOwner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send(minimalPublicationDraftPayload([foreignMedia.id]))
      .expect(400);

    // A DOCUMENT-type upload must never be selectable as public media.
    const doc = await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/media`,
      )
      .set(...authHeader(owner.accessToken))
      .field('mediaType', 'DOCUMENT')
      .attach('file', Buffer.from('fake-doc-bytes'), 'deed.pdf')
      .expect(201);

    await request(testApp.app.getHttpServer())
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/publication`,
      )
      .set(...authHeader(owner.accessToken))
      .send(minimalPublicationDraftPayload([doc.body.id as string]))
      .expect(400);
  });
});
