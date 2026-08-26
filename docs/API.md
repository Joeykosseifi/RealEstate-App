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

## Workspace context (from Milestone 2)

Professional-data endpoints require a resolved current workspace
(typically `X-Workspace-Id` header or route param, validated against the
authenticated user's active memberships server-side — never trusted
as-is from the client).

## N+1 prevention

Prisma queries for list endpoints must use `include`/`select` to fetch
related data in one round trip; no per-row follow-up queries in a loop.
