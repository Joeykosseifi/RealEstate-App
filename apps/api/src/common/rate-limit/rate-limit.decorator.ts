import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  points: number;
  /** Window length, in seconds. */
  durationSeconds: number;
  /** Redis key namespace for this endpoint, e.g. "auth:login". */
  keyPrefix: string;
  /**
   * Optional request-body field to fold into the rate-limit key (e.g.
   * "email"), so limiting is per-account-attempted in addition to
   * per-IP. When the field is absent from the body, the key falls back
   * to IP-only.
   */
  identifierField?: string;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

export const RateLimit = (options: RateLimitOptions): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);
