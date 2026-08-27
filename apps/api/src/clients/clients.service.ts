import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClientRecord, Prisma } from '@prisma/client';
import type {
  ClientDetail,
  ClientListItem,
  Paginated,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto';
import type { AssignClientDto } from './dto/assign-client.dto';
import {
  toClientDetail,
  toClientListItem,
  type ClientRecordWithCount,
} from './client.mapper';

const WITH_REQUIREMENT_COUNT = {
  _count: {
    select: { requirements: { where: { status: { not: 'ARCHIVED' } } } },
  },
} satisfies Prisma.ClientRecordInclude;

const SHORTLIST_INCLUDE = {
  property: { include: { location: { select: { city: true, area: true } } } },
} satisfies Prisma.ClientPropertyShortlistInclude;

/**
 * `ClientRecord` is workspace-owned CRM data about a professional's own
 * customer — NOT a platform `User` account (`AccountType.CLIENT`). Most
 * CRM clients never register at all; `platformUserId` is a reserved,
 * unenforced link for a future milestone. See docs/PRODUCT.md "CRM
 * client vs. platform client."
 *
 * Ownership/authorization follow the exact Property precedent:
 * `workspaceId` is the immutable business owner (server-derived, never
 * trusted from the request body), `createdByUserId` is the author.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Assignment target must be an ACTIVE member of the SAME workspace — never trusted from a stale reference alone. Assigning grants no additional workspace permissions. */
  private async assertValidAssignmentTarget(
    workspaceId: string,
    assignedToUserId: string,
  ): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assignedToUserId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ConflictException(
        'assignedToUserId must be an active member of this workspace.',
      );
    }
  }

  async create(
    workspaceId: string,
    actorUserId: string,
    permissions: Set<string>,
    dto: CreateClientDto,
  ): Promise<ClientListItem> {
    if (
      dto.assignedToUserId !== undefined &&
      !permissions.has(PERMISSIONS.CLIENT_ASSIGN.key)
    ) {
      throw new ForbiddenException(
        `Missing required permission: ${PERMISSIONS.CLIENT_ASSIGN.key}`,
      );
    }
    if (dto.assignedToUserId) {
      await this.assertValidAssignmentTarget(workspaceId, dto.assignedToUserId);
    }

    const client = await this.prisma.clientRecord.create({
      data: {
        workspaceId,
        createdByUserId: actorUserId,
        assignedToUserId: dto.assignedToUserId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        whatsappPhone: dto.whatsappPhone,
        email: dto.email,
        preferredContactMethod: dto.preferredContactMethod,
        source: dto.source,
        notes: dto.notes,
      },
      include: WITH_REQUIREMENT_COUNT,
    });

    await this.audit.log({
      actorUserId,
      action: 'client.created',
      targetType: 'ClientRecord',
      targetId: client.id,
      metadata: { workspaceId },
    });

    return toClientListItem(client);
  }

  async findMany(
    workspaceId: string,
    query: ListClientsQueryDto,
  ): Promise<Paginated<ClientListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const and: Prisma.ClientRecordWhereInput[] = [{ workspaceId }];

    if (query.status) {
      and.push({ status: query.status });
    } else if (!query.includeArchived) {
      and.push({ status: { not: 'ARCHIVED' } });
    }
    if (query.source) {
      and.push({ source: query.source });
    }
    if (query.assignedToUserId) {
      and.push({ assignedToUserId: query.assignedToUserId });
    }
    if (query.createdByUserId) {
      and.push({ createdByUserId: query.createdByUserId });
    }
    if (query.createdFrom) {
      and.push({ createdAt: { gte: new Date(query.createdFrom) } });
    }
    if (query.createdTo) {
      and.push({ createdAt: { lte: new Date(query.createdTo) } });
    }
    if (query.search) {
      const term = query.search.trim();
      and.push({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { whatsappPhone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ClientRecordWhereInput = { AND: and };

    const [clients, totalItems] = await Promise.all([
      this.prisma.clientRecord.findMany({
        where,
        include: WITH_REQUIREMENT_COUNT,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.clientRecord.count({ where }),
    ]);

    return {
      items: (clients as ClientRecordWithCount[]).map(toClientListItem),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /** 404 for both "doesn't exist" and "belongs to another workspace" — same precedent as PropertiesService.findOneOrThrow. */
  async findOneOrThrow(
    workspaceId: string,
    clientId: string,
  ): Promise<ClientRecord> {
    const client = await this.prisma.clientRecord.findFirst({
      where: { id: clientId, workspaceId },
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }
    return client;
  }

  async findOneForRead(
    workspaceId: string,
    clientId: string,
  ): Promise<ClientDetail> {
    const client = await this.prisma.clientRecord.findFirst({
      where: { id: clientId, workspaceId },
      include: WITH_REQUIREMENT_COUNT,
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    const [requirements, shortlist, presentationCount] = await Promise.all([
      this.prisma.clientRequirement.findMany({
        where: { clientId, status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clientPropertyShortlist.findMany({
        where: { clientId },
        include: SHORTLIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.propertyPresentation.count({
        where: { clientId, status: { not: 'ARCHIVED' } },
      }),
    ]);

    return toClientDetail(client, requirements, shortlist, presentationCount);
  }

  async update(
    workspaceId: string,
    clientId: string,
    actorUserId: string,
    dto: UpdateClientDto,
  ): Promise<ClientListItem> {
    const existing = await this.findOneOrThrow(workspaceId, clientId);
    if (existing.status === 'ARCHIVED') {
      throw new ConflictException('Restore this client before editing it.');
    }

    const client = await this.prisma.clientRecord.update({
      where: { id: clientId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        whatsappPhone: dto.whatsappPhone,
        email: dto.email,
        preferredContactMethod: dto.preferredContactMethod,
        source: dto.source,
        notes: dto.notes,
        status: dto.status,
      },
      include: WITH_REQUIREMENT_COUNT,
    });

    await this.audit.log({
      actorUserId,
      action: 'client.updated',
      targetType: 'ClientRecord',
      targetId: clientId,
      metadata: { fieldsChanged: Object.keys(dto) },
    });

    return toClientListItem(client);
  }

  async assign(
    workspaceId: string,
    clientId: string,
    actorUserId: string,
    dto: AssignClientDto,
  ): Promise<ClientListItem> {
    const existing = await this.findOneOrThrow(workspaceId, clientId);
    if (existing.status === 'ARCHIVED') {
      throw new ConflictException('Restore this client before reassigning it.');
    }
    if (dto.assignedToUserId) {
      await this.assertValidAssignmentTarget(workspaceId, dto.assignedToUserId);
    }

    const client = await this.prisma.clientRecord.update({
      where: { id: clientId },
      data: { assignedToUserId: dto.assignedToUserId },
      include: WITH_REQUIREMENT_COUNT,
    });

    await this.audit.log({
      actorUserId,
      action: 'client.assigned',
      targetType: 'ClientRecord',
      targetId: clientId,
      metadata: { assignedToUserId: dto.assignedToUserId },
    });

    return toClientListItem(client);
  }

  /** Reversible — see `restore()`. Never deletes the row or any related requirement/shortlist/presentation. */
  async archive(
    workspaceId: string,
    clientId: string,
    actorUserId: string,
  ): Promise<void> {
    const client = await this.findOneOrThrow(workspaceId, clientId);
    if (client.status === 'ARCHIVED') {
      throw new ConflictException('Client is already archived.');
    }

    await this.prisma.clientRecord.update({
      where: { id: clientId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'client.archived',
      targetType: 'ClientRecord',
      targetId: clientId,
      metadata: { previousStatus: client.status },
    });
  }

  /**
   * Always restores to INACTIVE, never back to its prior status —
   * mirrors Property.restore()'s fixed-default convention exactly: an
   * agent consciously reactivates a restored client's lifecycle rather
   * than it silently reappearing as LEAD/ACTIVE. See
   * docs/PERMISSIONS.md "Client restore behavior."
   */
  async restore(
    workspaceId: string,
    clientId: string,
    actorUserId: string,
  ): Promise<void> {
    const client = await this.findOneOrThrow(workspaceId, clientId);
    if (client.status !== 'ARCHIVED') {
      throw new ConflictException('Only an archived client can be restored.');
    }

    await this.prisma.clientRecord.update({
      where: { id: clientId },
      data: { status: 'INACTIVE', archivedAt: null, archivedByUserId: null },
    });

    await this.audit.log({
      actorUserId,
      action: 'client.restored',
      targetType: 'ClientRecord',
      targetId: clientId,
    });
  }
}
