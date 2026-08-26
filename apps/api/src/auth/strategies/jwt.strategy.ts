import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ApiEnv } from '../../config/env';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedRequestUser, JwtAccessPayload } from '../auth.types';

/**
 * Validates the access token signature/expiry (handled by passport-jwt
 * itself), then re-checks the user's current account status on every
 * request — SUSPENDED/DEACTIVATED accounts are rejected even if their
 * access token hasn't expired yet, so a suspension takes effect
 * immediately rather than waiting out the token's TTL.
 * PENDING_VERIFICATION accounts ARE allowed through: verification gates
 * specific product features, not authentication itself.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<ApiEnv, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedRequestUser> {
    const user = await this.usersService.findById(payload.sub);

    if (
      !user ||
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'DEACTIVATED'
    ) {
      throw new UnauthorizedException();
    }

    return { userId: user.id, sessionId: payload.sid, user };
  }
}
