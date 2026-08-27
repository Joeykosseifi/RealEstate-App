import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  ClientDetail,
  ClientListItem,
  Paginated,
} from '@real-estate/types';
import { RequireWorkspacePermission } from '../authorization/require-workspace-permission.decorator';
import { CurrentWorkspace } from '../authorization/current-workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import type { WorkspaceContext } from '../authorization/workspace-authorization.service';
import { PERMISSIONS } from '../authorization/permissions.catalog';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';

/**
 * Every route resolves its workspace via `WorkspaceContextGuard` from
 * the `:id` route param and re-checks ACTIVE membership + permission
 * server-side on every request — a client from a different workspace is
 * a `404`, not a `403` (see ClientsService.findOneOrThrow), so a
 * guessed UUID can't be used to distinguish "not yours" from "doesn't
 * exist." See docs/PERMISSIONS.md.
 */
@Controller('workspaces/:id/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_CREATE.key)
  async create(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateClientDto,
  ): Promise<ClientListItem> {
    return this.clients.create(
      workspaceContext.workspaceId,
      user.userId,
      workspaceContext.permissions,
      dto,
    );
  }

  @Get()
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_VIEW.key)
  async list(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Query() query: ListClientsQueryDto,
  ): Promise<Paginated<ClientListItem>> {
    return this.clients.findMany(workspaceContext.workspaceId, query);
  }

  @Get(':clientId')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_VIEW.key)
  async detail(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
  ): Promise<ClientDetail> {
    return this.clients.findOneForRead(workspaceContext.workspaceId, clientId);
  }

  @Patch(':clientId')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_EDIT.key)
  async update(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientListItem> {
    return this.clients.update(
      workspaceContext.workspaceId,
      clientId,
      user.userId,
      dto,
    );
  }

  @Post(':clientId/assign')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_ASSIGN.key)
  @HttpCode(HttpStatus.OK)
  async assign(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: AssignClientDto,
  ): Promise<ClientListItem> {
    return this.clients.assign(
      workspaceContext.workspaceId,
      clientId,
      user.userId,
      dto,
    );
  }

  @Post(':clientId/archive')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_ARCHIVE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.clients.archive(
      workspaceContext.workspaceId,
      clientId,
      user.userId,
    );
  }

  @Post(':clientId/restore')
  @RequireWorkspacePermission(PERMISSIONS.CLIENT_ARCHIVE.key)
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @CurrentWorkspace() workspaceContext: WorkspaceContext,
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.clients.restore(
      workspaceContext.workspaceId,
      clientId,
      user.userId,
    );
  }
}
