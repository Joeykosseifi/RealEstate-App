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
  AdminUserDetail,
  AdminUserSummary,
  Paginated,
} from '@real-estate/types';
import { RequirePlatformPermission } from '../authorization/require-platform-permission.decorator';
import { CurrentPlatformPermissions } from '../authorization/platform-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';
import { RestoreActionDto } from './dto/restore-action.dto';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @RequirePlatformPermission(PERMISSIONS.ADMIN_USERS_VIEW.key)
  async list(
    @Query() query: ListUsersQueryDto,
    @CurrentPlatformPermissions() permissions: Set<string>,
  ): Promise<Paginated<AdminUserSummary>> {
    return this.adminUsers.list(
      query,
      permissions.has(PERMISSIONS.ADMIN_USERS_VIEW_EMAIL.key),
    );
  }

  @Get(':id')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_USERS_VIEW.key)
  async detail(
    @Param('id') id: string,
    @CurrentPlatformPermissions() permissions: Set<string>,
  ): Promise<AdminUserDetail> {
    return this.adminUsers.getDetail(
      id,
      permissions.has(PERMISSIONS.ADMIN_USERS_VIEW_EMAIL.key),
    );
  }

  @Post(':id/suspend')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_USERS_SUSPEND.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: ModerationActionDto,
  ): Promise<void> {
    await this.adminUsers.suspend(id, actor.userId, dto.reason);
  }

  @Post(':id/deactivate')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_USERS_DEACTIVATE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: ModerationActionDto,
  ): Promise<void> {
    await this.adminUsers.deactivate(id, actor.userId, dto.reason);
  }

  @Post(':id/restore')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_USERS_RESTORE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: RestoreActionDto,
  ): Promise<void> {
    await this.adminUsers.restore(id, actor.userId, dto.reason);
  }
}
