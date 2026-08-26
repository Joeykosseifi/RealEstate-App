import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PendingCompanyProfile } from '../workspaces/workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

/**
 * Runs once both email and phone are verified. Exactly-once semantics
 * under concurrency (two verification calls racing each other) are
 * guaranteed by taking a row lock (`SELECT ... FOR UPDATE`) on the user
 * before deciding whether to activate — the second concurrent caller
 * blocks until the first commits, then observes accountStatus already
 * ACTIVE and no-ops. See docs/DATABASE.md "Activation & idempotency".
 */
@Injectable()
export class AccountActivationService {
  private readonly logger = new Logger(AccountActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
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

      if (user.accountType === 'AGENT') {
        await this.workspaces.ensurePersonalWorkspace(
          tx,
          user.id,
          `${user.firstName} ${user.lastName}`.trim(),
        );
      } else if (user.accountType === 'COMPANY') {
        const profile =
          user.pendingCompanyProfile as PendingCompanyProfile | null;
        if (!profile) {
          this.logger.error(
            `User ${user.id} is type COMPANY but has no pendingCompanyProfile`,
          );
          return;
        }
        await this.workspaces.createCompanyWithWorkspace(tx, user.id, profile);
      }
      // CLIENT: no workspace is created.

      await tx.user.update({
        where: { id: user.id },
        data: {
          accountStatus: 'ACTIVE',
          pendingCompanyProfile: Prisma.JsonNull,
        },
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
