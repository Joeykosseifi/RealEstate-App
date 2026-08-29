import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  Paginated,
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  toWorkspaceMemberSummary,
  toWorkspaceSummary,
} from './workspace.mapper';
import type { ListWorkspaceMembersQueryDto } from './dto/list-workspace-members-query.dto';
import type { UpdateWorkspaceContactDto } from './dto/update-workspace-contact.dto';

/**
 * Read-only workspace queries: the "which workspaces can I switch into"
 * list and per-workspace detail/roster. Membership mutation (invite,
 * suspend, remove, role change) lives in MembershipService.
 */
@Injectable()
export class WorkspaceDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Workspaces the user can currently switch into — ACTIVE memberships only. */
  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { workspace: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(toWorkspaceSummary);
  }

  /**
   * Paginated roster for one workspace, all statuses. `workspaceId` is
   * always resolved server-side by the caller (WorkspaceContextGuard,
   * from an already-authorized membership) — this never accepts it as
   * unvalidated client input, so there is no cross-workspace leakage.
   * `id` is appended as a tiebreaker after status/createdAt so ordering
   * (and therefore pagination) stays stable even when two rows share a
   * millisecond-precision createdAt.
   */
  async listMembers(
    workspaceId: string,
    query: ListWorkspaceMembersQueryDto = {},
  ): Promise<Paginated<WorkspaceMemberSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [members, totalItems] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: true, role: true },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
    ]);

    return {
      items: members.map(toWorkspaceMemberSummary),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /**
   * Updates the workspace's public marketplace contact info. An empty
   * string clears a field (stored as `null`); an omitted field is left
   * untouched. `workspaceId` is always resolved server-side from an
   * already-authorized membership — see `listMembers`'s doc comment.
   */
  async updateContact(
    workspaceId: string,
    dto: UpdateWorkspaceContactDto,
  ): Promise<void> {
    const data: Prisma.WorkspaceUpdateInput = {};
    if (dto.publicContactPhone !== undefined) {
      data.publicContactPhone = dto.publicContactPhone.trim() || null;
    }
    if (dto.publicContactEmail !== undefined) {
      data.publicContactEmail =
        dto.publicContactEmail.trim().toLowerCase() || null;
    }
    if (dto.publicContactWhatsapp !== undefined) {
      data.publicContactWhatsapp = dto.publicContactWhatsapp.trim() || null;
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    await this.prisma.workspace.update({ where: { id: workspaceId }, data });
  }
}
