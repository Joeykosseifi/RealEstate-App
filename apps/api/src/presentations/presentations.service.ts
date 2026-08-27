import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PropertyPresentation } from '@prisma/client';
import type {
  Paginated,
  PropertyPresentationDetail,
  PropertyPresentationSummary,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import { buildPresentationStorageKey } from '../storage/local-disk-storage.service';
import type { CreatePresentationDto } from './dto/create-presentation.dto';
import type { UpdatePresentationDto } from './dto/update-presentation.dto';
import type { ListPresentationsQueryDto } from './dto/list-presentations-query.dto';
import {
  toPropertyPresentationDetail,
  toPropertyPresentationSummary,
  type PresentationItemWithProperty,
  type PresentationWithCount,
} from './presentation.mapper';
import {
  PdfGeneratorService,
  type PresentationPdfItemInput,
} from './pdf-generator.service';

const WITH_ITEM_COUNT = {
  _count: { select: { items: true } },
} satisfies Prisma.PropertyPresentationInclude;

const ITEM_WITH_PROPERTY_INCLUDE = {
  property: {
    include: {
      location: { select: { city: true, area: true, country: true } },
      features: { select: { featureKey: true, value: true } },
    },
  },
} satisfies Prisma.PropertyPresentationItemInclude;

/**
 * PDF presentations. Every selected property is verified against
 * `workspaceId` before it can enter a presentation — a property (or
 * client) from another workspace can never appear here, regardless of
 * how it was selected client-side. The generated PDF is always built
 * from `PresentationSafePropertySnapshot` data only (see
 * `toPresentationSafeSnapshot` / `PdfGeneratorService`), never the
 * unrestricted professional property object — owner/commission/private
 * notes/exact coordinates are structurally unreachable from it.
 */
@Injectable()
export class PresentationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pdfGenerator: PdfGeneratorService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async assertClientInWorkspace(
    workspaceId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.clientRecord.findFirst({
      where: { id: clientId, workspaceId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }
  }

  private async assertRequirementInWorkspace(
    workspaceId: string,
    requirementId: string,
    clientId?: string,
  ): Promise<void> {
    const requirement = await this.prisma.clientRequirement.findFirst({
      where: {
        id: requirementId,
        workspaceId,
        ...(clientId ? { clientId } : {}),
      },
      select: { id: true },
    });
    if (!requirement) {
      throw new NotFoundException('Requirement not found.');
    }
  }

  /** Every propertyId must resolve to a property owned by this exact workspace — never trusted from the payload alone. */
  private async assertPropertiesInWorkspace(
    workspaceId: string,
    propertyIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(propertyIds)];
    const count = await this.prisma.property.count({
      where: { id: { in: uniqueIds }, workspaceId },
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more selected properties do not belong to this workspace.',
      );
    }
  }

  async create(
    workspaceId: string,
    actorUserId: string,
    dto: CreatePresentationDto,
  ): Promise<PropertyPresentationDetail> {
    if (dto.clientId) {
      await this.assertClientInWorkspace(workspaceId, dto.clientId);
    }
    if (dto.requirementId) {
      await this.assertRequirementInWorkspace(
        workspaceId,
        dto.requirementId,
        dto.clientId,
      );
    }
    await this.assertPropertiesInWorkspace(
      workspaceId,
      dto.items.map((item) => item.propertyId),
    );

    const presentation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.propertyPresentation.create({
        data: {
          workspaceId,
          createdByUserId: actorUserId,
          clientId: dto.clientId,
          requirementId: dto.requirementId,
          title: dto.title,
        },
      });
      await tx.propertyPresentationItem.createMany({
        data: dto.items.map((item, index) => ({
          presentationId: created.id,
          propertyId: item.propertyId,
          sortOrder: index,
          agentNote: item.agentNote,
        })),
      });
      return tx.propertyPresentation.findUniqueOrThrow({
        where: { id: created.id },
        include: WITH_ITEM_COUNT,
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'presentation.created',
      targetType: 'PropertyPresentation',
      targetId: presentation.id,
      metadata: { workspaceId, itemCount: dto.items.length },
    });

    return this.findOneForRead(workspaceId, presentation.id);
  }

  async findMany(
    workspaceId: string,
    query: ListPresentationsQueryDto,
  ): Promise<Paginated<PropertyPresentationSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const and: Prisma.PropertyPresentationWhereInput[] = [{ workspaceId }];
    if (query.clientId) {
      and.push({ clientId: query.clientId });
    }
    if (query.status) {
      and.push({ status: query.status });
    } else if (!query.includeArchived) {
      and.push({ status: { not: 'ARCHIVED' } });
    }

    const where: Prisma.PropertyPresentationWhereInput = { AND: and };

    const [presentations, totalItems] = await Promise.all([
      this.prisma.propertyPresentation.findMany({
        where,
        include: WITH_ITEM_COUNT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.propertyPresentation.count({ where }),
    ]);

    return {
      items: (presentations as PresentationWithCount[]).map(
        toPropertyPresentationSummary,
      ),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /** 404 for both "doesn't exist" and "belongs to another workspace." */
  async findOneOrThrow(
    workspaceId: string,
    presentationId: string,
  ): Promise<PropertyPresentation> {
    const presentation = await this.prisma.propertyPresentation.findFirst({
      where: { id: presentationId, workspaceId },
    });
    if (!presentation) {
      throw new NotFoundException('Presentation not found.');
    }
    return presentation;
  }

  private async resolvePrimaryImageUrls(
    propertyIds: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    for (const propertyId of propertyIds) {
      const media = await this.prisma.propertyMedia.findFirst({
        where: { propertyId, mediaType: 'IMAGE' },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { storageKey: true },
      });
      map.set(
        propertyId,
        media ? await this.storage.getSignedAccessUrl(media.storageKey) : null,
      );
    }
    return map;
  }

  async findOneForRead(
    workspaceId: string,
    presentationId: string,
  ): Promise<PropertyPresentationDetail> {
    const presentation = await this.prisma.propertyPresentation.findFirst({
      where: { id: presentationId, workspaceId },
      include: WITH_ITEM_COUNT,
    });
    if (!presentation) {
      throw new NotFoundException('Presentation not found.');
    }

    const items = (await this.prisma.propertyPresentationItem.findMany({
      where: { presentationId },
      include: ITEM_WITH_PROPERTY_INCLUDE,
    })) as PresentationItemWithProperty[];

    const primaryImageUrls = await this.resolvePrimaryImageUrls(
      items.map((item) => item.propertyId),
    );

    return toPropertyPresentationDetail(presentation, items, primaryImageUrls);
  }

  /**
   * Editing a `GENERATED` presentation's title/items moves it back to
   * `DRAFT` without touching the still-valid, still-accessible
   * previously generated PDF — see docs/DATABASE.md "Presentation
   * versioning." Only an explicit `POST .../generate` produces a new
   * artifact.
   */
  async update(
    workspaceId: string,
    presentationId: string,
    actorUserId: string,
    dto: UpdatePresentationDto,
  ): Promise<PropertyPresentationDetail> {
    const existing = await this.findOneOrThrow(workspaceId, presentationId);
    if (existing.status === 'ARCHIVED') {
      throw new ConflictException(
        'Restore this presentation before editing it.',
      );
    }

    const clientId = dto.clientId ?? existing.clientId ?? undefined;
    if (dto.clientId) {
      await this.assertClientInWorkspace(workspaceId, dto.clientId);
    }
    if (dto.requirementId) {
      await this.assertRequirementInWorkspace(
        workspaceId,
        dto.requirementId,
        clientId,
      );
    }
    if (dto.items) {
      await this.assertPropertiesInWorkspace(
        workspaceId,
        dto.items.map((item) => item.propertyId),
      );
    }

    const contentChanged = dto.title !== undefined || dto.items !== undefined;

    // Locks the presentation row first, before the items delete+recreate
    // below — without this, two concurrent updates naming overlapping
    // item sets can each observe "no existing rows" for a property they
    // are both about to insert (each transaction's own DELETE hasn't
    // been seen as committed by the other yet under READ COMMITTED),
    // and one of them trips the `(presentationId, propertyId)` unique
    // constraint. Locking first serializes the second update behind the
    // first's commit — the same row-locking technique
    // `PropertyMediaService.reorder` uses for the identical reason.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM property_presentations WHERE id = ${presentationId}::uuid FOR UPDATE`;

      await tx.propertyPresentation.update({
        where: { id: presentationId },
        data: {
          title: dto.title,
          clientId: dto.clientId,
          requirementId: dto.requirementId,
          status:
            contentChanged && existing.status === 'GENERATED'
              ? 'DRAFT'
              : undefined,
        },
      });

      if (dto.items) {
        await tx.propertyPresentationItem.deleteMany({
          where: { presentationId },
        });
        await tx.propertyPresentationItem.createMany({
          data: dto.items.map((item, index) => ({
            presentationId,
            propertyId: item.propertyId,
            sortOrder: index,
            agentNote: item.agentNote,
          })),
        });
      }
    });

    await this.audit.log({
      actorUserId,
      action: 'presentation.updated',
      targetType: 'PropertyPresentation',
      targetId: presentationId,
      metadata: { fieldsChanged: Object.keys(dto) },
    });

    return this.findOneForRead(workspaceId, presentationId);
  }

  /**
   * Versioning: writes a brand new object under a new,
   * generation-timestamped key and repoints `storageKey`/`generatedAt`
   * at it — the previous artifact is left in storage, not deleted or
   * overwritten in place. See docs/DATABASE.md "Presentation
   * versioning."
   */
  async generate(
    workspaceId: string,
    presentationId: string,
    actorUserId: string,
  ): Promise<PropertyPresentationDetail> {
    const presentation = await this.findOneOrThrow(workspaceId, presentationId);
    if (presentation.status === 'ARCHIVED') {
      throw new ConflictException(
        'Restore this presentation before generating a PDF.',
      );
    }

    const items = (await this.prisma.propertyPresentationItem.findMany({
      where: { presentationId },
      include: ITEM_WITH_PROPERTY_INCLUDE,
      orderBy: { sortOrder: 'asc' },
    })) as PresentationItemWithProperty[];
    if (items.length === 0) {
      throw new ConflictException(
        'Add at least one property before generating a PDF.',
      );
    }

    const [workspace, client] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { name: true },
      }),
      presentation.clientId
        ? this.prisma.clientRecord.findUnique({
            where: { id: presentation.clientId },
            select: { firstName: true, lastName: true },
          })
        : Promise.resolve(null),
    ]);

    const pdfItems: PresentationPdfItemInput[] = [];
    for (const item of items) {
      const media = await this.prisma.propertyMedia.findFirst({
        where: { propertyId: item.propertyId, mediaType: 'IMAGE' },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { storageKey: true },
      });
      // A missing or unreadable image must never block generation — see
      // docs/API.md "PDF generation resilience."
      const imageBuffer = media
        ? await this.storage.readObject(media.storageKey).catch(() => null)
        : null;

      pdfItems.push({
        snapshot: {
          id: item.property.id,
          title: item.property.title,
          description: item.property.description,
          propertyType: item.property.propertyType,
          listingPurpose: item.property.listingPurpose,
          price: Number(item.property.price),
          currency: item.property.currency,
          bedrooms: item.property.bedrooms,
          bathrooms: item.property.bathrooms,
          areaSqm: item.property.areaSqm ? Number(item.property.areaSqm) : null,
          propertyStatus: item.property.propertyStatus,
          city: item.property.location?.city ?? null,
          area: item.property.location?.area ?? null,
          country: item.property.location?.country ?? null,
          featureKeys: item.property.features
            .filter((feature) => feature.value)
            .map((feature) => feature.featureKey),
          primaryImageUrl: null,
        },
        agentNote: item.agentNote,
        imageBuffer,
      });
    }

    const generatedAt = new Date();
    const pdfBuffer = await this.pdfGenerator.generate({
      title: presentation.title,
      brandingName: workspace.name,
      clientName: client ? `${client.firstName} ${client.lastName}` : null,
      generatedAt,
      items: pdfItems,
    });

    const storageKey = buildPresentationStorageKey(
      workspaceId,
      presentationId,
      generatedAt,
    );
    await this.storage.putObject(storageKey, pdfBuffer, 'application/pdf');

    await this.prisma.propertyPresentation.update({
      where: { id: presentationId },
      data: { status: 'GENERATED', generatedAt, storageKey },
    });

    await this.audit.log({
      actorUserId,
      action: 'presentation.generated',
      targetType: 'PropertyPresentation',
      targetId: presentationId,
      metadata: { itemCount: items.length },
    });

    return this.findOneForRead(workspaceId, presentationId);
  }

  async getAccessUrl(
    workspaceId: string,
    presentationId: string,
    actorUserId: string,
  ): Promise<string> {
    const presentation = await this.findOneOrThrow(workspaceId, presentationId);
    if (!presentation.storageKey) {
      throw new ConflictException(
        'Generate this presentation before accessing its PDF.',
      );
    }

    await this.audit.log({
      actorUserId,
      action: 'presentation.accessed',
      targetType: 'PropertyPresentation',
      targetId: presentationId,
    });

    return this.storage.getSignedAccessUrl(presentation.storageKey);
  }

  /** Reversible in spirit (the row, its items, and every previously generated artifact are preserved) — there is no restore endpoint since an archived presentation can simply be recreated if still needed. */
  async archive(
    workspaceId: string,
    presentationId: string,
    actorUserId: string,
  ): Promise<void> {
    const presentation = await this.findOneOrThrow(workspaceId, presentationId);
    if (presentation.status === 'ARCHIVED') {
      throw new ConflictException('Presentation is already archived.');
    }

    await this.prisma.propertyPresentation.update({
      where: { id: presentationId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'presentation.archived',
      targetType: 'PropertyPresentation',
      targetId: presentationId,
    });
  }
}
