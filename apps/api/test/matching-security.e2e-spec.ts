import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createClientRequirement,
  createProperty,
  inviteAndActivateEmployee,
  registerClient,
  registerVerifiedCompanyOwner,
  verifyEmailAndPhone,
} from './utils/flows';

describe('Matching security', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it("36. matching never returns another workspace's property, even when it would otherwise satisfy every criterion", async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    // A perfectly matching property, but it belongs to workspace B.
    await createProperty(testApp, ownerB.workspaceId, ownerB.accessToken, {
      propertyType: 'APARTMENT',
      listingPurpose: 'SALE',
      price: 100000,
      currency: 'USD',
    });

    const client = await createClient(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const requirement = await createClientRequirement(
      testApp,
      ownerA.workspaceId,
      client.id,
      ownerA.accessToken,
      {
        propertyTypes: ['APARTMENT'],
        maxPrice: 200000,
        currency: 'USD',
      },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${ownerA.workspaceId}/clients/${client.id}/requirements/${requirement.id}/matches`,
      )
      .set(...authHeader(ownerA.accessToken))
      .expect(200);

    expect(response.body.items).toEqual([]);
  });

  it('37. a platform CLIENT account (no workspace) cannot call the matching endpoint', async () => {
    const platformClient = await registerClient(testApp);
    await verifyEmailAndPhone(testApp, platformClient);
    const login = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: platformClient.email, password: platformClient.password })
      .expect(200);

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
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements/${requirement.id}/matches`,
      )
      .set(...authHeader(login.body.tokens.accessToken as string))
      .expect(403);
  });

  it('38. missing property.view prevents matching even though client.view is held', async () => {
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

    const role = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'CLIENT_VIEW_ONLY',
        name: 'Client View Only',
        permissionKeys: ['client.view'],
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
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements/${requirement.id}/matches`,
      )
      .set(...authHeader(member.accessToken))
      .expect(403);
  });

  it('39. missing client.view prevents matching even though property.view is held', async () => {
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

    const role = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'PROPERTY_VIEW_ONLY',
        name: 'Property View Only',
        permissionKeys: ['property.view'],
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
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements/${requirement.id}/matches`,
      )
      .set(...authHeader(member.accessToken))
      .expect(403);
  });

  it("40. guessing another workspace's requirement id cannot bypass authorization", async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const clientA = await createClient(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const requirementA = await createClientRequirement(
      testApp,
      ownerA.workspaceId,
      clientA.id,
      ownerA.accessToken,
    );
    const clientB = await createClient(
      testApp,
      ownerB.workspaceId,
      ownerB.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${ownerB.workspaceId}/clients/${clientB.id}/requirements/${requirementA.id}/matches`,
      )
      .set(...authHeader(ownerB.accessToken))
      .expect(404);
  });

  it('41, 42, 43, 44. match results never expose owner info, commission notes, private notes, or exact coordinates', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      propertyType: 'APARTMENT',
      listingPurpose: 'SALE',
      price: 150000,
      currency: 'USD',
      location: {
        latitude: 33.978,
        longitude: 35.618,
        city: 'Jounieh',
        locationSource: 'MANUAL',
      },
      owners: [{ fullName: 'Secret Owner', phone: '+96170000001' }],
      privateDetails: {
        internalNotes: 'private note',
        commissionNotes: '5% commission',
      },
    });

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
        propertyTypes: ['APARTMENT'],
        maxPrice: 200000,
        currency: 'USD',
      },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/clients/${client.id}/requirements/${requirement.id}/matches`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.items.length).toBe(1);
    const matchedProperty = response.body.items[0].property;
    const serialized = JSON.stringify(matchedProperty);
    expect(matchedProperty).not.toHaveProperty('owners');
    expect(matchedProperty).not.toHaveProperty('privateDetails');
    expect(matchedProperty).not.toHaveProperty('latitude');
    expect(matchedProperty).not.toHaveProperty('longitude');
    expect(serialized).not.toContain('Secret Owner');
    expect(serialized).not.toContain('commission');
    expect(serialized).not.toContain('private note');
  });
});
