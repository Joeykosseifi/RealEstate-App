import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, UserSession } from '@prisma/client';
import type { ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateSecureToken,
  secureCompareHex,
  sha256Hex,
} from '../common/security/tokens.util';
import { parseDurationMs } from '../common/time/duration.util';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

export interface SessionMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IssuedSession {
  session: UserSession;
  refreshToken: string;
}

export type RotateResult =
  | { outcome: 'ROTATED'; issued: IssuedSession }
  | { outcome: 'REUSED' }
  | { outcome: 'INVALID' };

/**
 * A refresh token is `${sessionId}.${secret}` — only sha256(secret) is
 * stored, keyed by sessionId for O(1) lookup (no hash-table scan needed).
 *
 * Rotation & reuse detection (see docs/SECURITY.md "Refresh token
 * rotation" for the full write-up): each successful refresh overwrites
 * the session's stored hash with a new one. If a token is presented whose
 * secret does NOT match the session's *current* hash — meaning it's a
 * stale token from before the last rotation — we treat that as reuse and
 * revoke the session immediately, forcing re-authentication. A revoked or
 * expired session's token is rejected outright.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<ApiEnv, true>,
  ) {}

  private refreshTtlMs(): number {
    return parseDurationMs(
      this.configService.get('JWT_REFRESH_TTL', { infer: true }),
    );
  }

  async createSession(
    userId: string,
    meta: SessionMeta = {},
    client: PrismaClientOrTx = this.prisma,
  ): Promise<IssuedSession> {
    const secret = generateSecureToken();
    const refreshTokenHash = sha256Hex(secret);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    const session = await client.userSession.create({
      data: {
        userId,
        refreshTokenHash,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    return { session, refreshToken: `${session.id}.${secret}` };
  }

  private parseToken(
    token: string,
  ): { sessionId: string; secret: string } | null {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      return null;
    }
    return {
      sessionId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1),
    };
  }

  /** Validates a refresh token without rotating it. Used for read-only session checks. */
  async verify(token: string): Promise<UserSession | null> {
    const parsed = this.parseToken(token);
    if (!parsed) {
      return null;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now()
    ) {
      return null;
    }

    if (!secureCompareHex(sha256Hex(parsed.secret), session.refreshTokenHash)) {
      return null;
    }

    return session;
  }

  async rotate(token: string, meta: SessionMeta = {}): Promise<RotateResult> {
    const parsed = this.parseToken(token);
    if (!parsed) {
      return { outcome: 'INVALID' };
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!session) {
      return { outcome: 'INVALID' };
    }

    if (session.revokedAt) {
      return { outcome: 'REUSED' };
    }

    if (session.expiresAt.getTime() < Date.now()) {
      return { outcome: 'INVALID' };
    }

    if (!secureCompareHex(sha256Hex(parsed.secret), session.refreshTokenHash)) {
      this.logger.warn(
        `Refresh token reuse detected for session ${session.id}; revoking session.`,
      );
      await this.revokeById(session.id);
      return { outcome: 'REUSED' };
    }

    const secret = generateSecureToken();
    const refreshTokenHash = sha256Hex(secret);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    const updated = await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        expiresAt,
        lastUsedAt: new Date(),
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ipAddress ?? session.ipAddress,
      },
    });

    return {
      outcome: 'ROTATED',
      issued: { session: updated, refreshToken: `${updated.id}.${secret}` },
    };
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.userSession
      .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  async revokeAllForUser(
    userId: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<void> {
    await client.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
