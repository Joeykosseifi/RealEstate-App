import request from 'supertest';
import { createTestApp, resetRateLimits, type TestApp } from './utils/test-app';
import {
  authHeader,
  createClient,
  createPresentation,
  createProperty,
  inviteAndActivateEmployee,
  registerVerifiedCompanyOwner,
} from './utils/flows';

/**
 * pdfkit shows text via `TJ`/`Tj` operators whose operands are
 * hex-encoded byte strings (`<...>`), split into multiple runs
 * wherever kerning adjustments occur — a raw substring search against
 * the PDF bytes would miss text that's actually present (and, more
 * importantly, could give a false sense of security: a substring check
 * that never finds ANY text, sensitive or not, proves nothing). This
 * decodes every hex-string run in the file, in order, into one text
 * blob — safe because every character used in these tests (letters,
 * digits, `@`, `.`, `+`) maps 1:1 between WinAnsiEncoding and ASCII/
 * Latin-1, and concatenating hex-run bytes in document order
 * reconstructs each original string exactly, kerning gaps and all.
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const hexRunPattern = /<([0-9A-Fa-f\s]+)>/g;
  let text = '';
  let match: RegExpExecArray | null;
  while ((match = hexRunPattern.exec(raw)) !== null) {
    const hex = match[1].replace(/\s+/g, '');
    if (hex.length === 0 || hex.length % 2 !== 0) {
      continue;
    }
    for (let i = 0; i < hex.length; i += 2) {
      text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
  }
  return text;
}

describe('Presentation security', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => resetRateLimits(testApp));

  it('67. presentation creation requires property.create_presentation', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );

    const role = await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/roles`)
      .set(...authHeader(owner.accessToken))
      .send({
        key: 'NO_PRESENTATIONS',
        name: 'No Presentations',
        permissionKeys: ['property.view'],
      })
      .expect(201);
    const member = await inviteAndActivateEmployee(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        roleId: role.body.id,
      },
    );

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${owner.workspaceId}/presentations`)
      .set(...authHeader(member.accessToken))
      .send({ title: 'x', items: [{ propertyId: property.id }] })
      .expect(403);
  });

  it("68, 69. every selected property is authorization-checked — another workspace's property cannot enter a presentation", async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const propertyInA = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const propertyInB = await createProperty(
      testApp,
      ownerB.workspaceId,
      ownerB.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/presentations`)
      .set(...authHeader(ownerA.accessToken))
      .send({
        title: 'Mixed',
        items: [{ propertyId: propertyInA.id }, { propertyId: propertyInB.id }],
      })
      .expect(400);
  });

  it("70. another workspace's client cannot enter a presentation", async () => {
    const ownerA = await registerVerifiedCompanyOwner(testApp, 'Company A');
    const ownerB = await registerVerifiedCompanyOwner(testApp, 'Company B');
    const propertyInA = await createProperty(
      testApp,
      ownerA.workspaceId,
      ownerA.accessToken,
    );
    const clientInB = await createClient(
      testApp,
      ownerB.workspaceId,
      ownerB.accessToken,
    );

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/presentations`)
      .set(...authHeader(ownerA.accessToken))
      .send({
        title: 'x',
        clientId: clientInB.id,
        items: [{ propertyId: propertyInA.id }],
      })
      .expect(404);
  });

  it('71, 72, 73, 74. the generated PDF bytes never contain owner phone/email, private notes, commission notes, or exact coordinates', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      {
        title: 'Sea View Apartment',
        price: 150000,
        currency: 'USD',
        location: {
          latitude: 33.978123,
          longitude: 35.618456,
          city: 'Jounieh',
          locationSource: 'MANUAL',
        },
        owners: [
          {
            fullName: 'Secret Owner',
            phone: '+96170099999',
            email: 'secretowner@example.com',
          },
        ],
        privateDetails: {
          internalNotes: 'internal-only-note-xyz',
          commissionNotes: 'commission-secret-abc',
        },
      },
    );
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );

    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    const accessResponse = await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/access-url`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);
    const url = new URL(accessResponse.body.url as string);
    const fetched = await request(testApp.app.getHttpServer())
      .get(url.pathname + url.search)
      .expect(200);

    const pdfText = extractPdfText(fetched.body as Buffer);
    expect(pdfText).toContain('Sea View Apartment'); // sanity: safe content IS present
    expect(pdfText).not.toContain('+96170099999');
    expect(pdfText).not.toContain('secretowner@example.com');
    expect(pdfText).not.toContain('Secret Owner');
    expect(pdfText).not.toContain('internal-only-note-xyz');
    expect(pdfText).not.toContain('commission-secret-abc');
    expect(pdfText).not.toContain('33.978123');
    expect(pdfText).not.toContain('35.618456');
  });

  it('75. accessing the PDF without a valid signed URL is denied', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    await request(testApp.app.getHttpServer())
      .get(
        '/api/v1/storage/access?key=presentations/fake&exp=9999999999999&sig=deadbeef',
      )
      .expect(401);
  });

  it('76. an expired signed URL is denied', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );
    await request(testApp.app.getHttpServer())
      .post(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/generate`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(200);

    const stored = await testApp.prisma.propertyPresentation.findUniqueOrThrow({
      where: { id: presentation.id },
    });
    await request(testApp.app.getHttpServer())
      .get(`/api/v1/storage/access?key=${stored.storageKey}&exp=1&sig=deadbeef`)
      .expect(401);
  });

  it('accessing a presentation before it has ever been generated is rejected (no storage key yet)', async () => {
    const owner = await registerVerifiedCompanyOwner(testApp);
    const property = await createProperty(
      testApp,
      owner.workspaceId,
      owner.accessToken,
    );
    const presentation = await createPresentation(
      testApp,
      owner.workspaceId,
      owner.accessToken,
      [{ propertyId: property.id }],
    );

    await request(testApp.app.getHttpServer())
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/presentations/${presentation.id}/access-url`,
      )
      .set(...authHeader(owner.accessToken))
      .expect(409);
  });
});
