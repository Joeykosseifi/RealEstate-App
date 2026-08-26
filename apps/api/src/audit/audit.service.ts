import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Never put secrets here (passwords, tokens, OTPs, refresh tokens) — see docs/SECURITY.md. */
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

/**
 * Append-only audit trail (see docs/SECURITY.md "Audit logging"). Pass a
 * transaction client when the audited action must be recorded atomically
 * with the write it describes (e.g. account activation); omit it for a
 * standalone write (e.g. a login).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    input: AuditLogInput,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }
}
