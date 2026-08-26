import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AdminUserDetail,
  AdminUserSummary,
  Paginated,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';
import { toAdminUserDetail, toAdminUserSummary } from './admin-user.mapper';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import { assertWontRemoveLastActiveSuperAdmin } from './super-admin-guard.util';

/**
 * Platform user directory + moderation (suspend/deactivate/restore).
 * Every moderation action here follows the reversible-moderation policy
 * (docs/SECURITY.md): never a hard delete, always actor + reason +
 * timestamp + an audit log entry, and session revocation is immediate.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
  ) {}

  async list(
    query: ListUsersQueryDto,
    canViewEmail: boolean,
  ): Promise<Paginated<AdminUserSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const and: Prisma.UserWhereInput[] = [];
    if (query.search) {
      const term = query.search.trim();
      and.push({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term.toLowerCase(), mode: 'insensitive' } },
        ],
      });
    }
    if (query.accountType) {
      and.push({ accountType: query.accountType });
    }
    if (query.accountStatus) {
      and.push({ accountStatus: query.accountStatus });
    }
    if (query.verification === 'verified') {
      and.push({
        emailVerifiedAt: { not: null },
        phoneVerifiedAt: { not: null },
      });
    } else if (query.verification === 'unverified') {
      and.push({ OR: [{ emailVerifiedAt: null }, { phoneVerifiedAt: null }] });
    }

    const where: Prisma.UserWhereInput = and.length > 0 ? { AND: and } : {};

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((user) => toAdminUserSummary(user, canViewEmail)),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getDetail(
    userId: string,
    canViewEmail: boolean,
  ): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMemberships: { include: { workspace: true, role: true } },
        platformRoles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return toAdminUserDetail(user, canViewEmail);
  }

  async suspend(
    targetUserId: string,
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await assertWontRemoveLastActiveSuperAdmin(tx, targetUserId, 'suspend');

      const user = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!user) {
        throw new NotFoundException('User not found.');
      }
      if (user.accountStatus === 'DEACTIVATED') {
        throw new ConflictException(
          'This account is deactivated; restore it before suspending.',
        );
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          accountStatus: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedByUserId: actorUserId,
          suspensionReason: reason,
        },
      });
    });

    await this.sessions.revokeAllForUser(targetUserId);

    await this.audit.log({
      actorUserId,
      action: 'admin.user_suspended',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { reason },
    });
  }

  async deactivate(
    targetUserId: string,
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await assertWontRemoveLastActiveSuperAdmin(
        tx,
        targetUserId,
        'deactivate',
      );

      const user = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          accountStatus: 'DEACTIVATED',
          deactivatedAt: new Date(),
          deactivatedByUserId: actorUserId,
          deactivationReason: reason,
        },
      });
    });

    await this.sessions.revokeAllForUser(targetUserId);

    await this.audit.log({
      actorUserId,
      action: 'admin.user_deactivated',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { reason },
    });
  }

  async restore(
    targetUserId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (
      user.accountStatus !== 'SUSPENDED' &&
      user.accountStatus !== 'DEACTIVATED'
    ) {
      throw new ConflictException(
        'Only suspended or deactivated accounts can be restored.',
      );
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        accountStatus: 'ACTIVE',
        restoredAt: new Date(),
        restoredByUserId: actorUserId,
        restoreReason: reason,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'admin.user_restored',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { reason, previousStatus: user.accountStatus },
    });
  }
}
