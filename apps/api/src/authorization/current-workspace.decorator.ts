import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { WorkspaceContext } from './workspace-authorization.service';

/** Only usable on routes protected by `@RequireWorkspacePermission`. */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ workspaceContext: WorkspaceContext }>();
    return request.workspaceContext;
  },
);
