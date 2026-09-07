import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ApiEnv } from '../../config/env';
import { UsersService } from '../../users/users.service';
import { SessionsService } from '../../sessions/sessions.service';
import type { AuthenticatedRequestUser, JwtAccessPayload } from '../auth.types';

/**
 * Validates the access token signature/expiry (handled by passport-jwt
 * itself), then re-checks two things on every request so neither can
 * wait out the token's own TTL:
 *
 * 1. The user's current account status — SUSPENDED/DEACTIVATED accounts
 *    are rejected even if their access token hasn't expired yet.
 *    PENDING_VERIFICATION accounts ARE allowed through: verification
 *    gates specific product features, not authentication itself.
 * 2. The session named by the token's `sid` is still live — logout and
 *    password reset both revoke the `UserSession` row immediately (see
 *    AuthService.logout / PasswordResetService.resetPassword), and that
 *    revocation must take effect immediately too, not only once the
 *    already-issued access token's own short TTL naturally expires.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<ApiEnv, true>,
    private readonly usersService: UsersService,
    private readonly sessions: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedRequestUser> {
    const [user, sessionActive] = await Promise.all([
      this.usersService.findById(payload.sub),
      this.sessions.isActive(payload.sid),
    ]);

    if (
      !user ||
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'DEACTIVATED' ||
      !sessionActive
    ) {
      throw new UnauthorizedException();
    }

    return { userId: user.id, sessionId: payload.sid, user };
  }
}
