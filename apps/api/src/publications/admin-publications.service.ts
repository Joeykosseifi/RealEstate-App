import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PropertyPublicationStatus } from '@prisma/client';
import type {
  Paginated,
  PublicationReviewDetail,
  PublicationReviewSummary,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import {
  toPublicationReviewDetail,
  toPublicationReviewSummary,
  type PublicationWithWorkspaceName,
} from './publication.mapper';
import type { ListPublicationReviewQueryDto } from './dto/list-publication-review-query.dto';

const VERSION_WITH_MEDIA_INCLUDE = {
  media: { include: { propertyMedia: true } },
} satisfies Prisma.PropertyPublicationVersionInclude;

const REVIEW_INCLUDE = {
  latestVersion: { include: VERSION_WITH_MEDIA_INCLUDE },
  publishedVersion: { include: VERSION_WITH_MEDIA_INCLUDE },
  versions: true,
  workspace: { select: { name: true } },
} satisfies Prisma.PropertyPublicationInclude;

/**
 * Admin-side publication moderation. Deliberately reads ONLY the
 * `PropertyPublication`/`*Version`/`*Media` tables plus the submitter's
 * display name and workspace name — never `PropertyOwner`/
 * `PropertyPrivateDetails`, preserving the Milestone 2 admin/private-data
 * boundary (see docs/PERMISSIONS.md "Admin moderation boundary"): a
 * platform moderator can approve or reject a listing without ever seeing
 * owner contacts, commission notes, or internal reference numbers.
 */
@Injectable()
export class AdminPublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async resolveMediaUrls(
    publication: PublicationWithWorkspaceName,
  ): Promise<Map<string, string | null>> {
    const allMedia = [
      ...(publication.latestVersion?.media ?? []),
      ...(publication.publishedVersion?.media ?? []),
    ];
    const urls = new Map<string, string | null>();
    for (const item of allMedia) {
      if (urls.has(item.propertyMediaId)) continue;
      urls.set(
        item.propertyMediaId,
        await this.storage.getSignedAccessUrl(item.propertyMedia.storageKey),
      );
    }
    return urls;
  }

  async findMany(
    query: ListPublicationReviewQueryDto,
  ): Promise<Paginated<PublicationReviewSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const status: PropertyPublicationStatus = query.status ?? 'PENDING_REVIEW';

    const and: Prisma.PropertyPublicationWhereInput[] = [{ status }];
    if (query.workspaceId) {
      and.push({ workspaceId: query.workspaceId });
    }
    if (query.submittedByUserId) {
      and.push({ submittedByUserId: query.submittedByUserId });
    }
    if (query.propertyType) {
      and.push({ latestVersion: { propertyType: query.propertyType } });
    }
    if (query.listingPurpose) {
      and.push({ latestVersion: { listingPurpose: query.listingPurpose } });
    }
    if (query.search) {
      and.push({
        latestVersion: {
          publicTitle: { contains: query.search.trim(), mode: 'insensitive' },
        },
      });
    }

    const where: Prisma.PropertyPublicationWhereInput = { AND: and };
    const orderBy: Prisma.PropertyPublicationOrderByWithRelationInput =
      status === 'PENDING_REVIEW'
        ? { submittedAt: 'asc' }
        : { createdAt: 'desc' };

    const [publications, totalItems] = await Promise.all([
      this.prisma.propertyPublication.findMany({
        where,
        include: {
          latestVersion: true,
          workspace: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.propertyPublication.count({ where }),
    ]);

    return {
      items: publications.map(toPublicationReviewSummary),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  private async findOrThrow(id: string): Promise<PublicationWithWorkspaceName> {
    const publication = await this.prisma.propertyPublication.findUnique({
      where: { id },
      include: REVIEW_INCLUDE,
    });
    if (!publication) {
      throw new NotFoundException('Publication not found.');
    }
    return publication;
  }

  async findOneOrThrow(id: string): Promise<PublicationReviewDetail> {
    const publication = await this.findOrThrow(id);
    const mediaUrls = await this.resolveMediaUrls(publication);
    let submitterName: string | null = null;
    if (publication.submittedByUserId) {
      const submitter = await this.prisma.user.findUnique({
        where: { id: publication.submittedByUserId },
        select: { firstName: true, lastName: true },
      });
      submitterName = submitter
        ? `${submitter.firstName} ${submitter.lastName}`
        : null;
    }
    return toPublicationReviewDetail(publication, submitterName, mediaUrls);
  }

  /**
   * Row-locks the publication before reading/transitioning it, so two
   * concurrent admin decisions (two approvals, or approve-vs-reject)
   * cannot both succeed — the second sees the already-updated status
   * and is rejected with a 409, never a silent overwrite. Same technique
   * as `PresentationsService.update()`'s reorder-race fix.
   */
  private async withLockedPublication<T>(
    id: string,
    fn: (
      tx: Prisma.TransactionClient,
      publication: PublicationWithWorkspaceName,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM property_publications WHERE id = ${id}::uuid FOR UPDATE`;
      const publication = await tx.propertyPublication.findUnique({
        where: { id },
        include: REVIEW_INCLUDE,
      });
      if (!publication) {
        throw new NotFoundException('Publication not found.');
      }
      return fn(tx, publication);
    });
  }

  async approve(
    id: string,
    actorUserId: string,
  ): Promise<PublicationReviewDetail> {
    await this.withLockedPublication(id, async (tx, publication) => {
      if (
        publication.status !== 'PENDING_REVIEW' ||
        !publication.latestVersion ||
        publication.latestVersion.status !== 'PENDING_REVIEW'
      ) {
        throw new ConflictException(
          `Cannot approve from status ${publication.status} — it may have already been decided by another reviewer.`,
        );
      }
      const now = new Date();
      await tx.propertyPublicationVersion.update({
        where: { id: publication.latestVersion.id },
        data: {
          status: 'APPROVED',
          reviewedByUserId: actorUserId,
          reviewedAt: now,
        },
      });
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: {
          status: 'PUBLISHED',
          approvedByUserId: actorUserId,
          approvedAt: now,
          publishedAt: now,
          publishedVersionId: publication.latestVersion.id,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.publication_approved',
      targetType: 'PropertyPublication',
      targetId: id,
    });
    await this.audit.log({
      actorUserId,
      action: 'property.published',
      targetType: 'PropertyPublication',
      targetId: id,
    });

    return this.findOneOrThrow(id);
  }

  async reject(
    id: string,
    actorUserId: string,
    reason: string,
  ): Promise<PublicationReviewDetail> {
    await this.withLockedPublication(id, async (tx, publication) => {
      if (
        publication.status !== 'PENDING_REVIEW' ||
        !publication.latestVersion ||
        publication.latestVersion.status !== 'PENDING_REVIEW'
      ) {
        throw new ConflictException(
          `Cannot reject from status ${publication.status} — it may have already been decided by another reviewer.`,
        );
      }
      const now = new Date();
      await tx.propertyPublicationVersion.update({
        where: { id: publication.latestVersion.id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: actorUserId,
          reviewedAt: now,
          reviewReason: reason,
        },
      });
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: {
          status: 'REJECTED',
          rejectedByUserId: actorUserId,
          rejectedAt: now,
          rejectionReason: reason,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.publication_rejected',
      targetType: 'PropertyPublication',
      targetId: id,
      metadata: { reason },
    });

    return this.findOneOrThrow(id);
  }

  async requestChanges(
    id: string,
    actorUserId: string,
    reason: string,
  ): Promise<PublicationReviewDetail> {
    await this.withLockedPublication(id, async (tx, publication) => {
      if (
        publication.status !== 'PENDING_REVIEW' ||
        !publication.latestVersion ||
        publication.latestVersion.status !== 'PENDING_REVIEW'
      ) {
        throw new ConflictException(
          `Cannot request changes from status ${publication.status} — it may have already been decided by another reviewer.`,
        );
      }
      const now = new Date();
      await tx.propertyPublicationVersion.update({
        where: { id: publication.latestVersion.id },
        data: {
          status: 'CHANGES_REQUESTED',
          reviewedByUserId: actorUserId,
          reviewedAt: now,
          reviewReason: reason,
        },
      });
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: {
          status: 'CHANGES_REQUESTED',
          changesRequestedByUserId: actorUserId,
          changesRequestedAt: now,
          changesRequestedReason: reason,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.publication_changes_requested',
      targetType: 'PropertyPublication',
      targetId: id,
      metadata: { reason },
    });

    return this.findOneOrThrow(id);
  }

  async unpublish(
    id: string,
    actorUserId: string,
    reason: string,
  ): Promise<PublicationReviewDetail> {
    await this.withLockedPublication(id, async (tx, publication) => {
      if (publication.status !== 'PUBLISHED') {
        throw new ConflictException(
          `Cannot unpublish from status ${publication.status}.`,
        );
      }
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: {
          status: 'ADMIN_UNPUBLISHED',
          unpublishedAt: new Date(),
          unpublishedByUserId: actorUserId,
          unpublishReason: reason,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.admin_unpublished',
      targetType: 'PropertyPublication',
      targetId: id,
      metadata: { reason },
    });

    return this.findOneOrThrow(id);
  }

  /**
   * Only restores when the underlying property's business status is
   * still eligible (AVAILABLE/RESERVED) — a property that became
   * SOLD/RENTED/ARCHIVED while admin-unpublished must never be silently
   * re-marketed as available. See docs/PERMISSIONS.md "Business-status
   * safety."
   */
  async restore(
    id: string,
    actorUserId: string,
  ): Promise<PublicationReviewDetail> {
    await this.withLockedPublication(id, async (tx, publication) => {
      if (publication.status !== 'ADMIN_UNPUBLISHED') {
        throw new ConflictException(
          `Cannot restore from status ${publication.status}.`,
        );
      }
      const property = await tx.property.findUniqueOrThrow({
        where: { id: publication.propertyId },
        select: { propertyStatus: true },
      });
      if (
        property.propertyStatus !== 'AVAILABLE' &&
        property.propertyStatus !== 'RESERVED'
      ) {
        throw new ConflictException(
          `Cannot restore — the underlying property's business status is now ${property.propertyStatus}.`,
        );
      }
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          unpublishedAt: null,
          unpublishedByUserId: null,
          unpublishReason: null,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.publication_restored',
      targetType: 'PropertyPublication',
      targetId: id,
      metadata: { actor: 'admin' },
    });

    return this.findOneOrThrow(id);
  }
}
