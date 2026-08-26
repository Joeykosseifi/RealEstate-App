import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { UsersModule } from '../users/users.module';
import { AccountActivationModule } from '../auth/account-activation.module';
import { EmailVerificationService } from './email-verification.service';
import { PhoneVerificationService } from './phone-verification.service';

@Module({
  imports: [MailModule, SmsModule, UsersModule, AccountActivationModule],
  providers: [EmailVerificationService, PhoneVerificationService],
  exports: [EmailVerificationService, PhoneVerificationService],
})
export class VerificationModule {}
