import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceDirectoryService } from './workspace-directory.service';
import { MembershipService } from './membership.service';
import { WorkspacesController } from './workspaces.controller';

@Module({
  imports: [UsersModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceDirectoryService, MembershipService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
