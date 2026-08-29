import { Controller, Get } from '@nestjs/common';
import type { WorkspaceDashboard } from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { DashboardService } from './dashboard.service';

@Controller('workspaces/:id/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.WORKSPACE_VIEW.key)
  async get(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
  ): Promise<WorkspaceDashboard> {
    return this.dashboard.build(
      workspaceContext.workspaceId,
      workspaceContext.permissions,
    );
  }
}
