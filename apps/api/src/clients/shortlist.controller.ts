import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import type { ClientPropertyShortlistItem } from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { ShortlistService } from './shortlist.service';
import { AddShortlistItemDto } from './dto/add-shortlist-item.dto';

/**
 * `client.edit` gates the route (adding/removing is an edit to the
 * client's working set); `property.view` is additionally checked inside
 * `ShortlistService.add` — see docs/PERMISSIONS.md "Matching
 * architecture" for the same dual-permission pattern used by matching.
 */
@Controller('workspaces/:id/clients/:clientId/shortlist')
export class ShortlistController {
  constructor(private readonly shortlist: ShortlistService) {}

  @Post()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_EDIT.key)
  async add(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: AddShortlistItemDto,
  ): Promise<ClientPropertyShortlistItem> {
    return this.shortlist.add(
      workspaceContext.workspaceId,
      clientId,
      user.userId,
      workspaceContext.permissions,
      dto,
    );
  }

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_VIEW.key)
  async list(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
  ): Promise<ClientPropertyShortlistItem[]> {
    return this.shortlist.list(workspaceContext.workspaceId, clientId);
  }

  @Delete(':shortlistId')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_EDIT.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @Param('shortlistId') shortlistId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.shortlist.remove(
      workspaceContext.workspaceId,
      clientId,
      shortlistId,
      user.userId,
    );
  }
}
