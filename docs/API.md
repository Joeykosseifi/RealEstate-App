# API Conventions (apps/api)

These conventions apply to every endpoint added from Milestone 1 onward.

## Framework

NestJS, controllers → services → (Prisma) repositories. Controllers
contain routing/validation/DTO-mapping only; business logic lives in
services. Authorization checks live in centralized guards/policies, not
scattered through controllers.

## Request validation

Every incoming DTO is validated (`class-validator` + Nest's global
`ValidationPipe`, configured with `whitelist: true` and
`forbidNonWhitelisted: true`) — unknown fields are rejected, not silently
dropped.

## Response shape

- Success responses return explicit DTOs, never raw Prisma models. A
  model's private fields are excluded by construction (a separate
  serializer/DTO per audience — e.g. a property has an internal DTO and a
  public-marketplace DTO), not by a runtime "hide field" filter.
- Errors follow a single shape (`ApiErrorResponse` in
  `packages/types`):

  ```json
  {
    "statusCode": 404,
    "error": "NotFoundException",
    "message": "Property not found",
    "path": "/properties/...",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
  ```

## Pagination

List endpoints accept `page`/`pageSize` query params (validated via
`@real-estate/validation`'s `paginationQuerySchema`) and return
`{ items, meta }` (`Paginated<T>` in `@real-estate/types`).

## Versioning

Implemented from Milestone 1: every route except `/` and `/health` is
served under the `/api/v1` prefix (`app.setGlobalPrefix('api/v1', {
exclude: ['/', 'health'] })` in `main.ts`).

## Health check

`GET /health` — liveness/readiness for Postgres (via Prisma) and Redis.
Added in Milestone 0 as operational infrastructure, not a business
endpoint. Deliberately excluded from the `/api/v1` prefix.

## Authentication (Milestone 1)

Bearer access token in `Authorization: Bearer <token>`. Refresh tokens
are opaque strings (not JWTs) returned in the login/refresh response body
and submitted back in the request body — see `docs/SECURITY.md` for the
rotation/reuse-detection design. There is no cookie-based flow yet; secure
client-side storage (mobile Keychain/Keystore, a web BFF, etc.) is each
app's own responsibility and isn't built out until that app has an auth UI.

### Endpoints

All under `/api/v1`. Endpoints without an explicit status code below
return `200` on success (`login`/`refresh` are explicitly `@HttpCode(200)`
since Nest defaults `POST` to `201`).

| Method & path | Auth | Notes |
|---|---|---|
| `POST auth/register/client` | — | Returns the created `AuthUser` (201). No tokens issued — log in separately. |
| `POST auth/register/agent` | — | Same shape; `accountType: AGENT`. |
| `POST auth/register/company` | — | Same shape plus `companyName` (required) / `companyEmail` / `companyPhone` / `companyWebsite` / `companyDescription`; `accountType: COMPANY`. |
| `POST auth/login` | — | `{ email, password }` → `{ user, tokens }`. Generic "Invalid email or password" for any failure mode (unknown email, wrong password, suspended, deactivated). |
| `POST auth/refresh` | — | `{ refreshToken }` → new `{ accessToken, refreshToken, expiresIn }`. Rotates; the old refresh token stops working. |
| `POST auth/logout` | Bearer | Revokes the session named by the access token's `sid` claim. `204`. |
| `GET auth/me` | Bearer | Returns the caller's own `AuthUser`. Never accepts an id — there is no way to ask for anyone else's. |
| `POST auth/email/verify` | — | `{ token }`. `204`. One-time use. |
| `POST auth/email/resend` | — | `{ email }`. Always `204` — never reveals whether the email is registered. Rate-limited. |
| `POST auth/phone/request-otp` | — | `{ phone }`. Always `204`. Rate-limited. |
| `POST auth/phone/verify` | — | `{ phone, otp }`. `204`. Attempt-limited and one-time use. |
| `POST auth/password/forgot` | — | `{ email }`. Always `204`. Rate-limited. |
| `POST auth/password/reset` | — | `{ token, newPassword }`. `204`. Revokes every existing session for the user. |

`AuthUser` and `AuthTokens` are defined in `packages/types/src/auth.ts` —
`AuthUser` never includes `passwordHash` or any token/secret field.

### Registration → activation flow

Registration never activates an account by itself. For all three account
types: `register/*` → verify email (`email/verify`) → verify phone
(`phone/verify`) → the *second* of those two calls to complete triggers
activation (`AccountActivationService`), which flips `accountStatus` to
`ACTIVE` and, for AGENT/COMPANY, creates the workspace described in
`docs/PERMISSIONS.md`. Order between email and phone doesn't matter.
`PENDING_VERIFICATION` accounts can already log in — verification gates
specific product features, not authentication itself; only
`SUSPENDED`/`DEACTIVATED` block login.

### Mobile registration & onboarding (Milestone 6.1)

`apps/mobile`'s unauthenticated entry flow (`AuthStack` — Welcome → Sign
In / Create Account) calls the endpoints above directly, one screen per
step, with no intermediate abstraction:

| Screen | Endpoint(s) |
|---|---|
| `CreateAccountScreen` | `POST auth/register/{client,agent,company}` |
| `VerificationScreen` (also reused by `RootNavigator` for a returning `PENDING_VERIFICATION` session) | `POST auth/email/verify`, `POST auth/email/resend`, `POST auth/phone/request-otp`, `POST auth/phone/verify`, then `POST auth/login` (fresh registration) or a plain `GET auth/me` + `GET workspaces` refresh (resumed session) |
| `ForgotPasswordScreen` | `POST auth/password/forgot`, `POST auth/password/reset` |
| `SignInScreen` | `POST auth/login` |

Client-side validation (`apps/mobile/src/auth/validation.ts`) mirrors the
backend's real rules (email shape, E.164-ish phone shape, 8-128 char
password, confirmation match, required terms acceptance, `companyName`
required only for COMPANY) purely for fast feedback — the backend DTOs
remain the sole authority, and every field is re-validated server-side
regardless of what the client already checked. A 400/409 from any of
these calls surfaces the backend's own message text (already
human-readable — see `HttpExceptionFilter`) rather than a raw
stack trace; an array of validation messages is joined into one string
by `apps/mobile/src/api/client.ts` before being shown.

## Workspace context (Milestone 2)

Workspace-rooted endpoints resolve the workspace from the route's `:id`
param (or `X-Workspace-Id` header for future non-workspace-rooted
routes), then verify the caller has an **ACTIVE** membership there —
never trusted as-is from the client (`WorkspaceContextGuard` +
`WorkspaceAuthorizationService`). A missing workspace and a
missing/non-active membership return the identical `403` message, so an
unauthorized caller can't distinguish "doesn't exist" from "you're not a
member."

### Workspace endpoints

All under `/api/v1`, all require `Authorization: Bearer <token>`.
Endpoints marked with a permission require the caller's resolved
workspace permissions to include it (`@RequireWorkspacePermission`).

| Method & path | Permission | Notes |
|---|---|---|
| `GET workspaces` | — | Workspaces the caller can currently switch into (ACTIVE memberships only). |
| `GET workspaces/:id` | `workspace.view` | Workspace detail plus the caller's fully-resolved permission list for that workspace. |
| `GET workspaces/:id/members` | `team.view` | Paginated roster, all statuses (`page`/`pageSize`, default 20, max 100). Stable order: status, then `createdAt`, then `id` as tiebreaker. |
| `POST workspaces/:id/invitations` | `team.invite` | `{ email, membershipType, roleId? }`. Target must already be a registered user (inviting a not-yet-registered email is Milestone 8); `roleId` defaults to the system `AGENT` role. `201`. |
| `POST workspaces/:id/invitations/accept` | — (any authenticated user) | Accepts the caller's own pending invitation. `204`. |
| `POST workspaces/:id/members/:memberId/suspend` | `team.suspend` | `{ reason? }`. Blocked (`409`) if it would leave the workspace with zero active owners. `204`. |
| `POST workspaces/:id/members/:memberId/remove` | `team.remove` | Same owner protection as suspend. `204`. |
| `PATCH workspaces/:id/members/:memberId/role` | `team.assign_role` | `{ roleId }`. Rejected (`403`) for an `OWNER` membership — use ownership transfer instead (not yet implemented). |
| `GET workspaces/:id/roles` | `workspace.view` | System + this workspace's custom roles. |
| `POST workspaces/:id/roles` | `workspace.manage_roles` | `{ key, name, description?, permissionKeys[] }`. `403` if any requested key is `PLATFORM`-scope — see `docs/PERMISSIONS.md`. |
| `PATCH workspaces/:id/roles/:roleId` | `workspace.manage_roles` | Custom roles only (not system roles). |
| `DELETE workspaces/:id/roles/:roleId` | `workspace.manage_roles` | `409` if the role is currently assigned to any member. |
| `GET workspaces/:id/dashboard` | `workspace.view` | Real-data aggregate — see "Dashboard endpoint (Milestone 6)" below. |
| `PATCH workspaces/:id/contact` | `workspace.update` | `{ publicContactPhone?, publicContactEmail?, publicContactWhatsapp? }` — see "Public contact endpoint (Milestone 6)" below. `204`. |

### Dashboard endpoint (Milestone 6)

`GET workspaces/:id/dashboard` returns a `WorkspaceDashboard` built
entirely from live queries scoped to the caller's own workspace —
nothing is fabricated or cached. Each top-level section is present only
if the caller holds the matching view permission, same DTO-omission
policy as the property/client detail endpoints:

- `properties` (needs `property.view`): `total`, `byBusinessStatus`,
  `private` (no publication yet), `published`, `pendingReview`, and
  `recent` (the 5 most recently updated, same shape as the properties
  list endpoint).
- `clients` (needs `client.view`): `total`, `activeRequirements`, and
  `recent` (the 5 most recently updated).

A caller with neither permission gets `{}` — the mobile dashboard
screen renders "Nothing to show yet" rather than a broken/empty layout.

### Public contact endpoint (Milestone 6)

`PATCH workspaces/:id/contact` lets a workspace owner (or anyone
holding `workspace.update`) set the **explicit, opt-in** phone/email/
WhatsApp shown to marketplace visitors on that workspace's published
listings. This is structurally never the professional's private login
`User.email`/`phone` — it's a separate, blank-by-default field set on
`Workspace`. Per field: omit it to leave it untouched, send `""` to
clear it, send a value to set it (email is validated). See
`docs/PERMISSIONS.md` "Public professional contact (Milestone 6)".

### Admin endpoints (Milestone 2)

All under `/api/v1/admin`, all require `Authorization: Bearer <token>`
plus the named **platform** permission (`@RequirePlatformPermission`) —
entirely independent of any workspace membership.

| Method & path | Permission | Notes |
|---|---|---|
| `GET admin/users` | `admin.users.view` | Paginated (`page`/`pageSize`), filterable by `search`, `accountType`, `accountStatus`, `verification`. `email`/`phone` present only if the caller also has `admin.users.view_email`. |
| `GET admin/users/:id` | `admin.users.view` | Includes workspace memberships and platform role grants. |
| `POST admin/users/:id/suspend` | `admin.users.suspend` | `{ reason }` (required). Revokes all sessions immediately. `409` if this is the last active `SUPER_ADMIN`. `204`. |
| `POST admin/users/:id/deactivate` | `admin.users.deactivate` | Same shape/protections as suspend. `204`. |
| `POST admin/users/:id/restore` | `admin.users.restore` | `{ reason? }`. `409` unless the account is currently `SUSPENDED`/`DEACTIVATED`. `204`. |
| `POST admin/users/:id/platform-roles` | `admin.roles.manage` | `{ roleKey }` (one of the seeded platform roles). `409` if already held. `204`. |
| `DELETE admin/users/:id/platform-roles/:roleKey` | `admin.roles.manage` | `409` if revoking the last active `SUPER_ADMIN` grant. `204`. |
| `GET admin/companies` | `admin.companies.view` | Paginated company listing. |
| `POST admin/companies/:id/suspend` | `admin.companies.suspend` | `{ reason }` (required). Reversible. `204`. |
| `POST admin/companies/:id/deactivate` | `admin.companies.deactivate` | `{ reason }` (required). Independent of the registering owner's user account — see `docs/PERMISSIONS.md` "Company vs. user deactivation." `409` if already `DEACTIVATED`. `204`. |
| `POST admin/companies/:id/restore` | `admin.companies.restore` | `{ reason? }`. `409` unless the company is currently `SUSPENDED`/`DEACTIVATED`. `204`. |

Moderation is always reversible — suspend/deactivate/restore never
delete a row; see `docs/SECURITY.md` "Reversible moderation."

## Property endpoints (Milestone 3)

All under `/api/v1`, all workspace-rooted (`:id` is the workspace id,
resolved and authorized exactly like the workspace endpoints above) and
require `Authorization: Bearer <token>`. A property belonging to a
different workspace than `:id` is a `404`, not a `403` — see
docs/SECURITY.md "Property data isolation."

| Method & path | Permission | Notes |
|---|---|---|
| `POST workspaces/:id/properties` | `property.create` | Single transaction: Property + optional `location`/`featureKeys`/`owners`/`privateDetails` all commit together or not at all. Submitting `owners`/`privateDetails` requires the matching view permission too — see docs/PERMISSIONS.md "Sensitive property fields." `201`. |
| `GET workspaces/:id/properties` | `property.view` | Paginated, filterable — see "Property search" below. Excludes `ARCHIVED` unless `propertyStatus=ARCHIVED` or `includeArchived=true` is passed. |
| `GET workspaces/:id/properties/:propertyId` | `property.view` | `location`/`owners`/`privateDetails` are present as keys ONLY when the caller holds the matching permission — omitted, never `null`. Logs a sensitive-access audit event per section actually returned. |
| `PATCH workspaces/:id/properties/:propertyId` | `property.edit` | No `workspaceId`/`createdByUserId`/`propertyStatus` field exists on this DTO — unknown fields are rejected outright (`whitelist`/`forbidNonWhitelisted`). Whole-section replace semantics for `location`/`owners`/`privateDetails`/`featureKeys` when included. `409` if the property is `ARCHIVED` (restore first). |
| `PATCH workspaces/:id/properties/:propertyId/location` | `property.edit` | Focused location-only update — same effect as including `location` in the PATCH above. |
| `POST workspaces/:id/properties/:propertyId/status` | `property.edit` | `{ propertyStatus }`, one of `AVAILABLE`/`RESERVED`/`SOLD`/`RENTED`/`OFF_MARKET` (never `ARCHIVED` — `400`). `409` on a disallowed transition or if the property is archived — see docs/PERMISSIONS.md "Property status model." `204`. |
| `POST workspaces/:id/properties/:propertyId/archive` | `property.archive` | Reversible. `409` if already archived. `204`. |
| `POST workspaces/:id/properties/:propertyId/restore` | `property.archive` | `409` unless the property is currently `ARCHIVED`. Always lands on `OFF_MARKET`. `204`. |

### Property search (Milestone 3)

`GET workspaces/:id/properties` query parameters: `page`, `pageSize`
(default 20, max 100), `search` (title/city/area/address,
case-insensitive `contains`), `propertyType`, `listingPurpose`,
`propertyStatus`, `priceMin`/`priceMax`, `bedroomsMin`, `bathroomsMin`,
`areaMin`/`areaMax`, `city`, `area`, `features` (one or more feature
keys — `?features=pool&features=garden`), `createdByUserId`,
`includeArchived`, `sortOrder`. All filters are parameterized Prisma
queries (`contains`/`gte`/`lte`/relation `some`) — no raw SQL. Simple
indexed filtering, not Postgres full-text/trigram search — acceptable
for this milestone, see docs/DATABASE.md.

### Property media endpoints (Milestone 3)

All nested under `workspaces/:id/properties/:propertyId/media`, all
requiring `property.edit` (upload/reorder/delete) or `property.view`
(access-url) — media is part of editing a property, not a separately-
permissioned capability. See docs/DATABASE.md "Property media storage."

| Method & path | Permission | Notes |
|---|---|---|
| `POST .../media` | `property.edit` | `multipart/form-data`: `file` + `mediaType` (`IMAGE`/`VIDEO`/`DOCUMENT`) + optional `isPrimary`/`sortOrder`. First uploaded image becomes primary automatically unless `isPrimary` is explicit; setting a new primary unsets the old one (exactly one `isPrimary=true` per property, enforced by a DB partial unique index). Max 25MB. `201`. |
| `GET .../media/:mediaId/access-url` | `property.view` | Returns `{ url }` — a signed, time-limited URL (default 5 minutes). Never a permanent public path. |
| `PATCH .../media/reorder` | `property.edit` | `{ mediaIds: [...] }` — must list every media item belonging to the property, exactly once. `400` otherwise. |
| `DELETE .../media/:mediaId` | `property.edit` | Storage key is always resolved from the database, never accepted from the client. Deletes the object and the row; `204`. |
| `GET storage/access?key=&exp=&sig=` | — (signature-verified, not Bearer-authenticated) | The actual signed download endpoint a `access-url` response points to — mirrors how a real S3 presigned URL works. `401` on a missing/invalid/expired signature. |

## Client CRM, matching & presentation endpoints (Milestone 4)

All under `/api/v1`, workspace-rooted exactly like Property. A client,
requirement, shortlist entry, or presentation belonging to a different
workspace than `:id` is a `404`, not a `403` — same isolation rule as
Property.

### Client endpoints

| Method & path | Permission | Notes |
|---|---|---|
| `POST workspaces/:id/clients` | `client.create` | `workspaceId`/`createdByUserId` server-derived. Optional `assignedToUserId` additionally requires `client.assign` and is re-verified (same workspace, ACTIVE membership). `201`. |
| `GET workspaces/:id/clients` | `client.view` | Paginated, filterable — see "Client search" below. Excludes `ARCHIVED` unless `status=ARCHIVED` or `includeArchived=true`. |
| `GET workspaces/:id/clients/:clientId` | `client.view` | Returns active requirements, the shortlist, and a presentation count. Never includes a linked platform account's authentication secrets (no linking is built yet — `platformUserId` is a reserved, unenforced field). |
| `PATCH workspaces/:id/clients/:clientId` | `client.edit` | No `workspaceId`/`createdByUserId`/`assignedToUserId` field exists on this DTO — unknown fields rejected outright. `409` if the client is `ARCHIVED`. |
| `POST workspaces/:id/clients/:clientId/assign` | `client.assign` | `{ assignedToUserId: string \| null }` — `null` unassigns. Target re-verified server-side; `409` if not an ACTIVE member of the same workspace. Assigning grants no additional permissions. |
| `POST workspaces/:id/clients/:clientId/archive` | `client.archive` | Reversible. `409` if already archived. `204`. |
| `POST workspaces/:id/clients/:clientId/restore` | `client.archive` | `409` unless currently `ARCHIVED`. Always lands on `INACTIVE`. `204`. |

### Client search (Milestone 4)

`GET workspaces/:id/clients` query parameters: `page`, `pageSize`
(default 20, max 100), `search` (first/last name, phone, WhatsApp
phone, email — case-insensitive `contains`), `status`, `source`,
`assignedToUserId`, `createdByUserId`, `createdFrom`/`createdTo`,
`includeArchived`, `sortOrder`.

### Client requirement endpoints

Nested under `workspaces/:id/clients/:clientId/requirements`, reusing
`client.view`/`client.edit` — a requirement is a sub-resource of a
client, exactly like `PropertyLocation` is a sub-resource of a
property. A client may have any number of requirements at once.

| Method & path | Permission | Notes |
|---|---|---|
| `POST .../requirements` | `client.edit` | See docs/PERMISSIONS.md and docs/DATABASE.md for the hard-vs-soft criteria split. `currency` required whenever `minPrice`/`maxPrice` is set. `201`. |
| `GET .../requirements` | `client.view` | Excludes `ARCHIVED` unless `?includeArchived=true`. |
| `PATCH .../requirements/:requirementId` | `client.edit` | No `clientId`/`workspaceId`/`createdByUserId` field exists on this DTO. `409` if archived. |
| `POST .../requirements/:requirementId/archive` | `client.edit` | Reversible in spirit (row never deleted); no restore endpoint — create a fresh requirement instead. `204`. |

### Matching endpoint (Milestone 4)

| Method & path | Permission | Notes |
|---|---|---|
| `GET workspaces/:id/clients/:clientId/requirements/:requirementId/matches` | `client.view` **and** `property.view` | Both required — the guard checks `client.view`; `property.view` is checked explicitly inside `MatchingService`. Query params: `page`, `pageSize`, `minScore` (0-100). Computed fresh on every call — see docs/DATABASE.md "No stored match-result table." |

### Shortlist endpoints (Milestone 4)

Nested under `workspaces/:id/clients/:clientId/shortlist`.

| Method & path | Permission | Notes |
|---|---|---|
| `POST .../shortlist` | `client.edit` **and** `property.view` | `{ propertyId, requirementId?, note? }`. Property and (optional) requirement re-verified against the caller's workspace. `409` on a duplicate `(clientId, propertyId)` — enforced by a database unique constraint, not just an application check. `201`. |
| `GET .../shortlist` | `client.view` | Not paginated — a shortlist is expected to stay small. |
| `DELETE .../shortlist/:shortlistId` | `client.edit` | Removes only that one entry; the client, property, and every other relationship are untouched. `204`. |

### Presentation endpoints (Milestone 4)

All under `workspaces/:id/presentations`, all requiring
`property.create_presentation` — the single feature gate for the whole
surface (see docs/PERMISSIONS.md "Presentation authorization"). Every
selected `propertyId`/`clientId`/`requirementId` is independently
re-verified against the caller's workspace inside `PresentationsService`.

| Method & path | Notes |
|---|---|
| `POST workspaces/:id/presentations` | `{ title, clientId?, requirementId?, items: [{ propertyId, agentNote? }] }` — 1 to 50 items. Every property must belong to this workspace (`400` otherwise). `201`. |
| `GET workspaces/:id/presentations` | Paginated; optional `clientId`/`status`/`includeArchived` filters. |
| `GET workspaces/:id/presentations/:presentationId` | Returns items with `PresentationSafePropertySnapshot` data (see below) — never `storageKey` directly. |
| `PATCH workspaces/:id/presentations/:presentationId` | Whole-list replace semantics for `items` when present, same convention as `UpdatePropertyDto`. Editing a `GENERATED` presentation's title/items moves it back to `DRAFT` without touching the still-accessible previously generated PDF. `409` if archived. |
| `POST workspaces/:id/presentations/:presentationId/generate` | Builds a PDF via `pdfkit` from `PresentationSafePropertySnapshot` data only (see docs/PERMISSIONS.md "Never in PDF by default" below), stores it via `StorageService` under a new generation-timestamped key, and repoints `storageKey`/`generatedAt` — see docs/DATABASE.md "Presentation versioning." `200`. |
| `GET workspaces/:id/presentations/:presentationId/access-url` | Returns `{ url }` — a signed, time-limited URL to `GET /storage/access`, the same endpoint property media uses. `409` if never generated. |
| `POST workspaces/:id/presentations/:presentationId/archive` | Reversible in spirit (row, items, and every previously generated artifact preserved); no restore endpoint — recreate if still needed. `204`. |

**PDF generation library choice:** `pdfkit` — pure Node, no headless
browser to manage in production, ships Helvetica built in, and its
imperative API produces the same page content for the same input every
time. See docs/DATABASE.md "Design decisions worth knowing (Milestone
4)" for the full rationale versus Puppeteer/Playwright.

**PDF generation resilience:** a property with no image, or with
unreadable/corrupt/unsupported image bytes, never breaks generation —
`PdfGeneratorService` catches image-embedding failures per property and
simply omits that image, keeping every text section intact.

**Never in the PDF by default:** owner name/phone/email, commission
notes, internal notes, acquisition source, internal reference,
admin/moderation metadata, exact latitude/longitude, or private
documents. This isn't a rendering-code discipline — it's structural:
generation is built exclusively from `PresentationSafePropertySnapshot`
(`apps/api/src/properties/property.mapper.ts` `toPresentationSafeSnapshot`),
a fixed-shape type that has no fields for any of the above, so there is
no code path that could leak them into a PDF. Location shows only
`city`/`area`/`country` text — never the exact saved pin. Verified
directly against generated PDF bytes (not just the DTO) in
`apps/api/test/presentation-security.e2e-spec.ts`.

## Publication, moderation & marketplace endpoints (Milestone 5)

### Professional publication endpoints

All under `workspaces/:id/properties/:propertyId/publication`. `PUT`/
`submit`/`cancel`/`republish` require `property.publish`; `unpublish`
requires `property.unpublish`. Reuses the standard workspace
authorization chain — a publication belonging to another workspace's
property is `404`, never distinguishable from one that doesn't exist.

| Method & path | Notes |
|---|---|
| `GET .../publication` | Returns the current `PublicationDetail`, or `null` if the property has never had a publication row at all (the PRIVATE state — never a stored value, see docs/DATABASE.md). |
| `PUT .../publication` | Full-replace draft save — creates the publication (and version 1) on first call. Edits the current editable version in place while `DRAFT`; starts a new version while `CHANGES_REQUESTED`/`REJECTED`/`APPROVED`; `409` while `PENDING_REVIEW` (immutable — cancel first). `200`. |
| `POST .../publication/submit` | Validates eligibility (property `AVAILABLE`, public title/price/≥1 image/city-if-publicly-visible all present), freezes the current draft version, sets `PENDING_REVIEW`. `200`, `400` on ineligibility, `409` if not currently `DRAFT`. |
| `POST .../publication/cancel` | Professional-initiated withdrawal from review — reverts the SAME version to `DRAFT` (nothing was decided, so no new version). `200`, `409` unless `PENDING_REVIEW`. |
| `POST .../publication/unpublish` | Takes an approved, live listing down. Property stays fully intact and private-database-visible. `200`, `409` unless `PUBLISHED`. |
| `POST .../publication/republish` | Deliberate, minimal addition beyond the spec's literal endpoint list (see docs/PERMISSIONS.md "Owner republish") — reverses the professional's own unpublish without a new admin review, since the content is unchanged. `200`, `409` unless `OWNER_UNPUBLISHED` and still business-status eligible. |

### Admin publication review endpoints

All under `admin/property-publications`, using platform (not workspace)
authorization — see docs/PERMISSIONS.md "Admin authorization is never
workspace membership."

| Method & path | Permission | Notes |
|---|---|---|
| `GET admin/property-publications` | `admin.content.view` | Paginated queue; defaults to `status=PENDING_REVIEW`, oldest submission first. Filters: `status`, `workspaceId`, `propertyType`, `listingPurpose`, `submittedByUserId`, `search`. |
| `GET admin/property-publications/:id` | `admin.content.view` | Full `PublicationReviewDetail` — snapshot, submitter name, workspace name, review history. Never `PropertyOwner`/`PropertyPrivateDetails` (not reachable from this query at all). |
| `POST admin/property-publications/:id/approve` | `admin.content.review` | Row-locked; `409` if not currently `PENDING_REVIEW` (already decided by another reviewer). Atomically marks the version `APPROVED`, sets `publishedVersionId`, `status: PUBLISHED`. `200`. |
| `POST admin/property-publications/:id/reject` | `admin.content.review` | `{ reason }` required (`400` without one). Property remains fully private/intact. `200`, `409` unless `PENDING_REVIEW`. |
| `POST admin/property-publications/:id/request-changes` | `admin.content.review` | `{ reason }` required. `200`, `409` unless `PENDING_REVIEW`. |
| `POST admin/property-publications/:id/unpublish` | `admin.content.unpublish` | `{ reason }` required. `200`, `409` unless `PUBLISHED`. |
| `POST admin/property-publications/:id/restore` | `admin.content.restore` | Only restores when the underlying property's business status is still `AVAILABLE`/`RESERVED` — `409` otherwise (e.g. it became `SOLD` while taken down). `200`, `409` unless `ADMIN_UNPUBLISHED`. |

`admin.content.review` is a Milestone 5 addition to the permission
catalog, architecturally distinct from `admin.content.unpublish` (which
only governs taking an already-published listing down) — see
docs/PERMISSIONS.md. All five decision endpoints lock the publication
row (`SELECT ... FOR UPDATE`) before reading/transitioning it, so two
concurrent decisions never both succeed — see
`apps/api/test/publication-concurrency.e2e-spec.ts`.

### Marketplace endpoints

Require only `JwtAuthGuard` (any authenticated platform user —
CLIENT/AGENT/COMPANY), never workspace authorization — see
docs/PERMISSIONS.md "Marketplace authorization is not workspace
authorization."

| Method & path | Notes |
|---|---|
| `GET marketplace/properties` | Paginated. Filters: `search`, `propertyType`, `listingPurpose`, `priceMin`/`priceMax`, `bedroomsMin`/`bathroomsMin`, `areaMin`/`areaMax`, `country`/`city`/`area`, `features`. `sort`: `newest` (default) / `price_asc` / `price_desc`. Source of truth is `PropertyPublication`/`PropertyPublicationVersion`, never the raw `Property` — see docs/PERMISSIONS.md "Marketplace source of truth." |
| `GET marketplace/properties/:publicationId` | Full `PublicPropertyDetail`. `:publicationId` is the `PropertyPublication` id — the private `propertyId` is never accepted or exposed here. Unavailable/nonexistent → plain `404`, never distinguishable. `identity.contactPhone`/`contactEmail`/`contactWhatsapp` (Milestone 6) appear only as present-or-absent keys, sourced exclusively from the workspace's opt-in `publicContact*` fields — never the professional's private login email/phone. |
| `POST marketplace/properties/:publicationId/favorite` | Idempotent (`204` even if already favorited). `404` if the listing isn't currently eligible for favoriting (same eligibility rule as browsing). |
| `DELETE marketplace/properties/:publicationId/favorite` | `204`. |
| `GET marketplace/favorites` | Paginated. A favorite whose listing has since become unavailable returns `listing: null` rather than stale/private data. |

**Public location rules:** `PRIVATE`/`WORKSPACE` visibility never
populate any public location field (not even city/area); `PUBLIC_APPROXIMATE`
exposes city/area only; only `PUBLIC_EXACT` populates exact coordinates,
and only when the property actually has a saved location. Never
fabricated, never silently copied from the private pin.

**Public media rules:** only `PropertyMediaType.IMAGE` rows explicitly
selected via the draft's `media` array are ever servable publicly.
Served through the same short-lived signed-URL mechanism as private
media (`StorageService.getSignedAccessUrl` → `GET /storage/access`) —
no separate "public" storage tier; access control lives entirely in
which media the marketplace query is allowed to select.

**Business-status safety:** `SOLD`/`RENTED`/archived properties are
filtered by two independent layers — see docs/PERMISSIONS.md
"Business-status safety." `RESERVED` properties remain visible
(documented product decision).

### Mobile setup (Milestone 3)

`apps/mobile` reads `EXPO_PUBLIC_API_URL` (defaults to
`http://localhost:3000`) — set it to a URL your device/simulator can
actually reach (a plain `localhost` won't resolve from a physical
device or most Android emulators; use your machine's LAN IP or a tunnel).

**Google Maps setup:** the location picker (`apps/mobile/src/location/MapLocationPicker.tsx`)
is a full interactive `react-native-maps` map: search-and-select,
tap-to-drop, drag-to-move, and an explicit "Use current location"
button. It requires a **development build, not Expo Go** — consult
Expo's current versioned SDK docs for the `react-native-maps` config
plugin — because the Google Maps API keys are compiled into the native
project by `apps/mobile/app.config.ts`, not readable at runtime.

1. `react-native-maps` is already a dependency; no extra install needed.
2. Obtain a Google Maps Platform API key with **Maps SDK for Android**,
   **Maps SDK for iOS**, and **Places API** enabled (a separate,
   more narrowly-scoped key per platform is recommended). Set:
   - `GOOGLE_MAPS_ANDROID_API_KEY` / `GOOGLE_MAPS_IOS_API_KEY` — read
     by `app.config.ts` at Expo config time and compiled into the
     native Android/iOS Maps SDK config. Never exposed to bundled JS.
   - `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` — read at runtime by
     `apps/mobile/src/location/googlePlaces.ts` for search/autocomplete
     (Places Autocomplete + Place Details HTTP APIs). Being
     `EXPO_PUBLIC_`-prefixed, it **is** inlined into the JS bundle —
     restrict it to the Places API only in the Google Cloud console.
   All three are optional in local dev: with them unset, the map still
   opens and a pin can still be dropped, dragged, or set from the
   device's current location and saved — only native tile rendering
   and search/autocomplete need a real key. Never commit real keys;
   `.env` is gitignored and `.env.example` only ever holds placeholders.
3. Rebuild the native app (`expo prebuild` / a new development build)
   after changing any Maps API key — config-plugin fields are baked in
   at build time and are not picked up by Fast Refresh.

The picker is shared between adding a property (`AddPropertyScreen`'s
Location section) and editing one (`PropertyDetailScreen`'s "Edit
Location" action, via `PATCH .../properties/:propertyId/location`) —
both hold picker state as a `LocationDraft`
(`apps/mobile/src/location/locationPayload.ts`) and only ever send a
wire payload through `toLocationDto`, an explicit allowlist of the
fields `PropertyLocationDto` accepts.

### Mobile Clients tab (Milestone 4)

The Clients bottom tab (previously a placeholder) is now a full stack:
client list/search/add, client detail (contact info, requirements,
shortlist, presentations, archive/restore), an "Add Requirement" form
that visually distinguishes **Must Have** from **Preferred** criteria,
ranked match-result cards with per-criterion ✓/✗ explanations and
"Add to Shortlist," a shortlist screen with multi-select and "Create
Presentation," and a create/view presentation flow ending in "Generate
PDF" plus "View"/"Share" (the OS's native share sheet — no in-app
messaging is built here; the agent sends the PDF via WhatsApp/email
manually).

Since permission-gated UI (e.g. hiding "Archive" without
`client.archive`) needs the caller's resolved permission set, and
`GET /workspaces` (used to populate the workspace switcher) doesn't
return it, `AuthContext` additionally calls `GET /workspaces/:id` — the
one workspace endpoint that does return `permissions: string[]` —
whenever the acting workspace changes, and exposes it as
`permissions: Set<string>` alongside `currentWorkspace`.

### Mobile marketplace & publication UI (Milestone 5)

The Home bottom tab (previously a placeholder) is now the client
marketplace: a `MarketplaceStack` with Home (New Listings / For Sale /
For Rent rails, deterministic newest-first queries — no recommendation
AI), Search (text + type/purpose/sort filters, infinite scroll), Listing
Detail (image gallery, price/details/features/safe location, favorite
toggle, an "I'm Interested" action), and Favorites. A shared
`ListingCard` component guarantees the exact same public-safe fields
render identically across all three list surfaces.

**"I'm Interested" / Contact Agent, scoped deliberately.** Full
messaging is reserved for a later milestone (see "Do NOT build yet"
below) and the spec explicitly allows either a minimal inquiry
foundation or routing to a clear future-safe interaction. This build
takes the latter: tapping "I'm Interested" adds the listing to
Favorites (a real, immediately useful action) and shows a message that
direct contact is coming in a future update — never a dead button, and
no new inquiry/messaging surface area to secure and test in this
milestone.

On the professional side, `PropertyDetailScreen` gained a "Marketplace
Listing" section reflecting the current `PublicationDetail` (or its
absence, meaning private) with state-appropriate actions — Prepare
Listing / Edit Public Listing / Submit for Review / Cancel Submission /
Edit & Resubmit / Unpublish / Republish — driven by a pure, unit-tested
mapping (`apps/mobile/src/publications/publicationStatus.ts`) from
publication status to available actions. `PublishPropertyScreen` is the
single-scrollable-form "Prepare Public Listing" flow (public
title/description/price, bedrooms/bathrooms/area, feature selection,
location-visibility choice, image selection with a "Main" indicator) —
the same simplification precedent as `AddPropertyScreen` (Milestone 3),
not a literal multi-step wizard. `propertyType`/`listingPurpose` are
shown read-only, mirrored from the actual property, rather than
editable — a listing should never claim to be a different type of
property than it actually is.

### Admin-web moderation UI (Milestone 5)

`apps/admin-web` (previously the unmodified `create-next-app` starter)
now has the platform's first meaningful admin moderation UI: a login
page (any account holding a PLATFORM role with `admin.content.*`
permissions), a review queue (status tabs defaulting to `PENDING_REVIEW`,
paginated table), and a review detail page (public snapshot preview
including images, submitter/workspace identity, full review history,
and Approve/Request Changes/Reject/Unpublish/Restore actions gated by
what the current status actually allows). Request Changes/Reject/
Unpublish all use a shared `ReasonDialog` that enforces a non-empty
(≥3 character) reason client-side — the API independently re-validates
and remains the real authority. Deliberately minimal: a plain
`fetch`-based API client storing the JWT in `localStorage`, no design
system beyond Tailwind utility classes — functional correctness, not
visual polish, was the priority for this internal tool.

### Mobile role-aware navigation & UX (Milestone 6)

`MainTabs` branches on `user.accountType` (the registration-path signal,
never workspace presence — see docs/PERMISSIONS.md) rather than
rendering one shared tab bar with hidden items:

- **`ClientTabs`**: Home (marketplace), Search, Favorites, Account —
  each of Home/Search/Favorites is its own independent stack navigator
  so back-navigation never crosses tabs, unified only by a small shared
  `MarketplaceDetailParamList` type so all three can push the same
  `MarketplaceDetailScreen`. A client can never reach a professional
  screen through any navigation path — there is no route for it.
- **`ProfessionalTabs`** (AGENT or COMPANY account): Dashboard,
  Properties, Clients, Account. Requirements/Matching/Shortlist/
  Presentations are deliberately **not** separate top-level tabs — they
  stay reachable through Clients → Client Detail, matching the natural
  CRM flow (Client → Requirement → Matching → Shortlist →
  Presentation) the product spec itself describes, rather than
  cluttering the tab bar. `DashboardScreen` still deep-links into them
  (`navigation.navigate('Properties', { screen: 'PropertyDetail', params })`)
  using `NavigatorScreenParams` for full cross-stack type safety.
- Both replace the Milestone 3 `MoreScreen`/`PlaceholderScreen` stubs
  with a real `AccountScreen` (see docs/PRODUCT.md "Account & workspace
  experience (Milestone 6)").
- Every list screen touched this milestone (Properties, Clients,
  marketplace Search) gained the same common UX states: a distinct
  empty-vs-error-vs-loading render, clearable search/filters with a
  visible active-filter indicator, and pull-to-refresh — never a silent
  failure or an indistinguishable blank screen.
- The property photo upload gap (the backend upload endpoint existed
  since Milestone 3 but no screen ever called it) is closed:
  `PropertyDetailScreen`'s gallery now uses `expo-image-picker` to pick
  and upload images with progress state.

## N+1 prevention

Prisma queries for list endpoints must use `include`/`select` to fetch
related data in one round trip; no per-row follow-up queries in a loop.
