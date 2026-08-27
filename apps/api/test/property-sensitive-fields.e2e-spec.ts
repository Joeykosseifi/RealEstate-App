import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  inviteAndActivateEmployee,
  registerVerifiedCompanyOwner,
} from './utils/flows';

async function createCustomRole(
  testApp: TestApp,
  workspaceId: string,
  ownerToken: string,
  key: string,
  permissionKeys: string[],
): Promise<string> {
  const response = await request(testApp.app.getHttpServer())
    .post(`/api/v1/workspaces/${workspaceId}/roles`)
    .set(...authHeader(ownerToken))
    .send({ key, name: key, permissionKeys })
    .expect(201);
  return response.body.id as string;
}

const FULL_LOCATION = {
  country: 'Lebanon',
  city: 'Beirut',
  area: 'Achrafieh',
  address: '123 Exact Street',
  latitude: 33.888629,
  longitude: 35.495479,
  googlePlaceId: 'place-123',
};

const OWNER_PAYLOAD = { fullName: 'Secret Owner', phone: '+9611234567' };
const PRIVATE_DETAILS_PAYLOAD = {
  internalNotes: 'internal note text',
  commissionNotes: 'commission split text',
};

describe('Property sensitive-field permission enforcement', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('10, 12, 14, 16. property.view alone reveals none of owner/private-notes/commission/exact-location', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        location: FULL_LOCATION,
        owners: [OWNER_PAYLOAD],
        privateDetails: PRIVATE_DETAILS_PAYLOAD,
      },
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

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body).not.toHaveProperty('owners');
    expect(response.body).not.toHaveProperty('privateDetails');
    expect(response.body).not.toHaveProperty('location');
    expect(response.body.title).toBeDefined();
  });

  it('11. property.view_owner reveals owner information', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        owners: [OWNER_PAYLOAD],
      },
    );

    const roleId = await createCustomRole(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      'OWNER_VIEWER',
      ['property.view', 'property.view_owner'],
    );
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(member.accessToken))
      .expect(200);

    expect(response.body.owners).toHaveLength(1);
    expect(response.body.owners[0].fullName).toBe('Secret Owner');
    expect(response.body).not.toHaveProperty('privateDetails');
    expect(response.body).not.toHaveProperty('location');
  });

  it('13. property.view_private_notes reveals private notes but not commission', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        privateDetails: PRIVATE_DETAILS_PAYLOAD,
      },
    );

    const roleId = await createCustomRole(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      'PRIVATE_VIEWER',
      ['property.view', 'property.view_private_notes'],
    );
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(member.accessToken))
      .expect(200);

    expect(response.body.privateDetails.internalNotes).toBe(
      'internal note text',
    );
    expect(response.body.privateDetails).not.toHaveProperty('commissionNotes');
  });

  it('15. property.view_commission (with property.view_private_notes) reveals commission notes', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        privateDetails: PRIVATE_DETAILS_PAYLOAD,
      },
    );

    const roleId = await createCustomRole(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      'COMMISSION_VIEWER',
      [
        'property.view',
        'property.view_private_notes',
        'property.view_commission',
      ],
    );
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(member.accessToken))
      .expect(200);

    expect(response.body.privateDetails.commissionNotes).toBe(
      'commission split text',
    );
  });

  it('17. property.view_exact_location reveals exact coordinates', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        location: FULL_LOCATION,
      },
    );

    const roleId = await createCustomRole(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      'LOCATION_VIEWER',
      ['property.view', 'property.view_exact_location'],
    );
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId },
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(member.accessToken))
      .expect(200);

    expect(response.body.location.latitude).toBeCloseTo(33.888629, 5);
    expect(response.body.location.longitude).toBeCloseTo(35.495479, 5);
  });

  it('writing owner info requires property.view_owner, not just property.edit', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    // A custom role with property.edit but not property.view_owner.
    const roleId = await createCustomRole(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      'EDIT_ONLY',
      ['property.view', 'property.edit'],
    );
    const editor = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { roleId },
    );

    await request(testApp.app.getHttpServer())
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`,
      )
      .set(...authHeader(editor.accessToken))
      .send({ owners: [OWNER_PAYLOAD] })
      .expect(403);
  });

  it('47-52. owner and private-detail data persist, support multiple owners, and are correctly gated on read', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        owners: [OWNER_PAYLOAD, { fullName: 'Second Owner' }],
        privateDetails: PRIVATE_DETAILS_PAYLOAD,
      },
    );

    const fullDetail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);

    expect(fullDetail.body.owners).toHaveLength(2);
    expect(fullDetail.body.privateDetails.internalNotes).toBe(
      'internal note text',
    );
    expect(fullDetail.body.privateDetails.commissionNotes).toBe(
      'commission split text',
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
    const restrictedDetail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(restrictedDetail.body).not.toHaveProperty('owners');
    expect(restrictedDetail.body).not.toHaveProperty('privateDetails');
  });
});
