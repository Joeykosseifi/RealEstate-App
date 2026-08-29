import { Injectable } from '@nestjs/common';
import type {
  PropertyBusinessStatus,
  WorkspaceDashboard,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { ClientsService } from '../clients/clients.service';

const BUSINESS_STATUSES: PropertyBusinessStatus[] = [
  'AVAILABLE',
  'RESERVED',
  'SOLD',
  'RENTED',
  'OFF_MARKET',
];

/**
 * Real-data-only workspace dashboard aggregate — see
 * docs/PRODUCT.md "Professional dashboard". Never fabricates a number:
 * every count is a live query scoped to the caller's already-authorized
 * workspace, and a section is omitted entirely (not zeroed) when the
 * caller lacks the corresponding view permission — same DTO-omission
 * policy as the property/client detail endpoints.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly properties: PropertiesService,
    private readonly clients: ClientsService,
  ) {}

  async build(
    workspaceId: string,
    permissions: ReadonlySet<string>,
  ): Promise<WorkspaceDashboard> {
    const [propertiesSection, clientsSection] = await Promise.all([
      permissions.has('property.view')
        ? this.buildProperties(workspaceId)
        : Promise.resolve(undefined),
      permissions.has('client.view')
        ? this.buildClients(workspaceId)
        : Promise.resolve(undefined),
    ]);

    return {
      ...(propertiesSection ? { properties: propertiesSection } : {}),
      ...(clientsSection ? { clients: clientsSection } : {}),
    };
  }

  private async buildProperties(
    workspaceId: string,
  ): Promise<WorkspaceDashboard['properties']> {
    const [statusCounts, privateCount, published, pendingReview, recent] =
      await Promise.all([
        this.prisma.property.groupBy({
          by: ['propertyStatus'],
          where: { workspaceId, propertyStatus: { not: 'ARCHIVED' } },
          _count: { _all: true },
        }),
        this.prisma.property.count({
          where: {
            workspaceId,
            propertyStatus: { not: 'ARCHIVED' },
            publication: null,
          },
        }),
        this.prisma.propertyPublication.count({
          where: { workspaceId, status: 'PUBLISHED' },
        }),
        this.prisma.propertyPublication.count({
          where: { workspaceId, status: 'PENDING_REVIEW' },
        }),
        this.properties.findMany(workspaceId, {
          page: 1,
          pageSize: 5,
        }),
      ]);

    const byBusinessStatus = Object.fromEntries(
      BUSINESS_STATUSES.map((status) => [status, 0]),
    ) as Record<PropertyBusinessStatus, number>;
    for (const row of statusCounts) {
      byBusinessStatus[row.propertyStatus] = row._count._all;
    }
    const total = Object.values(byBusinessStatus).reduce(
      (sum, n) => sum + n,
      0,
    );

    return {
      total,
      byBusinessStatus,
      private: privateCount,
      published,
      pendingReview,
      recent: recent.items,
    };
  }

  private async buildClients(
    workspaceId: string,
  ): Promise<WorkspaceDashboard['clients']> {
    const [total, activeRequirements, recent] = await Promise.all([
      this.prisma.clientRecord.count({
        where: { workspaceId, status: { not: 'ARCHIVED' } },
      }),
      this.prisma.clientRequirement.count({
        where: { workspaceId, status: 'ACTIVE' },
      }),
      this.clients.findMany(workspaceId, {
        page: 1,
        pageSize: 5,
      }),
    ]);

    return {
      total,
      activeRequirements,
      recent: recent.items,
    };
  }
}
