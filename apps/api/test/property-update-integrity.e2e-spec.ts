import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  registerVerifiedCompanyOwner,
} from './utils/flows';

/**
 * Regression coverage for the property owner data-loss bug: the mobile
 * "Edit Property" screen used to reconstruct `owners` from only the
 * primary owner's name/phone (dropping email/WhatsApp/notes and any
 * additional owners) and resend that lossy array on every save — even a
 * save that only touched an unrelated field like price. The backend's
 * whole-array-replace semantics for `owners` (see UpdatePropertyDto) are
 * intentional and correct for a client that sends a complete,
 * accurate array; these tests pin down the contract a correct client
 * must follow, and prove the server itself never destroys data the
 * client doesn't touch.
 */

const OWNER_A = {
  fullName: 'Owner A',
  phone: '+96170000001',
  email: 'owner.a@example.com',
  whatsappPhone: '+96170000002',
  notes: 'Prefers WhatsApp',
};

const OWNER_B = {
  fullName: 'Owner B',
  phone: '+96170000003',
  email: 'owner.b@example.com',
  whatsappPhone: '+96170000004',
  notes: 'Speaks French',
};

describe('Property update integrity (owner data-loss regression)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('multiple owners are all persisted and returned on creation', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      owners: [OWNER_A, OWNER_B],
    });

    expect(property.owners).toHaveLength(2);
    expect(property.owners).toEqual([
      expect.objectContaining(OWNER_A),
      expect.objectContaining(OWNER_B),
    ]);
  });

  it('editing an unrelated property field (price) does not touch owners when the owners key is omitted', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      owners: [OWNER_A, OWNER_B],
    });

    const response = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .send({ price: 999999 })
      .expect(200);

    expect(response.body.price).toBe(999999);
    expect(response.body.owners).toHaveLength(2);
    expect(response.body.owners).toEqual([
      expect.objectContaining(OWNER_A),
      expect.objectContaining(OWNER_B),
    ]);
  });

  it('editing one owner while resubmitting a complete array preserves the other owner exactly', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      owners: [OWNER_A, OWNER_B],
    });

    // Simulates a correctly-behaving client (post-fix EditPropertyScreen):
    // the primary owner's name changes, every other field/owner is
    // resent unchanged rather than dropped.
    const response = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .send({
        owners: [{ ...OWNER_A, fullName: 'Owner A Updated' }, OWNER_B],
      })
      .expect(200);

    expect(response.body.owners).toEqual([
      expect.objectContaining({ ...OWNER_A, fullName: 'Owner A Updated' }),
      expect.objectContaining(OWNER_B),
    ]);
  });

  it('preserves owner fields not shown/edited by the screen (email, WhatsApp, notes) when only name/phone change', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      owners: [OWNER_A],
    });

    const response = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .send({
        owners: [{ ...OWNER_A, fullName: 'Owner A Renamed', phone: '+96170009999' }],
      })
      .expect(200);

    expect(response.body.owners).toEqual([
      expect.objectContaining({
        fullName: 'Owner A Renamed',
        phone: '+96170009999',
        email: OWNER_A.email,
        whatsappPhone: OWNER_A.whatsappPhone,
        notes: OWNER_A.notes,
      }),
    ]);
  });

  it('intentionally clearing an optional property field (description) persists as cleared', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      description: 'Original description',
    });

    const cleared = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .send({ description: '' })
      .expect(200);

    expect(cleared.body.description).toBe('');

    const fetched = await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .expect(200);
    expect(fetched.body.description).toBe('');
  });

  it('omitting an optional property field (description) on an unrelated edit leaves it unchanged', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
      description: 'Keep me',
    });

    const response = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
      .set(...authHeader(owner.accessToken))
      .send({ price: 123456 })
      .expect(200);

    expect(response.body.price).toBe(123456);
    expect(response.body.description).toBe('Keep me');
  });

  /**
   * Extends the same "omitted vs. cleared" contract to the numeric
   * optional fields (bedrooms/bathrooms/areaSqm) and to the two
   * privateDetails text fields EditPropertyScreen exposes
   * (internalNotes/commissionNotes). Numeric fields use an explicit
   * `null` to mean "clear" — never `0`, which would silently corrupt a
   * genuine zero-bedroom/zero-bathroom value — while the text fields
   * reuse the same empty-string convention as `description`.
   */
  describe('numeric and private-notes fields support the same omitted-vs-cleared contract', () => {
    it('omitting bedrooms/bathrooms/areaSqm on an unrelated edit leaves them unchanged', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
        bedrooms: 3,
        bathrooms: 2,
        areaSqm: 120.5,
      });

      const response = await request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ price: 111111 })
        .expect(200);

      expect(response.body.price).toBe(111111);
      expect(response.body.bedrooms).toBe(3);
      expect(response.body.bathrooms).toBe(2);
      expect(response.body.areaSqm).toBe(120.5);
    });

    it('sending an explicit null for bedrooms/bathrooms/areaSqm clears them (never coerced to 0)', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
        bedrooms: 3,
        bathrooms: 2,
        areaSqm: 120.5,
      });

      const cleared = await request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ bedrooms: null, bathrooms: null, areaSqm: null })
        .expect(200);

      expect(cleared.body.bedrooms).toBeNull();
      expect(cleared.body.bathrooms).toBeNull();
      expect(cleared.body.areaSqm).toBeNull();

      const fetched = await request(testApp.app.getHttpServer())
        .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .expect(200);
      expect(fetched.body.bedrooms).toBeNull();
      expect(fetched.body.bathrooms).toBeNull();
      expect(fetched.body.areaSqm).toBeNull();
    });

    it('clearing bedrooms to null does not disturb an untouched bathrooms value, and vice versa', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
        bedrooms: 4,
        bathrooms: 3,
      });

      const response = await request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ bedrooms: null })
        .expect(200);

      expect(response.body.bedrooms).toBeNull();
      expect(response.body.bathrooms).toBe(3);
    });

    it('omitting privateDetails on an unrelated edit leaves internalNotes/commissionNotes unchanged', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
        privateDetails: { internalNotes: 'Keep me', commissionNotes: 'Also keep me' },
      });

      const response = await request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ price: 222222 })
        .expect(200);

      expect(response.body.price).toBe(222222);
      expect(response.body.privateDetails.internalNotes).toBe('Keep me');
      expect(response.body.privateDetails.commissionNotes).toBe('Also keep me');
    });

    it('intentionally clearing internalNotes/commissionNotes (empty string) persists as cleared', async () => {
      const owner = await registerVerifiedCompanyOwner(testApp);
      const property = await createProperty(testApp, owner.workspaceId, owner.accessToken, {
        privateDetails: { internalNotes: 'Original notes', commissionNotes: 'Original split' },
      });

      const cleared = await request(testApp.app.getHttpServer())
        .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .send({ privateDetails: { internalNotes: '', commissionNotes: '' } })
        .expect(200);

      expect(cleared.body.privateDetails.internalNotes).toBe('');
      expect(cleared.body.privateDetails.commissionNotes).toBe('');

      const fetched = await request(testApp.app.getHttpServer())
        .get(`/api/v1/workspaces/${owner.workspaceId}/properties/${property.id}`)
        .set(...authHeader(owner.accessToken))
        .expect(200);
      expect(fetched.body.privateDetails.internalNotes).toBe('');
      expect(fetched.body.privateDetails.commissionNotes).toBe('');
    });
  });
});
