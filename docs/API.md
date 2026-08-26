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

Not yet needed at Milestone 0. When the API is public enough to need it,
version via URL prefix (`/v1/...`), not headers.

## Health check

`GET /health` — liveness/readiness for Postgres (via Prisma) and Redis.
Added in Milestone 0 as operational infrastructure, not a business
endpoint.

## Authentication headers (from Milestone 1)

Bearer access token in `Authorization: Bearer <token>`. Refresh via a
dedicated endpoint using an httpOnly-cookie or securely-stored refresh
token, never the access token.

## Workspace context (from Milestone 2)

Professional-data endpoints require a resolved current workspace
(typically `X-Workspace-Id` header or route param, validated against the
authenticated user's active memberships server-side — never trusted
as-is from the client).

## N+1 prevention

Prisma queries for list endpoints must use `include`/`select` to fetch
related data in one round trip; no per-row follow-up queries in a loop.
