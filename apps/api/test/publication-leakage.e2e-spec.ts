import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  grantPlatformRole,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
} from './utils/flows';

async function makeSuperAdmin(testApp: TestApp) {
  const admin = await registerVerifiedAgent(testApp);
  await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');
  return admin;
}

/**
 * Proves the marketplace/public APIs never leak professional-only data,
 * even when that data is deliberately present on the underlying
 * property. Structural DTO safety is also covered by
 * `marketplace.mapper.spec.ts` (unit-level, no DB); these are the
 * end-to-end proof against real HTTP responses.
 */
describe('Public data leakage — marketplace never exposes private fields', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('13-20. published listing detail never contains owner/private/commission/acquisition/internal-reference fields', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);

    const { publicationId, propertyId } =
      await createAndApprovePublishedListing(
        testApp,
        owner.workspaceId,
        owner.accessToken,
        admin.accessToken,
      );

    // Attach exactly the sensitive data the marketplace must never see.
    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/workspaces/${owner.workspaceId}/properties/${propertyId}`)
      .set(...authHeader(owner.accessToken))
      .send({
        owners: [
          {
            fullName: 'Secret Owner Name',
            phone: '+96170999999',
            email: 'secretowner@example.test',
            whatsappPhone: '+96170888888',
            notes: 'Owner is very motivated to sell.',
          },
        ],
        privateDetails: {
          internalNotes: 'Internal note: leaky roof, do not mention.',
          commissionNotes: 'Commission split 50/50.',
          acquisitionSource: 'Referral from Joe',
          internalReference: 'INTERNAL-REF-7742',
        },
      })
      .expect(200);

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain('Secret Owner Name');
    expect(raw).not.toContain('+96170999999');
    expect(raw).not.toContain('secretowner@example.test');
    expect(raw).not.toContain('+96170888888');
    expect(raw).not.toContain('leaky roof');
    expect(raw).not.toContain('Commission split');
    expect(raw).not.toContain('Referral from Joe');
    expect(raw).not.toContain('INTERNAL-REF-7742');
    expect(response.body.owners).toBeUndefined();
    expect(response.body.privateDetails).toBeUndefined();
  });

  it('21. exact latitude/longitude never appear unless locationVisibility is PUBLIC_EXACT', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);

    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { locationVisibility: 'PUBLIC_APPROXIMATE' },
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body.location.exactLatitude).toBeUndefined();
    expect(response.body.location.exactLongitude).toBeUndefined();
  });

  it('22. private/document media storage keys are never present — only resolved signed URLs', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);

    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain('storageKey');
    expect(raw).not.toMatch(/properties\/[0-9a-f-]+\/[0-9a-f-]+-[0-9a-f]{8}/);
  });

  it('23. admin review detail is never exposed through any public/marketplace endpoint', async () => {
    const owner = await registerVerifiedAgentWithWorkspace(testApp);
    const admin = await makeSuperAdmin(testApp);

    const { publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
    );

    const viewer = await registerVerifiedAgent(testApp);
    const response = await request(testApp.app.getHttpServer())
      .get(`/api/v1/marketplace/properties/${publicationId}`)
      .set(...authHeader(viewer.accessToken))
      .expect(200);

    expect(response.body.history).toBeUndefined();
    expect(response.body.submittedByUserId).toBeUndefined();
    expect(response.body.reviewReason).toBeUndefined();
  });
});
