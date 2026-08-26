import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Workspace, WorkspaceMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PermissionKey } from './permissions.catalog';

export interface WorkspaceContext {
  workspaceId: string;
  workspace: Workspace;
  membership: WorkspaceMember;
  roleKey: string | null;
  permissions: Set<string>;
}

/**
 * Resolves "is this user authorized to act in this workspace, and with
 * what permissions" purely from the database — never from anything the
 * client supplied about its own role/permissions. This is the one place
 * that logic lives; guards call it, they don't duplicate it.
 *
 * Default deny: any missing workspace, missing/non-ACTIVE membership, or
 * missing role all resolve to zero permissions / a thrown ForbiddenException,
 * never an implicit allow.
 */
@Injectable()
export class WorkspaceAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveContext(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceContext> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      // Same error as "not an active member" below — a workspace's mere
      // existence is not something an unauthorized caller should be able
      // to distinguish via status code.
      throw new ForbiddenException(
        'You are not an active member of this workspace.',
      );
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'You are not an active member of this workspace.',
      );
    }

    const permissions = new Set<string>(
      membership.role?.permissions.map(
        (rolePermission) => rolePermission.permission.key,
      ) ?? [],
    );

    return {
      workspaceId,
      workspace,
      membership,
      roleKey: membership.role?.key ?? null,
      permissions,
    };
  }

  async hasPermission(
    userId: string,
    workspaceId: string,
    permission: PermissionKey,
  ): Promise<boolean> {
    try {
      const context = await this.resolveContext(userId, workspaceId);
      return context.permissions.has(permission);
    } catch {
      return false;
    }
  }
}
