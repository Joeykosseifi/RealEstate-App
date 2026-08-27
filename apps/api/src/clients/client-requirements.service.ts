import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClientRequirement, PropertyType } from '@prisma/client';
import type { ClientRequirementDetail } from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  assertValidBounds,
  type CreateClientRequirementDto,
} from './dto/create-client-requirement.dto';
import type { UpdateClientRequirementDto } from './dto/update-client-requirement.dto';
import { toClientRequirementDetail } from './client.mapper';

/**
 * A client may have any number of requirements at once (an apartment to
 * buy AND land to invest in, say) — never restricted to one. Every
 * write here re-verifies the client belongs to the calling workspace
 * first (`ClientsService.findOneOrThrow`'s exact 404-not-403
 * precedent), so a requirement can never end up attached to another
 * workspace's client. `workspaceId`/`createdByUserId` are denormalized
 * onto the requirement at creation and never accepted from a payload.
 */
@Injectable()
export class ClientRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Also confirms the client belongs to this workspace — 404 either way. */
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

  async create(
    workspaceId: string,
    clientId: string,
    actorUserId: string,
    dto: CreateClientRequirementDto,
  ): Promise<ClientRequirementDetail> {
    await this.assertClientInWorkspace(workspaceId, clientId);
    const boundsError = assertValidBounds(dto);
    if (boundsError) {
      throw new BadRequestException(boundsError);
    }

    const requirement = await this.prisma.clientRequirement.create({
      data: {
        clientId,
        workspaceId,
        createdByUserId: actorUserId,
        title: dto.title,
        listingPurpose: dto.listingPurpose,
        propertyTypes: (dto.propertyTypes ?? []) as PropertyType[],
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        currency: dto.currency?.toUpperCase(),
        minBedrooms: dto.minBedrooms,
        maxBedrooms: dto.maxBedrooms,
        minBathrooms: dto.minBathrooms,
        minAreaSqm: dto.minAreaSqm,
        maxAreaSqm: dto.maxAreaSqm,
        countries: dto.countries ?? [],
        cities: dto.cities ?? [],
        areas: dto.areas ?? [],
        requiredFeatures: dto.requiredFeatures ?? [],
        preferredFeatures: dto.preferredFeatures ?? [],
        notes: dto.notes,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'client.requirement_created',
      targetType: 'ClientRequirement',
      targetId: requirement.id,
      metadata: { clientId, workspaceId },
    });

    return toClientRequirementDetail(requirement);
  }

  async findMany(
    workspaceId: string,
    clientId: string,
    includeArchived: boolean,
  ): Promise<ClientRequirementDetail[]> {
    await this.assertClientInWorkspace(workspaceId, clientId);
    const requirements = await this.prisma.clientRequirement.findMany({
      where: {
        clientId,
        workspaceId,
        ...(includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return requirements.map(toClientRequirementDetail);
  }

  /** 404 for "doesn't exist," "belongs to another client," or "client belongs to another workspace" alike. */
  async findOneOrThrow(
    workspaceId: string,
    clientId: string,
    requirementId: string,
  ): Promise<ClientRequirement> {
    const requirement = await this.prisma.clientRequirement.findFirst({
      where: { id: requirementId, clientId, workspaceId },
    });
    if (!requirement) {
      throw new NotFoundException('Requirement not found.');
    }
    return requirement;
  }

  async update(
    workspaceId: string,
    clientId: string,
    requirementId: string,
    actorUserId: string,
    dto: UpdateClientRequirementDto,
  ): Promise<ClientRequirementDetail> {
    const existing = await this.findOneOrThrow(
      workspaceId,
      clientId,
      requirementId,
    );
    if (existing.status === 'ARCHIVED') {
      throw new ConflictException('This requirement is archived.');
    }

    const decimalToNumber = (
      value: { toNumber(): number } | null,
    ): number | undefined => (value ? value.toNumber() : undefined);

    const merged = {
      minPrice: dto.minPrice ?? decimalToNumber(existing.minPrice),
      maxPrice: dto.maxPrice ?? decimalToNumber(existing.maxPrice),
      minBedrooms: dto.minBedrooms ?? existing.minBedrooms ?? undefined,
      maxBedrooms: dto.maxBedrooms ?? existing.maxBedrooms ?? undefined,
      minAreaSqm: dto.minAreaSqm ?? decimalToNumber(existing.minAreaSqm),
      maxAreaSqm: dto.maxAreaSqm ?? decimalToNumber(existing.maxAreaSqm),
      currency: dto.currency ?? existing.currency ?? undefined,
    };
    const boundsError = assertValidBounds(merged);
    if (boundsError) {
      throw new BadRequestException(boundsError);
    }

    const requirement = await this.prisma.clientRequirement.update({
      where: { id: requirementId },
      data: {
        title: dto.title,
        listingPurpose: dto.listingPurpose,
        propertyTypes: dto.propertyTypes as PropertyType[] | undefined,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        currency: dto.currency?.toUpperCase(),
        minBedrooms: dto.minBedrooms,
        maxBedrooms: dto.maxBedrooms,
        minBathrooms: dto.minBathrooms,
        minAreaSqm: dto.minAreaSqm,
        maxAreaSqm: dto.maxAreaSqm,
        countries: dto.countries,
        cities: dto.cities,
        areas: dto.areas,
        requiredFeatures: dto.requiredFeatures,
        preferredFeatures: dto.preferredFeatures,
        notes: dto.notes,
        status: dto.status,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'client.requirement_updated',
      targetType: 'ClientRequirement',
      targetId: requirementId,
      metadata: { fieldsChanged: Object.keys(dto) },
    });

    return toClientRequirementDetail(requirement);
  }

  /** Reversible in spirit (the row is never deleted), but there is no un-archive endpoint for a requirement — a fresh requirement is created instead, same as how a fulfilled search naturally becomes a new one. */
  async archive(
    workspaceId: string,
    clientId: string,
    requirementId: string,
    actorUserId: string,
  ): Promise<void> {
    const requirement = await this.findOneOrThrow(
      workspaceId,
      clientId,
      requirementId,
    );
    if (requirement.status === 'ARCHIVED') {
      throw new ConflictException('Requirement is already archived.');
    }

    await this.prisma.clientRequirement.update({
      where: { id: requirementId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'client.requirement_archived',
      targetType: 'ClientRequirement',
      targetId: requirementId,
    });
  }
}
