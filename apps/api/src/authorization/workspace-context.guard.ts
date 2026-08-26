import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import {
  WorkspaceAuthorizationService,
  type WorkspaceContext,
} from './workspace-authorization.service';

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolves the workspace a request is acting in and verifies the
 * caller has an ACTIVE membership there — never trusting anything the
 * client claims about its own role/permissions in that workspace.
 *
 * The workspace id is read from (in order): a route param named `id` or
 * `workspaceId` (workspace-rooted routes like `/workspaces/:id/...`), or
 * else the `X-Workspace-Id` header (for future workspace-scoped routes
 * that aren't rooted at a workspace path, e.g. `/properties`). Must run
 * after JwtAuthGuard — it reads `req.user`.
 */
@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(private readonly workspaceAuth: WorkspaceAuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user: AuthenticatedRequestUser;
        workspaceContext?: WorkspaceContext;
      }
    >();

    const workspaceId: string | undefined =
      firstValue(request.params.workspaceId) ??
      firstValue(request.params.id) ??
      firstValue(request.headers['x-workspace-id']);

    if (!workspaceId) {
      throw new BadRequestException(
        'A workspace id is required (route param or X-Workspace-Id header).',
      );
    }

    request.workspaceContext = await this.workspaceAuth.resolveContext(
      request.user.userId,
      workspaceId,
    );
    return true;
  }
}
