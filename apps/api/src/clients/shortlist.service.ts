import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ClientPropertyShortlistItem } from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import type { AddShortlistItemDto } from './dto/add-shortlist-item.dto';
import {
  toClientPropertyShortlistItem,
  type ShortlistItemWithProperty,
} from './client.mapper';

const SHORTLIST_INCLUDE = {
  property: { include: { location: { select: { city: true, area: true } } } },
} satisfies Prisma.ClientPropertyShortlistInclude;

/**
 * A property can only ever be shortlisted for a client in the SAME
 * workspace as the property itself — a Confidence client can never
 * shortlist a Joey-Personal-Workspace property, in Milestone 4 or any
 * later one, since both the client and the property are independently
 * re-verified against `workspaceId` before the insert.
 */
@Injectable()
export class ShortlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  async add(
    workspaceId: string,
    clientId: string,
    actorUserId: string,
    permissions: Set<string>,
    dto: AddShortlistItemDto,
  ): Promise<ClientPropertyShortlistItem> {
    if (!permissions.has(PERMISSIONS.PROPERTY_VIEW.key)) {
      throw new ForbiddenException(
        `Missing required permission: ${PERMISSIONS.PROPERTY_VIEW.key}`,
      );
    }
    await this.assertClientInWorkspace(workspaceId, clientId);

    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, workspaceId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    if (dto.requirementId) {
      const requirement = await this.prisma.clientRequirement.findFirst({
        where: { id: dto.requirementId, clientId, workspaceId },
        select: { id: true },
      });
      if (!requirement) {
        throw new NotFoundException('Requirement not found.');
      }
    }

    let item: ShortlistItemWithProperty;
    try {
      item = await this.prisma.clientPropertyShortlist.create({
        data: {
          workspaceId,
          clientId,
          requirementId: dto.requirementId,
          propertyId: dto.propertyId,
          addedByUserId: actorUserId,
          note: dto.note,
        },
        include: SHORTLIST_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This property is already shortlisted for this client.',
        );
      }
      throw error;
    }

    await this.audit.log({
      actorUserId,
      action: 'client.property_shortlisted',
      targetType: 'ClientPropertyShortlist',
      targetId: item.id,
      metadata: { clientId, propertyId: dto.propertyId },
    });

    return toClientPropertyShortlistItem(item);
  }

  async list(
    workspaceId: string,
    clientId: string,
  ): Promise<ClientPropertyShortlistItem[]> {
    await this.assertClientInWorkspace(workspaceId, clientId);
    const items = await this.prisma.clientPropertyShortlist.findMany({
      where: { clientId, workspaceId },
      include: SHORTLIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return (items as ShortlistItemWithProperty[]).map(
      toClientPropertyShortlistItem,
    );
  }

  /** Removing a shortlist entry only ever removes that one row — the client, property, and every other relationship are untouched. */
  async remove(
    workspaceId: string,
    clientId: string,
    shortlistId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.assertClientInWorkspace(workspaceId, clientId);
    const item = await this.prisma.clientPropertyShortlist.findFirst({
      where: { id: shortlistId, clientId, workspaceId },
    });
    if (!item) {
      throw new NotFoundException('Shortlist entry not found.');
    }

    await this.prisma.clientPropertyShortlist.delete({
      where: { id: shortlistId },
    });

    await this.audit.log({
      actorUserId,
      action: 'client.property_removed_from_shortlist',
      targetType: 'ClientPropertyShortlist',
      targetId: shortlistId,
      metadata: { clientId, propertyId: item.propertyId },
    });
  }
}
