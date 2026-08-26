import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { PlatformRolesService } from './platform-roles.service';
import { AdminPlatformRolesController } from './admin-platform-roles.controller';
import { AdminCompaniesService } from './admin-companies.service';
import { AdminCompaniesController } from './admin-companies.controller';

@Module({
  imports: [SessionsModule],
  controllers: [
    AdminUsersController,
    AdminPlatformRolesController,
    AdminCompaniesController,
  ],
  providers: [AdminUsersService, PlatformRolesService, AdminCompaniesService],
})
export class AdminModule {}
