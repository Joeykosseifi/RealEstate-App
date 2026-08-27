import {
  PdfGeneratorService,
  type PresentationPdfInput,
} from './pdf-generator.service';

const SNAPSHOT = {
  id: 'prop-1',
  title: 'Sea View Apartment',
  description: 'A lovely apartment.',
  propertyType: 'APARTMENT',
  listingPurpose: 'SALE' as const,
  price: 170000,
  currency: 'USD',
  bedrooms: 3,
  bathrooms: 2,
  areaSqm: 165,
  propertyStatus: 'AVAILABLE',
  city: 'Jounieh',
  area: 'Sahel Alma',
  country: 'Lebanon',
  featureKeys: ['parking', 'balcony'],
  primaryImageUrl: null,
};

function baseInput(
  overrides: Partial<PresentationPdfInput> = {},
): PresentationPdfInput {
  return {
    title: 'Properties for You',
    brandingName: 'Confidence Real Estate',
    clientName: 'Jane Client',
    generatedAt: new Date('2026-01-01T00:00:00Z'),
    items: [
      { snapshot: SNAPSHOT, agentNote: 'Great value.', imageBuffer: null },
    ],
    ...overrides,
  };
}

describe('PdfGeneratorService', () => {
  const service = new PdfGeneratorService();

  it('produces a non-empty, valid PDF buffer', async () => {
    const buffer = await service.generate(baseInput());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('does not break generation when a property has no image', async () => {
    const buffer = await service.generate(baseInput());
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('does not break generation when image bytes are corrupt/unsupported', async () => {
    const buffer = await service.generate(
      baseInput({
        items: [
          {
            snapshot: SNAPSHOT,
            agentNote: null,
            imageBuffer: Buffer.from('not-an-image'),
          },
        ],
      }),
    );
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('handles multiple properties in one presentation', async () => {
    const buffer = await service.generate(
      baseInput({
        items: [
          { snapshot: SNAPSHOT, agentNote: null, imageBuffer: null },
          {
            snapshot: { ...SNAPSHOT, id: 'prop-2', title: 'Second Property' },
            agentNote: null,
            imageBuffer: null,
          },
        ],
      }),
    );
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});
