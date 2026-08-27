import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createProperty,
  inviteAndActivateEmployee,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Client property shortlist', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('61. an authorized user can shortlist a property for a client', async () => {
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

    const response = await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyId: property.id, note: 'Good fit' })
      .expect(201);

    expect(response.body.propertyId).toBe(property.id);
    expect(response.body.note).toBe('Good fit');
  });

  it('62. a property must belong to the same authorized workspace as the client', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const clientA = await createClient(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const propertyInB = await createProperty(
      testApp,
      ownerB.workspaceId,
      ownerB.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${ownerA.workspaceId}/clients/${clientA.id}/shortlist`,
      )
      .set(...authHeader(ownerA.accessToken))
      .send({ propertyId: propertyInB.id })
      .expect(404);
  });

  it('63. duplicate shortlist (same client + property) is prevented', async () => {
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

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyId: property.id })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyId: property.id })
      .expect(409);
  });

  it('64. missing property.view prevents shortlisting even with client.edit', async () => {
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

    const role = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'CLIENT_EDIT_ONLY',
        name: 'Client Edit Only',
        permissionKeys: ['client.view', 'client.edit'],
      })
      .expect(201);
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: role.body.id,
      },
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(member.accessToken))
      .send({ propertyId: property.id })
      .expect(403);
  });

  it('65. removing a shortlist entry preserves unrelated records', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const propertyToRemove = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const propertyToKeep = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const removeEntry = await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyId: propertyToRemove.id })
      .expect(201);
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyId: propertyToKeep.id })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .delete(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist/${removeEntry.body.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const list = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(list.body.length).toBe(1);
    expect(list.body[0].propertyId).toBe(propertyToKeep.id);

    const keptProperty = await testApp.prisma.property.findUniqueOrThrow({
      where: { id: propertyToKeep.id },
    });
    expect(keptProperty).toBeDefined();
  });

  it('66. shortlisting an archived property is handled safely (no crash, still recorded)', async () => {
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
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/shortlist`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ propertyId: property.id })
      .expect(201);
  });
});
