import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequestUser } from '../auth.types';
import {
  AccountVerificationRequiredException,
  isAccountVerified,
} from '../account-verification';

/**
 * Must run after JwtAuthGuard. `req.user.user` is re-read from the
 * database on every request by JwtStrategy, so this always reflects live
 * verification state — never a client-side flag or a stale token claim.
 */
@Injectable()
export class VerifiedAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedRequestUser }>();

    if (!request.user || !isAccountVerified(request.user.user)) {
      throw new AccountVerificationRequiredException();
    }
    return true;
  }
}
