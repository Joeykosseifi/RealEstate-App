import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import type { PublicationDetail } from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { PublicationsService } from './publications.service';
import { SavePublicationDraftDto } from './dto/save-publication-draft.dto';

/**
 * Every route resolves its workspace/property via the standard
 * workspace-authorization chain — a publication belonging to another
 * workspace's property is a 404, matching PropertiesController. See
 * docs/PERMISSIONS.md "Publication authorization."
 */
@Controller('workspaces/:id/properties/:propertyId/publication')
export class PublicationsController {
  constructor(private readonly publications: PublicationsService) {}

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_VIEW.key)
  async detail(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
  ): Promise<PublicationDetail | null> {
    return this.publications.getDetail(
      workspaceContext.workspaceId,
      propertyId,
    );
  }

  @Put()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_PUBLISH.key)
  async saveDraft(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: SavePublicationDraftDto,
  ): Promise<PublicationDetail> {
    return this.publications.saveDraft(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      dto,
    );
  }

  @Post('submit')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_PUBLISH.key)
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PublicationDetail> {
    return this.publications.submit(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
    );
  }

  @Post('cancel')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_PUBLISH.key)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PublicationDetail> {
    return this.publications.cancelSubmission(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
    );
  }

  @Post('unpublish')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_UNPUBLISH.key)
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PublicationDetail> {
    return this.publications.unpublish(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
    );
  }

  @Post('republish')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_PUBLISH.key)
  @HttpCode(HttpStatus.OK)
  async republish(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PublicationDetail> {
    return this.publications.republish(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
    );
  }
}
