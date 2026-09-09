import { Module } from '@nestjs/common';
import { AccountActivationService } from './account-activation.service';

@Module({
  providers: [AccountActivationService],
  exports: [AccountActivationService],
})
export class AccountActivationModule {}
