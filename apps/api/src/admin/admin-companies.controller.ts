import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AdminCompanySummary, Paginated } from '@real-estate/types';
import { RequirePlatformPermission } from '../authorization/require-platform-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { AdminCompaniesService } from './admin-companies.service';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';
import { RestoreActionDto } from './dto/restore-action.dto';

@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly adminCompanies: AdminCompaniesService) {}

  @Get()
  @RequirePlatformPermission(PERMISSIONS.ADMIN_COMPANIES_VIEW.key)
  async list(
    @Query() query: ListCompaniesQueryDto,
  ): Promise<Paginated<AdminCompanySummary>> {
    return this.adminCompanies.list(query);
  }

  @Post(':id/suspend')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_COMPANIES_SUSPEND.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: ModerationActionDto,
  ): Promise<void> {
    await this.adminCompanies.suspend(id, actor.userId, dto.reason);
  }

  @Post(':id/restore')
  @RequirePlatformPermission(PERMISSIONS.ADMIN_COMPANIES_RESTORE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedRequestUser,
    @Body() dto: RestoreActionDto,
  ): Promise<void> {
    await this.adminCompanies.restore(id, actor.userId, dto.reason);
  }
}
