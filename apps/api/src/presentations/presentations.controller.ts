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
import type {
  Paginated,
  PropertyPresentationDetail,
  PropertyPresentationSummary,
} from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { PresentationsService } from './presentations.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { UpdatePresentationDto } from './dto/update-presentation.dto';
import { ListPresentationsQueryDto } from './dto/list-presentations-query.dto';

/**
 * Every route requires `property.create_presentation` — the single
 * feature gate for the whole presentation surface (create, list, view,
 * edit, generate, archive, and access the generated PDF), per the
 * milestone spec's "prefer the existing permission catalog" guidance;
 * see docs/PERMISSIONS.md "Presentation authorization." Every selected
 * property/client/requirement is independently re-verified against
 * `workspaceId` in `PresentationsService` — never trusted from the
 * request body alone.
 */
@Controller('workspaces/:id/presentations')
export class PresentationsController {
  constructor(private readonly presentations: PresentationsService) {}

  @Post()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  async create(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreatePresentationDto,
  ): Promise<PropertyPresentationDetail> {
    return this.presentations.create(
      workspaceContext.workspaceId,
      user.userId,
      dto,
    );
  }

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  async list(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Query() query: ListPresentationsQueryDto,
  ): Promise<Paginated<PropertyPresentationSummary>> {
    return this.presentations.findMany(workspaceContext.workspaceId, query);
  }

  @Get(':presentationId')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  async detail(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('presentationId') presentationId: string,
  ): Promise<PropertyPresentationDetail> {
    return this.presentations.findOneForRead(
      workspaceContext.workspaceId,
      presentationId,
    );
  }

  @Patch(':presentationId')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  async update(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('presentationId') presentationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdatePresentationDto,
  ): Promise<PropertyPresentationDetail> {
    return this.presentations.update(
      workspaceContext.workspaceId,
      presentationId,
      user.userId,
      dto,
    );
  }

  @Post(':presentationId/generate')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  @HttpCode(HttpStatus.OK)
  async generate(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('presentationId') presentationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PropertyPresentationDetail> {
    return this.presentations.generate(
      workspaceContext.workspaceId,
      presentationId,
      user.userId,
    );
  }

  @Get(':presentationId/access-url')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  async accessUrl(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('presentationId') presentationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<{ url: string }> {
    const url = await this.presentations.getAccessUrl(
      workspaceContext.workspaceId,
      presentationId,
      user.userId,
    );
    return { url };
  }

  @Post(':presentationId/archive')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE_PRESENTATION.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('presentationId') presentationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.presentations.archive(
      workspaceContext.workspaceId,
      presentationId,
      user.userId,
    );
  }
}
