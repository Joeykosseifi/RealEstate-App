import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createClientRequirement,
  minimalRequirementPayload,
  registerVerifiedCompanyOwner,
} from './utils/flows';

describe('Client requirements', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('27. a client can have multiple requirements at once', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        title: 'Apartment to buy',
      },
    );
    await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        title: 'Land to invest',
        propertyTypes: ['LAND'],
      },
    );

    const list = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(list.body.length).toBe(2);
  });

  it('28. a requirement is scoped to its correct workspace and client', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
    );

    expect(requirement.workspaceId).toBe(owner.workspaceId);
    expect(requirement.clientId).toBe(client.id);
  });

  it('29. a requirement cannot be attached to a client belonging to another workspace', async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const clientInA = await createClient(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );

    // ownerB is authorized in their OWN workspace, but the client id belongs to workspace A.
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${ownerB.workspaceId}/clients/${clientInA.id}/requirements`,
      )
      .set(...authHeader(ownerB.accessToken))
      .send(minimalRequirementPayload())
      .expect(404);
  });

  it('30, 31. hard and preferred criteria persist correctly', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        maxPrice: 180000,
        currency: 'USD',
        minBedrooms: 3,
        requiredFeatures: ['parking', 'elevator'],
        preferredFeatures: ['sea_view', 'balcony'],
      },
    );

    expect(requirement.maxPrice).toBe(180000);
    expect(requirement.currency).toBe('USD');
    expect(requirement.minBedrooms).toBe(3);
    expect(requirement.requiredFeatures).toEqual(['parking', 'elevator']);
    expect(requirement.preferredFeatures).toEqual(['sea_view', 'balcony']);
  });

  it('32. multiple accepted locations (cities/areas) are stored as arrays', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
      {
        cities: ['Jounieh', 'Kaslik'],
        areas: ['Zouk Mikael'],
      },
    );

    expect(requirement.cities).toEqual(['Jounieh', 'Kaslik']);
    expect(requirement.areas).toEqual(['Zouk Mikael']);
  });

  it('33. required/preferred feature keys must use the canonical property-feature catalog', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements`,
      )
      .set(...authHeader(owner.accessToken))
      .send(
        minimalRequirementPayload({ requiredFeatures: ['not_a_real_feature'] }),
      )
      .expect(400);
  });

  it('34. archiving a requirement preserves the row (never hard-deleted)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements/${requirement.id}/archive`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(204);

    const stored = await testApp.prisma.clientRequirement.findUniqueOrThrow({
      where: { id: requirement.id },
    });
    expect(stored.status).toBe('ARCHIVED');
    expect(stored.archivedAt).not.toBeNull();
  });

  it('35. requirement update cannot change workspace/client ownership', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const client = await createClient(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      owner.workspaceId,
      client.id,
      owner.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements/${requirement.id}`,
      )
      .set(...authHeader(owner.accessToken))
      .send({ workspaceId: 'not-real', clientId: 'not-real' })
      .expect(400); // both fields are unknown to UpdateClientRequirementDto -> rejected outright
  });
});
