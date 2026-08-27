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
  PropertyListItem,
  PropertyProfessionalDetail,
} from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { ChangePropertyStatusDto } from './dto/change-property-status.dto';
import { PropertyLocationDto } from './dto/property-location.dto';

/**
 * Every route here resolves its workspace via `WorkspaceContextGuard`
 * (from the `:id` route param) and re-checks ACTIVE membership +
 * permission server-side on every request — `workspaceId` is never
 * trusted from the body, and a property from a different workspace is a
 * `404`, not a `403`, so a guessed UUID can't be used to distinguish
 * "not yours" from "doesn't exist." See docs/PERMISSIONS.md.
 */
@Controller('workspaces/:id/properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Post()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE.key)
  async create(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreatePropertyDto,
  ): Promise<PropertyProfessionalDetail> {
    return this.properties.create(
      workspaceContext.workspaceId,
      user.userId,
      workspaceContext.permissions,
      dto,
    );
  }

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_VIEW.key)
  async list(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Query() query: ListPropertiesQueryDto,
  ): Promise<Paginated<PropertyListItem>> {
    return this.properties.findMany(workspaceContext.workspaceId, query);
  }

  @Get(':propertyId')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_VIEW.key)
  async detail(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PropertyProfessionalDetail> {
    return this.properties.findOneForRead(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      workspaceContext.permissions,
    );
  }

  @Patch(':propertyId')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_EDIT.key)
  async update(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PropertyProfessionalDetail> {
    return this.properties.update(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      workspaceContext.permissions,
      dto,
    );
  }

  @Patch(':propertyId/location')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_EDIT.key)
  async updateLocation(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: PropertyLocationDto,
  ): Promise<PropertyProfessionalDetail> {
    return this.properties.updateLocation(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      workspaceContext.permissions,
      dto,
    );
  }

  @Post(':propertyId/status')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_EDIT.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeStatus(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ChangePropertyStatusDto,
  ): Promise<void> {
    await this.properties.changeStatus(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      dto.propertyStatus,
    );
  }

  @Post(':propertyId/archive')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_ARCHIVE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.properties.archive(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
    );
  }

  @Post(':propertyId/restore')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_ARCHIVE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.properties.restore(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
    );
  }
}
