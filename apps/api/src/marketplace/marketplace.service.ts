import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  Paginated,
  PublicPropertyDetail,
  PublicPropertyListItem,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import {
  toPublicPropertyDetail,
  toPublicPropertyListItem,
  type PublishedListing,
} from './marketplace.mapper';
import type { MarketplaceSearchQueryDto } from './dto/marketplace-search-query.dto';

/**
 * A listing is publicly visible whenever it HAS a live published version
 * and nothing has explicitly taken it down — deliberately NOT
 * `status === 'PUBLISHED'` alone, because `status` also tracks the
 * *latest version's* workflow (e.g. a newer edit sitting in
 * PENDING_REVIEW/CHANGES_REQUESTED/REJECTED). Per docs/PERMISSIONS.md
 * "Major public edits after approval": the previously-approved version
 * must stay live to the public while a newer edit is under review, so
 * visibility and the top-level workflow status are intentionally
 * decoupled. Reused by FavoritesService so favoriting follows the exact
 * same eligibility rule as browsing.
 */
export const PUBLICATION_VISIBILITY_WHERE = {
  publishedVersionId: { not: null },
  status: { notIn: ['ADMIN_UNPUBLISHED', 'OWNER_UNPUBLISHED', 'ARCHIVED'] },
  property: { propertyStatus: { in: ['AVAILABLE', 'RESERVED'] } },
} satisfies Prisma.PropertyPublicationWhereInput;

const LISTING_INCLUDE = {
  publishedVersion: {
    include: { media: { include: { propertyMedia: true } } },
  },
  workspace: {
    include: {
      personalOwner: { select: { firstName: true, lastName: true } },
      company: { select: { name: true, logoUrl: true } },
    },
  },
} satisfies Prisma.PropertyPublicationInclude;

/**
 * The marketplace's ONLY source of truth is `PropertyPublication` +
 * its `publishedVersion` snapshot — never the raw `Property`/
 * `PropertyLocation`/`PropertyMedia` tables directly (see
 * docs/PERMISSIONS.md "Marketplace source of truth"). Two independent
 * eligibility layers, both enforced on every query: (1) the publication
 * itself must be `PUBLISHED`, and (2) the underlying property's business
 * status must still be AVAILABLE/RESERVED — a SOLD/RENTED/ARCHIVED
 * property is filtered out here even in the (should-never-happen) event
 * the publication-side auto-unpublish in PropertiesService was somehow
 * bypassed. See docs/PERMISSIONS.md "Business-status safety."
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async resolveMediaUrls(
    listings: PublishedListing[],
  ): Promise<Map<string, string | null>> {
    const urls = new Map<string, string | null>();
    for (const listing of listings) {
      for (const media of listing.publishedVersion.media) {
        if (urls.has(media.propertyMediaId)) continue;
        urls.set(
          media.propertyMediaId,
          await this.storage.getSignedAccessUrl(media.propertyMedia.storageKey),
        );
      }
    }
    return urls;
  }

  private async resolveFavoritedSet(
    viewerUserId: string | undefined,
    publicationIds: string[],
  ): Promise<Set<string>> {
    if (!viewerUserId || publicationIds.length === 0) {
      return new Set();
    }
    const favorites = await this.prisma.marketplaceFavorite.findMany({
      where: { userId: viewerUserId, publicationId: { in: publicationIds } },
      select: { publicationId: true },
    });
    return new Set(favorites.map((f) => f.publicationId));
  }

  async findMany(
    query: MarketplaceSearchQueryDto,
    viewerUserId?: string,
  ): Promise<Paginated<PublicPropertyListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const and: Prisma.PropertyPublicationWhereInput[] = [
      PUBLICATION_VISIBILITY_WHERE,
    ];

    const versionFilters: Prisma.PropertyPublicationVersionWhereInput = {};
    if (query.propertyType) versionFilters.propertyType = query.propertyType;
    if (query.listingPurpose)
      versionFilters.listingPurpose = query.listingPurpose;
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      versionFilters.publicPrice = {
        ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
        ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
      };
    }
    if (query.bedroomsMin !== undefined) {
      versionFilters.bedrooms = { gte: query.bedroomsMin };
    }
    if (query.bathroomsMin !== undefined) {
      versionFilters.bathrooms = { gte: query.bathroomsMin };
    }
    if (query.areaMin !== undefined || query.areaMax !== undefined) {
      versionFilters.areaSqm = {
        ...(query.areaMin !== undefined ? { gte: query.areaMin } : {}),
        ...(query.areaMax !== undefined ? { lte: query.areaMax } : {}),
      };
    }
    if (query.country) {
      versionFilters.publicCountry = {
        equals: query.country,
        mode: 'insensitive',
      };
    }
    if (query.city) {
      versionFilters.publicCity = { equals: query.city, mode: 'insensitive' };
    }
    if (query.area) {
      versionFilters.publicArea = { equals: query.area, mode: 'insensitive' };
    }
    if (query.features && query.features.length > 0) {
      versionFilters.publicFeatureKeys = { hasEvery: query.features };
    }
    if (query.search) {
      const term = query.search.trim();
      versionFilters.OR = [
        { publicTitle: { contains: term, mode: 'insensitive' } },
        { publicDescription: { contains: term, mode: 'insensitive' } },
        { publicCity: { contains: term, mode: 'insensitive' } },
        { publicArea: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(versionFilters).length > 0) {
      and.push({ publishedVersion: versionFilters });
    }

    const where: Prisma.PropertyPublicationWhereInput = { AND: and };

    const orderBy: Prisma.PropertyPublicationOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { publishedVersion: { publicPrice: 'asc' } }
        : query.sort === 'price_desc'
          ? { publishedVersion: { publicPrice: 'desc' } }
          : { publishedAt: 'desc' };

    const [listings, totalItems] = await Promise.all([
      this.prisma.propertyPublication.findMany({
        where,
        include: LISTING_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.propertyPublication.count({ where }),
    ]);

    const typedListings = listings as PublishedListing[];
    const mediaUrls = await this.resolveMediaUrls(typedListings);
    const favorited = await this.resolveFavoritedSet(
      viewerUserId,
      typedListings.map((l) => l.id),
    );

    return {
      items: typedListings.map((listing) =>
        toPublicPropertyListItem(listing, mediaUrls, favorited.has(listing.id)),
      ),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /**
   * `publicationId` is the marketplace-facing identifier — never accepts
   * or leaks the underlying private `propertyId` (see
   * docs/PERMISSIONS.md "Marketplace identifier"). A publication that
   * exists but isn't currently PUBLISHED (or whose property has since
   * become ineligible) is a plain 404 — indistinguishable from a
   * publication that never existed at all.
   */
  async findOneOrThrow(
    publicationId: string,
    viewerUserId?: string,
  ): Promise<PublicPropertyDetail> {
    const listing = await this.prisma.propertyPublication.findFirst({
      where: { id: publicationId, ...PUBLICATION_VISIBILITY_WHERE },
      include: LISTING_INCLUDE,
    });
    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
    const typed = listing as PublishedListing;
    const mediaUrls = await this.resolveMediaUrls([typed]);
    const favorited = await this.resolveFavoritedSet(viewerUserId, [typed.id]);
    return toPublicPropertyDetail(typed, mediaUrls, favorited.has(typed.id));
  }
}
