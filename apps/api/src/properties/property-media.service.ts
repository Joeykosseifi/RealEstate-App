import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import { buildPropertyMediaStorageKey } from '../storage/local-disk-storage.service';
import type { AddPropertyMediaDto } from './dto/add-property-media.dto';
import { toPropertyMediaSummary } from './property.mapper';
import type { PropertyMediaSummary } from '@real-estate/types';

export interface UploadedFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Property media metadata + the local-disk storage provider (see
 * StorageModule). Storage keys are always server-generated and resolved
 * from the DB before any read/delete — a client never supplies or
 * controls a storage key directly, which is what makes "delete cannot
 * remove arbitrary storage keys" true by construction, not by a
 * separate check.
 */
@Injectable()
export class PropertyMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async assertPropertyInWorkspace(
    workspaceId: string,
    propertyId: string,
  ): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, workspaceId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found.');
    }
  }

  /**
   * The storage write happens BEFORE the DB transaction (an id is
   * generated up front so the storage key can be computed early) — this
   * keeps the transaction short (no slow I/O while holding a row lock)
   * at the acceptable cost of a rare orphaned object if the transaction
   * then rolls back, the same tradeoff a real S3 multi-step upload has.
   *
   * The transaction itself locks the parent `Property` row with
   * `SELECT ... FOR UPDATE` before counting existing media — locking a
   * `PropertyMedia` row doesn't work for "am I the first image" because,
   * for the very first upload, no such row exists yet to lock. Without
   * this, two concurrent first-uploads can each observe "zero images
   * exist yet" and both try to become primary, tripping the one-primary
   * partial unique index (found by
   * `apps/api/test/property-concurrency-audit.e2e-spec.ts`).
   */
  async add(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    file: UploadedFileInput,
    dto: AddPropertyMediaDto,
  ): Promise<PropertyMediaSummary> {
    await this.assertPropertyInWorkspace(workspaceId, propertyId);

    const mediaId = randomUUID();
    const storageKey = buildPropertyMediaStorageKey(
      propertyId,
      mediaId,
      file.originalname,
    );
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const media = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${propertyId}::uuid FOR UPDATE`;

      const existingCount = await tx.propertyMedia.count({
        where: { propertyId },
      });
      const existingImageCount = await tx.propertyMedia.count({
        where: { propertyId, mediaType: 'IMAGE' },
      });
      const isFirstImage =
        dto.mediaType === 'IMAGE' && existingImageCount === 0;
      const isPrimary = dto.isPrimary ?? isFirstImage;

      if (isPrimary) {
        // Exactly one primary per property — unset any existing one first
        // (the partial unique index on isPrimary=true would otherwise
        // reject this insert).
        await tx.propertyMedia.updateMany({
          where: { propertyId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.propertyMedia.create({
        data: {
          id: mediaId,
          propertyId,
          mediaType: dto.mediaType,
          storageKey,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          sortOrder: dto.sortOrder ?? existingCount,
          uploadedByUserId: actorUserId,
          isPrimary,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'property.media_added',
      targetType: 'PropertyMedia',
      targetId: media.id,
      metadata: { propertyId, mediaType: media.mediaType },
    });

    return toPropertyMediaSummary(media);
  }

  async getAccessUrl(
    workspaceId: string,
    propertyId: string,
    mediaId: string,
  ): Promise<string> {
    await this.assertPropertyInWorkspace(workspaceId, propertyId);
    const media = await this.prisma.propertyMedia.findFirst({
      where: { id: mediaId, propertyId },
    });
    if (!media) {
      throw new NotFoundException('Media not found.');
    }
    return this.storage.getSignedAccessUrl(media.storageKey);
  }

  async reorder(
    workspaceId: string,
    propertyId: string,
    actorUserId: string,
    mediaIds: string[],
  ): Promise<void> {
    await this.assertPropertyInWorkspace(workspaceId, propertyId);

    const existing = await this.prisma.propertyMedia.findMany({
      where: { propertyId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const requestedIds = new Set(mediaIds);

    if (
      existingIds.size !== requestedIds.size ||
      [...existingIds].some((id) => !requestedIds.has(id))
    ) {
      throw new BadRequestException(
        'mediaIds must list every media item belonging to this property, exactly once.',
      );
    }

    // An interactive transaction that locks every row in one fixed order
    // (sorted by id) before writing, not a batched array of independent
    // per-row updates — two concurrent reorders naming the same media in
    // different orders would otherwise acquire row locks in opposite
    // orders and deadlock (Postgres error 40P01, found by
    // apps/api/test/property-concurrency-audit.e2e-spec.ts). Locking in a
    // single canonical order first means the second transaction simply
    // waits for the first to commit, then proceeds.
    const sortedIds = [...mediaIds].sort();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM property_media WHERE id = ANY(${sortedIds}::uuid[]) ORDER BY id FOR UPDATE`;
      for (const [index, id] of mediaIds.entries()) {
        await tx.propertyMedia.update({
          where: { id },
          data: { sortOrder: index },
        });
      }
    });

    await this.audit.log({
      actorUserId,
      action: 'property.media_reordered',
      targetType: 'Property',
      targetId: propertyId,
    });
  }

  /** Resolves the storage key from the DB — never from client input — before deleting the object. */
  async remove(
    workspaceId: string,
    propertyId: string,
    mediaId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.assertPropertyInWorkspace(workspaceId, propertyId);

    const media = await this.prisma.propertyMedia.findFirst({
      where: { id: mediaId, propertyId },
    });
    if (!media) {
      throw new NotFoundException('Media not found.');
    }

    await this.prisma.propertyMedia.delete({ where: { id: mediaId } });
    await this.storage.deleteObject(media.storageKey);

    await this.audit.log({
      actorUserId,
      action: 'property.media_removed',
      targetType: 'Property',
      targetId: propertyId,
      metadata: { mediaId, mediaType: media.mediaType },
    });
  }
}
