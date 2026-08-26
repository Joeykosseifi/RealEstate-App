# Database

- **Engine:** PostgreSQL 16
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Migrations:** Prisma Migrate — every schema change is a checked-in
  migration under `prisma/migrations/`. Never mutate the database outside
  of a migration.

## Current state (Milestone 1)

Milestone 0 shipped only the `datasource`/`generator` blocks. Milestone 1
adds authentication, users, verification, sessions, and the minimum
workspace/company/role foundation needed for automatic workspace creation
on account activation (full workspace management is Milestone 2).

### Models

| Model | Purpose |
|---|---|
| `User` | Account record for all three registration paths (CLIENT/AGENT/COMPANY) |
| `UserSession` | One row per device/session; holds only a hash of the current refresh token |
| `EmailVerification` | Link-style email verification tokens (hashed, one-time, expiring) |
| `PhoneVerification` | Numeric OTP phone verification (hashed, one-time, expiring, attempt-limited) |
| `PasswordReset` | Password reset tokens (hashed, one-time, expiring) |
| `Company` | Foundation fields for a registered company |
| `Workspace` | `PERSONAL` (one per agent) or `COMPANY` (one per company) |
| `WorkspaceMember` | Membership + `membershipType`/`status`, optionally a `Role` |
| `Role` / `Permission` / `RolePermission` | Foundation for Milestone 2's permission engine; Milestone 1 seeds only a system `OWNER` role |
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
| 2 | Full workspace management API, permission enforcement engine |
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
npm run prisma:migrate       # applies the milestone1_auth_users_workspaces migration
npm run prisma:seed          # seeds the system "OWNER" role
```
