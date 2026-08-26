import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SecurityModule } from '../common/security/security.module';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [MailModule, UsersModule, SessionsModule, SecurityModule],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
