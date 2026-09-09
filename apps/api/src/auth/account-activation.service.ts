import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Runs once both email and phone are verified. A workspace/company (for
 * AGENT/COMPANY accounts) is created immediately at registration — see
 * AuthService.register — not here, since verification gates specific
 * features (see PublicationsService.submit), never the account's
 * ability to sign in and use the app at all. So this is now a pure
 * status transition: PENDING_VERIFICATION -> ACTIVE.
 *
 * Exactly-once semantics under concurrency (two verification calls
 * racing each other) are guaranteed by taking a row lock
 * (`SELECT ... FOR UPDATE`) on the user before deciding whether to
 * activate — the second concurrent caller blocks until the first
 * commits, then observes accountStatus already ACTIVE and no-ops. See
 * docs/DATABASE.md "Activation & idempotency".
 */
@Injectable()
export class AccountActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async activateIfVerified(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }

      if (user.accountStatus === 'ACTIVE') {
        return;
      }

      if (!user.emailVerifiedAt || !user.phoneVerifiedAt) {
        return;
      }

      await tx.user.update({
        where: { id: user.id },
        data: { accountStatus: 'ACTIVE' },
      });

      await this.audit.log(
        {
          actorUserId: user.id,
          action: 'account.activated',
          targetType: 'User',
          targetId: user.id,
        },
        tx,
      );
    });
  }
}
