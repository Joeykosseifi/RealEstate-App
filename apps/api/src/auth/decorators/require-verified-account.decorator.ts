import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { VerifiedAccountGuard } from '../guards/verified-account.guard';

/**
 * Authenticated AND verified. For workspace-related routes that aren't
 * permission-scoped to one workspace; `@RequireWorkspacePermission`
 * already includes this check.
 */
export const RequireVerifiedAccount = (): MethodDecorator & ClassDecorator =>
  UseGuards(JwtAuthGuard, VerifiedAccountGuard);
