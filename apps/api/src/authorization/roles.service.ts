import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Permission, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isUniqueConstraintViolation } from '../common/prisma/unique-constraint.util';

export interface RoleWithPermissions extends Role {
  permissions: { permission: Permission }[];
}

export interface UpsertCustomRoleInput {
  key: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

/**
 * Custom per-workspace role CRUD. The one rule this service exists to
 * enforce structurally (not just by seed-data convention): a WORKSPACE-
 * scope role can never be granted a PLATFORM-scope permission — see
 * assertPermissionsAssignableToWorkspaceRole below. Platform role
 * grant/revoke (SUPER_ADMIN etc.) is a separate concern — see
 * apps/api/src/admin/platform-roles.service.ts.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** System workspace-role templates plus this workspace's own custom roles. */
  async listAssignableRoles(
    workspaceId: string,
  ): Promise<RoleWithPermissions[]> {
    return this.prisma.role.findMany({
      where: {
        scope: 'WORKSPACE',
        OR: [{ workspaceId: null }, { workspaceId }],
      },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getAssignableRoleById(
    workspaceId: string,
    roleId: string,
  ): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        scope: 'WORKSPACE',
        OR: [{ workspaceId: null }, { workspaceId }],
      },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new NotFoundException('Role not found in this workspace.');
    }
    return role;
  }

  async createCustomRole(
    workspaceId: string,
    actorUserId: string,
    input: UpsertCustomRoleInput,
  ): Promise<RoleWithPermissions> {
    const permissions = await this.resolveWorkspacePermissions(
      input.permissionKeys,
    );

    try {
      const role = await this.prisma.role.create({
        data: {
          key: input.key,
          name: input.name,
          description: input.description,
          scope: 'WORKSPACE',
          isSystem: false,
          workspaceId,
          permissions: {
            create: permissions.map((permission) => ({
              permissionId: permission.id,
            })),
          },
        },
        include: { permissions: { include: { permission: true } } },
      });

      await this.audit.log({
        actorUserId,
        action: 'workspace.role_created',
        targetType: 'Role',
        targetId: role.id,
        metadata: {
          workspaceId,
          key: role.key,
          permissionKeys: input.permissionKeys,
        },
      });

      return role;
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'key')) {
        throw new ConflictException(
          'A role with this key already exists in this workspace.',
        );
      }
      throw error;
    }
  }

  async updateCustomRole(
    workspaceId: string,
    roleId: string,
    actorUserId: string,
    input: Partial<UpsertCustomRoleInput>,
  ): Promise<RoleWithPermissions> {
    const existing = await this.getCustomRoleOwnedByWorkspace(
      workspaceId,
      roleId,
    );

    const permissions = input.permissionKeys
      ? await this.resolveWorkspacePermissions(input.permissionKeys)
      : null;

    const role = await this.prisma.$transaction(async (tx) => {
      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: existing.id } });
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: existing.id,
            permissionId: permission.id,
          })),
        });
      }

      return tx.role.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? undefined,
          description: input.description ?? undefined,
        },
        include: { permissions: { include: { permission: true } } },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'workspace.role_updated',
      targetType: 'Role',
      targetId: role.id,
      metadata: { workspaceId, key: role.key },
    });

    return role;
  }

  async deleteCustomRole(
    workspaceId: string,
    roleId: string,
    actorUserId: string,
  ): Promise<void> {
    const existing = await this.getCustomRoleOwnedByWorkspace(
      workspaceId,
      roleId,
    );

    const membersUsingRole = await this.prisma.workspaceMember.count({
      where: { roleId: existing.id },
    });
    if (membersUsingRole > 0) {
      throw new ConflictException(
        'This role is currently assigned to one or more members; reassign them before deleting it.',
      );
    }

    await this.prisma.role.delete({ where: { id: existing.id } });

    await this.audit.log({
      actorUserId,
      action: 'workspace.role_deleted',
      targetType: 'Role',
      targetId: existing.id,
      metadata: { workspaceId, key: existing.key },
    });
  }

  private async getCustomRoleOwnedByWorkspace(
    workspaceId: string,
    roleId: string,
  ): Promise<Role> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.workspaceId !== workspaceId || role.isSystem) {
      throw new NotFoundException('Custom role not found in this workspace.');
    }
    return role;
  }

  /** Resolves permission keys and enforces the platform/workspace scope boundary. */
  private async resolveWorkspacePermissions(
    permissionKeys: string[],
  ): Promise<Permission[]> {
    if (permissionKeys.length === 0) {
      throw new BadRequestException(
        'A role must have at least one permission.',
      );
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    if (permissions.length !== permissionKeys.length) {
      const found = new Set(permissions.map((permission) => permission.key));
      const missing = permissionKeys.filter((key) => !found.has(key));
      throw new BadRequestException(
        `Unknown permission key(s): ${missing.join(', ')}`,
      );
    }

    const platformLeaks = permissions.filter(
      (permission) => permission.scope !== 'WORKSPACE',
    );
    if (platformLeaks.length > 0) {
      throw new ForbiddenException(
        `Workspace roles cannot be granted platform permission(s): ${platformLeaks
          .map((permission) => permission.key)
          .join(', ')}`,
      );
    }

    return permissions;
  }
}
