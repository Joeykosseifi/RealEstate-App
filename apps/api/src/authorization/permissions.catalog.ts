/**
 * The single source of truth for every permission key in the system.
 * Never hard-code a raw permission string anywhere else — import from
 * here (see PERMISSIONS below) so a typo is a compile error, not a
 * silent always-false check. Consumed by prisma/seed.ts (to populate the
 * `Permission` table) and by every `@RequireWorkspacePermission` /
 * `@RequirePlatformPermission` call site.
 *
 * `scope` is enforced, not descriptive: RolesService refuses to attach a
 * PLATFORM permission to a WORKSPACE-scope role, structurally guaranteeing
 * a workspace (company admin, custom role, etc.) can never obtain a
 * platform/admin capability. See docs/PERMISSIONS.md.
 */

export type AuthorizationScope = 'PLATFORM' | 'WORKSPACE';

export interface PermissionDefinition {
  key: string;
  scope: AuthorizationScope;
  description: string;
}

function workspacePermission(
  key: string,
  description: string,
): PermissionDefinition {
  return { key, scope: 'WORKSPACE', description };
}

function platformPermission(
  key: string,
  description: string,
): PermissionDefinition {
  return { key, scope: 'PLATFORM', description };
}

export const PERMISSIONS = {
  // Workspace
  WORKSPACE_VIEW: workspacePermission(
    'workspace.view',
    'View workspace details',
  ),
  WORKSPACE_UPDATE: workspacePermission(
    'workspace.update',
    'Update workspace settings',
  ),
  WORKSPACE_MANAGE_MEMBERS: workspacePermission(
    'workspace.manage_members',
    'Invite, suspend, remove workspace members',
  ),
  WORKSPACE_MANAGE_ROLES: workspacePermission(
    'workspace.manage_roles',
    'Create/edit/delete custom workspace roles',
  ),
  WORKSPACE_VIEW_AUDIT: workspacePermission(
    'workspace.view_audit',
    "View this workspace's audit history",
  ),

  // Team
  TEAM_VIEW: workspacePermission('team.view', 'View the team roster'),
  TEAM_INVITE: workspacePermission(
    'team.invite',
    'Invite a user to the workspace',
  ),
  TEAM_REMOVE: workspacePermission(
    'team.remove',
    'Remove a member from the workspace',
  ),
  TEAM_SUSPEND: workspacePermission(
    'team.suspend',
    "Suspend a member's workspace access",
  ),
  TEAM_ASSIGN_ROLE: workspacePermission(
    'team.assign_role',
    "Change a member's workspace role",
  ),

  // Property (foundation only — enforced starting Milestone 3)
  PROPERTY_VIEW: workspacePermission('property.view', 'View a property record'),
  PROPERTY_CREATE: workspacePermission(
    'property.create',
    'Create a property record',
  ),
  PROPERTY_EDIT: workspacePermission('property.edit', 'Edit a property record'),
  PROPERTY_ARCHIVE: workspacePermission(
    'property.archive',
    'Archive a property record',
  ),
  PROPERTY_PUBLISH: workspacePermission(
    'property.publish',
    'Submit a property for publication',
  ),
  PROPERTY_UNPUBLISH: workspacePermission(
    'property.unpublish',
    'Remove a published property from the marketplace',
  ),
  PROPERTY_SHARE: workspacePermission(
    'property.share',
    'Share a property with another workspace (collaboration)',
  ),
  PROPERTY_CREATE_PRESENTATION: workspacePermission(
    'property.create_presentation',
    'Build a presentation/PDF from a property',
  ),
  PROPERTY_VIEW_OWNER: workspacePermission(
    'property.view_owner',
    'View owner contact details',
  ),
  PROPERTY_VIEW_PRIVATE_NOTES: workspacePermission(
    'property.view_private_notes',
    'View private internal notes',
  ),
  PROPERTY_VIEW_COMMISSION: workspacePermission(
    'property.view_commission',
    'View commission information',
  ),
  PROPERTY_VIEW_EXACT_LOCATION: workspacePermission(
    'property.view_exact_location',
    'View exact saved coordinates',
  ),

  // Client CRM (foundation only — enforced starting Milestone 4)
  CLIENT_VIEW: workspacePermission('client.view', 'View a CRM client record'),
  CLIENT_CREATE: workspacePermission(
    'client.create',
    'Create a CRM client record',
  ),
  CLIENT_EDIT: workspacePermission('client.edit', 'Edit a CRM client record'),
  CLIENT_ASSIGN: workspacePermission(
    'client.assign',
    'Assign a CRM client to an agent',
  ),
  CLIENT_ARCHIVE: workspacePermission(
    'client.archive',
    'Archive a CRM client record',
  ),

  // Collaboration (foundation only — enforced starting Milestone 9)
  COLLABORATION_VIEW: workspacePermission(
    'collaboration.view',
    'View a collaboration',
  ),
  COLLABORATION_CREATE: workspacePermission(
    'collaboration.create',
    'Propose/create a collaboration',
  ),
  COLLABORATION_MANAGE: workspacePermission(
    'collaboration.manage',
    "Manage a collaboration's terms/permissions",
  ),
  COLLABORATION_END: workspacePermission(
    'collaboration.end',
    'End a collaboration',
  ),

  // Admin / platform
  ADMIN_USERS_VIEW: platformPermission(
    'admin.users.view',
    'List/view user accounts',
  ),
  ADMIN_USERS_VIEW_EMAIL: platformPermission(
    'admin.users.view_email',
    "View a user's registered email address",
  ),
  ADMIN_USERS_SUSPEND: platformPermission(
    'admin.users.suspend',
    'Suspend a user account',
  ),
  ADMIN_USERS_DEACTIVATE: platformPermission(
    'admin.users.deactivate',
    'Deactivate a user account',
  ),
  ADMIN_USERS_RESTORE: platformPermission(
    'admin.users.restore',
    'Restore a suspended/deactivated user account',
  ),
  ADMIN_CONTENT_VIEW: platformPermission(
    'admin.content.view',
    'View public/business content for moderation',
  ),
  ADMIN_CONTENT_UNPUBLISH: platformPermission(
    'admin.content.unpublish',
    'Unpublish public content',
  ),
  ADMIN_CONTENT_ARCHIVE: platformPermission(
    'admin.content.archive',
    'Archive business content',
  ),
  ADMIN_CONTENT_RESTORE: platformPermission(
    'admin.content.restore',
    'Restore unpublished/archived content',
  ),
  ADMIN_COMPANIES_VIEW: platformPermission(
    'admin.companies.view',
    'List/view companies',
  ),
  ADMIN_COMPANIES_SUSPEND: platformPermission(
    'admin.companies.suspend',
    'Suspend a company',
  ),
  ADMIN_COMPANIES_DEACTIVATE: platformPermission(
    'admin.companies.deactivate',
    'Deactivate a company',
  ),
  ADMIN_COMPANIES_RESTORE: platformPermission(
    'admin.companies.restore',
    'Restore a suspended/deactivated company',
  ),
  ADMIN_VERIFICATIONS_MANAGE: platformPermission(
    'admin.verifications.manage',
    'Manage company/agent verification status',
  ),
  ADMIN_REPORTS_MANAGE: platformPermission(
    'admin.reports.manage',
    'Manage platform reports',
  ),
  ADMIN_SUBSCRIPTIONS_MANAGE: platformPermission(
    'admin.subscriptions.manage',
    'Manage subscriptions/plans',
  ),
  ADMIN_AUDIT_VIEW: platformPermission(
    'admin.audit.view',
    'View platform-wide audit logs',
  ),
  ADMIN_ROLES_MANAGE: platformPermission(
    'admin.roles.manage',
    'Grant/revoke platform roles and manage the role catalog',
  ),
} as const satisfies Record<string, PermissionDefinition>;

export type PermissionKey =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS]['key'];

export const PERMISSION_CATALOG: readonly PermissionDefinition[] =
  Object.values(PERMISSIONS);
