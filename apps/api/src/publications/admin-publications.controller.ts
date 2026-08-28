import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type {
  Paginated,
  PublicationReviewDetail,
  PublicationReviewSummary,
} from '@real-estate/types';
import { RequirePlatformPermission } from '../authorization/require-platform-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { AdminPublicationsService } from './admin-publications.service';
import { ListPublicationReviewQueryDto } from './dto/list-publication-review-query.dto';
import { PublicationReasonDto } from './dto/save-publication-draft.dto';

/**
 * Platform-admin moderation surface — completely independent of
 * workspace authorization (see docs/PERMISSIONS.md "Admin authorization
 * is never workspace membership"). A company admin holding
 * `workspace.manage_*` permissions gains nothing here; only a user
 * holding a PLATFORM role with these `admin.content.*` permissions can
 * reach these routes at all.
 */
@Controller('admin/property-publications')
export class AdminPublicationsController {
  constructor(private readonly adminPublications: AdminPublicationsService) {}

  @Get()
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_VIEW.key)
  async list(
    @Query() query: ListPublicationReviewQueryDto,
  ): Promise<Paginated<PublicationReviewSummary>> {
    return this.adminPublications.findMany(query);
  }

  @Get(':id')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_VIEW.key)
  async detail(@Param('id') id: string): Promise<PublicationReviewDetail> {
    return this.adminPublications.findOneOrThrow(id);
  }

  @Post(':id/approve')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_REVIEW.key)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
  ): Promise<PublicationReviewDetail> {
    return this.adminPublications.approve(id, actor.userId);
  }

  @Post(':id/reject')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_REVIEW.key)
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: PublicationReasonDto,
  ): Promise<PublicationReviewDetail> {
    return this.adminPublications.reject(id, actor.userId, dto.reason);
  }

  @Post(':id/request-changes')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_REVIEW.key)
  @HttpCode(HttpStatus.OK)
  async requestChanges(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: PublicationReasonDto,
  ): Promise<PublicationReviewDetail> {
    return this.adminPublications.requestChanges(id, actor.userId, dto.reason);
  }

  @Post(':id/unpublish')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_UNPUBLISH.key)
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: PublicationReasonDto,
  ): Promise<PublicationReviewDetail> {
    return this.adminPublications.unpublish(id, actor.userId, dto.reason);
  }

  @Post(':id/restore')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_CONTENT_RESTORE.key)
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
  ): Promise<PublicationReviewDetail> {
    return this.adminPublications.restore(id, actor.userId);
  }
}
