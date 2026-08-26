import { Injectable } from '@nestjs/common';
import type {
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  toWorkspaceMemberSummary,
  toWorkspaceSummary,
} from './workspace.mapper';

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

  async listMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true, role: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    return members.map(toWorkspaceMemberSummary);
  }
}
