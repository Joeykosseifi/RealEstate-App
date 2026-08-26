import { Module } from '@nestjs/common';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { ApiEnv } from '../config/env';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from '../common/security/security.module';
import { SessionsModule } from '../sessions/sessions.module';
import { VerificationModule } from '../verification/verification.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    SecurityModule,
    SessionsModule,
    VerificationModule,
    PasswordResetModule,
    RateLimitModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [NestConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ApiEnv, true>) => ({
        secret: configService.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_TTL', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
