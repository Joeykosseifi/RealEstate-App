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

### Mobile setup (Milestone 3)

`apps/mobile` reads `EXPO_PUBLIC_API_URL` (defaults to
`http://localhost:3000`) — set it to a URL your device/simulator can
actually reach (a plain `localhost` won't resolve from a physical
device or most Android emulators; use your machine's LAN IP or a tunnel).

**Google Maps setup (not configured in this environment):** the
location picker currently uses manual lat/lng entry plus an explicit
"Use current location" button (`apps/mobile/src/location/useCurrentLocation.ts`).
To add the full interactive map/search experience described in the
product spec:

1. Install `react-native-maps` and, for search/autocomplete, a Places
   client library.
2. Obtain a Google Maps Platform API key (Maps SDK + Places API
   enabled) and set `GOOGLE_MAPS_API_KEY` (native config) /
   `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (client-side calls) in `.env`.
3. Build a `<MapLocationPicker>` component behind the same interface
   `useCurrentLocation` already establishes, and swap it into
   `AddPropertyScreen`'s Location section — no other screen needs to
   change, since they only ever receive `{ latitude, longitude, ... }`.

## N+1 prevention

Prisma queries for list endpoints must use `include`/`select` to fetch
related data in one round trip; no per-row follow-up queries in a loop.
