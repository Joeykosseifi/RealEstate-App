import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from './workspace-authorization.service';

/** Shape of `req` once JwtAuthGuard + WorkspaceContextGuard have both run. */
export interface RequestWithWorkspaceContext {
  user: AuthenticatedRequestUser;
  workspaceContext: WorkspaceContext;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}
