import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthTokens, AuthUser } from '@real-estate/types';
import { AuthService } from './auth.service';
import { EmailVerificationService } from '../verification/email-verification.service';
import { PhoneVerificationService } from '../verification/phone-verification.service';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from './auth.types';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

function sessionMeta(req: Request): { userAgent?: string; ipAddress?: string } {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('register/client')
  @RateLimit({
    points: 5,
    durationSeconds: 3600,
    keyPrefix: 'auth:register',
    identifierField: 'email',
  })
  async registerClient(
    @Body() dto: RegisterClientDto,
    @Req() req: Request,
  ): Promise<AuthUser> {
    return this.authService.registerClient(dto, req.ip);
  }

  @Post('register/agent')
  @RateLimit({
    points: 5,
    durationSeconds: 3600,
    keyPrefix: 'auth:register',
    identifierField: 'email',
  })
  async registerAgent(
    @Body() dto: RegisterAgentDto,
    @Req() req: Request,
  ): Promise<AuthUser> {
    return this.authService.registerAgent(dto, req.ip);
  }

  @Post('register/company')
  @RateLimit({
    points: 5,
    durationSeconds: 3600,
    keyPrefix: 'auth:register',
    identifierField: 'email',
  })
  async registerCompany(
    @Body() dto: RegisterCompanyDto,
    @Req() req: Request,
  ): Promise<AuthUser> {
    return this.authService.registerCompany(dto, req.ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    points: 10,
    durationSeconds: 900,
    keyPrefix: 'auth:login',
    identifierField: 'email',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    return this.authService.login(dto, sessionMeta(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 30, durationSeconds: 60, keyPrefix: 'auth:refresh' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken, sessionMeta(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedRequestUser): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedRequestUser): Promise<AuthUser> {
    return this.authService.me(user.userId);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    points: 10,
    durationSeconds: 900,
    keyPrefix: 'auth:email-verify',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.emailVerification.verify(dto.token);
  }

  @Post('email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    points: 3,
    durationSeconds: 900,
    keyPrefix: 'auth:email-resend',
    identifierField: 'email',
  })
  async resendEmail(@Body() dto: ResendEmailVerificationDto): Promise<void> {
    await this.emailVerification.resend(dto.email);
  }

  @Post('phone/request-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    points: 3,
    durationSeconds: 900,
    keyPrefix: 'auth:otp-request',
    identifierField: 'phone',
  })
  async requestOtp(@Body() dto: RequestOtpDto): Promise<void> {
    await this.phoneVerification.requestOtp(dto.phone);
  }

  @Post('phone/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    points: 10,
    durationSeconds: 900,
    keyPrefix: 'auth:otp-verify',
    identifierField: 'phone',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<void> {
    await this.phoneVerification.verifyOtp(dto.phone, dto.otp);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    points: 3,
    durationSeconds: 900,
    keyPrefix: 'auth:password-forgot',
    identifierField: 'email',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.passwordReset.requestReset(dto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    points: 10,
    durationSeconds: 900,
    keyPrefix: 'auth:password-reset',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordReset.resetPassword(dto.token, dto.newPassword);
  }
}
