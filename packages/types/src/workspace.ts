export type WorkspaceType = 'PERSONAL' | 'COMPANY';

export type WorkspaceMembershipType = 'OWNER' | 'EMPLOYEE' | 'FREELANCE_AGENT' | 'COLLABORATOR';

export type WorkspaceMembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface WorkspaceSummary {
  id: string;
  type: WorkspaceType;
  name: string;
  companyId: string | null;
  membershipType: WorkspaceMembershipType;
  membershipStatus: WorkspaceMembershipStatus;
  roleKey: string | null;
  createdAt: string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  /** The requesting user's own resolved permissions in this workspace. */
  permissions: string[];
}

export interface WorkspaceMemberSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipType: WorkspaceMembershipType;
  status: WorkspaceMembershipStatus;
  roleKey: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  suspendedAt: string | null;
  removedAt: string | null;
}

export interface WorkspaceRoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}
