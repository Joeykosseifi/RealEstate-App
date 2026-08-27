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
 * Admin company moderation — list/suspend/deactivate/restore, mirroring
 * the user moderation reversible-moderation pattern (see
 * docs/SECURITY.md "Reversible moderation"). Never a hard delete: the
 * company row, its workspace, its memberships, and its
 * (future-milestone) property data are all untouched by any action
 * here — only `Company.accountStatus` changes. Deactivating a company
 * does not touch the registering owner's `User.accountStatus` or any
 * other user's personal workspace — company-level and user-level
 * moderation are deliberately independent (see
 * docs/PERMISSIONS.md "Company vs. user deactivation").
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

  /**
   * Deactivates a company. Reversible — see `restore()`. Never deletes
   * the `Company` row, its `Workspace`, or any `WorkspaceMember`
   * (memberships/history are preserved for restoration), and never
   * transfers `createdByUserId` ownership. Deliberately does not touch
   * the registering owner's `User.accountStatus` — a company being
   * deactivated does not deactivate the person who created it.
   */
  async deactivate(
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
    if (company.accountStatus === 'DEACTIVATED') {
      throw new ConflictException('Company is already deactivated.');
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { accountStatus: 'DEACTIVATED' },
    });

    await this.audit.log({
      actorUserId,
      action: 'admin.company_deactivated',
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
    if (
      company.accountStatus !== 'SUSPENDED' &&
      company.accountStatus !== 'DEACTIVATED'
    ) {
      throw new ConflictException(
        'Only suspended or deactivated companies can be restored.',
      );
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
      metadata: { reason, previousStatus: company.accountStatus },
    });
  }
}
