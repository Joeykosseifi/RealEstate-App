import request from 'supertest';
import {
  createTestApp,
  resetRateLimits,
  uniqueEmail,
  uniquePhone,
  type TestApp,
} from './utils/test-app';

describe('Auth — registration', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  const baseBody = () => ({
    firstName: 'Test',
    lastName: 'User',
    email: uniqueEmail(),
    phone: uniquePhone(),
    password: 'correct-horse-battery-staple',
    acceptedTerms: true,
  });

  it('1. client can register', async () => {
    const body = baseBody();
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(body)
      .expect(201);

    expect(res.body.accountType).toBe('CLIENT');
    expect(res.body.accountStatus).toBe('PENDING_VERIFICATION');
    expect(res.body.email).toBe(body.email.toLowerCase());
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('2. agent can register', async () => {
    const body = baseBody();
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/agent')
      .send(body)
      .expect(201);

    expect(res.body.accountType).toBe('AGENT');
  });

  it('3. company can register', async () => {
    const body = { ...baseBody(), companyName: 'Acme Realty LLC' };
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/company')
      .send(body)
      .expect(201);

    expect(res.body.accountType).toBe('COMPANY');
  });

  it('4. duplicate email is rejected', async () => {
    const body = baseBody();
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(body)
      .expect(201);

    const dupe = { ...body, phone: uniquePhone() };
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(dupe)
      .expect(409);

    expect(res.body.message).toMatch(/email/i);
  });

  it('5. duplicate phone is rejected', async () => {
    const body = baseBody();
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(body)
      .expect(201);

    const dupe = { ...body, email: uniqueEmail() };
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(dupe)
      .expect(409);

    expect(res.body.message).toMatch(/phone/i);
  });

  it('6. email normalization prevents duplicate case variants', async () => {
    const raw = `Mixed.Case.${Date.now()}@Example.TEST`;
    const body = { ...baseBody(), email: raw };
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(body)
      .expect(201);

    expect(res.body.email).toBe(raw.toLowerCase());

    const dupe = { ...body, email: raw.toUpperCase(), phone: uniquePhone() };
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(dupe)
      .expect(409);
  });

  it('7. password is never stored plaintext', async () => {
    const body = baseBody();
    const res = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send(body)
      .expect(201);

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(stored.passwordHash).not.toBe(body.password);
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('rejects malformed input (invalid email, short password, unaccepted terms)', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send({ ...baseBody(), email: 'not-an-email' })
      .expect(400);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send({ ...baseBody(), password: 'short' })
      .expect(400);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send({ ...baseBody(), acceptedTerms: false })
      .expect(400);
  });

  it('rejects unknown fields (DTO allowlisting)', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register/client')
      .send({ ...baseBody(), accountStatus: 'ACTIVE', isAdmin: true })
      .expect(400);
  });
});
