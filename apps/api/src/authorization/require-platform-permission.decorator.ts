import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { PermissionKey } from './permissions.catalog';
import { PlatformPermissionGuard } from './platform-permission.guard';

export const REQUIRE_PLATFORM_PERMISSION_KEY = 'require_platform_permission';

/**
 * Protects an admin endpoint with platform (not workspace) authorization:
 * authenticate -> resolve platform role(s) -> require this permission.
 * Does not require membership in any workspace.
 *
 * Usage: `@RequirePlatformPermission(PERMISSIONS.ADMIN_USERS_VIEW.key)`
 */
export const RequirePlatformPermission = (
  permission: PermissionKey,
): MethodDecorator =>
  applyDecorators(
    UseGuards(JwtAuthGuard, PlatformPermissionGuard),
    SetMetadata(REQUIRE_PLATFORM_PERMISSION_KEY, permission),
  );
