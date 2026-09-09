import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createProperty,
  login,
  registerAgent,
  registerCompany,
  savePublicationDraft,
  submitPublication,
  uploadPropertyImage,
  verifyEmailAndPhone,
} from './utils/flows';

/**
 * Regression coverage for the account-verification overhaul:
 *
 * 1. A workspace/company is created immediately at registration (see
 *    AuthService.register) — not deferred until verification (see
 *    AccountActivationService.activateIfVerified, now a pure status
 *    flip) — so an unverified AGENT/COMPANY can actually browse the
 *    app, matching the "Verify Later" product requirement.
 * 2. "Verify Later" never fakes verification: nothing about
 *    registration, login, or browsing sets emailVerifiedAt/
 *    phoneVerifiedAt/accountStatus=ACTIVE.
 * 3. The one action that genuinely requires a verified identity —
 *    submitting a property to the public marketplace — still enforces
 *    the real backend verification state regardless of how permissive
 *    browsing itself is (see PublicationsService.assertActorVerified).
 * 4. Two small pre-existing gaps in verification-endpoint coverage: an
 *    invalid (never-issued) email token is rejected, and phone OTP
 *    resend is rate-limited the same way email resend already is.
 */
describe('Account verification flow (browsing while unverified + verified-only gate)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('registering an AGENT creates a personal workspace immediately, before any verification', async () => {
    const user = await registerAgent(testApp);

    const workspace = await testApp.prisma.workspace.findFirst({
      where: { personalOwnerUserId: user.id },
    });
    expect(workspace).not.toBeNull();

    const stored = await testApp.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.accountStatus).toBe('PENDING_VERIFICATION');
  });

  it('registering a COMPANY creates the company + workspace immediately, before any verification', async () => {
    const user = await registerCompany(testApp, { companyName: 'Unverified Co' });

    const membership = await testApp.prisma.workspaceMember.findFirst({
      where: { userId: user.id, membershipType: 'OWNER' },
      include: { workspace: true },
    });
    expect(membership).not.toBeNull();
    expect(membership?.workspace.type).toBe('COMPANY');

    const stored = await testApp.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.accountStatus).toBe('PENDING_VERIFICATION');
  });

  it('an unverified agent can log in and browse workspace-scoped endpoints (list workspaces, list properties)', async () => {
    const user = await registerAgent(testApp);
    const tokens = await login(testApp, user);

    const workspacesResponse = await request(testApp.app.getHttpServer())
      .get('/api/v1/workspaces')
      .set(...authHeader(tokens.accessToken))
      .expect(200);
    expect(workspacesResponse.body).toHaveLength(1);
    const workspaceId = workspacesResponse.body[0].id as string;

    await request(testApp.app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/properties`)
      .set(...authHeader(tokens.accessToken))
      .expect(200);

    // Still genuinely unverified — browsing never fakes it.
    const stored = await testApp.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.emailVerifiedAt).toBeNull();
    expect(stored.phoneVerifiedAt).toBeNull();
    expect(stored.accountStatus).toBe('PENDING_VERIFICATION');
  });

  it('an unverified agent can create a property (a normal, low-risk app feature)', async () => {
    const user = await registerAgent(testApp);
    const tokens = await login(testApp, user);
    const workspace = await testApp.prisma.workspace.findFirstOrThrow({
      where: { personalOwnerUserId: user.id },
    });

    const property = await createProperty(testApp, workspace.id, tokens.accessToken);
    expect(property.id).toEqual(expect.any(String));
  });

  it('an unverified agent CANNOT submit a property to the public marketplace (verified-only gate)', async () => {
    const user = await registerAgent(testApp);
    const tokens = await login(testApp, user);
    const workspace = await testApp.prisma.workspace.findFirstOrThrow({
      where: { personalOwnerUserId: user.id },
    });

    const property = await createProperty(testApp, workspace.id, tokens.accessToken);
    const media = await uploadPropertyImage(testApp, workspace.id, property.id, tokens.accessToken);
    await savePublicationDraft(testApp, workspace.id, property.id, tokens.accessToken, [media.id]);

    const response = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${workspace.id}/properties/${property.id}/publication/submit`)
      .set(...authHeader(tokens.accessToken))
      .expect(403);
    expect(response.body.message).toMatch(/verify your email and phone/i);
  });

  it('after completing verification, the same agent CAN submit — and accountStatus becomes ACTIVE', async () => {
    const user = await registerAgent(testApp);
    const tokens = await login(testApp, user);
    const workspace = await testApp.prisma.workspace.findFirstOrThrow({
      where: { personalOwnerUserId: user.id },
    });

    const property = await createProperty(testApp, workspace.id, tokens.accessToken);
    const media = await uploadPropertyImage(testApp, workspace.id, property.id, tokens.accessToken);
    await savePublicationDraft(testApp, workspace.id, property.id, tokens.accessToken, [media.id]);

    await verifyEmailAndPhone(testApp, user);

    const stored = await testApp.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.accountStatus).toBe('ACTIVE');

    // A previously-issued access token remains valid — verifying doesn't
    // revoke the session, it only unlocks the one gated action.
    await submitPublication(testApp, workspace.id, property.id, tokens.accessToken);
  });

  it('an invalid (never-issued) email verification token is rejected', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: 'this-token-was-never-issued' })
      .expect(400);
  });

  it('phone OTP resend (request-otp) is rate limited, same as email resend', async () => {
    const user = await registerAgent(testApp);

    // points: 3 per 900s for auth:otp-request.
    for (let i = 0; i < 3; i += 1) {
      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/phone/request-otp')
        .send({ phone: user.phone })
        .expect(204);
    }

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/request-otp')
      .send({ phone: user.phone })
      .expect(429);
  });
});
