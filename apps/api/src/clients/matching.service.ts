import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Paginated, PropertyMatchResult } from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import {
  toPresentationSafeSnapshot,
  type PropertyForPresentationSnapshot,
} from '../properties/property.mapper';
import {
  scoreMatch,
  type MatchCandidateProperty,
  type MatchRequirementCriteria,
} from './matching-engine';
import type { ListMatchesQueryDto } from './dto/list-matches-query.dto';

const CANDIDATE_INCLUDE = {
  location: { select: { city: true, area: true, country: true } },
  features: { select: { featureKey: true, value: true } },
} satisfies Prisma.PropertyInclude;

type CandidateRow = PropertyForPresentationSnapshot;

/**
 * Property matching — see docs/PERMISSIONS.md "Matching architecture."
 * The authorization chain runs FIRST, at the candidate query level:
 * `workspaceId` scopes the SQL `WHERE` before any row is read, so an
 * unauthorized property is never fetched, scored, or filtered out
 * after the fact — never "search everything, then hide what the caller
 * can't see." For Milestone 4, matching only ever considers properties
 * the ACTIVE workspace itself owns; cross-workspace/freelance
 * collaboration inventory is a later milestone.
 *
 * Matches are always computed fresh from current data (see
 * docs/DATABASE.md "Recalculate matches") — there is no stored
 * match-result table to go stale when a price/status/feature changes.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async findMatches(
    workspaceId: string,
    clientId: string,
    requirementId: string,
    permissions: Set<string>,
    query: ListMatchesQueryDto,
  ): Promise<Paginated<PropertyMatchResult>> {
    if (!permissions.has(PERMISSIONS.PROPERTY_VIEW.key)) {
      throw new ForbiddenException(
        `Missing required permission: ${PERMISSIONS.PROPERTY_VIEW.key}`,
      );
    }

    const client = await this.prisma.clientRecord.findFirst({
      where: { id: clientId, workspaceId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }
    const requirement = await this.prisma.clientRequirement.findFirst({
      where: { id: requirementId, clientId, workspaceId },
    });
    if (!requirement) {
      throw new NotFoundException('Requirement not found.');
    }

    const and: Prisma.PropertyWhereInput[] = [
      { workspaceId },
      { propertyStatus: 'AVAILABLE' },
      { listingPurpose: requirement.listingPurpose },
    ];

    if (requirement.propertyTypes.length > 0) {
      and.push({ propertyType: { in: requirement.propertyTypes } });
    }
    if (requirement.minPrice != null || requirement.maxPrice != null) {
      // Currency rule: prices are never compared across currencies (see
      // docs/PERMISSIONS.md "Matching currency rule"). `currency` is
      // required by CreateClientRequirementDto validation whenever a
      // price bound is set, so it is guaranteed non-null here.
      and.push({ currency: requirement.currency as string });
      if (requirement.minPrice != null) {
        and.push({ price: { gte: requirement.minPrice } });
      }
      if (requirement.maxPrice != null) {
        and.push({ price: { lte: requirement.maxPrice } });
      }
    }
    if (requirement.minBedrooms != null) {
      and.push({ bedrooms: { gte: requirement.minBedrooms } });
    }
    if (requirement.maxBedrooms != null) {
      and.push({ bedrooms: { lte: requirement.maxBedrooms } });
    }
    if (requirement.minBathrooms != null) {
      and.push({ bathrooms: { gte: requirement.minBathrooms } });
    }
    if (requirement.minAreaSqm != null) {
      and.push({ areaSqm: { gte: requirement.minAreaSqm } });
    }
    if (requirement.maxAreaSqm != null) {
      and.push({ areaSqm: { lte: requirement.maxAreaSqm } });
    }
    if (
      requirement.countries.length > 0 ||
      requirement.cities.length > 0 ||
      requirement.areas.length > 0
    ) {
      // Combined with OR, not AND — a client accepting "Jounieh,
      // Kaslik, Zouk Mikael" across cities/areas needs a match against
      // any one of them, not every location dimension at once.
      const locationOr: Prisma.PropertyWhereInput[] = [];
      if (requirement.countries.length > 0) {
        locationOr.push({
          location: {
            country: { in: requirement.countries, mode: 'insensitive' },
          },
        });
      }
      if (requirement.cities.length > 0) {
        locationOr.push({
          location: { city: { in: requirement.cities, mode: 'insensitive' } },
        });
      }
      if (requirement.areas.length > 0) {
        locationOr.push({
          location: { area: { in: requirement.areas, mode: 'insensitive' } },
        });
      }
      and.push({ OR: locationOr });
    }
    for (const featureKey of requirement.requiredFeatures) {
      and.push({ features: { some: { featureKey, value: true } } });
    }

    const candidates = (await this.prisma.property.findMany({
      where: { AND: and },
      include: CANDIDATE_INCLUDE,
    })) as CandidateRow[];

    const requirementCriteria: MatchRequirementCriteria = {
      listingPurpose: requirement.listingPurpose,
      propertyTypes: requirement.propertyTypes,
      minPrice: requirement.minPrice ? requirement.minPrice.toNumber() : null,
      maxPrice: requirement.maxPrice ? requirement.maxPrice.toNumber() : null,
      currency: requirement.currency,
      minBedrooms: requirement.minBedrooms,
      maxBedrooms: requirement.maxBedrooms,
      minBathrooms: requirement.minBathrooms,
      minAreaSqm: requirement.minAreaSqm
        ? requirement.minAreaSqm.toNumber()
        : null,
      maxAreaSqm: requirement.maxAreaSqm
        ? requirement.maxAreaSqm.toNumber()
        : null,
      countries: requirement.countries,
      cities: requirement.cities,
      areas: requirement.areas,
      requiredFeatures: requirement.requiredFeatures,
      preferredFeatures: requirement.preferredFeatures,
    };

    const scored = candidates.map((property) => {
      const candidateProperty: MatchCandidateProperty = {
        currency: property.currency,
        propertyType: property.propertyType,
        city: property.location?.city ?? null,
        area: property.location?.area ?? null,
        country: property.location?.country ?? null,
        featureKeys: property.features
          .filter((feature) => feature.value)
          .map((f) => f.featureKey),
      };
      return {
        property,
        ...scoreMatch(requirementCriteria, candidateProperty),
      };
    });

    const filtered =
      query.minScore !== undefined
        ? scored.filter((entry) => entry.score >= query.minScore!)
        : scored;

    // Deterministic ranking: score descending, then property id
    // ascending as a stable secondary order — see docs/PERMISSIONS.md
    // "Match ordering."
    filtered.sort(
      (a, b) => b.score - a.score || a.property.id.localeCompare(b.property.id),
    );

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const totalItems = filtered.length;
    const pageEntries = filtered.slice(
      (page - 1) * pageSize,
      (page - 1) * pageSize + pageSize,
    );

    const items: PropertyMatchResult[] = [];
    for (const entry of pageEntries) {
      const primaryImageUrl = await this.resolvePrimaryImageUrl(
        entry.property.id,
      );
      items.push({
        property: toPresentationSafeSnapshot(entry.property, primaryImageUrl),
        score: entry.score,
        explanation: {
          matchedCriteria: entry.matchedCriteria,
          missingPreferredCriteria: entry.missingPreferredCriteria,
        },
      });
    }

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  private async resolvePrimaryImageUrl(
    propertyId: string,
  ): Promise<string | null> {
    const media = await this.prisma.propertyMedia.findFirst({
      where: { propertyId, mediaType: 'IMAGE' },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      select: { storageKey: true },
    });
    return media ? this.storage.getSignedAccessUrl(media.storageKey) : null;
  }
}
