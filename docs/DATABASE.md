# Database

- **Engine:** PostgreSQL 16
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Migrations:** Prisma Migrate — every schema change is a checked-in
  migration under `prisma/migrations/`. Never mutate the database outside
  of a migration.

## Current state (Milestone 4)

Milestone 0 shipped only the `datasource`/`generator` blocks. Milestone 1
added authentication, users, verification, sessions, and the minimum
workspace/company/role foundation needed for automatic workspace creation
on account activation. Milestone 2 built the full workspace/permission
engine and platform admin authorization. Milestone 3 added the
professional private property database — `Property` and its related
models. Milestone 4 (this revision) adds the client CRM (`ClientRecord`),
per-client property requirements (`ClientRequirement`), a shortlist
relationship (`ClientPropertyShortlist`), and client-facing PDF
presentations (`PropertyPresentation`/`PropertyPresentationItem`).
Matching itself is computed on demand — see "Recalculate matches" below.

### Property models (Milestone 3)

| Model | Purpose |
|---|---|
| `Property` | The core record. `workspaceId` (business owner, immutable after creation) and `createdByUserId` (who entered it) are separate concepts. `propertyStatus` is business status only (`AVAILABLE`/`RESERVED`/`SOLD`/`RENTED`/`OFF_MARKET`/`ARCHIVED`) — publication status doesn't exist yet (Milestone 5). `price`/`areaSqm` are `Decimal`, not `Float`, to avoid rounding drift. |
| `PropertyLocation` | One-to-one. The permanent Google Maps pin (`latitude`/`longitude` as `Decimal(9,6)`, `googlePlaceId` as a convenience reference only), plus `locationSource` (how it was captured) and the future-facing `locationVisibility` (not enforced by any endpoint yet). |
| `PropertyFeature` | A normalized `(propertyId, featureKey, value)` row per amenity — not one boolean column per feature. `featureKey` is validated at the API layer against `apps/api/src/properties/property-features.catalog.ts`, the same "single source of truth catalog" pattern as `permissions.catalog.ts`, so adding a new amenity is a one-line catalog change, never a migration. |
| `PropertyMedia` | Object-storage reference (`storageKey`, never a public URL) plus metadata. Exactly one row per property may have `isPrimary = true`, enforced by a hand-added partial unique index (see below), not just application logic. |
| `PropertyOwner` | Private owner/contact data. A property may have more than one (co-owners). Requires `property.view_owner` to read or write. |
| `PropertyPrivateDetails` | One-to-one. Internal notes + commission notes + acquisition/reference metadata. Requires `property.view_private_notes` to read or write; `commissionNotes` additionally requires `property.view_commission`. |

### Design decisions worth knowing (Milestone 3)

- **Main-photo partial unique index.** Mirrors Milestone 2's
  system-role-key pattern: `CREATE UNIQUE INDEX
  "property_media_one_primary_per_property" ON "property_media"
  ("propertyId") WHERE "isPrimary" = true` guarantees at the database
  level that a property can never end up with two primary images, even
  under a bug or a race — a plain `(propertyId, isPrimary)` unique index
  wouldn't work, since Postgres allows unlimited `isPrimary = false` rows
  to share a `propertyId`.
- **Property feature storage.** A normalized key/value join table, not a
  DB enum or a foreign-key catalog table, was chosen so a new amenity
  never needs a migration — the tradeoff is that uniqueness/validity of
  `featureKey` is enforced by the API layer (against the code catalog),
  not by the database schema itself.
- **`Decimal`, not `Float`, for money and area.** `price`/`areaSqm`/
  `latitude`/`longitude` are all Prisma `Decimal` columns. API responses
  convert them to plain JS `number` (see `property.mapper.ts`) — safe
  for realistic property prices/areas/coordinates, and avoids
  Decimal-vs-JSON serialization friction in every consumer.
- **Property concurrency.** Deliberately plain last-write-wins for
  ordinary field edits (no version column, no row lock) — a rare,
  low-stakes race, unlike Milestone 2's owner/SUPER_ADMIN-count
  invariants which use `SELECT ... FOR UPDATE` because they genuinely
  cannot tolerate a race. The one thing that IS locked: concurrent media
  uploads to the same property lock the parent `Property` row before
  deciding "is this the first image" (a `PropertyMedia` row can't be
  locked for this, since for the very first upload none exists yet to
  lock) — found by a concurrency test that reproduced the primary-image
  unique-index violation under real parallel requests. Concurrent media
  reorders lock the affected rows in one canonical (sorted-by-id) order
  before writing, for the same reason two Postgres transactions
  updating the same rows in opposite orders can deadlock (error 40P01,
  also found by a concurrency test) — see
  `apps/api/test/property-concurrency-audit.e2e-spec.ts`.
- **Property media storage.** `apps/api/src/storage/` defines a
  `StorageService` interface (`putObject`/`getSignedAccessUrl`/
  `deleteObject`) with one implementation today, `LocalDiskStorageService`
  — a real filesystem directory (`STORAGE_LOCAL_DIR`, gitignored, default
  `.data/property-media`), not a placeholder, since no S3-compatible
  credentials are configured in this environment. Files are never served
  from a public path: `getSignedAccessUrl` returns an HMAC-signed,
  time-limited URL (`STORAGE_SIGNED_URL_TTL_SECONDS`, default 5 minutes)
  to `GET /storage/access`, which verifies the signature before
  streaming the file. A real S3-compatible provider is meant to be a new
  class behind the same interface — no caller changes. Storage keys are
  always server-generated and resolved from the `PropertyMedia` row
  before any read/delete — a client can never name a storage key
  directly.

### Client CRM / matching / presentation models (Milestone 4)

| Model | Purpose |
|---|---|
| `ClientRecord` | An agent's/company's own customer — NOT a platform `User` account (`AccountType.CLIENT`). Same ownership-vs-authorship split as `Property`: `workspaceId` immutable business owner, `createdByUserId` author. `assignedToUserId`/`platformUserId`/`archivedByUserId` are plain scalar references (no Prisma relation), matching `Property.archivedByUserId`'s exact precedent. |
| `ClientRequirement` | A client's property search criteria — a client may have any number at once. `workspaceId`/`createdByUserId` are denormalized from the parent client at creation (immutable, re-validated on every write) so requirement queries don't need a join. Hard (must-have) criteria are typed columns evaluated as SQL filters by the matching engine; `preferredFeatures` is the one purely soft (score-only) column. |
| `ClientPropertyShortlist` | A property saved for a client, optionally tied to the requirement that motivated it. `@@unique([clientId, propertyId])` prevents a duplicate shortlist entry at the database level, not just in application code. |
| `PropertyPresentation` | A client-facing PDF built from selected properties. `clientId`/`requirementId` are optional. `storageKey`/`generatedAt` always point at the most recently generated PDF — see "Presentation versioning" below. |
| `PropertyPresentationItem` | The properties in one presentation, in send order (`sortOrder`) with an optional per-property `agentNote`. No per-item snapshot fields — see "Presentation snapshot strategy" below. |

### Design decisions worth knowing (Milestone 4)

- **No stored match-result table.** Matching (`apps/api/src/clients/matching.service.ts`) always computes fresh from current `Property`/`ClientRequirement` data — a property's price, status, or features can change after the fact, and there is no meaningful "match record" to keep in sync. Hard filtering happens in the SQL `WHERE` clause (workspace-scoped first, so an unauthorized property is never fetched at all); scoring and explanation are pure functions (`matching-engine.ts`) over the already-filtered candidates.
- **Match score formula, centrally documented** (`apps/api/src/clients/matching-score.config.ts`): a candidate that reaches scoring has already passed every hard filter, so `BASE_SCORE` (60) represents "meets every must-have." The remaining 40 points are distributed evenly across however many preferred features the requirement lists; zero preferred features scores 100 automatically. Deliberately no graded "closeness" scoring on price/bedrooms/area (e.g. cheaper-is-better) — that would be exactly the kind of subjective magic number this configuration is meant to avoid.
- **Matching currency rule.** Prices are never compared across currencies: when a requirement has a price bound, the candidate query also filters on `currency = requirement.currency` (required by validation whenever a price bound is set) — a property in a different currency simply has no price-based matches, rather than being silently compared numerically.
- **Location arrays combined with OR.** `countries`/`cities`/`areas` on a requirement are three independent arrays, but a candidate need only match ONE of them (not all three) when any are set — a client accepting "Jounieh, Kaslik, Zouk Mikael" lists those across `cities`/`areas` and expects a match against any single one, not a match against every populated dimension simultaneously.
- **Match ordering is deterministic and stable.** Results sort by score descending, then property id ascending as a fixed tiebreaker — two requests against unchanged data always return identically ordered results.
- **Presentation snapshot strategy.** Rather than duplicating property fields onto `PropertyPresentationItem` (a "snapshot" table), the generated PDF binary itself — stored via `StorageService`, referenced by `PropertyPresentation.storageKey` — is the historical record of exactly what was sent. Regenerating always reads current property data by design; editing a presentation's items/title never touches a previously generated artifact.
- **Presentation versioning.** Pressing "Generate" writes a brand-new object under a new, generation-timestamp-keyed key (`buildPresentationStorageKey`, `apps/api/src/storage/local-disk-storage.service.ts`) and repoints `storageKey`/`generatedAt` at it — it never overwrites the previous artifact in place. The previous artifact is left in storage (not deleted, not referenced anywhere once superseded). Editing a `GENERATED` presentation's title/items/notes moves its status back to `DRAFT` without touching the still-accessible previous artifact until an explicit regeneration.
- **Presentation PDF generation library.** `pdfkit` — chosen over a headless browser (Puppeteer/Playwright) because this codebase had no existing PDF dependency and no other reason to carry a full Chromium binary. `pdfkit` is pure Node, ships Helvetica built in (no font files to bundle), and its imperative drawing API produces the same page content every time for the same input. Generated with `compress: false` so an e2e test can assert directly against the artifact's raw bytes that sensitive data never appears in it — see `apps/api/test/presentation-security.e2e-spec.ts`.
- **Presentation reorder concurrency.** `PresentationsService.update()` locks the `PropertyPresentation` row (`SELECT ... FOR UPDATE`) before its delete-then-recreate of `PropertyPresentationItem` rows — without this, two concurrent updates naming overlapping item sets can each observe "no existing rows" for a property they're both about to insert under READ COMMITTED, tripping the `(presentationId, propertyId)` unique constraint. Found by `apps/api/test/crm-concurrency.e2e-spec.ts`, fixed with the same row-locking technique `PropertyMediaService.reorder` uses for the identical reason (see Milestone 3 above).
- **Shortlist duplicate prevention is a database constraint**, not just an application-layer check (`@@unique([clientId, propertyId])`) — verified under real concurrent requests in `apps/api/test/crm-concurrency.e2e-spec.ts`.

### Models

| Model | Purpose |
|---|---|
| `User` | Account record for all three registration paths (CLIENT/AGENT/COMPANY); Milestone 2 adds moderation fields (`suspendedAt`/`suspendedByUserId`/`suspensionReason`, `deactivatedAt`/`deactivatedByUserId`/`deactivationReason`, `restoredAt`/`restoredByUserId`/`restoreReason`) |
| `UserSession` | One row per device/session; holds only a hash of the current refresh token |
| `EmailVerification` | Link-style email verification tokens (hashed, one-time, expiring) |
| `PhoneVerification` | Numeric OTP phone verification (hashed, one-time, expiring, attempt-limited) |
| `PasswordReset` | Password reset tokens (hashed, one-time, expiring) |
| `Company` | Foundation fields for a registered company; `accountStatus` (`CompanyAccountStatus`) gained a `DEACTIVATED` value alongside `ACTIVE`/`SUSPENDED`, added in the follow-up `20260827141336_milestone2_company_deactivation` migration, to support the reversible `POST /admin/companies/:id/deactivate` endpoint (see `docs/PERMISSIONS.md` "Company vs. user deactivation") |
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
| 3 | ✅ `Property`, `PropertyLocation`, `PropertyFeature`, `PropertyMedia`, `PropertyOwner`, `PropertyPrivateDetails` |
| 4 | ✅ `ClientRecord`, `ClientRequirement`, `ClientPropertyShortlist`, `PropertyPresentation`, `PropertyPresentationItem` (no match-result table — matching is computed on demand) |
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
  historical-data requirements in the product spec. `Property` follows
  this now: a sold or retired property is archived (`propertyStatus =
  ARCHIVED`, `archivedAt`/`archivedByUserId` stamped), never deleted —
  see docs/PERMISSIONS.md "Archive, not delete."
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
npm run prisma:migrate       # applies all migrations (Milestones 1-3)
npm run prisma:seed          # seeds the permission catalog + system roles (idempotent)
```

Property media is stored on the local filesystem in development (see
"Property media storage" above) — no extra setup needed, but confirm
`STORAGE_LOCAL_DIR`/`STORAGE_SIGNING_SECRET` are set in `.env` (copied
from `.env.example`).

To grant the first `SUPER_ADMIN` (no HTTP endpoint does this — see
`docs/PERMISSIONS.md` "Super Admin bootstrap"):

```bash
cd apps/api
SUPER_ADMIN_BOOTSTRAP_EMAIL=you@example.com npm run admin:bootstrap
```
