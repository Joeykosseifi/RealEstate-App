import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, User } from '@prisma/client';
import type { ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { toAuthUser } from '../users/user.mapper';
import { PasswordService } from '../common/security/password.service';
import { isUniqueConstraintViolation } from '../common/prisma/unique-constraint.util';
import { parseDurationMs } from '../common/time/duration.util';
import {
  SessionsService,
  type SessionMeta,
} from '../sessions/sessions.service';
import { EmailVerificationService } from '../verification/email-verification.service';
import { PhoneVerificationService } from '../verification/phone-verification.service';
import type { PendingCompanyProfile } from '../workspaces/workspaces.service';
import type { AuthTokens, AuthUser } from '@real-estate/types';
import type { RegisterClientDto } from './dto/register-client.dto';
import type { RegisterAgentDto } from './dto/register-agent.dto';
import type { RegisterCompanyDto } from './dto/register-company.dto';
import type { LoginDto } from './dto/login.dto';

/**
 * Precomputed Argon2id hash of a fixed dummy value. Verified against on
 * an unknown-email login attempt so the response time doesn't betray
 * whether the email exists (a real user always pays for one
 * PasswordService.verify() call; without this, a nonexistent email would
 * short-circuit and respond measurably faster).
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$axcxbTeQqcHts2q5Od/qHw$V6Us4K3qMlovNx1ZXYHjFRZ7PvrmMZPksnPMt79p1fc';

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly sessions: SessionsService,
    private readonly emailVerification: EmailVerificationService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService<ApiEnv, true>,
  ) {}

  async registerClient(
    dto: RegisterClientDto,
    ipAddress?: string,
  ): Promise<AuthUser> {
    return this.register(dto, 'CLIENT', null, ipAddress);
  }

  async registerAgent(
    dto: RegisterAgentDto,
    ipAddress?: string,
  ): Promise<AuthUser> {
    return this.register(dto, 'AGENT', null, ipAddress);
  }

  async registerCompany(
    dto: RegisterCompanyDto,
    ipAddress?: string,
  ): Promise<AuthUser> {
    const profile: PendingCompanyProfile = {
      name: dto.companyName,
      email: dto.companyEmail,
      phone: dto.companyPhone,
      website: dto.companyWebsite,
      description: dto.companyDescription,
    };
    return this.register(dto, 'COMPANY', profile, ipAddress);
  }

  private async register(
    dto: RegisterInput,
    accountType: User['accountType'],
    pendingCompanyProfile: PendingCompanyProfile | null,
    ipAddress?: string,
  ): Promise<AuthUser> {
    const email = this.usersService.normalizeEmail(dto.email);
    const phone = this.usersService.normalizePhone(dto.phone);
    const passwordHash = await this.passwordService.hash(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          phone,
          passwordHash,
          accountType,
          accountStatus: 'PENDING_VERIFICATION',
          termsAcceptedAt: new Date(),
          pendingCompanyProfile:
            (pendingCompanyProfile as unknown as Prisma.InputJsonValue) ??
            undefined,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'email')) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      if (isUniqueConstraintViolation(error, 'phone')) {
        throw new ConflictException(
          'An account with this phone number already exists.',
        );
      }
      throw error;
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'account.registered',
      targetType: 'User',
      targetId: user.id,
      metadata: { accountType },
      ipAddress,
    });

    await Promise.all([
      this.emailVerification.sendVerificationEmail(user),
      this.phoneVerification.sendOtp(user),
    ]);

    return toAuthUser(user);
  }

  async login(
    dto: LoginDto,
    meta: SessionMeta,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const genericError = new UnauthorizedException(
      'Invalid email or password.',
    );
    const user = await this.usersService.findByEmail(dto.email);

    const passwordOk = await this.passwordService.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (!user || !passwordOk) {
      throw genericError;
    }

    if (
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'DEACTIVATED'
    ) {
      throw genericError;
    }

    const issued = await this.sessions.createSession(user.id, meta);
    const accessToken = this.signAccessToken(user.id, issued.session.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'auth.login_success',
      targetType: 'User',
      targetId: user.id,
      ipAddress: meta.ipAddress,
    });

    return {
      user: toAuthUser(user),
      tokens: {
        accessToken,
        refreshToken: issued.refreshToken,
        expiresIn: this.accessTtlSeconds(),
      },
    };
  }

  async refresh(refreshToken: string, meta: SessionMeta): Promise<AuthTokens> {
    const result = await this.sessions.rotate(refreshToken, meta);

    if (result.outcome === 'REUSED') {
      throw new UnauthorizedException(
        'This refresh token has already been used. Please log in again.',
      );
    }
    if (result.outcome === 'INVALID') {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const { session, refreshToken: newRefreshToken } = result.issued;
    const accessToken = this.signAccessToken(session.userId, session.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessions.revokeById(sessionId);
    await this.audit.log({
      actorUserId: userId,
      action: 'auth.logout',
      targetType: 'UserSession',
      targetId: sessionId,
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toAuthUser(user);
  }

  private signAccessToken(userId: string, sessionId: string): string {
    return this.jwtService.sign({ sub: userId, sid: sessionId });
  }

  private accessTtlSeconds(): number {
    return Math.round(
      parseDurationMs(
        this.configService.get('JWT_ACCESS_TTL', { infer: true }),
      ) / 1000,
    );
  }
}
