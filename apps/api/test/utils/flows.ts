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

export interface VerifiedCompanyOwner extends RegisteredUser, LoggedInTokens {
  workspaceId: string;
  companyId: string;
}

/** Registers a company, verifies + logs in the owner, and resolves their workspace id. */
export async function registerVerifiedCompanyOwner(
  testApp: TestApp,
  companyName = 'Test Co',
): Promise<VerifiedCompanyOwner> {
  const user = await registerCompany(testApp, { companyName });
  await verifyEmailAndPhone(testApp, user);
  const tokens = await login(testApp, user);

  const membership = await testApp.prisma.workspaceMember.findFirstOrThrow({
    where: { userId: user.id, membershipType: 'OWNER' },
    include: { workspace: true },
  });

  return {
    ...user,
    ...tokens,
    workspaceId: membership.workspaceId,
    companyId: membership.workspace.companyId!,
  };
}

export interface EmployeeMember extends RegisteredUser, LoggedInTokens {
  membershipId: string;
}

/**
 * Registers+verifies a fresh agent, has the workspace owner invite them,
 * then has the new member log in and accept — the common setup for
 * membership/permission tests that need a second, non-owner member.
 */
export async function inviteAndActivateEmployee(
  testApp: TestApp,
  workspaceId: string,
  ownerAccessToken: string,
  options: { membershipType?: string; roleId?: string } = {},
): Promise<EmployeeMember> {
  const employee = await registerAgent(testApp);
  await verifyEmailAndPhone(testApp, employee);

  await request(testApp.app.getHttpServer())
    .post(`/api/v1/workspaces/${workspaceId}/invitations`)
    .set('Authorization', `Bearer ${ownerAccessToken}`)
    .send({
      email: employee.email,
      membershipType: options.membershipType ?? 'EMPLOYEE',
      ...(options.roleId ? { roleId: options.roleId } : {}),
    })
    .expect(201);

  const tokens = await login(testApp, employee);

  await request(testApp.app.getHttpServer())
    .post(`/api/v1/workspaces/${workspaceId}/invitations/accept`)
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .expect(204);

  const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
    where: { workspaceId_userId: { workspaceId, userId: employee.id } },
  });

  return { ...employee, ...tokens, membershipId: membership.id };
}

/** Grants a platform role directly (bypassing the bootstrap script) for test setup. */
export async function grantPlatformRole(
  testApp: TestApp,
  userId: string,
  roleKey: string,
): Promise<void> {
  const role = await testApp.prisma.role.findFirstOrThrow({
    where: { key: roleKey, scope: 'PLATFORM' },
  });
  await testApp.prisma.userPlatformRole.create({
    data: { userId, roleId: role.id },
  });
}

export function authHeader(accessToken: string): [string, string] {
  return ['Authorization', `Bearer ${accessToken}`];
}

/** Minimal valid property payload for tests — override any field. */
export function minimalPropertyPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    propertyType: 'APARTMENT',
    listingPurpose: 'SALE',
    title: 'Test Property',
    price: 100000,
    currency: 'USD',
    ...overrides,
  };
}

export interface CreatedProperty {
  id: string;
  [key: string]: unknown;
}

/** Creates a property via the real HTTP API and returns the created professional-detail response body. */
export async function createProperty(
  testApp: TestApp,
  workspaceId: string,
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedProperty> {
  const response = await request(testApp.app.getHttpServer())
    .post(`/api/v1/workspaces/${workspaceId}/properties`)
    .set(...authHeader(accessToken))
    .send(minimalPropertyPayload(overrides))
    .expect(201);
  return response.body as CreatedProperty;
}
