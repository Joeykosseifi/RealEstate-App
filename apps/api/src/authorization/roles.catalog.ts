import {
  PERMISSIONS,
  type AuthorizationScope,
  type PermissionKey,
} from './permissions.catalog';

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  scope: AuthorizationScope;
  permissions: PermissionKey[];
}

const {
  WORKSPACE_VIEW,
  WORKSPACE_UPDATE,
  WORKSPACE_MANAGE_MEMBERS,
  WORKSPACE_MANAGE_ROLES,
  WORKSPACE_VIEW_AUDIT,
  TEAM_VIEW,
  TEAM_INVITE,
  TEAM_REMOVE,
  TEAM_SUSPEND,
  TEAM_ASSIGN_ROLE,
  PROPERTY_VIEW,
  PROPERTY_CREATE,
  PROPERTY_EDIT,
  PROPERTY_ARCHIVE,
  PROPERTY_PUBLISH,
  PROPERTY_UNPUBLISH,
  PROPERTY_SHARE,
  PROPERTY_CREATE_PRESENTATION,
  PROPERTY_VIEW_OWNER,
  PROPERTY_VIEW_PRIVATE_NOTES,
  PROPERTY_VIEW_COMMISSION,
  PROPERTY_VIEW_EXACT_LOCATION,
  CLIENT_VIEW,
  CLIENT_CREATE,
  CLIENT_EDIT,
  CLIENT_ASSIGN,
  CLIENT_ARCHIVE,
  COLLABORATION_VIEW,
  COLLABORATION_CREATE,
  COLLABORATION_MANAGE,
  COLLABORATION_END,
  ADMIN_USERS_VIEW,
  ADMIN_USERS_VIEW_EMAIL,
  ADMIN_USERS_SUSPEND,
  ADMIN_USERS_DEACTIVATE,
  ADMIN_USERS_RESTORE,
  ADMIN_CONTENT_VIEW,
  ADMIN_CONTENT_REVIEW,
  ADMIN_CONTENT_UNPUBLISH,
  ADMIN_CONTENT_ARCHIVE,
  ADMIN_CONTENT_RESTORE,
  ADMIN_COMPANIES_VIEW,
  ADMIN_COMPANIES_SUSPEND,
  ADMIN_COMPANIES_DEACTIVATE,
  ADMIN_COMPANIES_RESTORE,
  ADMIN_VERIFICATIONS_MANAGE,
  ADMIN_REPORTS_MANAGE,
  ADMIN_SUBSCRIPTIONS_MANAGE,
  ADMIN_AUDIT_VIEW,
  ADMIN_ROLES_MANAGE,
} = PERMISSIONS;

const ALL_WORKSPACE_OPERATIONAL_PERMISSIONS: PermissionKey[] = [
  PROPERTY_VIEW.key,
  PROPERTY_CREATE.key,
  PROPERTY_EDIT.key,
  PROPERTY_ARCHIVE.key,
  PROPERTY_PUBLISH.key,
  PROPERTY_UNPUBLISH.key,
  PROPERTY_SHARE.key,
  PROPERTY_CREATE_PRESENTATION.key,
  PROPERTY_VIEW_OWNER.key,
  PROPERTY_VIEW_PRIVATE_NOTES.key,
  PROPERTY_VIEW_COMMISSION.key,
  PROPERTY_VIEW_EXACT_LOCATION.key,
  CLIENT_VIEW.key,
  CLIENT_CREATE.key,
  CLIENT_EDIT.key,
  CLIENT_ASSIGN.key,
  CLIENT_ARCHIVE.key,
  COLLABORATION_VIEW.key,
  COLLABORATION_CREATE.key,
  COLLABORATION_MANAGE.key,
  COLLABORATION_END.key,
];

/**
 * System role catalog, seeded verbatim by prisma/seed.ts. Custom
 * per-workspace roles (created via the workspace role-management API)
 * are a separate, non-system Role row and are not listed here.
 *
 * Exact per-role permission sets are a documented product decision
 * where the spec didn't enumerate one field-by-field — see
 * docs/PERMISSIONS.md "Workspace roles" for the rationale behind each.
 */
export const WORKSPACE_ROLES: RoleDefinition[] = [
  {
    key: 'WORKSPACE_OWNER',
    name: 'Workspace Owner',
    description:
      'Full control of their own workspace. Not a platform administrator.',
    scope: 'WORKSPACE',
    permissions: [
      WORKSPACE_VIEW.key,
      WORKSPACE_UPDATE.key,
      WORKSPACE_MANAGE_MEMBERS.key,
      WORKSPACE_MANAGE_ROLES.key,
      WORKSPACE_VIEW_AUDIT.key,
      TEAM_VIEW.key,
      TEAM_INVITE.key,
      TEAM_REMOVE.key,
      TEAM_SUSPEND.key,
      TEAM_ASSIGN_ROLE.key,
      ...ALL_WORKSPACE_OPERATIONAL_PERMISSIONS,
    ],
  },
  {
    key: 'COMPANY_ADMIN',
    name: 'Company Admin',
    description: 'Manages day-to-day company workspace operations and team.',
    scope: 'WORKSPACE',
    permissions: [
      WORKSPACE_VIEW.key,
      WORKSPACE_UPDATE.key,
      WORKSPACE_MANAGE_MEMBERS.key,
      TEAM_VIEW.key,
      TEAM_INVITE.key,
      TEAM_REMOVE.key,
      TEAM_SUSPEND.key,
      TEAM_ASSIGN_ROLE.key,
      ...ALL_WORKSPACE_OPERATIONAL_PERMISSIONS,
    ],
  },
  {
    key: 'MANAGER',
    name: 'Manager',
    description:
      'Operational team permissions; cannot change workspace/team structure.',
    scope: 'WORKSPACE',
    permissions: [
      WORKSPACE_VIEW.key,
      TEAM_VIEW.key,
      PROPERTY_VIEW.key,
      PROPERTY_CREATE.key,
      PROPERTY_EDIT.key,
      PROPERTY_ARCHIVE.key,
      PROPERTY_CREATE_PRESENTATION.key,
      // Owner contact, private notes, and exact location are core data
      // needed to work a property day-to-day (see Milestone 3) — only
      // commission (financial split) stays restricted to owner/admin
      // roles, see docs/PERMISSIONS.md "Sensitive property fields."
      PROPERTY_VIEW_OWNER.key,
      PROPERTY_VIEW_PRIVATE_NOTES.key,
      PROPERTY_VIEW_EXACT_LOCATION.key,
      CLIENT_VIEW.key,
      CLIENT_CREATE.key,
      CLIENT_EDIT.key,
      CLIENT_ASSIGN.key,
    ],
  },
  {
    key: 'AGENT',
    name: 'Agent',
    description: 'Ordinary professional permissions.',
    scope: 'WORKSPACE',
    permissions: [
      WORKSPACE_VIEW.key,
      PROPERTY_VIEW.key,
      PROPERTY_CREATE.key,
      PROPERTY_EDIT.key,
      PROPERTY_ARCHIVE.key,
      PROPERTY_CREATE_PRESENTATION.key,
      // See MANAGER above — same rationale.
      PROPERTY_VIEW_OWNER.key,
      PROPERTY_VIEW_PRIVATE_NOTES.key,
      PROPERTY_VIEW_EXACT_LOCATION.key,
      CLIENT_VIEW.key,
      CLIENT_CREATE.key,
      CLIENT_EDIT.key,
    ],
  },
  {
    key: 'VIEWER',
    name: 'Viewer',
    description:
      'Read-only access. No create/edit/archive/share/publish permissions.',
    scope: 'WORKSPACE',
    permissions: [
      WORKSPACE_VIEW.key,
      TEAM_VIEW.key,
      PROPERTY_VIEW.key,
      CLIENT_VIEW.key,
      COLLABORATION_VIEW.key,
    ],
  },
];

export const PLATFORM_ROLES: RoleDefinition[] = [
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Platform owner. Full platform-wide administrative access.',
    scope: 'PLATFORM',
    permissions: [
      ADMIN_USERS_VIEW.key,
      ADMIN_USERS_VIEW_EMAIL.key,
      ADMIN_USERS_SUSPEND.key,
      ADMIN_USERS_DEACTIVATE.key,
      ADMIN_USERS_RESTORE.key,
      ADMIN_CONTENT_VIEW.key,
      ADMIN_CONTENT_REVIEW.key,
      ADMIN_CONTENT_UNPUBLISH.key,
      ADMIN_CONTENT_ARCHIVE.key,
      ADMIN_CONTENT_RESTORE.key,
      ADMIN_COMPANIES_VIEW.key,
      ADMIN_COMPANIES_SUSPEND.key,
      ADMIN_COMPANIES_DEACTIVATE.key,
      ADMIN_COMPANIES_RESTORE.key,
      ADMIN_VERIFICATIONS_MANAGE.key,
      ADMIN_REPORTS_MANAGE.key,
      ADMIN_SUBSCRIPTIONS_MANAGE.key,
      ADMIN_AUDIT_VIEW.key,
      ADMIN_ROLES_MANAGE.key,
    ],
  },
  {
    key: 'PLATFORM_ADMIN',
    name: 'Platform Admin',
    description:
      'Broad platform administration, excluding managing other platform admins.',
    scope: 'PLATFORM',
    permissions: [
      ADMIN_USERS_VIEW.key,
      ADMIN_USERS_VIEW_EMAIL.key,
      ADMIN_USERS_SUSPEND.key,
      ADMIN_USERS_DEACTIVATE.key,
      ADMIN_USERS_RESTORE.key,
      ADMIN_CONTENT_VIEW.key,
      ADMIN_CONTENT_REVIEW.key,
      ADMIN_CONTENT_UNPUBLISH.key,
      ADMIN_CONTENT_ARCHIVE.key,
      ADMIN_CONTENT_RESTORE.key,
      ADMIN_COMPANIES_VIEW.key,
      ADMIN_COMPANIES_SUSPEND.key,
      ADMIN_COMPANIES_DEACTIVATE.key,
      ADMIN_COMPANIES_RESTORE.key,
      ADMIN_VERIFICATIONS_MANAGE.key,
      ADMIN_REPORTS_MANAGE.key,
      ADMIN_SUBSCRIPTIONS_MANAGE.key,
      ADMIN_AUDIT_VIEW.key,
    ],
  },
  {
    key: 'PROPERTY_MODERATOR',
    name: 'Property Moderator',
    description: 'Moderates published/public content.',
    scope: 'PLATFORM',
    permissions: [
      ADMIN_CONTENT_VIEW.key,
      ADMIN_CONTENT_REVIEW.key,
      ADMIN_CONTENT_UNPUBLISH.key,
      ADMIN_CONTENT_ARCHIVE.key,
      ADMIN_CONTENT_RESTORE.key,
    ],
  },
  {
    key: 'USER_MODERATOR',
    name: 'User Moderator',
    description: 'Moderates user and company accounts.',
    scope: 'PLATFORM',
    permissions: [
      ADMIN_USERS_VIEW.key,
      ADMIN_USERS_VIEW_EMAIL.key,
      ADMIN_USERS_SUSPEND.key,
      ADMIN_USERS_DEACTIVATE.key,
      ADMIN_USERS_RESTORE.key,
      ADMIN_COMPANIES_VIEW.key,
      ADMIN_COMPANIES_SUSPEND.key,
      ADMIN_COMPANIES_DEACTIVATE.key,
      ADMIN_COMPANIES_RESTORE.key,
    ],
  },
  {
    key: 'SUPPORT_ADMIN',
    name: 'Support Admin',
    description:
      'Customer support access — account lookup and verification help.',
    scope: 'PLATFORM',
    permissions: [
      ADMIN_USERS_VIEW.key,
      ADMIN_USERS_VIEW_EMAIL.key,
      ADMIN_VERIFICATIONS_MANAGE.key,
    ],
  },
  {
    key: 'FINANCE_ADMIN',
    name: 'Finance Admin',
    description: 'Manages subscriptions and financial reporting.',
    scope: 'PLATFORM',
    permissions: [ADMIN_SUBSCRIPTIONS_MANAGE.key, ADMIN_REPORTS_MANAGE.key],
  },
  {
    key: 'ANALYST',
    name: 'Analyst',
    description: 'Read-only platform analytics/audit access.',
    scope: 'PLATFORM',
    permissions: [ADMIN_AUDIT_VIEW.key, ADMIN_REPORTS_MANAGE.key],
  },
];

export const SYSTEM_ROLES: RoleDefinition[] = [
  ...WORKSPACE_ROLES,
  ...PLATFORM_ROLES,
];
