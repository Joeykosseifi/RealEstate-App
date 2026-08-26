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

## Status (Milestone 1)

The database foundation exists: `Workspace`, `WorkspaceMember`, `Role`,
`Permission`, `RolePermission` (see `docs/DATABASE.md`). What Milestone 1
actually does with them is narrow and specific — enough for account
activation, nothing more:

- An activated agent gets exactly one `PERSONAL` workspace and an
  `OWNER` `WorkspaceMember` row (`WorkspacesService.ensurePersonalWorkspace`).
- An activated company gets a `Company`, a `COMPANY` workspace, and an
  `OWNER` `WorkspaceMember` row for the registering user
  (`WorkspacesService.createCompanyWithWorkspace`).
- Exactly one system `Role` is seeded (`key: "OWNER"`, see
  `prisma/seed.ts`) and assigned to those memberships.
- `Permission`/`RolePermission` are unpopulated — no permission keys
  exist yet, and nothing in Milestone 1 checks a permission to authorize
  a request.

There is no permission-checking guard, no workspace-switching API, no
membership-management API, and no enforcement of the table above yet —
that is Milestone 2 (workspaces/authorization) and Milestone 9
(collaboration/commission), which this document continues to define the
target model for.
