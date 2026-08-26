import request from 'supertest';
import {
  extractEmailToken,
  extractOtp,
  uniqueEmail,
  uniquePhone,
  type TestApp,
} from './test-app';

export interface RegisteredUser {
  id: string;
  email: string;
  phone: string;
  password: string;
}

const DEFAULT_PASSWORD = 'correct-horse-battery-staple';

async function register(
  testApp: TestApp,
  path: 'client' | 'agent' | 'company',
  extra: Record<string, unknown> = {},
): Promise<RegisteredUser> {
  const email = uniqueEmail(path);
  const phone = uniquePhone();
  const password = DEFAULT_PASSWORD;

  const response = await request(testApp.app.getHttpServer())
    .post(`/api/v1/auth/register/${path}`)
    .send({
      firstName: 'Test',
      lastName: 'User',
      email,
      phone,
      password,
      acceptedTerms: true,
      ...extra,
    })
    .expect(201);

  return { id: response.body.id as string, email, phone, password };
}

export const registerClient = (
  testApp: TestApp,
  extra?: Record<string, unknown>,
) => register(testApp, 'client', extra);

export const registerAgent = (
  testApp: TestApp,
  extra?: Record<string, unknown>,
) => register(testApp, 'agent', extra);

export const registerCompany = (
  testApp: TestApp,
  extra?: Record<string, unknown>,
) => register(testApp, 'company', { companyName: 'Test Co', ...extra });

/** Completes email + phone verification for a just-registered user, driving it to ACTIVE. */
export async function verifyEmailAndPhone(
  testApp: TestApp,
  user: RegisteredUser,
): Promise<void> {
  const emailToken = extractEmailToken(testApp.mail.latestFor(user.email));
  await request(testApp.app.getHttpServer())
    .post('/api/v1/auth/email/verify')
    .send({ token: emailToken })
    .expect(204);

  const otp = extractOtp(testApp.sms.latestFor(user.phone));
  await request(testApp.app.getHttpServer())
    .post('/api/v1/auth/phone/verify')
    .send({ phone: user.phone, otp })
    .expect(204);
}

export interface LoggedInTokens {
  accessToken: string;
  refreshToken: string;
}

export async function login(
  testApp: TestApp,
  user: RegisteredUser,
): Promise<LoggedInTokens> {
  const response = await request(testApp.app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);

  return response.body.tokens as LoggedInTokens;
}

/** Registers, verifies, and logs an agent in — the common setup for workspace/session tests. */
export async function registerVerifiedAgent(
  testApp: TestApp,
): Promise<RegisteredUser & LoggedInTokens> {
  const user = await registerAgent(testApp);
  await verifyEmailAndPhone(testApp, user);
  const tokens = await login(testApp, user);
  return { ...user, ...tokens };
}
