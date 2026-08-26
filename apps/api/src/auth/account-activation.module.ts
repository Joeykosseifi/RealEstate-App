import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AccountActivationService } from './account-activation.service';

@Module({
  imports: [WorkspacesModule],
  providers: [AccountActivationService],
  exports: [AccountActivationService],
})
export class AccountActivationModule {}
