import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { PropertyMediaSummary } from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { PropertyMediaService } from './property-media.service';
import { AddPropertyMediaDto } from './dto/add-property-media.dto';
import { ReorderPropertyMediaDto } from './dto/reorder-property-media.dto';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * All media actions require `property.edit` — media is part of editing
 * a property, not a separately-permissioned capability (see
 * docs/PERMISSIONS.md). Nested under the property route so workspace
 * and property scoping happen exactly once, via WorkspaceContextGuard.
 */
@Controller('workspaces/:id/properties/:propertyId/media')
export class PropertyMediaController {
  constructor(private readonly media: PropertyMediaService) {}

  @Post()
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_EDIT.key)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: AddPropertyMediaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PropertyMediaSummary> {
    if (!file) {
      throw new BadRequestException('A file is required.');
    }
    return this.media.add(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      file,
      dto,
    );
  }

  @Get(':mediaId/access-url')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_VIEW.key)
  async accessUrl(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @Param('mediaId') mediaId: string,
  ): Promise<{ url: string }> {
    const url = await this.media.getAccessUrl(
      workspaceContext.workspaceId,
      propertyId,
      mediaId,
    );
    return { url };
  }

  @Patch('reorder')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_EDIT.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ReorderPropertyMediaDto,
  ): Promise<void> {
    await this.media.reorder(
      workspaceContext.workspaceId,
      propertyId,
      user.userId,
      dto.mediaIds,
    );
  }

  @Delete(':mediaId')
  @RequireWorkspacePermission(PERMISSIONS.PROPERTY_EDIT.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('propertyId') propertyId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.media.remove(
      workspaceContext.workspaceId,
      propertyId,
      mediaId,
      user.userId,
    );
  }
}
