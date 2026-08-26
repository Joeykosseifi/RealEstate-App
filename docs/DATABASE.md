# Database

- **Engine:** PostgreSQL 16
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Migrations:** Prisma Migrate — every schema change is a checked-in
  migration under `prisma/migrations/`. Never mutate the database outside
  of a migration.

## Current state (Milestone 2)

Milestone 0 shipped only the `datasource`/`generator` blocks. Milestone 1
added authentication, users, verification, sessions, and the minimum
workspace/company/role foundation needed for automatic workspace creation
on account activation. Milestone 2 builds the full workspace/permission
engine and platform admin authorization on top of that foundation.

### Models

| Model | Purpose |
|---|---|
| `User` | Account record for all three registration paths (CLIENT/AGENT/COMPANY); Milestone 2 adds moderation fields (`suspendedAt`/`suspendedByUserId`/`suspensionReason`, `deactivatedAt`/`deactivatedByUserId`/`deactivationReason`, `restoredAt`/`restoredByUserId`/`restoreReason`) |
| `UserSession` | One row per device/session; holds only a hash of the current refresh token |
| `EmailVerification` | Link-style email verification tokens (hashed, one-time, expiring) |
| `PhoneVerification` | Numeric OTP phone verification (hashed, one-time, expiring, attempt-limited) |
| `PasswordReset` | Password reset tokens (hashed, one-time, expiring) |
| `Company` | Foundation fields for a registered company |
| `Workspace` | `PERSONAL` (one per agent) or `COMPANY` (one per company); now also owns its `customRoles` |
| `WorkspaceMember` | Membership + `membershipType`/`status` (`INVITED`/`ACTIVE`/`SUSPENDED`/`REMOVED`), optionally a `Role`; Milestone 2 adds `invitedByUserId`, `suspendedByUserId`, `suspendedAt`, `removedByUserId` |
| `Role` | System (`workspaceId: null`) or custom per-workspace roles. Milestone 2 adds `scope` (`WORKSPACE`\|`PLATFORM`) and `workspaceId`; `key` is unique per workspace, plus a hand-added partial unique index enforcing system-role keys are globally unique among `workspaceId IS NULL` rows |
| `Permission` | Milestone 2 adds `scope` (`WORKSPACE`\|`PLATFORM`) and is now populated (49 seeded keys — see `docs/PERMISSIONS.md`) |
| `RolePermission` | Join table, unchanged shape from Milestone 1 |
| `UserPlatformRole` | **New in Milestone 2.** Grants a `PLATFORM`-scope role directly to a user, independent of any workspace membership (`@@unique([userId, roleId])`) |
| `AuditLog` | Append-only audit trail (see `docs/SECURITY.md`) |

### Design decisions worth knowing

- **`User.pendingCompanyProfile` (Json?).** A COMPANY registration submits
  company details (name/email/phone/website/description) before the user
  has verified anything. Per the product spec, the `Company` row itself is
  only created once activation runs (email + phone both verified), inside
  the same transaction as the `Workspace` and `OWNER` membership — so the
  submitted company details need somewhere to live in the meantime. Rather
  than a separate staging table, they're held in this one nullable JSON
  column and cleared (`Prisma.JsonNull`) once consumed by activation.
- **Workspace type CHECK constraint.** Prisma can't express "exactly one
  of `personalOwnerUserId` / `companyId` is set, matching `type`"
  declaratively, so the initial migration has a hand-added SQL `CHECK`
  constraint (see `prisma/migrations/*/migration.sql`) enforcing it at the
  database level, on top of the application-layer logic in
  `WorkspacesService`.
- **Uniqueness as the primary duplicate-prevention layer:**
  `Workspace.personalOwnerUserId` is unique (nullable-unique — Postgres
  allows multiple NULLs), guaranteeing at most one personal workspace per
  user at the database level. `Workspace.companyId` is unique similarly.
  `WorkspaceMember` has `@@unique([workspaceId, userId])`, so a user can
  never hold two membership rows in the same workspace.
- **Partial unique index for system role keys (Milestone 2).** A plain
  `@@unique([workspaceId, key])` doesn't prevent two different
  `workspaceId: null` (system) rows from sharing a key, because SQL
  never treats `NULL = NULL` as a uniqueness match. A hand-added
  migration statement, `CREATE UNIQUE INDEX "roles_system_key_unique" ON
  "roles"("key") WHERE "workspaceId" IS NULL`, closes that gap
  declaratively rather than relying on seed-script discipline.
- **Scope enforcement lives in application code, not a DB constraint
  (Milestone 2).** Postgres has no clean way to express "a
  `RolePermission` row is only valid if `Role.scope = Permission.scope`"
  as a constraint across a join table, so this is enforced in
  `RolesService.resolveWorkspacePermissions()` at write time instead —
  see `docs/PERMISSIONS.md` for why this is still a hard guarantee, not
  just a convention.

### Activation & idempotency

Agent and company account activation (creating a personal workspace, or a
company + its workspace + an OWNER membership) must happen exactly once,
even under concurrent retries. `AccountActivationService` guarantees this
with a `SELECT ... FOR UPDATE` row lock on the `User` row: the first
concurrent caller runs the activation transaction and commits; every
other concurrent caller blocks on the lock, then observes
`accountStatus === 'ACTIVE'` once unblocked and no-ops. `WorkspacesService`
additionally uses `upsert` (not `create`) for the personal-workspace path
as a second, independent layer of protection against the same race. See
`apps/api/test/auth-workspace.e2e-spec.ts` for concurrency tests that
exercise this directly.

## Planned model introduction, by milestone

| Milestone | Models introduced |
|---|---|
| 1 | ✅ `User`, `UserSession`, `EmailVerification`, `PhoneVerification`, `PasswordReset`, `Company`, `Workspace`, `WorkspaceMember`, `Role`, `Permission`, `RolePermission`, `AuditLog` |
| 2 | ✅ `UserPlatformRole`; `Role`/`Permission` scope split; full workspace management + admin authorization API |
| 3 | `Property`, property media, owner info, private notes, location |
| 4 | CRM `Client`, `ClientRequirement`, match results, `Presentation` |
| 5 | Publication review/moderation records |
| 6 | Client favorites, public marketplace read models |
| 7 | `Conversation`, `Message`, `Viewing` |
| 8 | Company employee invitations, team roles |
| 9 | `Collaboration`, collaboration permissions, commission agreements |
| 10 | `Subscription`, `Plan`, plan usage/limits |
| 11 | Security/performance hardening on the schema above |

## Conventions

- Primary keys: UUID v4 via Prisma's `@default(uuid())`, stored as native
  Postgres `uuid` columns (`@db.Uuid`).
- Every table gets `createdAt`; mutable tables also get `updatedAt`
  (`AuditLog` is append-only, so it has no `updatedAt`).
- Soft-delete vs. hard-delete is decided per-entity based on the audit and
  historical-data requirements in the product spec (e.g. sold properties
  must remain queryable as history) — not yet relevant to any Milestone 1
  model.
- Foreign keys are always indexed.
- No ORM entity is ever returned directly from an API response — every
  endpoint maps to an explicit DTO (see `docs/API.md`).
- Emails are normalized (lowercased/trimmed) before every write and
  comparison; phone numbers are normalized to E.164 via `libphonenumber-js`.

## Local setup

```bash
cp .env.example .env
npm run docker:up            # starts Postgres + Redis
npm run prisma:generate
npm run prisma:migrate       # applies both migrations (Milestone 1 + Milestone 2)
npm run prisma:seed          # seeds the permission catalog + system roles (idempotent)
```

To grant the first `SUPER_ADMIN` (no HTTP endpoint does this — see
`docs/PERMISSIONS.md` "Super Admin bootstrap"):

```bash
cd apps/api
SUPER_ADMIN_BOOTSTRAP_EMAIL=you@example.com npm run admin:bootstrap
```
