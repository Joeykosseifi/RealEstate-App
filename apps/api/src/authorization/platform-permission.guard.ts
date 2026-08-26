import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { PlatformAuthorizationService } from './platform-authorization.service';
import { REQUIRE_PLATFORM_PERMISSION_KEY } from './require-platform-permission.decorator';

/**
 * Independent of workspace authorization entirely — a platform admin
 * doesn't need to be a member of any workspace. Must run after
 * JwtAuthGuard. Attaches the full resolved permission set to
 * `req.platformPermissions` so a controller can check for an additional,
 * non-required permission (e.g. admin.users.view_email) without a second
 * DB round trip.
 */
@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformAuth: PlatformAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string | undefined>(
      REQUIRE_PLATFORM_PERMISSION_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest<
      Request & {
        user: AuthenticatedRequestUser;
        platformPermissions?: Set<string>;
      }
    >();

    const permissions = await this.platformAuth.resolvePermissions(
      request.user.userId,
    );
    request.platformPermissions = permissions;

    if (required && !permissions.has(required)) {
      throw new ForbiddenException(
        `Missing required platform permission: ${required}`,
      );
    }

    return true;
  }
}
