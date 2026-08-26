import type { Role, User, Workspace, WorkspaceMember } from '@prisma/client';
import type {
  WorkspaceMemberSummary,
  WorkspaceRoleSummary,
  WorkspaceSummary,
} from '@real-estate/types';
import type { RoleWithPermissions } from '../authorization/roles.service';

export function toWorkspaceSummary(
  membership: WorkspaceMember & { workspace: Workspace; role: Role | null },
): WorkspaceSummary {
  return {
    id: membership.workspace.id,
    type: membership.workspace.type,
    name: membership.workspace.name,
    companyId: membership.workspace.companyId,
    membershipType: membership.membershipType,
    membershipStatus: membership.status,
    roleKey: membership.role?.key ?? null,
    createdAt: membership.workspace.createdAt.toISOString(),
  };
}

export function toWorkspaceMemberSummary(
  member: WorkspaceMember & { user: User; role: Role | null },
): WorkspaceMemberSummary {
  return {
    id: member.id,
    userId: member.user.id,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    email: member.user.email,
    membershipType: member.membershipType,
    status: member.status,
    roleKey: member.role?.key ?? null,
    invitedAt: member.invitedAt?.toISOString() ?? null,
    joinedAt: member.joinedAt?.toISOString() ?? null,
    suspendedAt: member.suspendedAt?.toISOString() ?? null,
    removedAt: member.removedAt?.toISOString() ?? null,
  };
}

export function toWorkspaceRoleSummary(
  role: RoleWithPermissions,
): WorkspaceRoleSummary {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map(
      (rolePermission) => rolePermission.permission.key,
    ),
  };
}
