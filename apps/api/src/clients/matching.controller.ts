import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Paginated, PropertyMatchResult } from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { MatchingService } from './matching.service';
import { ListMatchesQueryDto } from './dto/list-matches-query.dto';

/**
 * Requires BOTH `client.view` (checked by the guard, since this route
 * is gated like every other client sub-resource) AND `property.view`
 * (checked manually inside `MatchingService.findMatches`, since
 * `@RequireWorkspacePermission` only ever checks one permission) — see
 * docs/PERMISSIONS.md "Matching architecture."
 */
@Controller(
  'workspaces/:id/clients/:clientId/requirements/:requirementId/matches',
)
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_VIEW.key)
  async list(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @Param('requirementId') requirementId: string,
    @Query() query: ListMatchesQueryDto,
  ): Promise<Paginated<PropertyMatchResult>> {
    return this.matching.findMatches(
      workspaceContext.workspaceId,
      clientId,
      requirementId,
      workspaceContext.permissions,
      query,
    );
  }
}
