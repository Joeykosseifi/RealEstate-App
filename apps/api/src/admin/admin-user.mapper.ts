import type {
  Role,
  User,
  UserPlatformRole,
  Workspace,
  WorkspaceMember,
} from '@prisma/client';
import type {
  AdminUserDetail,
  AdminUserSummary,
  AdminWorkspaceMembership,
} from '@real-estate/types';

/**
 * `email`/`phone` are only included when `canViewEmail` is true (the
 * actor holds `admin.users.view_email`) — omitted entirely otherwise,
 * never masked. See docs/PERMISSIONS.md "Admin email access".
 */
export function toAdminUserSummary(
  user: User,
  canViewEmail: boolean,
): AdminUserSummary {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    ...(canViewEmail ? { email: user.email, phone: user.phone } : {}),
    accountType: user.accountType,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

type UserWithRelations = User & {
  workspaceMemberships: (WorkspaceMember & {
    workspace: Workspace;
    role: Role | null;
  })[];
  platformRoles: (UserPlatformRole & { role: Role })[];
};

export function toAdminUserDetail(
  user: UserWithRelations,
  canViewEmail: boolean,
): AdminUserDetail {
  const workspaceMemberships: AdminWorkspaceMembership[] =
    user.workspaceMemberships.map((membership) => ({
      workspaceId: membership.workspace.id,
      workspaceType: membership.workspace.type,
      workspaceName: membership.workspace.name,
      membershipType: membership.membershipType,
      status: membership.status,
      roleKey: membership.role?.key ?? null,
    }));

  return {
    ...toAdminUserSummary(user, canViewEmail),
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    suspensionReason: user.suspensionReason,
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    deactivationReason: user.deactivationReason,
    restoredAt: user.restoredAt?.toISOString() ?? null,
    restoreReason: user.restoreReason,
    workspaceMemberships,
    platformRoles: user.platformRoles.map((grant) => grant.role.key),
  };
}
