import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createAndApprovePublishedListing,
  createClient,
  createClientRequirement,
  createProperty,
  grantPlatformRole,
  login,
  minimalPropertyPayload,
  registerAgent,
  registerClient,
  registerCompany,
  registerVerifiedAgent,
  registerVerifiedAgentWithWorkspace,
  registerVerifiedCompanyOwner,
  savePublicationDraft,
  submitPublication,
  uploadPropertyImage,
  verifyEmailAndPhone,
  type RegisteredUser,
  type VerifiedAgentWithWorkspace,
} from './utils/flows';

const VERIFICATION_REQUIRED = 'AccountVerificationRequiredException';

/**
 * Unverified accounts (email and/or phone not yet confirmed) get
 * PUBLIC-ONLY access: they can sign in and browse/search/open public
 * marketplace listings, but every workspace-scoped endpoint — private
 * property inventory, property creation (private, public-bound, or
 * draft), media, publication drafts, dashboard, CRM clients, matching,
 * presentations, members, roles, the workspace list, invitation
 * acceptance — is rejected server-side by VerifiedAccountGuard (see
 * RequireWorkspacePermission / RequireVerifiedAccount), regardless of
 * workspace membership or anything the client sends.
 *
 * Workspace/company creation still happens at registration (see
 * AuthService.register) — the workspace simply isn't reachable until
 * the account is verified.
 */
describe('Account verification: public-only access for unverified accounts', () => {
  let testApp: TestApp;
  let owner: VerifiedAgentWithWorkspace;
  let publicationId: string;
  let privatePropertyId: string;
  const publicTitle = `PublicListing-${Date.now()}`;
  const privateTitle = `SecretPrivateInventory-${Date.now()}`;

  async function expectVerificationRequired(
    req: request.Test,
  ): Promise<request.Response> {
    const response = await req.expect(403);
    expect(response.body.error).toBe(VERIFICATION_REQUIRED);
    // `path` only echoes the URL the caller itself sent.
    const rest: Record<string, unknown> = { ...response.body };
    delete rest.path;
    expect(JSON.stringify(rest)).not.toContain(privateTitle);
    expect(JSON.stringify(rest)).not.toContain(privatePropertyId);
    return response;
  }

  async function registerUnverifiedAgent(): Promise<
    RegisteredUser & { accessToken: string; workspaceId: string }
  > {
    const user = await registerAgent(testApp);
    const tokens = await login(testApp, user);
    const workspace = await testApp.prisma.workspace.findFirstOrThrow({
      where: { personalOwnerUserId: user.id },
    });
    return {
      ...user,
      accessToken: tokens.accessToken,
      workspaceId: workspace.id,
    };
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    await resetRateLimits(testApp);

    const admin = await registerVerifiedAgent(testApp);
    await grantPlatformRole(testApp, admin.id, 'SUPER_ADMIN');

    owner = await registerVerifiedAgentWithWorkspace(testApp);
    ({ publicationId } = await createAndApprovePublishedListing(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      admin.accessToken,
      {},
      { publicTitle },
    ));

    const privateProperty = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      { title: privateTitle },
    );
    privatePropertyId = privateProperty.id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  describe('allowed for unverified accounts', () => {
    it('an unverified account can sign in with email/password, and /auth/me reports the real (unverified) state', async () => {
      const user = await registerAgent(testApp);
      const tokens = await login(testApp, user);

      const me = await request(testApp.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(...authHeader(tokens.accessToken))
        .expect(200);
      expect(me.body.accountStatus).toBe('PENDING_VERIFICATION');
      expect(me.body.emailVerifiedAt).toBeNull();
      expect(me.body.phoneVerifiedAt).toBeNull();
    });

    it('a wrong password is still rejected for an unverified account (email/password auth unchanged)', async () => {
      const user = await registerAgent(testApp);
      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'definitely-not-the-password' })
        .expect(401);
    });

    it.each([
      ['AGENT', () => registerAgent(testApp)],
      ['COMPANY', () => registerCompany(testApp)],
      ['CLIENT', () => registerClient(testApp)],
    ])(
      'an unverified %s can list public marketplace properties — and only public data comes back',
      async (_label, registerFn) => {
        const user = await registerFn();
        const tokens = await login(testApp, user);

        const response = await request(testApp.app.getHttpServer())
          .get('/api/v1/marketplace/properties?pageSize=100')
          .set(...authHeader(tokens.accessToken))
          .expect(200);

        const ids = (response.body.items as { publicationId: string }[]).map(
          (item) => item.publicationId,
        );
        expect(ids).toContain(publicationId);
        expect(JSON.stringify(response.body)).not.toContain(privateTitle);
        expect(JSON.stringify(response.body)).not.toContain(privatePropertyId);
      },
    );

    it('an unverified account can search/filter the public marketplace, which never matches private inventory', async () => {
      const user = await registerUnverifiedAgent();

      const publicHit = await request(testApp.app.getHttpServer())
        .get(
          `/api/v1/marketplace/properties?search=${publicTitle}&listingPurpose=SALE`,
        )
        .set(...authHeader(user.accessToken))
        .expect(200);
      expect(
        (publicHit.body.items as { publicationId: string }[]).map(
          (i) => i.publicationId,
        ),
      ).toContain(publicationId);

      const privateMiss = await request(testApp.app.getHttpServer())
        .get(`/api/v1/marketplace/properties?search=${privateTitle}`)
        .set(...authHeader(user.accessToken))
        .expect(200);
      expect(privateMiss.body.items).toHaveLength(0);
      expect(privateMiss.body.meta.totalItems).toBe(0);
    });

    it('an unverified account can open a public property detail', async () => {
      const user = await registerUnverifiedAgent();

      const response = await request(testApp.app.getHttpServer())
        .get(`/api/v1/marketplace/properties/${publicationId}`)
        .set(...authHeader(user.accessToken))
        .expect(200);
      expect(response.body.publicationId).toBe(publicationId);
      expect(JSON.stringify(response.body)).not.toContain(owner.workspaceId);
    });

    it('signing in and browsing never modifies the real verification state ("Verify Later" is client-side only)', async () => {
      const user = await registerUnverifiedAgent();
      await request(testApp.app.getHttpServer())
        .get('/api/v1/marketplace/properties')
        .set(...authHeader(user.accessToken))
        .expect(200);
      await login(testApp, user);

      const stored = await testApp.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.emailVerifiedAt).toBeNull();
      expect(stored.phoneVerifiedAt).toBeNull();
      expect(stored.accountStatus).toBe('PENDING_VERIFICATION');
    });

    it('workspace/company is still created at registration — it just is not reachable yet', async () => {
      const agent = await registerAgent(testApp);
      expect(
        await testApp.prisma.workspace.findFirst({
          where: { personalOwnerUserId: agent.id },
        }),
      ).not.toBeNull();

      const company = await registerCompany(testApp, {
        companyName: 'Unverified Co',
      });
      const membership = await testApp.prisma.workspaceMember.findFirst({
        where: { userId: company.id, membershipType: 'OWNER' },
        include: { workspace: true },
      });
      expect(membership?.workspace.type).toBe('COMPANY');
    });
  });

  describe('denied for unverified accounts (enforced by the API, not the UI)', () => {
    it('cannot list workspace properties — with or without search/filter params', async () => {
      const user = await registerUnverifiedAgent();
      const server = testApp.app.getHttpServer();

      await expectVerificationRequired(
        request(server)
          .get(`/api/v1/workspaces/${user.workspaceId}/properties`)
          .set(...authHeader(user.accessToken)),
      );
      await expectVerificationRequired(
        request(server)
          .get(
            `/api/v1/workspaces/${user.workspaceId}/properties?search=Secret&city=Beirut&priceMin=1&publicationFilter=UNPUBLISHED`,
          )
          .set(...authHeader(user.accessToken)),
      );
    });

    it('cannot retrieve a private property by id — even with an ACTIVE membership + permission in that workspace', async () => {
      const user = await registerUnverifiedAgent();
      // An ACTIVE membership with full permissions in the owner's
      // workspace (inserted directly — the API itself won't let an
      // unverified account accept an invitation). Verification is an
      // additional requirement on top of membership/RBAC, so this must
      // still be denied.
      const ownerRole = await testApp.prisma.role.findFirstOrThrow({
        where: {
          key: 'WORKSPACE_OWNER',
          scope: 'WORKSPACE',
          workspaceId: null,
        },
      });
      await testApp.prisma.workspaceMember.create({
        data: {
          workspaceId: owner.workspaceId,
          userId: user.id,
          membershipType: 'EMPLOYEE',
          status: 'ACTIVE',
          roleId: ownerRole.id,
          joinedAt: new Date(),
        },
      });

      await expectVerificationRequired(
        request(testApp.app.getHttpServer())
          .get(
            `/api/v1/workspaces/${owner.workspaceId}/properties/${privatePropertyId}`,
          )
          .set(...authHeader(user.accessToken)),
      );
      await expectVerificationRequired(
        request(testApp.app.getHttpServer())
          .get(`/api/v1/workspaces/${owner.workspaceId}/properties`)
          .set(...authHeader(user.accessToken)),
      );
    });

    it('gets the same 403 for a workspace it is not a member of (cannot probe which workspaces/properties exist)', async () => {
      const user = await registerUnverifiedAgent();
      await expectVerificationRequired(
        request(testApp.app.getHttpServer())
          .get(
            `/api/v1/workspaces/${owner.workspaceId}/properties/${privatePropertyId}`,
          )
          .set(...authHeader(user.accessToken)),
      );
    });

    it.each([
      ['a private property (default PRIVATE location visibility)', {}],
      [
        'a property intended to be public (PUBLIC_EXACT location)',
        {
          location: {
            latitude: 33.89,
            longitude: 35.5,
            city: 'Beirut',
            locationVisibility: 'PUBLIC_EXACT',
          },
        },
      ],
      [
        'a bare draft (title/price only) intended for later publication',
        { title: 'Draft' },
      ],
    ])('cannot create %s', async (_label, overrides) => {
      const user = await registerUnverifiedAgent();

      await expectVerificationRequired(
        request(testApp.app.getHttpServer())
          .post(`/api/v1/workspaces/${user.workspaceId}/properties`)
          .set(...authHeader(user.accessToken))
          .send(minimalPropertyPayload(overrides)),
      );

      expect(
        await testApp.prisma.property.count({
          where: { workspaceId: user.workspaceId },
        }),
      ).toBe(0);
    });

    it('cannot bypass the check with client-supplied verification flags, headers, or an invalid body', async () => {
      const user = await registerUnverifiedAgent();
      const server = testApp.app.getHttpServer();

      await expectVerificationRequired(
        request(server)
          .post(`/api/v1/workspaces/${user.workspaceId}/properties`)
          .set(...authHeader(user.accessToken))
          .set('X-Workspace-Id', user.workspaceId)
          .set('X-Verified', 'true')
          .send({
            ...minimalPropertyPayload(),
            emailVerifiedAt: new Date().toISOString(),
            phoneVerifiedAt: new Date().toISOString(),
            accountStatus: 'ACTIVE',
            verified: true,
          }),
      );
      // Rejected before validation runs — no field-level hints leak.
      await expectVerificationRequired(
        request(server)
          .post(`/api/v1/workspaces/${user.workspaceId}/properties`)
          .set(...authHeader(user.accessToken))
          .send({}),
      );

      const stored = await testApp.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.emailVerifiedAt).toBeNull();
      expect(stored.phoneVerifiedAt).toBeNull();
      expect(stored.accountStatus).toBe('PENDING_VERIFICATION');
    });

    it('half-verified (email only) is still unverified', async () => {
      const user = await registerUnverifiedAgent();
      await testApp.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });

      await expectVerificationRequired(
        request(testApp.app.getHttpServer())
          .post(`/api/v1/workspaces/${user.workspaceId}/properties`)
          .set(...authHeader(user.accessToken))
          .send(minimalPropertyPayload()),
      );
    });

    it('does not leak private data through dashboard, workspace list/detail, members, media, publication, clients, matching, or presentations', async () => {
      const user = await registerUnverifiedAgent();
      const server = testApp.app.getHttpServer();
      const ws = user.workspaceId;
      const auth = authHeader(user.accessToken);
      const fakeId = '00000000-0000-4000-8000-000000000000';

      const reads = [
        '/api/v1/workspaces',
        `/api/v1/workspaces/${ws}`,
        `/api/v1/workspaces/${ws}/dashboard`,
        `/api/v1/workspaces/${ws}/members`,
        `/api/v1/workspaces/${ws}/roles`,
        `/api/v1/workspaces/${ws}/properties/${fakeId}/publication`,
        `/api/v1/workspaces/${ws}/properties/${fakeId}/media/${fakeId}/access-url`,
        `/api/v1/workspaces/${ws}/clients`,
        `/api/v1/workspaces/${ws}/clients/${fakeId}/requirements`,
        `/api/v1/workspaces/${ws}/clients/${fakeId}/requirements/${fakeId}/matches`,
        `/api/v1/workspaces/${ws}/clients/${fakeId}/shortlist`,
        `/api/v1/workspaces/${ws}/presentations`,
        `/api/v1/workspaces/${owner.workspaceId}/dashboard`,
      ];
      for (const path of reads) {
        await expectVerificationRequired(
          request(server)
            .get(path)
            .set(...auth),
        );
      }

      const writes: [string, Record<string, unknown>][] = [
        [
          `/api/v1/workspaces/${ws}/clients`,
          { firstName: 'A', lastName: 'B', phone: '+96170000001' },
        ],
        [`/api/v1/workspaces/${ws}/presentations`, { title: 'x', items: [] }],
        [
          `/api/v1/workspaces/${ws}/invitations`,
          { email: 'someone@example.com' },
        ],
        [`/api/v1/workspaces/${ws}/properties/${fakeId}/archive`, {}],
      ];
      for (const [path, body] of writes) {
        await expectVerificationRequired(
          request(server)
            .post(path)
            .set(...auth)
            .send(body),
        );
      }
      await expectVerificationRequired(
        request(server)
          .patch(`/api/v1/workspaces/${ws}/properties/${fakeId}`)
          .set(...auth)
          .send({ title: 'x' }),
      );
      await expectVerificationRequired(
        request(server)
          .put(`/api/v1/workspaces/${ws}/properties/${fakeId}/publication`)
          .set(...auth)
          .send({}),
      );
    });

    it('cannot accept a workspace invitation until verified (invitations are addressed by an email it has not proven it owns)', async () => {
      const company = await registerVerifiedCompanyOwner(
        testApp,
        'Inviting Co',
      );
      const invitee = await registerAgent(testApp);
      await request(testApp.app.getHttpServer())
        .post(`/api/v1/workspaces/${company.workspaceId}/invitations`)
        .set(...authHeader(company.accessToken))
        .send({ email: invitee.email, membershipType: 'EMPLOYEE' })
        .expect(201);
      const tokens = await login(testApp, invitee);

      await expectVerificationRequired(
        request(testApp.app.getHttpServer())
          .post(`/api/v1/workspaces/${company.workspaceId}/invitations/accept`)
          .set(...authHeader(tokens.accessToken)),
      );
      const membership = await testApp.prisma.workspaceMember.findUniqueOrThrow(
        {
          where: {
            workspaceId_userId: {
              workspaceId: company.workspaceId,
              userId: invitee.id,
            },
          },
        },
      );
      expect(membership.status).toBe('INVITED');

      await verifyEmailAndPhone(testApp, invitee);
      await request(testApp.app.getHttpServer())
        .post(`/api/v1/workspaces/${company.workspaceId}/invitations/accept`)
        .set(...authHeader(tokens.accessToken))
        .expect(204);
    });
  });

  describe('after verification', () => {
    it('completing verification restores workspace/property functionality on the SAME access token', async () => {
      const user = await registerUnverifiedAgent();
      const server = testApp.app.getHttpServer();

      await expectVerificationRequired(
        request(server)
          .post(`/api/v1/workspaces/${user.workspaceId}/properties`)
          .set(...authHeader(user.accessToken))
          .send(minimalPropertyPayload()),
      );

      await verifyEmailAndPhone(testApp, user);
      const stored = await testApp.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.accountStatus).toBe('ACTIVE');

      const workspaces = await request(server)
        .get('/api/v1/workspaces')
        .set(...authHeader(user.accessToken))
        .expect(200);
      const workspaceIds = (workspaces.body as { id: string }[]).map(
        (w) => w.id,
      );
      expect(workspaceIds).toContain(user.workspaceId);

      const property = await createProperty(
        testApp,
        user.workspaceId,
        user.accessToken,
      );
      await request(server)
        .get(`/api/v1/workspaces/${user.workspaceId}/properties/${property.id}`)
        .set(...authHeader(user.accessToken))
        .expect(200);
      await request(server)
        .get(`/api/v1/workspaces/${user.workspaceId}/dashboard`)
        .set(...authHeader(user.accessToken))
        .expect(200);

      const media = await uploadPropertyImage(
        testApp,
        user.workspaceId,
        property.id,
        user.accessToken,
      );
      await savePublicationDraft(
        testApp,
        user.workspaceId,
        property.id,
        user.accessToken,
        [media.id],
      );
      await submitPublication(
        testApp,
        user.workspaceId,
        property.id,
        user.accessToken,
      );

      const client = await createClient(
        testApp,
        user.workspaceId,
        user.accessToken,
      );
      await createClientRequirement(
        testApp,
        user.workspaceId,
        client.id,
        user.accessToken,
      );
    });

    it('verification never replaces RBAC: a verified non-member still cannot read another workspace', async () => {
      const outsider = await registerVerifiedAgent(testApp);

      const response = await request(testApp.app.getHttpServer())
        .get(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${privatePropertyId}`,
        )
        .set(...authHeader(outsider.accessToken))
        .expect(403);
      expect(response.body.error).not.toBe(VERIFICATION_REQUIRED);
      expect(JSON.stringify(response.body)).not.toContain(privateTitle);
    });

    it('the verified workspace owner keeps full access to their own private inventory', async () => {
      const response = await request(testApp.app.getHttpServer())
        .get(
          `/api/v1/workspaces/${owner.workspaceId}/properties/${privatePropertyId}`,
        )
        .set(...authHeader(owner.accessToken))
        .expect(200);
      expect(response.body.title).toBe(privateTitle);
    });
  });

  describe('verification endpoint edge cases', () => {
    it('an invalid (never-issued) email verification token is rejected', async () => {
      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/email/verify')
        .send({ token: 'this-token-was-never-issued' })
        .expect(400);
    });

    it('phone OTP resend (request-otp) is rate limited, same as email resend', async () => {
      const user = await registerAgent(testApp);

      // points: 3 per 900s for auth:otp-request.
      for (let i = 0; i < 3; i += 1) {
        await request(testApp.app.getHttpServer())
          .post('/api/v1/auth/phone/request-otp')
          .send({ phone: user.phone })
          .expect(204);
      }

      await request(testApp.app.getHttpServer())
        .post('/api/v1/auth/phone/request-otp')
        .send({ phone: user.phone })
        .expect(429);
    });
  });
});
