import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedAccountGuard } from '../auth/guards/verified-account.guard';
import type { PermissionKey } from './permissions.catalog';
import { WorkspaceContextGuard } from './workspace-context.guard';
import { WorkspacePermissionGuard } from './workspace-permission.guard';

export const REQUIRE_WORKSPACE_PERMISSION_KEY = 'require_workspace_permission';

/**
 * Protects an endpoint with the full workspace authorization chain:
 * authenticate -> require a verified account -> resolve workspace ->
 * verify ACTIVE membership -> resolve role -> require this permission.
 * One decorator, no per-controller guard wiring.
 *
 * The verification check runs before workspace resolution so an
 * unverified caller gets the same 403 for every workspace id and can't
 * probe which workspaces/resources exist.
 *
 * Usage: `@RequireWorkspacePermission(PERMISSIONS.PROPERTY_CREATE.key)`
 */
export const RequireWorkspacePermission = (
  permission: PermissionKey,
): MethodDecorator =>
  applyDecorators(
    UseGuards(
      JwtAuthGuard,
      VerifiedAccountGuard,
      WorkspaceContextGuard,
      WorkspacePermissionGuard,
    ),
    SetMetadata(REQUIRE_WORKSPACE_PERMISSION_KEY, permission),
  );
