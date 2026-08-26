import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AccountActivationService } from '../auth/account-activation.service';
import { generateSecureToken, sha256Hex } from '../common/security/tokens.util';

/**
 * Link-style email verification. The raw token is only ever handed to
 * MailService (which, outside development, does not log or persist it —
 * see ConsoleMailProvider) — the database only ever stores its SHA-256
 * hash, and resend/verify never echo it back in an API response.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
    private readonly configService: ConfigService<ApiEnv, true>,
    private readonly audit: AuditService,
    private readonly activation: AccountActivationService,
  ) {}

  private ttlMs(): number {
    const minutes = this.configService.get('EMAIL_VERIFICATION_TTL_MINUTES', {
      infer: true,
    });
    return minutes * 60_000;
  }

  async sendVerificationEmail(user: User): Promise<void> {
    const token = generateSecureToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + this.ttlMs());

    await this.prisma.emailVerification.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.mail.send({
      to: user.email,
      subject: 'Verify your email address',
      text: `Your email verification token is: ${token}\nThis expires in ${Math.round(this.ttlMs() / 60_000)} minutes.`,
    });
  }

  /** Always succeeds from the caller's point of view — never reveals whether the email is registered. */
  async resend(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return;
    }
    await this.sendVerificationEmail(user);
  }

  async verify(token: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const record = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.consumedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorUserId: record.userId,
      action: 'email.verified',
      targetType: 'User',
      targetId: record.userId,
    });

    await this.activation.activateIfVerified(record.userId);
  }
}
