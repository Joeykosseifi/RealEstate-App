import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import { login, registerVerifiedAgent } from './utils/flows';

describe('Auth — tokens & sessions', () => {
  let testApp: TestApp;
  let jwtService: JwtService;

  beforeAll(async () => {
    testApp = await createTestApp();
    jwtService = testApp.app.get(JwtService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('13. access token authenticates protected endpoint', async () => {
    const user = await registerVerifiedAgent(testApp);

    const res = await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(user.id);
  });

  it('14. invalid access token fails', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('15. expired access token fails', async () => {
    const user = await registerVerifiedAgent(testApp);
    const expiredToken = jwtService.sign(
      { sub: user.id, sid: randomUUID() },
      { expiresIn: '-10s' },
    );

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('16 & 17. refresh token works and rotates', async () => {
    const user = await registerVerifiedAgent(testApp);

    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(user.refreshToken);
  });

  it('18. old refresh token cannot normally be reused', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('19 & 20. logout revokes the session, and a revoked session cannot refresh', async () => {
    const user = await registerVerifiedAgent(testApp);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it("21. one user's session cannot authenticate as another user", async () => {
    const userA = await registerVerifiedAgent(testApp);
    const userB = await registerVerifiedAgent(testApp);

    // An attacker who knows userB's id but not the server's signing
    // secret cannot forge a token that authenticates as userB.
    const forged = jwtService.sign(
      { sub: userB.id, sid: randomUUID() },
      { secret: 'a-completely-wrong-secret', expiresIn: '15m' },
    );

    await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);

    // And userA's own valid token only ever resolves to userA.
    const res = await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    expect(res.body.id).toBe(userA.id);
  });

  it('guessing a session id in a refresh token does not bypass authorization', async () => {
    const guessedToken = `${randomUUID()}.${'a'.repeat(43)}`;

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: guessedToken })
      .expect(401);
  });

  it('login for a fresh account works and issues a working session end to end', async () => {
    const user = await registerVerifiedAgent(testApp);
    const tokens = await login(testApp, user);

    const res = await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
    expect(res.body.id).toBe(user.id);
  });
});
