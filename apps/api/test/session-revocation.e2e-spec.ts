import request from 'supertest';
import {
  createTestApp,
  extractResetToken,
  resetRateLimits,
  type TestApp,
} from './utils/test-app';
import { login, registerVerifiedAgent } from './utils/flows';

/**
 * Regression coverage for immediate session revocation. Before this
 * fix, `JwtStrategy` validated an access token purely by signature,
 * expiry, and the user's account status — it never checked whether the
 * `UserSession` row named by the token's `sid` had been revoked. So
 * logging out, or resetting a password, revoked the session record (and
 * correctly blocked future refreshes) but the already-issued access
 * token kept authenticating protected endpoints until its own short TTL
 * separately expired. `JwtStrategy.validate` now also calls
 * `SessionsService.isActive(sid)` on every request, so a revoked
 * session's access token stops working immediately.
 */
describe('Session revocation is immediate', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('a revoked access session cannot access a protected endpoint', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    await testApp.prisma.userSession.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);
  });

  it('logout revokes the current session immediately — both its access token and its refresh token stop working', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(204);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('password reset revokes every existing session — access tokens from every device stop working immediately', async () => {
    const user = await registerVerifiedAgent(testApp);
    // A second login = a second device/session for the same user.
    const secondSessionTokens = await login(testApp, user);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondSessionTokens.accessToken}`)
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(204);
    const token = extractResetToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'a-freshly-reset-password-1' })
      .expect(204);

    // Both the original session's and the second session's access
    // tokens must stop working immediately — password reset revokes
    // every session for the user, not just the one that requested it.
    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);
    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondSessionTokens.accessToken}`)
      .expect(401);
  });

  it('unrelated active sessions are unaffected by logging out of one session (existing single-session-scoped logout model preserved)', async () => {
    const user = await registerVerifiedAgent(testApp);
    const secondSessionTokens = await login(testApp, user);

    // Logging out on the FIRST session must not touch the second.
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(204);

    // First session: dead, as expected.
    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);

    // Second session: still fully live — both its access token and its
    // ability to refresh.
    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondSessionTokens.accessToken}`)
      .expect(200);
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondSessionTokens.refreshToken })
      .expect(200);
  });

  it('account suspension is still enforced immediately alongside the session check (does not regress existing account-status enforcement)', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: 'SUSPENDED' },
    });

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);
  });
});
