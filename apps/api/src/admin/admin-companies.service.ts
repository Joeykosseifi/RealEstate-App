import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Company } from '@prisma/client';
import type { AdminCompanySummary, Paginated } from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { ListCompaniesQueryDto } from './dto/list-companies-query.dto';

function toAdminCompanySummary(company: Company): AdminCompanySummary {
  return {
    id: company.id,
    name: company.name,
    email: company.email,
    phone: company.phone,
    website: company.website,
    verificationStatus: company.verificationStatus,
    accountStatus: company.accountStatus,
    createdByUserId: company.createdByUserId,
    createdAt: company.createdAt.toISOString(),
  };
}

/**
 * Minimal admin company moderation — list/suspend/restore, mirroring the
 * user moderation reversible-moderation pattern. Company "deactivate" is
 * deliberately not implemented yet: unlike a user, a company has no
 * session of its own to revoke, and the product distinction between
 * "suspended" and "deactivated" for a company hasn't been specified —
 * `admin.companies.deactivate` is still seeded in the permission catalog
 * for when that's designed.
 */
@Injectable()
export class AdminCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListCompaniesQueryDto,
  ): Promise<Paginated<AdminCompanySummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = query.search
      ? {
          name: { contains: query.search.trim(), mode: 'insensitive' as const },
        }
      : {};

    const [items, totalItems] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items: items.map(toAdminCompanySummary),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async suspend(
    companyId: string,
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { accountStatus: 'SUSPENDED' },
    });

    await this.audit.log({
      actorUserId,
      action: 'admin.company_suspended',
      targetType: 'Company',
      targetId: companyId,
      metadata: { reason },
    });
  }

  async restore(
    companyId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    if (company.accountStatus !== 'SUSPENDED') {
      throw new ConflictException('Only suspended companies can be restored.');
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { accountStatus: 'ACTIVE' },
    });

    await this.audit.log({
      actorUserId,
      action: 'admin.company_restored',
      targetType: 'Company',
      targetId: companyId,
      metadata: { reason },
    });
  }
}
