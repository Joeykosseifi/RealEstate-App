import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordService } from '../common/security/password.service';
import { generateSecureToken, sha256Hex } from '../common/security/tokens.util';

/**
 * Security policy (documented per Milestone 1 requirement #12): a
 * successful password reset revokes every existing session for the
 * user. Rationale — a password reset most often follows a suspected
 * compromise, so any session established under the old (possibly
 * leaked) credentials should not be trusted to continue; the user
 * re-authenticates with the new password on every device.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
    private readonly configService: ConfigService<ApiEnv, true>,
    private readonly audit: AuditService,
    private readonly passwordService: PasswordService,
    private readonly sessions: SessionsService,
  ) {}

  private ttlMs(): number {
    const minutes = this.configService.get('PASSWORD_RESET_TTL_MINUTES', {
      infer: true,
    });
    return minutes * 60_000;
  }

  /** Always succeeds from the caller's point of view — never reveals whether the email is registered. */
  async requestReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const token = generateSecureToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + this.ttlMs());

    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.mail.send({
      to: user.email,
      subject: 'Reset your password',
      text: `Your password reset token is: ${token}\nThis expires in ${Math.round(this.ttlMs() / 60_000)} minutes. If you didn't request this, you can ignore this email.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.consumedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    ]);

    await this.sessions.revokeAllForUser(record.userId);

    await this.audit.log({
      actorUserId: record.userId,
      action: 'auth.password_reset',
      targetType: 'User',
      targetId: record.userId,
    });
  }
}
