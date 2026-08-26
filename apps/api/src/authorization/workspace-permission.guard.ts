import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { WorkspaceContext } from './workspace-authorization.service';
import { REQUIRE_WORKSPACE_PERMISSION_KEY } from './require-workspace-permission.decorator';

/** Must run after WorkspaceContextGuard — reads `req.workspaceContext`. */
@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string | undefined>(
      REQUIRE_WORKSPACE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!required) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { workspaceContext?: WorkspaceContext }>();
    const workspaceContext = request.workspaceContext;

    if (!workspaceContext || !workspaceContext.permissions.has(required)) {
      throw new ForbiddenException(
        `Missing required workspace permission: ${required}`,
      );
    }

    return true;
  }
}
