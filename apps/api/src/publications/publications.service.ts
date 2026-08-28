import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PublicationDetail } from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import {
  toPublicationDetail,
  type PublicationWithVersions,
} from './publication.mapper';
import type { SavePublicationDraftDto } from './dto/save-publication-draft.dto';

const VERSION_WITH_MEDIA_INCLUDE = {
  media: { include: { propertyMedia: true } },
} satisfies Prisma.PropertyPublicationVersionInclude;

const PUBLICATION_INCLUDE = {
  latestVersion: { include: VERSION_WITH_MEDIA_INCLUDE },
  publishedVersion: { include: VERSION_WITH_MEDIA_INCLUDE },
  versions: true,
} satisfies Prisma.PropertyPublicationInclude;

/**
 * Statuses in which the *latest version's fields* may still be edited in
 * place — DRAFT (never submitted) or CHANGES_REQUESTED/REJECTED (a
 * decision was made, so editing must start a NEW version — see
 * `startNewVersionIfNeeded`). PENDING_REVIEW is deliberately absent: the
 * submitted snapshot must be immutable while under review (see
 * docs/PERMISSIONS.md "Publication snapshot").
 */
const EDITABLE_IN_PLACE: readonly string[] = ['DRAFT'];
const REQUIRES_NEW_VERSION: readonly string[] = [
  'CHANGES_REQUESTED',
  'REJECTED',
  'APPROVED',
];

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async resolveMediaUrls(
    publication: PublicationWithVersions,
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

  private async toDetail(
    publication: PublicationWithVersions,
  ): Promise<PublicationDetail> {
    const mediaUrls = await this.resolveMediaUrls(publication);
    return toPublicationDetail(publication, mediaUrls);
  }

  /** 404 for both "no property" and "not this workspace's" — never distinguishable, matching PropertiesService. */
  private async findPropertyOrThrow(workspaceId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, workspaceId },
      include: { location: true, media: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found.');
    }
    return property;
  }

  async findPublicationOrThrow(
    workspaceId: string,
    propertyId: string,
  ): Promise<PublicationWithVersions | null> {
    await this.findPropertyOrThrow(workspaceId, propertyId);
    return this.prisma.propertyPublication.findFirst({
      where: { propertyId, workspaceId },
      include: PUBLICATION_INCLUDE,
    });
  }

  /** Returns `null` when no publication row exists — that absence IS the PRIVATE state (see schema.prisma doc comment). */
  async getDetail(
    workspaceId: string,
    propertyId: string,
  ): Promise<PublicationDetail | null> {
    const publication = await this.findPublicationOrThrow(
      workspaceId,
      propertyId,
    );
    return publication ? this.toDetail(publication) : null;
  }

  private buildVersionData(
    dto: SavePublicationDraftDto,
    validImageMediaIds: Set<string>,
  ): Omit<
    Prisma.PropertyPublicationVersionCreateInput,
    'publication' | 'versionNumber' | 'status'
  > {
    const visibility = dto.locationVisibility ?? 'PRIVATE';
    const media = dto.media ?? [];

    for (const item of media) {
      if (!validImageMediaIds.has(item.propertyMediaId)) {
        throw new BadRequestException(
          `Media ${item.propertyMediaId} is not a valid IMAGE belonging to this property.`,
        );
      }
    }

    return {
      publicTitle: dto.publicTitle,
      publicDescription: dto.publicDescription ?? null,
      publicPrice: dto.publicPrice,
      currency: dto.currency.toUpperCase(),
      propertyType: dto.propertyType,
      listingPurpose: dto.listingPurpose,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      areaSqm: dto.areaSqm ?? null,
      publicFeatureKeys: dto.publicFeatureKeys ?? [],
      locationVisibility: visibility,
      publicCountry:
        visibility === 'PRIVATE' || visibility === 'WORKSPACE'
          ? null
          : (dto.publicCountry ?? null),
      publicCity:
        visibility === 'PRIVATE' || visibility === 'WORKSPACE'
          ? null
          : (dto.publicCity ?? null),
      publicArea:
        visibility === 'PRIVATE' || visibility === 'WORKSPACE'
          ? null
          : (dto.publicArea ?? null),
      // Only PUBLIC_EXACT may ever carry coordinates — see
      // docs/PERMISSIONS.md "Public location rules". Never silently
      // populated from the property's private saved pin.
      publicLatitude: null,
      publicLongitude: null,
    };
  }

  /**
   * `PUT .../publication` — creates the publication (and its first
   * DRAFT version) on first call, otherwise edits the current editable
   * version in place or starts a new one (see `REQUIRES_NEW_VERSION`).
   * Never touches the private `Property` row.
   */
  async saveDraft(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    dto: SavePublicationDraftDto,
  ): Promise<PublicationDetail> {
    const property = await this.findPropertyOrThrow(workspaceId, propertyId);
    if (property.propertyStatus === 'ARCHIVED') {
      throw new ConflictException(
        'An archived property cannot be prepared for publication.',
      );
    }

    // PUBLIC_EXACT may only be selected when the property actually has a
    // saved location — otherwise there is nothing to expose, and we
    // never fabricate coordinates.
    if (dto.locationVisibility === 'PUBLIC_EXACT' && !property.location) {
      throw new BadRequestException(
        'This property has no saved location — set one before choosing PUBLIC_EXACT visibility.',
      );
    }

    const validImageMediaIds = new Set(
      property.media.filter((m) => m.mediaType === 'IMAGE').map((m) => m.id),
    );

    const existing = await this.prisma.propertyPublication.findUnique({
      where: { propertyId },
      include: PUBLICATION_INCLUDE,
    });

    const versionData = this.buildVersionData(dto, validImageMediaIds);
    // Fill exact coordinates only now that validation above passed.
    if (dto.locationVisibility === 'PUBLIC_EXACT' && property.location) {
      versionData.publicLatitude = property.location.latitude;
      versionData.publicLongitude = property.location.longitude;
    }
    const mediaSelections = (dto.media ?? []).map((item, index) => ({
      propertyMediaId: item.propertyMediaId,
      sortOrder: index,
      isMain: item.isMain ?? index === 0,
    }));

    const publication = await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        const created = await tx.propertyPublication.create({
          data: {
            propertyId,
            workspaceId,
            status: 'DRAFT',
          },
        });
        const version = await tx.propertyPublicationVersion.create({
          data: {
            publicationId: created.id,
            versionNumber: 1,
            status: 'DRAFT',
            ...versionData,
            media: { create: mediaSelections },
          },
        });
        await tx.propertyPublication.update({
          where: { id: created.id },
          data: { latestVersionId: version.id },
        });
        await this.audit.log({
          actorUserId,
          action: 'property.publication_draft_created',
          targetType: 'PropertyPublication',
          targetId: created.id,
          metadata: { propertyId, workspaceId },
        });
        return tx.propertyPublication.findUniqueOrThrow({
          where: { id: created.id },
          include: PUBLICATION_INCLUDE,
        });
      }

      const currentVersion = existing.latestVersion;
      if (!currentVersion) {
        throw new Error(
          'Publication is missing latestVersion — invariant violation.',
        );
      }

      if (EDITABLE_IN_PLACE.includes(currentVersion.status)) {
        await tx.propertyPublicationMedia.deleteMany({
          where: { versionId: currentVersion.id },
        });
        await tx.propertyPublicationVersion.update({
          where: { id: currentVersion.id },
          data: {
            ...versionData,
            media: { create: mediaSelections },
          },
        });
      } else if (REQUIRES_NEW_VERSION.includes(currentVersion.status)) {
        const newVersion = await tx.propertyPublicationVersion.create({
          data: {
            publicationId: existing.id,
            versionNumber: currentVersion.versionNumber + 1,
            status: 'DRAFT',
            ...versionData,
            media: { create: mediaSelections },
          },
        });
        await tx.propertyPublication.update({
          where: { id: existing.id },
          data: { latestVersionId: newVersion.id, status: 'DRAFT' },
        });
      } else {
        // PENDING_REVIEW — immutable while under review.
        throw new ConflictException(
          'This publication is pending admin review and cannot be edited. Cancel the submission first.',
        );
      }

      await this.audit.log({
        actorUserId,
        action: 'property.publication_updated',
        targetType: 'PropertyPublication',
        targetId: existing.id,
        metadata: { propertyId, workspaceId },
      });

      return tx.propertyPublication.findUniqueOrThrow({
        where: { id: existing.id },
        include: PUBLICATION_INCLUDE,
      });
    });

    return this.toDetail(publication);
  }

  private assertSubmissionEligible(
    property: Awaited<ReturnType<PublicationsService['findPropertyOrThrow']>>,
    version: NonNullable<PublicationWithVersions['latestVersion']>,
  ): void {
    if (property.propertyStatus !== 'AVAILABLE') {
      throw new ConflictException(
        `Only an AVAILABLE property may be submitted for publication (current status: ${property.propertyStatus}).`,
      );
    }
    if (!version.publicTitle || version.publicTitle.trim().length === 0) {
      throw new BadRequestException(
        'A public title is required before submission.',
      );
    }
    if (Number(version.publicPrice) <= 0) {
      throw new BadRequestException(
        'A valid public price is required before submission.',
      );
    }
    if (version.media.length === 0) {
      throw new BadRequestException(
        'At least one public image must be selected before submission.',
      );
    }
    if (
      version.locationVisibility !== 'PRIVATE' &&
      version.locationVisibility !== 'WORKSPACE' &&
      !version.publicCity
    ) {
      throw new BadRequestException(
        'A public city is required when the location is publicly visible.',
      );
    }
  }

  /**
   * Transactionally: verify eligibility, freeze the current draft
   * version (immutable from here on), set PENDING_REVIEW, record
   * submitter/timestamp, audit. See docs/PERMISSIONS.md "Publication
   * eligibility."
   */
  async submit(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
  ): Promise<PublicationDetail> {
    const property = await this.findPropertyOrThrow(workspaceId, propertyId);
    const publication = await this.prisma.propertyPublication.findUnique({
      where: { propertyId },
      include: PUBLICATION_INCLUDE,
    });
    if (!publication || !publication.latestVersion) {
      throw new NotFoundException(
        'No publication draft exists for this property yet.',
      );
    }
    if (publication.latestVersion.status !== 'DRAFT') {
      throw new ConflictException(
        `Cannot submit from status ${publication.latestVersion.status}.`,
      );
    }

    this.assertSubmissionEligible(property, publication.latestVersion);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.propertyPublicationVersion.update({
        where: { id: publication.latestVersion!.id },
        data: {
          status: 'PENDING_REVIEW',
          submittedByUserId: actorUserId,
          submittedAt: now,
        },
      });
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: {
          status: 'PENDING_REVIEW',
          submittedByUserId: actorUserId,
          submittedAt: now,
        },
      });
      return tx.propertyPublication.findUniqueOrThrow({
        where: { id: publication.id },
        include: PUBLICATION_INCLUDE,
      });
    });

    await this.audit.log({
      actorUserId,
      // A resubmission (version > 1 — i.e. following changes-requested or
      // rejected) is audited distinctly from a first-ever submission, per
      // docs/SECURITY.md "Publication audit events."
      action:
        publication.latestVersion.versionNumber > 1
          ? 'property.publication_resubmitted'
          : 'property.publication_submitted',
      targetType: 'PropertyPublication',
      targetId: publication.id,
      metadata: {
        propertyId,
        workspaceId,
        versionNumber: publication.latestVersion.versionNumber,
      },
    });

    return this.toDetail(updated);
  }

  /**
   * Professional-initiated withdrawal from review — reverts the SAME
   * version back to DRAFT (nothing was decided yet, so no new version
   * number is needed). See docs/PERMISSIONS.md "Editing while pending."
   */
  async cancelSubmission(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
  ): Promise<PublicationDetail> {
    await this.findPropertyOrThrow(workspaceId, propertyId);
    const publication = await this.prisma.propertyPublication.findUnique({
      where: { propertyId },
      include: PUBLICATION_INCLUDE,
    });
    if (!publication || !publication.latestVersion) {
      throw new NotFoundException('No publication exists for this property.');
    }
    if (publication.latestVersion.status !== 'PENDING_REVIEW') {
      throw new ConflictException(
        'Only a pending submission can be cancelled.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.propertyPublicationVersion.update({
        where: { id: publication.latestVersion!.id },
        data: { status: 'DRAFT', submittedByUserId: null, submittedAt: null },
      });
      await tx.propertyPublication.update({
        where: { id: publication.id },
        data: { status: 'DRAFT' },
      });
      return tx.propertyPublication.findUniqueOrThrow({
        where: { id: publication.id },
        include: PUBLICATION_INCLUDE,
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.publication_updated',
      targetType: 'PropertyPublication',
      targetId: publication.id,
      metadata: { propertyId, workspaceId, action: 'cancel_submission' },
    });

    return this.toDetail(updated);
  }

  /** Professional-initiated unpublish of their own live listing. Property stays fully intact and private-database-visible. */
  async unpublish(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
  ): Promise<PublicationDetail> {
    await this.findPropertyOrThrow(workspaceId, propertyId);
    const publication = await this.prisma.propertyPublication.findUnique({
      where: { propertyId },
      include: PUBLICATION_INCLUDE,
    });
    if (!publication) {
      throw new NotFoundException('No publication exists for this property.');
    }
    if (publication.status !== 'PUBLISHED') {
      throw new ConflictException(
        'Only a published listing can be unpublished.',
      );
    }

    const updated = await this.prisma.propertyPublication.update({
      where: { id: publication.id },
      data: {
        status: 'OWNER_UNPUBLISHED',
        unpublishedAt: new Date(),
        unpublishedByUserId: actorUserId,
        unpublishReason: null,
      },
      include: PUBLICATION_INCLUDE,
    });

    await this.audit.log({
      actorUserId,
      action: 'property.owner_unpublished',
      targetType: 'PropertyPublication',
      targetId: publication.id,
      metadata: { propertyId, workspaceId },
    });

    return this.toDetail(updated);
  }

  /**
   * Deliberate, minimal addition beyond the spec's literal endpoint list
   * (see docs/PERMISSIONS.md "Owner republish"): reverses an
   * OWNER_UNPUBLISHED listing back to PUBLISHED without a new admin
   * review, since the content is byte-for-byte the same previously
   * approved snapshot — only re-checked against current business-status
   * eligibility, exactly like admin `restore()`.
   */
  async republish(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
  ): Promise<PublicationDetail> {
    const property = await this.findPropertyOrThrow(workspaceId, propertyId);
    const publication = await this.prisma.propertyPublication.findUnique({
      where: { propertyId },
      include: PUBLICATION_INCLUDE,
    });
    if (!publication || !publication.publishedVersionId) {
      throw new NotFoundException('No previously published version exists.');
    }
    if (publication.status !== 'OWNER_UNPUBLISHED') {
      throw new ConflictException(
        'Only an owner-unpublished listing can be republished.',
      );
    }
    if (
      property.propertyStatus !== 'AVAILABLE' &&
      property.propertyStatus !== 'RESERVED'
    ) {
      throw new ConflictException(
        `Cannot republish while the property's business status is ${property.propertyStatus}.`,
      );
    }

    const updated = await this.prisma.propertyPublication.update({
      where: { id: publication.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        unpublishedAt: null,
        unpublishedByUserId: null,
        unpublishReason: null,
      },
      include: PUBLICATION_INCLUDE,
    });

    await this.audit.log({
      actorUserId,
      action: 'property.publication_restored',
      targetType: 'PropertyPublication',
      targetId: publication.id,
      metadata: { propertyId, workspaceId, actor: 'owner' },
    });

    return this.toDetail(updated);
  }
}
