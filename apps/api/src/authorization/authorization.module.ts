import { Global, Module } from '@nestjs/common';
import { WorkspaceAuthorizationService } from './workspace-authorization.service';
import { WorkspaceContextGuard } from './workspace-context.guard';
import { WorkspacePermissionGuard } from './workspace-permission.guard';
import { PlatformAuthorizationService } from './platform-authorization.service';
import { PlatformPermissionGuard } from './platform-permission.guard';
import { RolesService } from './roles.service';

/**
 * Global so every feature module can use `@RequireWorkspacePermission` /
 * `@RequirePlatformPermission` without importing this module itself —
 * mirrors AuditModule's pattern from Milestone 1.
 */
@Global()
@Module({
  providers: [
    WorkspaceAuthorizationService,
    WorkspaceContextGuard,
    WorkspacePermissionGuard,
    PlatformAuthorizationService,
    PlatformPermissionGuard,
    RolesService,
  ],
  exports: [
    WorkspaceAuthorizationService,
    WorkspaceContextGuard,
    WorkspacePermissionGuard,
    PlatformAuthorizationService,
    PlatformPermissionGuard,
    RolesService,
  ],
})
export class AuthorizationModule {}
