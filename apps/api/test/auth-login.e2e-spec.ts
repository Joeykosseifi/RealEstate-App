import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import { registerVerifiedAgent } from './utils/flows';

describe('Auth — login', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('8. correct credentials authenticate', async () => {
    const user = await registerVerifiedAgent(testApp);

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.tokens.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(user.email);
  });

  it('9. incorrect password fails securely', async () => {
    const user = await registerVerifiedAgent(testApp);

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password-entirely' })
      .expect(401);

    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('10. unknown email fails without inappropriate account enumeration', async () => {
    const user = await registerVerifiedAgent(testApp);

    const wrongPasswordRes = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password-entirely' })
      .expect(401);

    const unknownEmailRes = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'definitely-not-registered@example.test',
        password: 'whatever-password',
      })
      .expect(401);

    // Same status and same message for both — no signal about which case occurred.
    expect(unknownEmailRes.body.message).toBe(wrongPasswordRes.body.message);
  });

  it('11. suspended user cannot authenticate', async () => {
    const user = await registerVerifiedAgent(testApp);
    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: 'SUSPENDED' },
    });

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('12. deactivated user cannot authenticate', async () => {
    const user = await registerVerifiedAgent(testApp);
    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: 'DEACTIVATED' },
    });

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    expect(res.body.message).toBe('Invalid email or password.');
  });
});
