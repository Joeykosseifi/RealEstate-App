import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { RequirePlatformPermission } from '../authorization/require-platform-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { PlatformRolesService } from './platform-roles.service';
import { GrantPlatformRoleDto } from './dto/grant-platform-role.dto';

/**
 * "Manage platform admins" (section 12). Gated by `admin.roles.manage`,
 * which only SUPER_ADMIN is seeded with — a workspace/company admin can
 * never reach this endpoint no matter their workspace role, since
 * platform and workspace permissions are structurally separate (see
 * RolesService and docs/PERMISSIONS.md).
 */
@Controller('admin/users/:id/platform-roles')
export class AdminPlatformRolesController {
  constructor(private readonly platformRoles: PlatformRolesService) {}

  @Post()
  @RequirePlatformPermission(PERMISSIONS.ADMIN_ROLES_MANAGE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async grant(
    @Param('id') userId: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: GrantPlatformRoleDto,
  ): Promise<void> {
    await this.platformRoles.grant(userId, dto.roleKey, actor.userId);
  }

  @Delete(':roleKey')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_ROLES_MANAGE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param('id') userId: string,
    @Param('roleKey') roleKey: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.platformRoles.revoke(userId, roleKey, actor.userId);
  }
}
