import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Workspace, WorkspaceMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { isUniqueConstraintViolation } from '../common/prisma/unique-constraint.util';
import type { InviteMemberDto } from './dto/invite-member.dto';

const DEFAULT_INVITE_ROLE_KEY = 'AGENT';

/**
 * Membership lifecycle: invite -> accept -> (suspend | remove | role
 * change). Owner protection (see assertWontLeaveWorkspaceWithoutAnOwner)
 * is the one invariant every mutating method here goes through — it must
 * never become possible to leave a workspace with zero ACTIVE owners,
 * including under concurrent requests (enforced with a row lock, not
 * just an application-level count check).
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  async invite(
    workspace: Workspace,
    actorUserId: string,
    dto: InviteMemberDto,
  ): Promise<WorkspaceMember> {
    if (workspace.type !== 'COMPANY') {
      throw new BadRequestException(
        'Only company workspaces support inviting members.',
      );
    }

    const email = this.usersService.normalizeEmail(dto.email);
    const targetUser = await this.prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      throw new NotFoundException(
        'No registered account found with that email. Inviting a not-yet-registered user is not supported yet.',
      );
    }

    const roleId = await this.resolveInviteRoleId(workspace.id, dto.roleId);

    try {
      const membership = await this.prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: targetUser.id,
          membershipType: dto.membershipType,
          status: 'INVITED',
          roleId,
          invitedAt: new Date(),
          invitedByUserId: actorUserId,
        },
      });

      await this.audit.log({
        actorUserId,
        action: 'workspace.member_invited',
        targetType: 'WorkspaceMember',
        targetId: membership.id,
        metadata: { workspaceId: workspace.id, invitedUserId: targetUser.id },
      });

      return membership;
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'userId')) {
        throw new ConflictException(
          'This user already has a membership in this workspace.',
        );
      }
      throw error;
    }
  }

  private async resolveInviteRoleId(
    workspaceId: string,
    roleId?: string,
  ): Promise<string | undefined> {
    if (roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          id: roleId,
          scope: 'WORKSPACE',
          OR: [{ workspaceId: null }, { workspaceId }],
        },
      });
      if (!role) {
        throw new BadRequestException('Invalid role for this workspace.');
      }
      return role.id;
    }

    const defaultRole = await this.prisma.role.findFirst({
      where: { workspaceId: null, key: DEFAULT_INVITE_ROLE_KEY },
    });
    return defaultRole?.id;
  }

  async acceptInvitation(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership || membership.status !== 'INVITED') {
      throw new NotFoundException(
        'No pending invitation found for this workspace.',
      );
    }

    await this.prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { status: 'ACTIVE', joinedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'workspace.member_activated',
      targetType: 'WorkspaceMember',
      targetId: membership.id,
      metadata: { workspaceId },
    });
  }

  async suspend(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await this.loadMemberForUpdate(tx, workspaceId, memberId);
      if (member.membershipType === 'OWNER') {
        await this.assertWontLeaveWorkspaceWithoutAnOwner(
          tx,
          workspaceId,
          member.id,
        );
      }
      await tx.workspaceMember.update({
        where: { id: member.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedByUserId: actorUserId,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'workspace.member_suspended',
      targetType: 'WorkspaceMember',
      targetId: memberId,
      metadata: { workspaceId, reason },
    });
  }

  async remove(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await this.loadMemberForUpdate(tx, workspaceId, memberId);
      if (member.membershipType === 'OWNER') {
        await this.assertWontLeaveWorkspaceWithoutAnOwner(
          tx,
          workspaceId,
          member.id,
        );
      }
      await tx.workspaceMember.update({
        where: { id: member.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date(),
          removedByUserId: actorUserId,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'workspace.member_removed',
      targetType: 'WorkspaceMember',
      targetId: memberId,
      metadata: { workspaceId, reason },
    });
  }

  async changeRole(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    roleId: string,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found in this workspace.');
    }

    if (member.membershipType === 'OWNER') {
      throw new ForbiddenException(
        "An owner's role cannot be reassigned directly — this would silently strip their permissions " +
          'while leaving them structurally the owner. Use an ownership-transfer process instead (not yet implemented).',
      );
    }

    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        scope: 'WORKSPACE',
        OR: [{ workspaceId: null }, { workspaceId }],
      },
    });
    if (!role) {
      throw new BadRequestException('Invalid role for this workspace.');
    }

    await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { roleId: role.id },
    });

    await this.audit.log({
      actorUserId,
      action: 'workspace.role_assigned',
      targetType: 'WorkspaceMember',
      targetId: memberId,
      metadata: { workspaceId, roleId: role.id, roleKey: role.key },
    });
  }

  private async loadMemberForUpdate(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMember> {
    const member = await tx.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found in this workspace.');
    }
    return member;
  }

  /**
   * Locks every OWNER row in this workspace (not just the one being
   * acted on) before counting, so two concurrent requests targeting
   * *different* owners of the same two-owner workspace can't both
   * observe "one other active owner remains" and both succeed, leaving
   * zero. The second request blocks on the lock until the first commits,
   * then re-counts against the now-current state.
   */
  private async assertWontLeaveWorkspaceWithoutAnOwner(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    excludeMemberId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM workspace_members WHERE "workspaceId" = ${workspaceId}::uuid AND "membershipType" = 'OWNER' FOR UPDATE`;

    const otherActiveOwners = await tx.workspaceMember.count({
      where: {
        workspaceId,
        membershipType: 'OWNER',
        status: 'ACTIVE',
        id: { not: excludeMemberId },
      },
    });

    if (otherActiveOwners === 0) {
      throw new ConflictException(
        'Cannot remove or suspend the only active owner of this workspace. Transfer ownership first.',
      );
    }
  }
}
