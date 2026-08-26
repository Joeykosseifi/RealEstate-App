import request from 'supertest';
import {
  createTestApp,
  extractEmailToken,
  extractOtp,
  resetRateLimits,
  type TestApp,
} from './utils/test-app';
import { registerAgent, registerVerifiedAgent } from './utils/flows';

describe('Auth — security boundaries', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('46. password hashes never appear in API responses', async () => {
    const user = await registerVerifiedAgent(testApp);

    const responses = await Promise.all([
      request(testApp.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password }),
      request(testApp.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`),
    ]);

    for (const res of responses) {
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('$argon2id$');
      expect(body).not.toContain(user.password);
    }
  });

  it('47. refresh-token hashes never appear in API responses', async () => {
    const user = await registerVerifiedAgent(testApp);
    const session = await testApp.prisma.userSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('refreshTokenHash');
    expect(body).not.toContain(session.refreshTokenHash);
  });

  it('48. OTP secrets never appear in verification API responses', async () => {
    const user = await registerAgent(testApp);
    const otp = extractOtp(testApp.sms.latestFor(user.phone));

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp })
      .expect(204);

    expect(res.text).toBe('');
  });

  it('49. reset-token secrets never appear in password API responses', async () => {
    const user = await registerVerifiedAgent(testApp);

    const forgotRes = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(204);
    expect(forgotRes.text).toBe('');

    const token = extractEmailToken(testApp.mail.latestFor(user.email));
    const resetRes = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'a-totally-different-password' })
      .expect(204);
    expect(resetRes.text).toBe('');
  });

  it('50. protected endpoints reject unauthenticated requests', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .expect(401);
  });

  it('51. rate limiting activates on configured sensitive endpoints', async () => {
    const user = await registerVerifiedAgent(testApp);

    // points: 3 per 900s for auth:password-forgot.
    for (let i = 0; i < 3; i += 1) {
      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/password/forgot')
        .send({ email: user.email })
        .expect(204);
    }

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(429);
  });

  it('rejects arbitrary/extra fields on login (DTO allowlisting)', async () => {
    const user = await registerVerifiedAgent(testApp);
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.password,
        accountStatus: 'ACTIVE',
      })
      .expect(400);
  });
});
