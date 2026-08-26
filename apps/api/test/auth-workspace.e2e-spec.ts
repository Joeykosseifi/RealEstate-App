import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  registerAgent,
  registerCompany,
  registerClient,
  verifyEmailAndPhone,
} from './utils/flows';
import { AccountActivationService } from '../src/auth/account-activation.service';

describe('Auth — agent/client/company workspace creation on activation', () => {
  let testApp: TestApp;
  let activation: AccountActivationService;

  beforeAll(async () => {
    testApp = await createTestApp();
    activation = testApp.app.get(AccountActivationService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('36, 37 & 39. agent activation creates exactly one PERSONAL workspace, agent is OWNER, no companyId', async () => {
    const user = await registerAgent(testApp);
    await verifyEmailAndPhone(testApp, user);

    const workspaces = await testApp.prisma.workspace.findMany({
      where: { personalOwnerUserId: user.id },
    });
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].type).toBe('PERSONAL');
    expect(workspaces[0].companyId).toBeNull();

    const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId: workspaces[0].id, userId: user.id },
      },
    });
    expect(membership.membershipType).toBe('OWNER');
    expect(membership.status).toBe('ACTIVE');

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.accountStatus).toBe('ACTIVE');
  });

  it('38. retrying activation does not create another personal workspace', async () => {
    const user = await registerAgent(testApp);
    await verifyEmailAndPhone(testApp, user);

    // Simulate a retried/duplicate activation trigger.
    await activation.activateIfVerified(user.id);
    await activation.activateIfVerified(user.id);

    const workspaces = await testApp.prisma.workspace.findMany({
      where: { personalOwnerUserId: user.id },
    });
    expect(workspaces).toHaveLength(1);

    const memberships = await testApp.prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(1);
  });

  it('40. client activation creates no professional workspace', async () => {
    const user = await registerClient(testApp);
    await verifyEmailAndPhone(testApp, user);

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.accountStatus).toBe('ACTIVE');

    const workspaces = await testApp.prisma.workspace.findMany({
      where: { personalOwnerUserId: user.id },
    });
    expect(workspaces).toHaveLength(0);

    const memberships = await testApp.prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(0);
  });

  it('41, 42, 43 & 44. company activation creates Company + COMPANY workspace + OWNER membership, correctly linked', async () => {
    const user = await registerCompany(testApp, {
      companyName: 'Blue Sky Realty',
    });
    await verifyEmailAndPhone(testApp, user);

    const company = await testApp.prisma.company.findFirstOrThrow({
      where: { createdByUserId: user.id },
    });
    expect(company.name).toBe('Blue Sky Realty');

    const workspace = await testApp.prisma.workspace.findUniqueOrThrow({
      where: { companyId: company.id },
    });
    expect(workspace.type).toBe('COMPANY');
    expect(workspace.companyId).toBe(company.id);

    const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
    });
    expect(membership.membershipType).toBe('OWNER');

    const stored = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.pendingCompanyProfile).toBeNull();
  });

  it('45. retrying company activation does not create duplicate company/workspace/membership state', async () => {
    const user = await registerCompany(testApp, {
      companyName: 'Green Fields Realty',
    });
    await verifyEmailAndPhone(testApp, user);

    await activation.activateIfVerified(user.id);
    await activation.activateIfVerified(user.id);

    const companies = await testApp.prisma.company.findMany({
      where: { createdByUserId: user.id },
    });
    expect(companies).toHaveLength(1);

    const workspaces = await testApp.prisma.workspace.findMany({
      where: { companyId: companies[0].id },
    });
    expect(workspaces).toHaveLength(1);

    const memberships = await testApp.prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(1);
  });

  it('concurrency: two simultaneous agent activations create exactly one workspace + one membership', async () => {
    const user = await registerAgent(testApp);

    // Mark both channels verified directly (isolates the race from the
    // one-time-use token flow) then fire concurrent activation attempts —
    // this is exactly the race the row lock in AccountActivationService
    // is designed to serialize.
    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), phoneVerifiedAt: new Date() },
    });

    await Promise.all([
      activation.activateIfVerified(user.id),
      activation.activateIfVerified(user.id),
      activation.activateIfVerified(user.id),
    ]);

    const workspaces = await testApp.prisma.workspace.findMany({
      where: { personalOwnerUserId: user.id },
    });
    expect(workspaces).toHaveLength(1);

    const memberships = await testApp.prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(1);
  });

  it('concurrency: two simultaneous company activations create exactly one company/workspace/membership', async () => {
    const user = await registerCompany(testApp, {
      companyName: 'Concurrent Realty',
    });

    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), phoneVerifiedAt: new Date() },
    });

    await Promise.all([
      activation.activateIfVerified(user.id),
      activation.activateIfVerified(user.id),
      activation.activateIfVerified(user.id),
    ]);

    const companies = await testApp.prisma.company.findMany({
      where: { createdByUserId: user.id },
    });
    expect(companies).toHaveLength(1);

    const workspaces = await testApp.prisma.workspace.findMany({
      where: { companyId: companies[0].id },
    });
    expect(workspaces).toHaveLength(1);

    const memberships = await testApp.prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(1);
  });

  it('freelance agent leaving a company (no membership) retains personal-workspace ownership', async () => {
    // Milestone 1 doesn't implement collaboration yet, but the ownership
    // model must already hold: a personal workspace's ownership is a
    // property of the workspace itself, not of any company membership
    // that does or doesn't exist alongside it.
    const user = await registerAgent(testApp);
    await verifyEmailAndPhone(testApp, user);

    const workspace = await testApp.prisma.workspace.findUniqueOrThrow({
      where: { personalOwnerUserId: user.id },
    });
    expect(workspace.personalOwnerUserId).toBe(user.id);
    expect(workspace.companyId).toBeNull();
  });
});
