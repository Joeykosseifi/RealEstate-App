import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { ClientRequirementDetail } from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { ClientRequirementsService } from './client-requirements.service';
import { CreateClientRequirementDto } from './dto/create-client-requirement.dto';
import { UpdateClientRequirementDto } from './dto/update-client-requirement.dto';

/**
 * Nested under a client (`workspaces/:id/clients/:clientId/requirements`)
 * — reuses `client.view`/`client.edit`, per the milestone spec's
 * "prefer the existing permission catalog" instruction, since a
 * requirement is a sub-resource of a client exactly like
 * `PropertyLocation` is a sub-resource of a property.
 */
@Controller('workspaces/:id/clients/:clientId/requirements')
export class ClientRequirementsController {
  constructor(private readonly requirements: ClientRequirementsService) {}

  @Post()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_EDIT.key)
  async create(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateClientRequirementDto,
  ): Promise<ClientRequirementDetail> {
    return this.requirements.create(
      workspaceContext.workspaceId,
      clientId,
      user.userId,
      dto,
    );
  }

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_VIEW.key)
  async list(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<ClientRequirementDetail[]> {
    return this.requirements.findMany(
      workspaceContext.workspaceId,
      clientId,
      includeArchived === 'true',
    );
  }

  @Patch(':requirementId')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_EDIT.key)
  async update(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @Param('requirementId') requirementId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateClientRequirementDto,
  ): Promise<ClientRequirementDetail> {
    return this.requirements.update(
      workspaceContext.workspaceId,
      clientId,
      requirementId,
      user.userId,
      dto,
    );
  }

  @Post(':requirementId/archive')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_EDIT.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @Param('requirementId') requirementId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.requirements.archive(
      workspaceContext.workspaceId,
      clientId,
      requirementId,
      user.userId,
    );
  }
}
