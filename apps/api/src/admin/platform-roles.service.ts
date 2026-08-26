import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isUniqueConstraintViolation } from '../common/prisma/unique-constraint.util';
import {
  assertWontRemoveLastActiveSuperAdmin,
  SUPER_ADMIN_ROLE_KEY,
} from './super-admin-guard.util';

/**
 * Grants/revokes PLATFORM-scope roles (SUPER_ADMIN, PLATFORM_ADMIN,
 * etc.) directly on a user — independent of workspace membership. This
 * is section 12's "manage platform admins" capability; gated by
 * `admin.roles.manage`, which only SUPER_ADMIN's seeded permission set
 * includes (see roles.catalog.ts) — a company/workspace admin can never
 * reach this, regardless of their workspace role.
 */
@Injectable()
export class PlatformRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async grant(
    targetUserId: string,
    roleKey: string,
    actorUserId: string,
  ): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { key: roleKey, scope: 'PLATFORM' },
    });
    if (!role) {
      throw new BadRequestException('Unknown platform role.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    try {
      await this.prisma.userPlatformRole.create({
        data: {
          userId: targetUserId,
          roleId: role.id,
          grantedByUserId: actorUserId,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('User already holds this platform role.');
      }
      throw error;
    }

    await this.audit.log({
      actorUserId,
      action: 'admin.platform_role_assigned',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { roleKey },
    });
  }

  async revoke(
    targetUserId: string,
    roleKey: string,
    actorUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const grant = await tx.userPlatformRole.findFirst({
        where: { userId: targetUserId, role: { key: roleKey } },
      });
      if (!grant) {
        throw new NotFoundException('User does not hold this platform role.');
      }

      // Only the SUPER_ADMIN grant itself is protected — revoking some
      // other platform role from a user who separately also holds
      // SUPER_ADMIN must not be blocked by this check.
      if (roleKey === SUPER_ADMIN_ROLE_KEY) {
        await assertWontRemoveLastActiveSuperAdmin(
          tx,
          targetUserId,
          'remove the platform role of',
        );
      }

      await tx.userPlatformRole.delete({ where: { id: grant.id } });
    });

    await this.audit.log({
      actorUserId,
      action: 'admin.platform_role_removed',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { roleKey },
    });
  }
}
