import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PropertyBusinessStatus } from '@prisma/client';
import type {
  Paginated,
  PropertyListItem,
  PropertyProfessionalDetail,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import type { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import type { PropertyLocationDto } from './dto/property-location.dto';
import {
  toPropertyListItem,
  toPropertyProfessionalDetail,
  type PropertyForList,
  type PropertyWithRelations,
} from './property.mapper';

const DETAIL_INCLUDE = {
  location: true,
  features: true,
  media: true,
  owners: true,
  privateDetails: true,
} satisfies Prisma.PropertyInclude;

const LIST_INCLUDE = {
  location: { select: { city: true, area: true } },
  media: {
    select: {
      id: true,
      mediaType: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      sortOrder: true,
      isPrimary: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PropertyInclude;

/**
 * Business-status transitions reachable via `changeStatus()`. ARCHIVED
 * is deliberately unreachable here — it only happens through
 * `archive()`, and leaving it (restore-only) via `restore()`. SOLD/RENTED
 * can only go back to AVAILABLE or OFF_MARKET (undoing a mistaken mark),
 * never directly to each other or to RESERVED, which would not make
 * sense without passing back through AVAILABLE first. See
 * docs/PERMISSIONS.md "Property status transitions."
 */
const ALLOWED_STATUS_TRANSITIONS: Record<
  PropertyBusinessStatus,
  PropertyBusinessStatus[]
> = {
  AVAILABLE: ['RESERVED', 'SOLD', 'RENTED', 'OFF_MARKET'],
  RESERVED: ['AVAILABLE', 'SOLD', 'RENTED', 'OFF_MARKET'],
  OFF_MARKET: ['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED'],
  SOLD: ['AVAILABLE', 'OFF_MARKET'],
  RENTED: ['AVAILABLE', 'OFF_MARKET'],
  ARCHIVED: [],
};

interface SensitiveSectionsInput {
  owners?: unknown[];
  privateDetails?: { commissionNotes?: string } | undefined;
}

/**
 * Concurrency strategy (documented decision, see docs/DATABASE.md
 * "Property concurrency"): plain last-write-wins, no optimistic
 * (version column) or pessimistic (row lock) concurrency control for
 * ordinary field edits — two agents editing the same property at once
 * is a rare, low-stakes event where "the later request's values win" is
 * an acceptable outcome, unlike Milestone 2's owner/SUPER_ADMIN-count
 * invariants (which genuinely cannot tolerate a race and use
 * `SELECT ... FOR UPDATE`). The one guard that does matter here is
 * checked synchronously against the freshest read available
 * (`update()`/`changeStatus()` reject once a property is ARCHIVED) —
 * this narrows, but does not fully eliminate, the race window against a
 * concurrent `archive()`, which is the intended, documented tradeoff.
 */
@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Writing owner info requires the same permission as reading it
   * (`property.view_owner`) — a user who can't see owner data shouldn't
   * be able to blindly overwrite it either. Same logic for private
   * notes / commission. See docs/PERMISSIONS.md "Sensitive property
   * fields."
   */
  /**
   * `location` is deliberately NOT gated here — every property needs a
   * location the moment it's created (it's core data, like title or
   * price), so writing it only requires the baseline `property.edit`/
   * `property.create`. Only READING the exact coordinates back requires
   * `property.view_exact_location` (see property.mapper.ts) — a
   * write-only-no-read-back permission combination is intentionally
   * possible, matching the spec's framing ("viewing... must not
   * automatically imply access"), which is about reads. Owner contact
   * info, private notes, and commission are different: they're optional
   * enrichment data entered separately from the core record, so writing
   * them requires the same permission as reading them — a user who
   * can't see owner data shouldn't be able to blindly overwrite it
   * either.
   */
  private assertCanWriteSensitiveSections(
    permissions: Set<string>,
    input: SensitiveSectionsInput,
  ): void {
    if (
      input.owners !== undefined &&
      !permissions.has(PERMISSIONS.PROPERTY_VIEW_OWNER.key)
    ) {
      throw new ForbiddenException(
        `Missing required permission: ${PERMISSIONS.PROPERTY_VIEW_OWNER.key}`,
      );
    }
    if (input.privateDetails !== undefined) {
      if (!permissions.has(PERMISSIONS.PROPERTY_VIEW_PRIVATE_NOTES.key)) {
        throw new ForbiddenException(
          `Missing required permission: ${PERMISSIONS.PROPERTY_VIEW_PRIVATE_NOTES.key}`,
        );
      }
      if (
        input.privateDetails.commissionNotes !== undefined &&
        !permissions.has(PERMISSIONS.PROPERTY_VIEW_COMMISSION.key)
      ) {
        throw new ForbiddenException(
          `Missing required permission: ${PERMISSIONS.PROPERTY_VIEW_COMMISSION.key}`,
        );
      }
    }
  }

  /**
   * Single transaction: Property + optional Location/Features/Owners/
   * PrivateDetails all commit together or not at all — never a partial
   * property record from a failed nested create. Media is deliberately
   * NOT part of this transaction (see PropertyMediaService) — uploads
   * are a separate, post-create operation since they involve the
   * storage provider, not just the database.
   */
  async create(
    workspaceId: string,
    actorUserId: string,
    permissions: Set<string>,
    dto: CreatePropertyDto,
  ): Promise<PropertyProfessionalDetail> {
    this.assertCanWriteSensitiveSections(permissions, dto);

    const property = await this.prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          workspaceId,
          createdByUserId: actorUserId,
          propertyType: dto.propertyType,
          listingPurpose: dto.listingPurpose,
          title: dto.title,
          description: dto.description,
          price: dto.price,
          currency: dto.currency.toUpperCase(),
          bedrooms: dto.bedrooms,
          bathrooms: dto.bathrooms,
          areaSqm: dto.areaSqm,
          floor: dto.floor,
          totalFloors: dto.totalFloors,
          yearBuilt: dto.yearBuilt,
        },
      });

      if (dto.location) {
        await tx.propertyLocation.create({
          data: { propertyId: created.id, ...dto.location },
        });
      }

      if (dto.featureKeys && dto.featureKeys.length > 0) {
        await tx.propertyFeature.createMany({
          data: dto.featureKeys.map((featureKey) => ({
            propertyId: created.id,
            featureKey,
          })),
        });
      }

      if (dto.owners && dto.owners.length > 0) {
        await tx.propertyOwner.createMany({
          data: dto.owners.map((owner) => ({
            propertyId: created.id,
            ...owner,
          })),
        });
      }

      if (dto.privateDetails) {
        await tx.propertyPrivateDetails.create({
          data: { propertyId: created.id, ...dto.privateDetails },
        });
      }

      return tx.property.findUniqueOrThrow({
        where: { id: created.id },
        include: DETAIL_INCLUDE,
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.created',
      targetType: 'Property',
      targetId: property.id,
      metadata: { workspaceId, propertyType: property.propertyType },
    });

    return toPropertyProfessionalDetail(property, permissions);
  }

  async findMany(
    workspaceId: string,
    query: ListPropertiesQueryDto,
  ): Promise<Paginated<PropertyListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const and: Prisma.PropertyWhereInput[] = [{ workspaceId }];

    if (query.propertyStatus) {
      and.push({ propertyStatus: query.propertyStatus });
    } else if (!query.includeArchived) {
      and.push({ propertyStatus: { not: 'ARCHIVED' } });
    }
    if (query.propertyType) {
      and.push({ propertyType: query.propertyType });
    }
    if (query.listingPurpose) {
      and.push({ listingPurpose: query.listingPurpose });
    }
    if (query.priceMin !== undefined) {
      and.push({ price: { gte: query.priceMin } });
    }
    if (query.priceMax !== undefined) {
      and.push({ price: { lte: query.priceMax } });
    }
    if (query.bedroomsMin !== undefined) {
      and.push({ bedrooms: { gte: query.bedroomsMin } });
    }
    if (query.bathroomsMin !== undefined) {
      and.push({ bathrooms: { gte: query.bathroomsMin } });
    }
    if (query.areaMin !== undefined) {
      and.push({ areaSqm: { gte: query.areaMin } });
    }
    if (query.areaMax !== undefined) {
      and.push({ areaSqm: { lte: query.areaMax } });
    }
    if (query.createdByUserId) {
      and.push({ createdByUserId: query.createdByUserId });
    }
    if (query.city) {
      and.push({
        location: { city: { equals: query.city, mode: 'insensitive' } },
      });
    }
    if (query.area) {
      and.push({
        location: { area: { equals: query.area, mode: 'insensitive' } },
      });
    }
    if (query.features && query.features.length > 0) {
      for (const featureKey of query.features) {
        and.push({ features: { some: { featureKey, value: true } } });
      }
    }
    if (query.search) {
      const term = query.search.trim();
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { location: { city: { contains: term, mode: 'insensitive' } } },
          { location: { area: { contains: term, mode: 'insensitive' } } },
          { location: { address: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.PropertyWhereInput = { AND: and };

    const [properties, totalItems] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: (properties as PropertyForList[]).map(toPropertyListItem),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /** Throws 404 for both "doesn't exist" and "belongs to another workspace" — a caller can't distinguish a guessed UUID from one that's simply not theirs. */
  async findOneOrThrow(
    workspaceId: string,
    propertyId: string,
  ): Promise<PropertyWithRelations> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, workspaceId },
      include: DETAIL_INCLUDE,
    });
    if (!property) {
      throw new NotFoundException('Property not found.');
    }
    return property;
  }

  /**
   * Audits access to each sensitive section only when that section was
   * actually present on the property AND actually included in the
   * response (i.e. the caller held the permission) — there is nothing
   * sensitive to log access to otherwise.
   */
  async findOneForRead(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    permissions: Set<string>,
  ): Promise<PropertyProfessionalDetail> {
    const property = await this.findOneOrThrow(workspaceId, propertyId);
    const detail = toPropertyProfessionalDetail(property, permissions);

    if (detail.owners) {
      await this.audit.log({
        actorUserId,
        action: 'property.owner_accessed',
        targetType: 'Property',
        targetId: property.id,
      });
    }
    if (detail.privateDetails) {
      await this.audit.log({
        actorUserId,
        action: 'property.private_notes_accessed',
        targetType: 'Property',
        targetId: property.id,
      });
    }
    if (detail.location) {
      await this.audit.log({
        actorUserId,
        action: 'property.exact_location_accessed',
        targetType: 'Property',
        targetId: property.id,
      });
    }

    return detail;
  }

  /**
   * Whole-section replace semantics for `location`/`owners`/
   * `privateDetails`/`featureKeys` when present in the payload (see
   * UpdatePropertyDto) — all in one transaction with the core field
   * update. `workspaceId`/`createdByUserId` are structurally
   * unreachable from `UpdatePropertyDto`, so there is nothing here that
   * could move a property between workspaces.
   */
  async update(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    permissions: Set<string>,
    dto: UpdatePropertyDto,
  ): Promise<PropertyProfessionalDetail> {
    const existing = await this.findOneOrThrow(workspaceId, propertyId);
    if (existing.propertyStatus === 'ARCHIVED') {
      throw new ConflictException('Restore this property before editing it.');
    }
    this.assertCanWriteSensitiveSections(permissions, dto);

    const property = await this.prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          propertyType: dto.propertyType,
          listingPurpose: dto.listingPurpose,
          title: dto.title,
          description: dto.description,
          price: dto.price,
          currency: dto.currency?.toUpperCase(),
          bedrooms: dto.bedrooms,
          bathrooms: dto.bathrooms,
          areaSqm: dto.areaSqm,
          floor: dto.floor,
          totalFloors: dto.totalFloors,
          yearBuilt: dto.yearBuilt,
        },
      });

      if (dto.location) {
        await tx.propertyLocation.upsert({
          where: { propertyId },
          create: { propertyId, ...dto.location },
          update: { ...dto.location },
        });
      }

      if (dto.featureKeys) {
        await tx.propertyFeature.deleteMany({ where: { propertyId } });
        if (dto.featureKeys.length > 0) {
          await tx.propertyFeature.createMany({
            data: dto.featureKeys.map((featureKey) => ({
              propertyId,
              featureKey,
            })),
          });
        }
      }

      if (dto.owners) {
        await tx.propertyOwner.deleteMany({ where: { propertyId } });
        if (dto.owners.length > 0) {
          await tx.propertyOwner.createMany({
            data: dto.owners.map((owner) => ({ propertyId, ...owner })),
          });
        }
      }

      if (dto.privateDetails) {
        await tx.propertyPrivateDetails.upsert({
          where: { propertyId },
          create: { propertyId, ...dto.privateDetails },
          update: { ...dto.privateDetails },
        });
      }

      return tx.property.findUniqueOrThrow({
        where: { id: propertyId },
        include: DETAIL_INCLUDE,
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.updated',
      targetType: 'Property',
      targetId: property.id,
      metadata: { fieldsChanged: Object.keys(dto) },
    });

    return toPropertyProfessionalDetail(property, permissions);
  }

  async changeStatus(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    newStatus: Exclude<PropertyBusinessStatus, 'ARCHIVED'>,
  ): Promise<void> {
    const property = await this.findOneOrThrow(workspaceId, propertyId);

    if (property.propertyStatus === 'ARCHIVED') {
      throw new ConflictException(
        'Restore this property before changing its status.',
      );
    }
    if (property.propertyStatus === newStatus) {
      return; // idempotent no-op
    }
    if (
      !ALLOWED_STATUS_TRANSITIONS[property.propertyStatus].includes(newStatus)
    ) {
      throw new ConflictException(
        `Cannot transition property status from ${property.propertyStatus} to ${newStatus}.`,
      );
    }

    await this.prisma.property.update({
      where: { id: propertyId },
      data: { propertyStatus: newStatus },
    });

    await this.audit.log({
      actorUserId,
      action: 'property.status_changed',
      targetType: 'Property',
      targetId: propertyId,
      metadata: { from: property.propertyStatus, to: newStatus },
    });
  }

  /** Reversible — see `restore()`. Never deletes the row or any related record. */
  async archive(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
  ): Promise<void> {
    const property = await this.findOneOrThrow(workspaceId, propertyId);

    if (property.propertyStatus === 'ARCHIVED') {
      throw new ConflictException('Property is already archived.');
    }

    await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        propertyStatus: 'ARCHIVED',
        archivedAt: new Date(),
        archivedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'property.archived',
      targetType: 'Property',
      targetId: propertyId,
      metadata: { previousStatus: property.propertyStatus },
    });
  }

  /**
   * Always restores to OFF_MARKET, never back to its prior status — an
   * agent should consciously decide to re-list a restored property
   * rather than have it silently reappear as AVAILABLE. See
   * docs/PERMISSIONS.md "Restore behavior."
   */
  async restore(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
  ): Promise<void> {
    const property = await this.findOneOrThrow(workspaceId, propertyId);

    if (property.propertyStatus !== 'ARCHIVED') {
      throw new ConflictException('Only an archived property can be restored.');
    }

    await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        propertyStatus: 'OFF_MARKET',
        archivedAt: null,
        archivedByUserId: null,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'property.restored',
      targetType: 'Property',
      targetId: propertyId,
    });
  }

  /**
   * Focused location-only update (see docs/API.md) — same effect as
   * including `location` in a `PATCH .../properties/:id` body, kept as
   * its own endpoint since the Google Maps picker flow updates only
   * this section. Requires only `property.edit` — see the write-vs-read
   * note on `assertCanWriteSensitiveSections` above for why location
   * isn't gated by `property.view_exact_location` on write.
   */
  async updateLocation(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    permissions: Set<string>,
    dto: PropertyLocationDto,
  ): Promise<PropertyProfessionalDetail> {
    await this.findOneOrThrow(workspaceId, propertyId);

    await this.prisma.propertyLocation.upsert({
      where: { propertyId },
      create: { propertyId, ...dto },
      update: { ...dto },
    });

    await this.audit.log({
      actorUserId,
      action: 'property.updated',
      targetType: 'Property',
      targetId: propertyId,
      metadata: { section: 'location' },
    });

    const property = await this.prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: DETAIL_INCLUDE,
    });
    return toPropertyProfessionalDetail(property, permissions);
  }
}
