import request from 'supertest';
import {
  createTestApp,
  extractResetToken,
  resetRateLimits,
  type TestApp,
} from './utils/test-app';
import { registerVerifiedAgent } from './utils/flows';

describe('Auth — password reset', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('31. password reset request behaves safely for unknown email', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'no-such-account@example.test' })
      .expect(204);
  });

  it('32. valid reset token changes password', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(204);

    const token = extractResetToken(testApp.mail.latestFor(user.email));
    const newPassword = 'a-brand-new-strong-password';

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: newPassword })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);
  });

  it('33. expired reset token fails', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(204);

    await testApp.prisma.passwordReset.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const token = extractResetToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'another-strong-password' })
      .expect(400);
  });

  it('34. used reset token cannot be reused', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(204);
    const token = extractResetToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'first-new-password-123' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'second-new-password-456' })
      .expect(400);
  });

  it('35. existing sessions are revoked after a password reset (documented policy)', async () => {
    const user = await registerVerifiedAgent(testApp);

    // The refreshToken from registerVerifiedAgent's login is a live session.
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(204);
    const token = extractResetToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'yet-another-strong-password' })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200); // access token itself is still valid until it expires — only the session/refresh is revoked.
  });
});
