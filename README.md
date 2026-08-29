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

The admin-web moderation UI has its own committed, repeatable Playwright
regression suite (16 scenarios: login/session handling, the review
queue's rendering/filtering/pagination, the review detail's safe
snapshot, approve/reject/request-changes with reason validation,
admin-unpublish/restore, and a structural check that private
professional/owner fields never reach the moderation view). It seeds
real fixtures through the actual registration/publication HTTP flow
(never mocked) and needs Postgres + Redis running:

```bash
cd apps/admin-web
npm run test:admin-web
```

This one script boots the API (dev mode) and admin-web, seeds fixtures,
runs the suite, and tears both servers down — see
`apps/admin-web/tests/run-admin-web-tests.mjs` for details, including
why it flushes Redis first (the suite drives real traffic through the
real login/registration rate limiters, never a weakened stand-in).

### Known real-device-only verification gaps

Two pieces of mobile UI are verified against the real backend (curl-level
smoke tests, or the package's own type definitions) but not by actually
tapping through them on a physical device or simulator, since this
sandbox has neither:

- `PropertyDetailScreen`'s photo upload (`expo-image-picker`, Milestone
  6) — the picker's own permission prompt and camera-roll UI.
- The mobile registration/verification screens' paste-the-token flow
  (Milestone 6.1) — keyboard behavior, autofill, and copy-paste from the
  device's mail/SMS apps into the token/OTP fields.

Add both to the pre-launch device/beta testing checklist before shipping.

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
| 6 | Core product completion & UX (role-aware navigation, real dashboard, contact-professional, workflow/UX polish) | ✅ |
| 6.1 | Mobile registration & onboarding closure (Welcome/Sign In/Create Account, real verification, forgot password) | ✅ |
| 7 | Design system & full UI polish | ⬜ |
| 8 | Conversations, messages, viewings, notifications | ⬜ |
| 9 | Company workspace, employee accounts, team management | ⬜ |
| 10 | Freelance/company collaboration & commission agreements | ⬜ |
| 11 | Subscriptions, payments, plan limits | ⬜ |
| 12 | Public agent/company profile pages | ⬜ |
| 13 | Security hardening, audit logging, performance, production readiness | ⬜ |

Milestone 6 superseded the originally-planned "public agent/company
profile pages" milestone — the product was re-scoped toward reaching a
usable V1 beta faster; public profile pages are deferred to milestone
12 above.

## Contributing conventions

- Strict TypeScript everywhere; no `any` escape hatches without reason.
- All incoming API DTOs are validated; ORM entities are never returned
  directly from API responses.
- Database changes are migrations only — never undocumented mutations.
- Business logic lives in services, not controllers.
- Default-deny authorization; see `docs/PERMISSIONS.md`.
- Automated tests are required for every permission boundary (see
  `tests/README.md` for the critical security-test checklist).
