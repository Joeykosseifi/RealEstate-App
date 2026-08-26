import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  WorkspaceDetail,
  WorkspaceMemberSummary,
  WorkspaceRoleSummary,
  WorkspaceSummary,
} from '@real-estate/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { RolesService } from '../authorization/roles.service';
import { WorkspaceDirectoryService } from './workspace-directory.service';
import { MembershipService } from './membership.service';
import { toWorkspaceRoleSummary } from './workspace.mapper';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ModerationReasonDto } from './dto/moderation-reason.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly directory: WorkspaceDirectoryService,
    private readonly membership: MembershipService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<WorkspaceSummary[]> {
    return this.directory.listForUser(user.userId);
  }

  @Get(':id')
  @RequireWorkspacePermission(PERMISSIONS.WORKSPACE_VIEW.key)
  detail(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
  ): WorkspaceDetail {
    return {
      id: workspaceContext.workspace.id,
      type: workspaceContext.workspace.type,
      name: workspaceContext.workspace.name,
      companyId: workspaceContext.workspace.companyId,
      membershipType: workspaceContext.membership.membershipType,
      membershipStatus: workspaceContext.membership.status,
      roleKey: workspaceContext.roleKey,
      createdAt: workspaceContext.workspace.createdAt.toISOString(),
      permissions: [...workspaceContext.permissions],
    };
  }

  @Get(':id/members')
  @RequireWorkspacePermission(PERMISSIONS.TEAM_VIEW.key)
  async members(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
  ): Promise<WorkspaceMemberSummary[]> {
    return this.directory.listMembers(workspaceContext.workspaceId);
  }

  @Post(':id/invitations')
  @RequireWorkspacePermission(PERMISSIONS.TEAM_INVITE.key)
  async invite(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: InviteMemberDto,
  ): Promise<{ id: string }> {
    const membership = await this.membership.invite(
      workspaceContext.workspace,
      user.userId,
      dto,
    );
    return { id: membership.id };
  }

  @Post(':id/invitations/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptInvitation(
    @Param('id') workspaceId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.membership.acceptInvitation(workspaceId, user.userId);
  }

  @Post(':id/members/:memberId/suspend')
  @RequireWorkspacePermission(PERMISSIONS.TEAM_SUSPEND.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspendMember(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ModerationReasonDto,
  ): Promise<void> {
    await this.membership.suspend(
      workspaceContext.workspaceId,
      memberId,
      user.userId,
      dto.reason,
    );
  }

  @Post(':id/members/:memberId/remove')
  @RequireWorkspacePermission(PERMISSIONS.TEAM_REMOVE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ModerationReasonDto,
  ): Promise<void> {
    await this.membership.remove(
      workspaceContext.workspaceId,
      memberId,
      user.userId,
      dto.reason,
    );
  }

  @Patch(':id/members/:memberId/role')
  @RequireWorkspacePermission(PERMISSIONS.TEAM_ASSIGN_ROLE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeMemberRole(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ChangeMemberRoleDto,
  ): Promise<void> {
    await this.membership.changeRole(
      workspaceContext.workspaceId,
      memberId,
      user.userId,
      dto.roleId,
    );
  }

  @Get(':id/roles')
  @RequireWorkspacePermission(PERMISSIONS.WORKSPACE_VIEW.key)
  async listRoles(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
  ): Promise<WorkspaceRoleSummary[]> {
    const roles = await this.roles.listAssignableRoles(
      workspaceContext.workspaceId,
    );
    return roles.map(toWorkspaceRoleSummary);
  }

  @Post(':id/roles')
  @RequireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_ROLES.key)
  async createRole(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateRoleDto,
  ): Promise<WorkspaceRoleSummary> {
    const role = await this.roles.createCustomRole(
      workspaceContext.workspaceId,
      user.userId,
      dto,
    );
    return toWorkspaceRoleSummary(role);
  }

  @Patch(':id/roles/:roleId')
  @RequireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_ROLES.key)
  async updateRole(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateRoleDto,
  ): Promise<WorkspaceRoleSummary> {
    const role = await this.roles.updateCustomRole(
      workspaceContext.workspaceId,
      roleId,
      user.userId,
      dto,
    );
    return toWorkspaceRoleSummary(role);
  }

  @Delete(':id/roles/:roleId')
  @RequireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_ROLES.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.roles.deleteCustomRole(
      workspaceContext.workspaceId,
      roleId,
      user.userId,
    );
  }
}
