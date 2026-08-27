import type { AccountStatus, AccountType } from './auth';

/**
 * `email`/`phone` are present only when the requesting admin also holds
 * `admin.users.view_email` — otherwise the API omits them entirely
 * rather than sending a masked placeholder. See docs/PERMISSIONS.md
 * "Admin email access".
 */
export interface AdminUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string | null;
  accountType: AccountType;
  accountStatus: AccountStatus;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminWorkspaceMembership {
  workspaceId: string;
  workspaceType: 'PERSONAL' | 'COMPANY';
  workspaceName: string;
  membershipType: string;
  status: string;
  roleKey: string | null;
}

export interface AdminCompanySummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdByUserId: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  termsAcceptedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  restoredAt: string | null;
  restoreReason: string | null;
  workspaceMemberships: AdminWorkspaceMembership[];
  platformRoles: string[];
}
