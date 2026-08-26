import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';

/**
 * Fixed-window rate limiter backed by Redis (safe across multiple API
 * instances — see docs/SECURITY.md "Rate limiting"). Checks the request's
 * IP and, when configured, a body field (e.g. email/phone) as independent
 * limit dimensions: either one tripping rejects the request.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';

    const keys = [`ratelimit:${options.keyPrefix}:ip:${ip}`];

    if (options.identifierField) {
      const body = request.body as Record<string, unknown> | undefined;
      const value = body?.[options.identifierField];
      if (typeof value === 'string' && value.trim().length > 0) {
        keys.push(
          `ratelimit:${options.keyPrefix}:id:${value.trim().toLowerCase()}`,
        );
      }
    }

    for (const key of keys) {
      const count = await this.increment(key, options.durationSeconds);
      if (count > options.points) {
        throw new HttpException(
          'Too many requests. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  private async increment(
    key: string,
    durationSeconds: number,
  ): Promise<number> {
    const client = this.redisService.getClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, durationSeconds);
    }
    return count;
  }
}
