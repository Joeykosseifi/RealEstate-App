import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { PermissionKey } from './permissions.catalog';
import { WorkspaceContextGuard } from './workspace-context.guard';
import { WorkspacePermissionGuard } from './workspace-permission.guard';

export const REQUIRE_WORKSPACE_PERMISSION_KEY = 'require_workspace_permission';

/**
 * Protects an endpoint with the full workspace authorization chain:
 * authenticate -> resolve workspace -> verify ACTIVE membership ->
 * resolve role -> require this permission. One decorator, no
 * per-controller guard wiring.
 *
 * Usage: `@RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE.key)`
 */
export const RequireWorkspacePermission = (
  permission: PermissionKey,
): MethodDecorator =>
  applyDecorators(
    UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard),
    SetMetadata(REQUIRE_WORKSPACE_PERMISSION_KEY, permission),
  );
