import {
  toPropertyPublicDetail,
  type PropertyWithRelations,
} from './property.mapper';

function buildProperty(
  overrides: Partial<PropertyWithRelations> = {},
): PropertyWithRelations {
  return {
    id: 'prop-1',
    workspaceId: 'ws-1',
    createdByUserId: 'user-1',
    propertyType: 'APARTMENT',
    listingPurpose: 'SALE',
    title: 'Test',
    description: null,
    price: 100000,
    currency: 'USD',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: null,
    floor: null,
    totalFloors: null,
    yearBuilt: null,
    propertyStatus: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    location: {
      id: 'loc-1',
      propertyId: 'prop-1',
      country: 'X',
      region: null,
      city: 'Beirut',
      area: 'Achrafieh',
      address: '123 Secret Exact Street',
      latitude: 33.888629,
      longitude: 35.495479,
      googlePlaceId: 'place-123',
      locationSource: 'MANUAL',
      locationVisibility: 'PRIVATE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    features: [],
    media: [],
    owners: [
      {
        id: 'owner-1',
        propertyId: 'prop-1',
        fullName: 'Secret Owner',
        phone: '+10000000000',
        email: 'owner@example.test',
        whatsappPhone: null,
        notes: 'private owner note',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    privateDetails: {
      propertyId: 'prop-1',
      internalNotes: 'secret internal note',
      commissionNotes: 'secret commission split',
      acquisitionSource: 'referral',
      internalReference: 'REF-1',
      privateStatusNotes: 'secret status note',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  } as unknown as PropertyWithRelations;
}

describe('toPropertyPublicDetail', () => {
  it('18. never includes owner, private-notes, or commission fields, and never exposes exact coordinates', () => {
    const publicDetail = toPropertyPublicDetail(buildProperty());

    const serialized = JSON.stringify(publicDetail);

    expect(publicDetail).not.toHaveProperty('owners');
    expect(publicDetail).not.toHaveProperty('privateDetails');
    expect(publicDetail.location).not.toHaveProperty('latitude');
    expect(publicDetail.location).not.toHaveProperty('longitude');
    expect(publicDetail.location).not.toHaveProperty('address');

    // Belt-and-suspenders: none of the known secret values leak anywhere in the payload.
    expect(serialized).not.toContain('Secret Owner');
    expect(serialized).not.toContain('secret internal note');
    expect(serialized).not.toContain('secret commission split');
    expect(serialized).not.toContain('secret status note');
    expect(serialized).not.toContain('123 Secret Exact Street');
    expect(serialized).not.toContain('33.888629');
    expect(serialized).not.toContain('35.495479');
  });
});
