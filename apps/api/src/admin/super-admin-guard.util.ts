import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

/**
 * Shared by AdminUsersService (suspend/deactivate) and
 * PlatformRolesService (revoke) — the one invariant both must protect:
 * it must never become possible to leave the platform with zero ACTIVE
 * users holding SUPER_ADMIN.
 *
 * Locks every SUPER_ADMIN grant row before counting, so two concurrent
 * requests targeting *different* super admins can't both observe "one
 * other active super admin remains" and both succeed, leaving zero — the
 * second blocks on the lock until the first commits, then re-counts.
 *
 * No-op (no lock taken) when the target doesn't currently hold
 * SUPER_ADMIN — suspending/deactivating/demoting anyone else is
 * unaffected by this rule.
 */
export async function assertWontRemoveLastActiveSuperAdmin(
  tx: Prisma.TransactionClient,
  targetUserId: string,
  action: string,
): Promise<void> {
  const targetHoldsSuperAdmin = await tx.userPlatformRole.findFirst({
    where: { userId: targetUserId, role: { key: SUPER_ADMIN_ROLE_KEY } },
  });
  if (!targetHoldsSuperAdmin) {
    return;
  }

  await tx.$queryRaw`SELECT upr.id FROM user_platform_roles upr JOIN roles r ON r.id = upr."roleId" WHERE r.key = ${SUPER_ADMIN_ROLE_KEY} FOR UPDATE`;

  const otherActiveSuperAdmins = await tx.user.count({
    where: {
      id: { not: targetUserId },
      accountStatus: 'ACTIVE',
      platformRoles: { some: { role: { key: SUPER_ADMIN_ROLE_KEY } } },
    },
  });

  if (otherActiveSuperAdmins === 0) {
    throw new ConflictException(
      `Cannot ${action} the last active SUPER_ADMIN.`,
    );
  }
}
