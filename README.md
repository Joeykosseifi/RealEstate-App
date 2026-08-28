# Real Estate Platform

A production-quality real estate management and marketplace platform,
built milestone by milestone. See [`docs/PRODUCT.md`](docs/PRODUCT.md)
for the product overview, [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md)
for the authorization model, and [`docs/SECURITY.md`](docs/SECURITY.md)
for the security requirements every milestone is held to.

## Repository structure

```
real-estate-platform/
├── apps/
│   ├── mobile/       React Native + Expo + TypeScript (clients & professionals)
│   ├── admin-web/    Next.js + TypeScript (admin moderation & operations)
│   └── api/           NestJS + TypeScript (backend API)
├── packages/
│   ├── ui/            Shared cross-platform design tokens / components
│   ├── types/         Shared TypeScript types (API contracts)
│   ├── validation/     Shared zod validation schemas
│   └── config/         Shared env validation + config helpers
├── prisma/            Prisma schema & migrations (PostgreSQL)
├── docs/              Architecture & product documentation
└── tests/             Cross-cutting / security test suites
```

## Requirements

- Node.js >= 20, npm >= 10 (see `.nvmrc`)
- Docker (for local Postgres + Redis)

## Getting started

```bash
npm install
cp .env.example .env

# Start Postgres + Redis
npm run docker:up

# Generate the Prisma client and apply migrations
npm run prisma:generate
npm run prisma:migrate

npm run prisma:seed         # seeds the permission catalog + system roles (idempotent)

# Run the API
npm run dev:api        # http://localhost:3000 — GET /health, POST /api/v1/auth/...

# Run the admin web app
npm run dev:admin       # http://localhost:3001

# Run the mobile app (Expo)
npm run dev:mobile
```

## Environment variables

See [`.env.example`](.env.example) for the full list. Copy it to `.env`
and fill in real values; `.env` is gitignored and must never be committed.
Every required variable is validated at process startup — the API refuses
to start with missing or invalid configuration instead of running with
undefined behavior.

## Common scripts (run from repo root)

| Command | Description |
|---|---|
| `npm run build` | Build every app/package that defines a `build` script |
| `npm run lint` | Lint every app/package |
| `npm run typecheck` | Type-check every app/package |
| `npm test` | Run unit tests across every app/package |
| `npm run format` / `format:check` | Prettier write/check across the repo |
| `npm run docker:up` / `docker:down` | Start/stop local Postgres + Redis |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:seed` | Seed foundation data (system roles) |

## Database

PostgreSQL via Prisma. See [`docs/DATABASE.md`](docs/DATABASE.md) for
schema conventions and the planned model-introduction schedule. Never
mutate the database outside of a checked-in migration.

## Testing

`npm test` (root) runs every app/package's unit tests. The API's
integration/e2e suite runs against a real Postgres + Redis (not mocks)
and lives separately, since it needs that live infrastructure and runs
serially against shared state:

```bash
cd apps/api
npm run test:e2e
```

See `apps/api/test/` for the auth/session/workspace-activation
integration tests, and `tests/README.md` for the cross-cutting
security-test checklist that grows as later milestones add the
workspaces/properties those tests need.

## Build order (milestones)

The platform is built one milestone at a time; each is fully tested,
linted, security-reviewed, and documented before the next begins.

| # | Milestone | Status |
|---|---|---|
| 0 | Repository foundation (this repo, DB, Prisma, Redis, tooling) | ✅ |
| 1 | Auth, users, verification, sessions, personal workspace creation | ✅ |
| 2 | Workspaces, memberships, roles, permissions, authorization | ✅ |
| 3 | Agent property database (location, media, owner info, search) | ✅ |
| 4 | CRM, requirements, matching, presentations/PDFs | ✅ |
| 5 | Publication workflow, admin moderation & client marketplace (search, favorites) | ✅ |
| 6 | Public agent/company profile pages | ⬜ |
| 7 | Conversations, messages, viewings, notifications | ⬜ |
| 8 | Company workspace, employee accounts, team management | ⬜ |
| 9 | Freelance/company collaboration & commission agreements | ⬜ |
| 10 | Subscriptions, payments, plan limits | ⬜ |
| 11 | Security hardening, audit logging, performance, production readiness | ⬜ |

## Contributing conventions

- Strict TypeScript everywhere; no `any` escape hatches without reason.
- All incoming API DTOs are validated; ORM entities are never returned
  directly from API responses.
- Database changes are migrations only — never undocumented mutations.
- Business logic lives in services, not controllers.
- Default-deny authorization; see `docs/PERMISSIONS.md`.
- Automated tests are required for every permission boundary (see
  `tests/README.md` for the critical security-test checklist).
