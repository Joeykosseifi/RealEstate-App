import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { UsersService } from '../users/users.service';
import { AccountActivationService } from '../auth/account-activation.service';
import {
  generateNumericOtp,
  secureCompareHex,
  sha256Hex,
} from '../common/security/tokens.util';

/**
 * Numeric-OTP phone verification. Only the SHA-256 hash of the code is
 * stored; the raw code is only ever handed to SmsService (which, outside
 * development, does not log or persist it — see ConsoleSmsProvider).
 */
@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly sms: SmsService,
    private readonly configService: ConfigService<ApiEnv, true>,
    private readonly audit: AuditService,
    private readonly activation: AccountActivationService,
  ) {}

  private ttlMs(): number {
    const minutes = this.configService.get('PHONE_OTP_TTL_MINUTES', {
      infer: true,
    });
    return minutes * 60_000;
  }

  private maxAttempts(): number {
    return this.configService.get('PHONE_OTP_MAX_ATTEMPTS', { infer: true });
  }

  async sendOtp(user: User): Promise<void> {
    if (!user.phone) {
      throw new BadRequestException(
        'This account has no phone number on file.',
      );
    }

    const otp = generateNumericOtp(6);
    const otpHash = sha256Hex(otp);
    const expiresAt = new Date(Date.now() + this.ttlMs());

    await this.prisma.phoneVerification.create({
      data: { userId: user.id, phone: user.phone, otpHash, expiresAt },
    });

    await this.sms.send(
      user.phone,
      `Your verification code is ${otp}. It expires in ${Math.round(this.ttlMs() / 60_000)} minutes.`,
    );
  }

  /** Always succeeds from the caller's point of view — never reveals whether the phone is registered. */
  async requestOtp(phone: string): Promise<void> {
    const normalized = this.usersService.normalizePhone(phone);
    const user = await this.prisma.user.findUnique({
      where: { phone: normalized },
    });
    if (!user || user.phoneVerifiedAt) {
      return;
    }
    await this.sendOtp(user);
  }

  async verifyOtp(phone: string, otp: string): Promise<void> {
    const normalized = this.usersService.normalizePhone(phone);
    const user = await this.prisma.user.findUnique({
      where: { phone: normalized },
    });

    const genericError = new BadRequestException(
      'Invalid or expired verification code.',
    );
    if (!user) {
      throw genericError;
    }

    const record = await this.prisma.phoneVerification.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw genericError;
    }

    if (record.attempts >= this.maxAttempts()) {
      throw new BadRequestException(
        'Too many attempts. Request a new verification code.',
      );
    }

    const matches = secureCompareHex(sha256Hex(otp), record.otpHash);
    if (!matches) {
      await this.prisma.phoneVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw genericError;
    }

    await this.prisma.$transaction([
      this.prisma.phoneVerification.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorUserId: user.id,
      action: 'phone.verified',
      targetType: 'User',
      targetId: user.id,
    });

    await this.activation.activateIfVerified(user.id);
  }
}
