import request from 'supertest';
import {
  createTestApp,
  extractEmailToken,
  extractOtp,
  resetRateLimits,
  type TestApp,
} from './utils/test-app';
import { registerAgent } from './utils/flows';

describe('Auth — email & phone verification', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('22. valid phone OTP verifies phone', async () => {
    const user = await registerAgent(testApp);
    const otp = extractOtp(testApp.sms.latestFor(user.phone));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp })
      .expect(204);

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.phoneVerifiedAt).not.toBeNull();
  });

  it('23. invalid OTP fails', async () => {
    const user = await registerAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp: '000000' })
      .expect(400);
  });

  it('24. expired OTP fails', async () => {
    const user = await registerAgent(testApp);
    await testApp.prisma.phoneVerification.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const otp = extractOtp(testApp.sms.latestFor(user.phone));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp })
      .expect(400);
  });

  it('25. OTP attempt limit works', async () => {
    const user = await registerAgent(testApp);
    const otp = extractOtp(testApp.sms.latestFor(user.phone));

    // PHONE_OTP_MAX_ATTEMPTS defaults to 5 — exhaust it with wrong codes.
    for (let i = 0; i < 5; i += 1) {
      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/phone/verify')
        .send({ phone: user.phone, otp: '111111' })
        .expect(400);
    }

    // Even the correct OTP is now rejected.
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp })
      .expect(400);
    expect(res.body.message).toMatch(/too many attempts/i);
  });

  it('26. OTP cannot be reused', async () => {
    const user = await registerAgent(testApp);
    const otp = extractOtp(testApp.sms.latestFor(user.phone));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .send({ phone: user.phone, otp })
      .expect(400);
  });

  it('27. email verification works', async () => {
    const user = await registerAgent(testApp);
    const token = extractEmailToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(204);

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.emailVerifiedAt).not.toBeNull();
  });

  it('28. expired email verification fails', async () => {
    const user = await registerAgent(testApp);
    await testApp.prisma.emailVerification.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const token = extractEmailToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(400);
  });

  it('29. email verification is one-time use', async () => {
    const user = await registerAgent(testApp);
    const token = extractEmailToken(testApp.mail.latestFor(user.email));

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(400);
  });

  it('30. resend rate limiting works', async () => {
    const user = await registerAgent(testApp);

    // points: 3 per 900s for auth:email-resend.
    for (let i = 0; i < 3; i += 1) {
      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/email/resend')
        .send({ email: user.email })
        .expect(204);
    }

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/resend')
      .send({ email: user.email })
      .expect(429);
  });

  it('resend never reveals whether the email is registered', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/email/resend')
      .send({ email: 'not-a-real-account@example.test' })
      .expect(204);
  });

  it('request-otp never reveals whether the phone is registered', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/phone/request-otp')
      .send({ phone: '+14155559999' })
      .expect(204);
  });
});
