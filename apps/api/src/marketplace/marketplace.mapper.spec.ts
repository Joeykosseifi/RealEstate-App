import {
  toPublicLocation,
  toPublicPropertyDetail,
  toPublicPropertyListItem,
  type PublishedListing,
} from './marketplace.mapper';

function buildListing(
  overrides: Partial<PublishedListing> = {},
): PublishedListing {
  const base = {
    id: 'pub-1',
    propertyId: 'prop-1',
    workspaceId: 'ws-1',
    status: 'PUBLISHED',
    latestVersionId: 'v1',
    publishedVersionId: 'v1',
    submittedByUserId: 'user-1',
    submittedAt: new Date('2026-01-01'),
    approvedByUserId: 'admin-1',
    approvedAt: new Date('2026-01-02'),
    rejectedByUserId: null,
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedByUserId: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    publishedAt: new Date('2026-01-02'),
    unpublishedAt: null,
    unpublishedByUserId: null,
    unpublishReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    publishedVersion: {
      id: 'v1',
      publicationId: 'pub-1',
      versionNumber: 1,
      status: 'APPROVED',
      publicTitle: 'Nice Apartment',
      publicDescription: 'A description',
      publicPrice: 150000 as unknown as import('@prisma/client').Prisma.Decimal,
      currency: 'USD',
      propertyType: 'APARTMENT',
      listingPurpose: 'SALE',
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: null,
      publicFeatureKeys: ['parking'],
      locationVisibility: 'PUBLIC_APPROXIMATE',
      publicCountry: 'Lebanon',
      publicCity: 'Jounieh',
      publicArea: 'Sarba',
      publicLatitude: null,
      publicLongitude: null,
      submittedByUserId: 'user-1',
      submittedAt: new Date('2026-01-01'),
      reviewedByUserId: 'admin-1',
      reviewedAt: new Date('2026-01-02'),
      reviewReason: null,
      createdAt: new Date('2026-01-01'),
      media: [],
    },
    workspace: {
      id: 'ws-1',
      type: 'PERSONAL',
      name: 'Test Workspace',
      personalOwnerUserId: 'user-1',
      companyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      personalOwner: { firstName: 'Jane', lastName: 'Agent' },
      company: null,
    },
  } as unknown as PublishedListing;

  return { ...base, ...overrides };
}

describe('marketplace.mapper — structural safety', () => {
  it('toPublicPropertyListItem never includes owner/private/commission keys, regardless of input shape', () => {
    // Simulate a listing object that (incorrectly, hypothetically) also
    // carries private data on nested objects — the mapper must never
    // read or forward it, since it has no code path that touches those
    // fields at all.
    const listing = buildListing();
    (listing as unknown as Record<string, unknown>).owners = [
      { fullName: 'Leaked Owner', phone: '+96170000000' },
    ];
    (listing as unknown as Record<string, unknown>).privateDetails = {
      commissionNotes: 'leaked commission',
    };

    const result = toPublicPropertyListItem(listing, new Map());
    const raw = JSON.stringify(result);

    expect(raw).not.toContain('Leaked Owner');
    expect(raw).not.toContain('leaked commission');
    expect(Object.keys(result)).not.toContain('owners');
    expect(Object.keys(result)).not.toContain('privateDetails');
  });

  it('toPublicPropertyDetail never includes exact coordinates when locationVisibility is not PUBLIC_EXACT', () => {
    const listing = buildListing();
    const result = toPublicPropertyDetail(listing, new Map());

    expect(result.location.exactLatitude).toBeUndefined();
    expect(result.location.exactLongitude).toBeUndefined();
  });

  it('toPublicLocation exposes coordinates only for PUBLIC_EXACT with a saved lat/lng', () => {
    const privateLocation = toPublicLocation({
      ...buildListing().publishedVersion,
      locationVisibility: 'PRIVATE',
      publicCity: 'Jounieh',
    } as never);
    expect(privateLocation).toEqual({ country: null, city: null, area: null });

    const exactLocation = toPublicLocation({
      ...buildListing().publishedVersion,
      locationVisibility: 'PUBLIC_EXACT',
      publicLatitude:
        33.98 as unknown as import('@prisma/client').Prisma.Decimal,
      publicLongitude:
        35.62 as unknown as import('@prisma/client').Prisma.Decimal,
    } as never);
    expect(exactLocation.exactLatitude).toBe(33.98);
    expect(exactLocation.exactLongitude).toBe(35.62);
  });

  it('toPublicPropertyDetail never includes propertyId or workspaceId — only the publicationId', () => {
    const listing = buildListing();
    const result = toPublicPropertyDetail(listing, new Map());
    const raw = JSON.stringify(result);

    expect(raw).not.toContain('prop-1');
    expect(raw).not.toContain('ws-1');
    expect(result.publicationId).toBe('pub-1');
  });
});
