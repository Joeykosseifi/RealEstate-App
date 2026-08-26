# Workspaces, Ownership & Permissions

This document is the reference for the platform's core authorization
model. It is written ahead of implementation (Milestone 2) so every
milestone that touches professional data is built against the same rules.

## The four concepts

1. **Workspace** — the container all professional data belongs to.
   - An independent agent automatically gets a personal workspace on
     account activation.
   - A company has a company workspace.
   - A user may belong to multiple workspaces (e.g. their own personal
     workspace plus one or more company workspaces).
   - Personal and company data are never merged.

2. **Ownership** — which workspace owns an entity.
   - A property created in an agent's personal workspace belongs to that
     personal workspace, permanently.
   - A property created in a company workspace belongs to the company,
     even if a specific employee entered it.
   - Sharing a personal property with a company (collaboration) never
     transfers ownership — the company only gets explicitly granted
     permissions.
   - Ending a collaboration revokes future access but preserves
     historical/audit records and existing transaction records.

3. **Permissions** — granular, independent, default-deny grants.
4. **Publication Status** — separate from business status; see below.

## Membership vs. ownership vs. permission

Membership in a workspace grants **access to operate within it** (subject
to role/permissions) — it never implies ownership of any specific entity,
and it never bypasses collaboration-scoped restrictions on entities owned
by a different workspace.

## Property status model

Business status (independent of publication):

- `AVAILABLE`, `RESERVED`, `SOLD`, `RENTED`, `OFF_MARKET`, `ARCHIVED`

Publication lifecycle (independent of business status):

- `PRIVATE` → `PENDING_REVIEW` → `UNDER_REVIEW` →
  `CHANGES_REQUIRED` / `APPROVED` → `PUBLISHED`, or `REJECTED`;
  a published property can later be `UNPUBLISHED`.

A property can be, for example, `AVAILABLE` + `PRIVATE`,
`AVAILABLE` + `PUBLISHED`, or permanently `SOLD` while remaining in the
professional database as historical data.

Professionals can never directly publish — only submit for review.
Admins approve, reject, or request changes. A collaborating company may
submit on a freelance agent's behalf only with explicit `property.publish`
permission, and only for that specific property; this never transfers
ownership.

## Sensitive permissions (independent, default-deny)

| Permission | Grants |
|---|---|
| `property.view` | Basic visibility into a property record |
| `property.edit` | Modify a property record |
| `property.share` | Share a property with another workspace (collaboration) |
| `property.publish` | Submit a property for publication review |
| `property.unpublish` | Remove a published property from the marketplace |
| `property.create_presentation` | Build a presentation/PDF from a property |
| `property.view_owner` | View owner contact details |
| `property.view_private_notes` | View private internal notes |
| `property.view_commission` | View commission information |
| `property.view_exact_location` | View exact saved coordinates (vs. approximate) |

`property.view` never implies any of the others. Any permission not
explicitly granted is denied.

## Location visibility

Independent of the permissions above, each property has a location
visibility setting controlling what the *public marketplace* (not
workspace members) can see:

- `PRIVATE`, `WORKSPACE`, `PUBLIC_APPROXIMATE`, `PUBLIC_EXACT`

Saved latitude/longitude/Google Place ID are always the source of truth
in the database. Clients never receive exact coordinates unless the
property's location visibility is `PUBLIC_EXACT`, or exact-location
access is separately granted via `property.view_exact_location`
(workspace/collaboration context) or a secure private share.

## Collaboration lifecycle

`PENDING` → `ACTIVE` → (`DECLINED` | `REVOKED` | `ENDED`)

A collaboration grants a specific set of permissions (from the table
above) to a specific collaborating workspace, and may optionally carry a
commission agreement (percentage or fixed, potentially split across
multiple shares — not hard-coded to one model). Commission terms are
private professional data.

## Enforcement rule

Authorization is resolved server-side, in this order, for every
professional-data request:

authenticated user → current workspace → active membership → role →
required permission → entity ownership → collaboration grant (if the
entity belongs to a different workspace).

Default deny at every step. The frontend-provided workspace, role, or
permission is never trusted.

## Workspace scope vs. platform scope (Milestone 2)

Every `Role` and every `Permission` carries an `AuthorizationScope` —
`WORKSPACE` or `PLATFORM`. This is not descriptive metadata; it is
**structurally enforced**, not just a naming convention:

- A **workspace permission** (`workspace.*`, `team.*`, and the
  foundation-only `property.*`/`client.*`/`collaboration.*` keys) is
  resolved from a user's `WorkspaceMember` → `Role` → `RolePermission`
  chain for one specific workspace (`WorkspaceAuthorizationService`).
- A **platform permission** (`admin.*`) is resolved from a user's
  `UserPlatformRole` grants, entirely independent of any workspace
  membership (`PlatformAuthorizationService`). A `SUPER_ADMIN` does not
  need to join every workspace on the platform to administer user
  accounts — platform authority and workspace membership are two
  unrelated axes.
- `RolesService` (custom per-workspace role CRUD) refuses to attach a
  `PLATFORM`-scope permission to a `WORKSPACE`-scope role — the check is
  a `permission.scope !== 'WORKSPACE'` guard inside
  `resolveWorkspacePermissions()`, not a UI-only restriction. **A
  malicious company admin can never grant `admin.users.deactivate` (or
  any other platform permission) to a workspace role, no matter what
  they submit to `POST /workspaces/:id/roles`** — the API returns `403`
  and nothing is written. See
  `apps/api/test/workspace-permissions.e2e-spec.ts` (test 12) for the
  automated proof.
- There is no endpoint anywhere that lets a workspace-scoped actor grant
  a platform role. Platform roles (`SUPER_ADMIN`, `PLATFORM_ADMIN`, etc.)
  can only be granted/revoked via `POST/DELETE
  /admin/users/:id/platform-roles`, itself gated by the platform
  permission `admin.roles.manage` — which only `SUPER_ADMIN` is seeded
  with.

## Permission catalog (Milestone 2)

The full, single-source-of-truth catalog lives in
`apps/api/src/authorization/permissions.catalog.ts` — never hard-code a
raw permission string elsewhere; import the `PERMISSIONS` constant so a
typo is a compile error. It is grouped by domain:

| Group | Scope | Examples |
|---|---|---|
| Workspace | WORKSPACE | `workspace.view`, `workspace.manage_roles`, `workspace.view_audit` |
| Team | WORKSPACE | `team.view`, `team.invite`, `team.suspend`, `team.remove`, `team.assign_role` |
| Property (foundation only — enforced from Milestone 3) | WORKSPACE | `property.view`, `property.create`, `property.view_exact_location`, ... |
| Client CRM (foundation only — enforced from Milestone 4) | WORKSPACE | `client.view`, `client.create`, `client.assign`, ... |
| Collaboration (foundation only — enforced from Milestone 9) | WORKSPACE | `collaboration.view`, `collaboration.manage`, ... |
| Admin / platform | PLATFORM | `admin.users.view`, `admin.users.view_email`, `admin.users.suspend`, `admin.roles.manage`, ... |

## Workspace roles (system, seeded)

Defined in `apps/api/src/authorization/roles.catalog.ts`, seeded by
`prisma/seed.ts`. A workspace's own custom roles (created via `POST
/workspaces/:id/roles`) are ordinary `WORKSPACE`-scope `Role` rows with
`workspaceId` set to that workspace, subject to the same platform-leak
guard above.

| Role | Summary |
|---|---|
| `WORKSPACE_OWNER` | Full control of their own workspace (team + all operational permissions). Not a platform administrator. |
| `COMPANY_ADMIN` | Manages day-to-day team/operations; cannot manage custom roles or view the workspace audit log. |
| `MANAGER` | Operational permissions (properties, clients); cannot change workspace/team structure. |
| `AGENT` | Ordinary professional permissions; no team-management permissions. |
| `VIEWER` | Read-only; no create/edit/archive/publish/invite permissions. |

## Platform roles (system, seeded)

| Role | Summary |
|---|---|
| `SUPER_ADMIN` | Full platform authority, including `admin.roles.manage` (the only role that can grant/revoke platform roles). Protected against total lockout — see below. |
| `PLATFORM_ADMIN` | Broad platform administration, excluding managing other platform admins. |
| `PROPERTY_MODERATOR` | Moderates published/public content only. |
| `USER_MODERATOR` | Moderates user and company accounts only. |
| `SUPPORT_ADMIN` | Account lookup + verification help; read-mostly. |
| `FINANCE_ADMIN` | Subscriptions and financial reporting only. |
| `ANALYST` | Read-only analytics/audit access. |

## Admin email access

`admin.users.view_email` is a distinct permission from `admin.users.view`.
An actor with `view` but not `view_email` gets a user summary/detail with
the `email`/`phone` fields **omitted entirely** — never masked, never a
placeholder — so there is no way to distinguish "no email on file" from
"not authorized to see it." An actor with `view_email` always receives
the real value. See `toAdminUserSummary`/`toAdminUserDetail` in
`apps/api/src/admin/admin-user.mapper.ts`, and tests 27/28 in
`apps/api/test/admin-platform.e2e-spec.ts`.

## Reversible moderation

Suspending, deactivating, or restoring a user (or a workspace member)
**never deletes a row.** Every action stamps actor + reason + timestamp
on the record itself and writes an append-only `AuditLog` entry; restore
is always available from `SUSPENDED`/`DEACTIVATED` back to `ACTIVE`. See
`docs/SECURITY.md` "Reversible moderation."

## Owner & Super Admin lockout protection

Two structurally-enforced invariants, both implemented the same way —
lock every relevant row with `SELECT ... FOR UPDATE` inside a
transaction *before* counting survivors, so two concurrent requests can't
both observe "one other remains" and both succeed, leaving zero:

- **A workspace can never end up with zero active `OWNER` members.**
  `MembershipService.assertWontLeaveWorkspaceWithoutAnOwner` blocks
  suspending or removing the last active owner (`409 Conflict`); the
  reassignment path is deliberately not implemented yet ("use an
  ownership-transfer process instead").
- **The platform can never end up with zero active `SUPER_ADMIN`
  users.** `assertWontRemoveLastActiveSuperAdmin`
  (`apps/api/src/admin/super-admin-guard.util.ts`) is shared by
  suspend/deactivate (`AdminUsersService`) and platform-role revocation
  (`PlatformRolesService`) — the latter only applies the check when the
  role being revoked is `SUPER_ADMIN` itself, so revoking some other
  platform role from a user who separately also holds `SUPER_ADMIN` is
  unaffected.

Both invariants have dedicated concurrency tests
(`apps/api/test/workspace-membership.e2e-spec.ts`,
`apps/api/test/admin-platform.e2e-spec.ts`) that fire two conflicting
requests with `Promise.allSettled` and assert exactly one succeeds.

## Super Admin bootstrap

There is no HTTP endpoint that grants the first `SUPER_ADMIN` — that
would be a privilege-escalation surface with no legitimate caller. A
standalone script, `apps/api/scripts/bootstrap-super-admin.ts` (run via
`npm run admin:bootstrap` inside `apps/api`), reads
`SUPER_ADMIN_BOOTSTRAP_EMAIL`, requires the user to already exist
(registered through the normal flow), and idempotently grants the role,
writing an audit log entry with `actorUserId: null` (system action).

## Status (Milestone 2)

Implemented: workspace isolation and switching, membership lifecycle
(invite → accept → suspend/remove/role-change), the full permission
catalog and system role seed above, the workspace/platform scope
separation and its structural enforcement, custom per-workspace roles,
the admin user directory and moderation endpoints, platform role
grant/revoke, and both lockout protections. Not yet built: property,
CRM, matching, messaging, viewings, collaboration, commission,
subscriptions, payments, and a full admin frontend — those remain future
milestones, and this document continues to define their target
permission model above (the `property.*`/`client.*`/`collaboration.*`
keys exist in the catalog today but are not yet checked by any
endpoint).
