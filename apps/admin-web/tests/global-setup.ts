import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Seeds every fixture the 16 admin-web regression scenarios need,
 * through the SAME real HTTP registration/verification/publication
 * flow a real professional and a real platform admin would use — never
 * mocked. The two deliberate exceptions (documented inline below) are
 * granting the SUPER_ADMIN platform role and bulk-seeding extra
 * pagination filler rows, both done via Prisma directly because no HTTP
 * endpoint is meant to exist for either (see
 * `apps/api/scripts/bootstrap-super-admin.ts`, "there is no HTTP
 * endpoint that can do this, by design").
 *
 * Writes `tests/.fixtures.json`, which every spec file reads.
 */
const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3000') + '/api/v1';
const API_LOG_FILE = process.env.API_LOG_FILE;
// `playwright test` (invoked by run-admin-web-tests.mjs) always runs
// with cwd = apps/admin-web, so this is stable regardless of whether
// Playwright loads this file as CJS or ESM (import.meta.url/__dirname
// are not both guaranteed to exist across its internal transform modes).
const FIXTURES_PATH = join(process.cwd(), 'tests', '.fixtures.json');

const prisma = new PrismaClient();

function readLog(): string {
  if (!API_LOG_FILE || !existsSync(API_LOG_FILE)) {
    throw new Error(
      `API_LOG_FILE (${API_LOG_FILE}) not found — global-setup must run via ` +
        "`npm run test:admin-web`, which captures the API dev server's console " +
        'mail/SMS output that this script reads verification tokens/OTPs from.',
    );
  }
  return readFileSync(API_LOG_FILE, 'utf8');
}

/** Polls the (growing) API log file for a value, since the dev server writes asynchronously. */
async function pollLog<T>(extract: (log: string) => T | null, timeoutMs = 30_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = extract(readLog());
    if (value !== null) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Timed out waiting for expected log content from the API dev server.');
}

function extractEmailToken(log: string, email: string): string | null {
  const marker = `to=${email} subject=`;
  const idx = log.lastIndexOf(marker);
  if (idx === -1) return null;
  const window = log.slice(idx, idx + 500);
  const match = /token is: (\S+)/.exec(window);
  return match ? match[1] : null;
}

function extractOtp(log: string, phone: string): string | null {
  const marker = `to=${phone} body="`;
  const idx = log.lastIndexOf(marker);
  if (idx === -1) return null;
  const window = log.slice(idx, idx + 300);
  const match = /code is (\d{6})/.exec(window);
  return match ? match[1] : null;
}

interface Session {
  id: string;
  email: string;
  phone: string;
  accessToken: string;
}

let counter = 0;
function unique(prefix: string): { email: string; phone: string } {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  // Same +1415 (San Francisco) NANP pattern as apps/api/test/utils/test-app.ts's
  // uniquePhone() — a real, libphonenumber-js-valid area code, unlike 555.
  const local = 2_000_000 + (Number(stamp.slice(-7)) % 7_999_999);
  return {
    email: `admin-web-e2e-${stamp}-${prefix}@example.test`,
    phone: `+1415${local}`,
  };
}

async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const body = (await res.json().catch(() => undefined)) as T;
  return { status: res.status, body };
}

async function registerVerifiedAgent(): Promise<Session> {
  const { email, phone } = unique('agent');
  const password = 'correct-horse-battery-staple';
  const registered = await api<{ id: string }>('/auth/register/agent', {
    method: 'POST',
    body: {
      firstName: 'E2E',
      lastName: 'Admin Web',
      email,
      phone,
      password,
      acceptedTerms: true,
    },
  });
  if (registered.status !== 201) {
    throw new Error(
      `Registration failed (${registered.status}): ${JSON.stringify(registered.body)}`,
    );
  }

  const token = await pollLog((log) => extractEmailToken(log, email));
  const verifyEmail = await api('/auth/email/verify', { method: 'POST', body: { token } });
  if (verifyEmail.status !== 204) {
    throw new Error(`Email verification failed: ${JSON.stringify(verifyEmail.body)}`);
  }

  const otp = await pollLog((log) => extractOtp(log, phone));
  const verifyPhone = await api('/auth/phone/verify', {
    method: 'POST',
    body: { phone, otp },
  });
  if (verifyPhone.status !== 204) {
    throw new Error(`Phone verification failed: ${JSON.stringify(verifyPhone.body)}`);
  }

  const login = await api<{ tokens: { accessToken: string } }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (login.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  }

  return { id: registered.body.id, email, phone, accessToken: login.body.tokens.accessToken };
}

async function createProperty(workspaceId: string, token: string, title: string) {
  const res = await api<{ id: string }>(`/workspaces/${workspaceId}/properties`, {
    method: 'POST',
    token,
    body: {
      propertyType: 'APARTMENT',
      listingPurpose: 'SALE',
      title,
      price: 200000,
      currency: 'USD',
    },
  });
  if (res.status !== 201) throw new Error(`createProperty failed: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

async function uploadImage(
  workspaceId: string,
  propertyId: string,
  token: string,
): Promise<string> {
  const form = new FormData();
  form.append('mediaType', 'IMAGE');
  form.append(
    'file',
    new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
    'photo.jpg',
  );
  const res = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/properties/${propertyId}/media`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  );
  const body = (await res.json()) as { id: string };
  if (res.status !== 201) throw new Error(`uploadImage failed: ${JSON.stringify(body)}`);
  return body.id;
}

async function saveDraftAndSubmit(
  workspaceId: string,
  propertyId: string,
  token: string,
  mediaId: string,
  publicTitle: string,
) {
  const draft = await api(`/workspaces/${workspaceId}/properties/${propertyId}/publication`, {
    method: 'PUT',
    token,
    body: {
      publicTitle,
      publicPrice: 200000,
      currency: 'USD',
      propertyType: 'APARTMENT',
      listingPurpose: 'SALE',
      publicCity: 'Beirut',
      locationVisibility: 'PUBLIC_APPROXIMATE',
      media: [{ propertyMediaId: mediaId, isMain: true }],
    },
  });
  if (draft.status !== 200) throw new Error(`saveDraft failed: ${JSON.stringify(draft.body)}`);

  const submit = await api(
    `/workspaces/${workspaceId}/properties/${propertyId}/publication/submit`,
    { method: 'POST', token },
  );
  if (submit.status !== 200) throw new Error(`submit failed: ${JSON.stringify(submit.body)}`);
}

async function createPendingPublication(
  workspaceId: string,
  token: string,
  title: string,
): Promise<{ propertyId: string; publicationId: string }> {
  const propertyId = await createProperty(workspaceId, token, title);
  const mediaId = await uploadImage(workspaceId, propertyId, token);
  await saveDraftAndSubmit(workspaceId, propertyId, token, mediaId, title);
  const publication = await prisma.propertyPublication.findUniqueOrThrow({
    where: { propertyId },
  });
  return { propertyId, publicationId: publication.id };
}

/**
 * Deletes every user/workspace/property/publication this suite has ever
 * created (recognizable by the fixed email pattern below), so each run
 * starts from a clean slate — repeated runs must never accumulate stale
 * PENDING_REVIEW rows that would otherwise silently push this run's own
 * named fixtures off the queue's first page. Workspaces are deleted
 * first (cascades to Property → PropertyPublication → Version → Media);
 * users are deleted after (cascades UserPlatformRole/verifications).
 */
async function cleanPriorRuns(): Promise<void> {
  const priorUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'admin-web-e2e-' } },
    select: { id: true },
  });
  const userIds = priorUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.workspace.deleteMany({
      where: { personalOwnerUserId: { in: userIds } },
    });
    await prisma.marketplaceFavorite.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // This dev database also accumulates PENDING_REVIEW/PUBLISHED/etc. rows
  // from unrelated manual smoke-testing across sessions — the admin
  // queue's default sort (submittedAt ascending, see
  // AdminPublicationsService.findMany) means old leftover rows would
  // otherwise permanently occupy page 1 ahead of this run's own named
  // fixtures, no matter how recently those were created. Publications
  // are disposable, re-derivable test fixtures in this environment (the
  // underlying Property/Workspace/User rows for OTHER tests, e.g.
  // Milestone 4 CRM data, are left untouched — only the publication
  // layer is reset), so a full reset here is what makes this suite
  // deterministic regardless of what earlier sessions left behind.
  await prisma.propertyPublication.deleteMany({});
}

async function globalSetup(): Promise<void> {
  await cleanPriorRuns();

  // --- Two accounts, both created through the real signup flow. ---
  const admin = await registerVerifiedAgent();
  const professional = await registerVerifiedAgent();

  // Granting SUPER_ADMIN has no HTTP endpoint by design — see the file
  // header comment. This mirrors apps/api/scripts/bootstrap-super-admin.ts.
  const role = await prisma.role.findFirstOrThrow({
    where: { key: 'SUPER_ADMIN', scope: 'PLATFORM' },
  });
  await prisma.userPlatformRole.create({
    data: { userId: admin.id, roleId: role.id },
  });
  const adminSession = await api<{ tokens: { accessToken: string } }>('/auth/login', {
    method: 'POST',
    body: { email: admin.email, password: 'correct-horse-battery-staple' },
  });
  const adminToken = adminSession.body.tokens.accessToken;

  const workspace = await prisma.workspace.findFirstOrThrow({
    where: { personalOwnerUserId: professional.id },
  });
  const workspaceId = workspace.id;

  // --- Scenarios 7-11: three independent PENDING_REVIEW submissions. ---
  const approve = await createPendingPublication(
    workspaceId,
    professional.accessToken,
    'Approve Me Apartment',
  );
  const reject = await createPendingPublication(
    workspaceId,
    professional.accessToken,
    'Reject Me Apartment',
  );
  const changes = await createPendingPublication(
    workspaceId,
    professional.accessToken,
    'Changes Me Apartment',
  );

  // --- Scenario 16: a PENDING_REVIEW submission whose property carries
  // a distinctive PropertyOwner marker that must never reach the admin
  // moderation snapshot (structurally impossible per publication.mapper.ts
  // / admin-publications.service.ts, which never join PropertyOwner at
  // all — this test proves that holds at the HTTP response level too).
  const leak = await createPendingPublication(
    workspaceId,
    professional.accessToken,
    'Leak Check Apartment',
  );
  const OWNER_SECRET_MARKER = 'DO-NOT-LEAK-OWNER-CONTACT-9f31c2';
  await prisma.propertyOwner.create({
    data: {
      propertyId: leak.propertyId,
      fullName: OWNER_SECRET_MARKER,
      phone: '+96170000999',
      email: 'owner-secret@example.test',
    },
  });

  // --- Scenarios 12-13: a PUBLISHED listing, eligible for unpublish. ---
  const forUnpublish = await createPendingPublication(
    workspaceId,
    professional.accessToken,
    'Unpublish Me Apartment',
  );
  const approveUnpublishTarget = await api(
    `/admin/property-publications/${forUnpublish.publicationId}/approve`,
    { method: 'POST', token: adminToken },
  );
  if (approveUnpublishTarget.status !== 200) {
    throw new Error(
      `Could not approve unpublish-target fixture: ${JSON.stringify(approveUnpublishTarget.body)}`,
    );
  }

  // --- Scenario 14: an ADMIN_UNPUBLISHED listing, eligible for restore. ---
  const forRestore = await createPendingPublication(
    workspaceId,
    professional.accessToken,
    'Restore Me Apartment',
  );
  await api(`/admin/property-publications/${forRestore.publicationId}/approve`, {
    method: 'POST',
    token: adminToken,
  });
  await api(`/admin/property-publications/${forRestore.publicationId}/unpublish`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Fixture setup: taking down before restore test.' },
  });

  // --- Scenario 4 (pagination): bulk-seed enough extra PENDING_REVIEW
  // rows to push the default queue past one page (pageSize=20). Done
  // directly via Prisma — this is pure query-volume filler, not a
  // workflow the HTTP flow needs to re-prove 20+ times. Left untouched
  // by every other scenario, so this count stays >20 for the whole run
  // regardless of test order.
  for (let i = 0; i < 25; i += 1) {
    const property = await prisma.property.create({
      data: {
        workspaceId,
        createdByUserId: professional.id,
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        title: `Pagination Filler ${i}`,
        price: 100000,
        currency: 'USD',
      },
    });
    const publication = await prisma.propertyPublication.create({
      data: { propertyId: property.id, workspaceId, status: 'PENDING_REVIEW' },
    });
    const version = await prisma.propertyPublicationVersion.create({
      data: {
        publicationId: publication.id,
        versionNumber: 1,
        status: 'PENDING_REVIEW',
        publicTitle: `Pagination Filler ${i}`,
        publicPrice: 100000,
        currency: 'USD',
        propertyType: 'APARTMENT',
        listingPurpose: 'SALE',
        locationVisibility: 'PRIVATE',
        submittedByUserId: professional.id,
        submittedAt: new Date(),
      },
    });
    await prisma.propertyPublication.update({
      where: { id: publication.id },
      data: {
        latestVersionId: version.id,
        submittedByUserId: professional.id,
        submittedAt: new Date(),
      },
    });
  }

  // Every spec except 01-auth (which deliberately exercises the real
  // login form and an unauthenticated state) reuses this pre-authenticated
  // storage state instead of logging in again through the UI. The login
  // endpoint is real-rate-limited (10 requests / 15 min per IP — see
  // apps/api/src/auth/auth.controller.ts) exactly like production; a
  // fresh UI login per test would exhaust that budget partway through a
  // 16-test run, which is a test-suite-shape problem, not a reason to
  // weaken the limiter itself.
  writeFileSync(
    join(process.cwd(), 'tests', '.storage-state.json'),
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3001',
          localStorage: [{ name: 'realestate.admin.accessToken', value: adminToken }],
        },
      ],
    }),
  );

  writeFileSync(
    FIXTURES_PATH,
    JSON.stringify(
      {
        adminEmail: admin.email,
        adminPassword: 'correct-horse-battery-staple',
        pendingApprovePublicationId: approve.publicationId,
        pendingRejectPublicationId: reject.publicationId,
        pendingChangesPublicationId: changes.publicationId,
        pendingLeakPublicationId: leak.publicationId,
        ownerSecretMarker: OWNER_SECRET_MARKER,
        publishedForUnpublishId: forUnpublish.publicationId,
        adminUnpublishedForRestoreId: forRestore.publicationId,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

export default globalSetup;
