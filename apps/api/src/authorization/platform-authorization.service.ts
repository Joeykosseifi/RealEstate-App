import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PermissionKey } from './permissions.catalog';

/**
 * Resolves a user's platform-wide (admin) permissions, granted via
 * UserPlatformRole — completely independent of any workspace membership.
 * A SUPER_ADMIN does not need to join every workspace to administer
 * platform accounts. Default deny: a user with no platform role rows
 * resolves to an empty permission set, not an implicit allow.
 */
@Injectable()
export class PlatformAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePermissions(userId: string): Promise<Set<string>> {
    const grants = await this.prisma.userPlatformRole.findMany({
      where: { userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const permissions = new Set<string>();
    for (const grant of grants) {
      for (const rolePermission of grant.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }
    return permissions;
  }

  async hasPermission(
    userId: string,
    permission: PermissionKey,
  ): Promise<boolean> {
    const permissions = await this.resolvePermissions(userId);
    return permissions.has(permission);
  }

  async hasPlatformRole(userId: string, roleKey: string): Promise<boolean> {
    const grant = await this.prisma.userPlatformRole.findFirst({
      where: { userId, role: { key: roleKey, scope: 'PLATFORM' } },
    });
    return grant !== null;
  }
}
