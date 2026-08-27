# Product Overview

A real estate management and marketplace platform serving four user
contexts:

- **Client** — browses the public marketplace, requests viewings, messages
  agents/companies, saves favorites and requirements.
- **Independent / Freelance Agent** — maintains a private property
  database in a personal workspace, manages CRM clients, and may
  optionally collaborate with companies.
- **Real Estate Company** — a company workspace with team members, roles,
  and its own private property database.
- **Platform Administrator** — moderates publication requests and manages
  the platform.

The professional side (agent/company) is subscription-based. The
marketplace (client-facing search/browse) is free to use and does not
require a professional subscription.

## Central value proposition

A secure, private property database for professionals: exact locations
(Google Maps), owner details, private notes, presentations/PDFs, and
client matching — with nothing professional leaking to the public
marketplace except what has been explicitly approved for publication.

## Core architecture concepts

Every professional data operation is built around four concepts, detailed
in [`PERMISSIONS.md`](./PERMISSIONS.md):

1. **Workspace** — the container professional data belongs to (a personal
   workspace per agent, a company workspace per company).
2. **Ownership** — which workspace owns an entity. Ownership never
   transfers through collaboration or membership changes.
3. **Permissions** — granular, independent, default-deny grants (see
   `PERMISSIONS.md` for the full list).
4. **Publication Status** — the separate lifecycle that governs whether a
   property is visible to the public marketplace.

## Registration & accounts (Milestone 1)

Three registration paths — CLIENT, AGENT, COMPANY — determine onboarding
behavior only; they are never treated as an authorization signal (see
`docs/PERMISSIONS.md`). All three go through the same account lifecycle:
registration → email verification + phone OTP verification → activation.

- **CLIENT** activates with no professional workspace — just the
  marketplace account.
- **AGENT** activation automatically creates exactly one personal
  workspace with the agent as its OWNER — the "private professional
  database ready" moment described in the central value proposition
  above. This personal workspace is permanent and stays separate from any
  company the agent later joins.
- **COMPANY** activation creates the Company record, its company
  workspace, and an OWNER membership for the person who registered it.

See `docs/API.md` for the concrete endpoints and `docs/DATABASE.md` for
the activation/idempotency guarantees behind "exactly one" above.

## Professional property database (Milestone 3)

Every AGENT personal workspace and every COMPANY workspace now has a real
private property database behind it — this is the "central value
proposition" above, implemented:

- **Ownership vs. authorship.** A property belongs to exactly one
  workspace (`workspaceId`) — the business owner of the record. Whoever
  actually typed it in (`createdByUserId`) is a separate concept: a
  company employee creating a property still creates it for the
  company's workspace, never their own personal one. See
  `docs/PERMISSIONS.md` "Property ownership vs. authorship."
- **Business status, not publication status.** `AVAILABLE` /
  `RESERVED` / `SOLD` / `RENTED` / `OFF_MARKET` / `ARCHIVED` describe the
  deal's real-world state. Whether a property is visible on the public
  marketplace is a completely separate lifecycle that doesn't exist yet
  (Milestone 5) — a property can be `AVAILABLE` and privately-held for
  months before any publication concept applies to it.
- **The Google Maps promise.** An exact pin (latitude/longitude,
  optionally a Google Place ID) is saved once and is the permanent
  source of truth — reopening a property years later shows the exact
  same location. See `docs/PERMISSIONS.md` "Google Maps strategy."
- **Sensitive data stays sensitive.** Owner contact info, private
  internal notes, and commission figures are never returned unless the
  viewer specifically holds the matching permission — `property.view`
  alone reveals none of them. See `docs/PERMISSIONS.md` "Sensitive
  property fields."
- **Archive, never delete.** Retiring a property uses the same
  reversible-moderation pattern as Milestone 2's user/company
  moderation: `ARCHIVED` is a status, not a deletion, and restore is
  always available.

### Mobile property flow (Milestone 3)

`apps/mobile` now has its first real screens beyond the Expo starter:
sign-in, a bottom-tab shell (Home / Properties / Clients / Inbox / More
— only Properties has business logic this milestone, the rest are
labeled placeholders, not dead buttons), and three Properties screens
(list with search/status filters, add, detail). The "Add Property" form
is a single scrollable form covering every field the product spec's
step list calls for (type/purpose, basics, price, rooms/area, features,
location, owner, private notes) rather than a literal multi-screen
wizard — a deliberate simplification, not a missing feature. Location
entry is manual lat/lng plus an explicit "Use current location" button
(the only moment the app requests location permission); a full
interactive map/search picker is the documented follow-up once
`react-native-maps` and a Google Maps API key are wired in — see
`docs/API.md` "Google Maps setup" for exactly what that involves.

## Build order

The platform is built milestone by milestone; see the root
[`README.md`](../README.md#build-order) for the full list and current
status. Each milestone is implemented, tested, and documented before the
next begins.

## Full product specification

The complete product specification (property status model, collaboration
lifecycle, CRM, matching, presentations, messaging, viewings, auth,
authorization, file security, audit logging, subscriptions) is tracked
against the milestones in the root README and the docs listed there. This
document will grow section-by-section as each milestone lands, rather than
describing unbuilt features in detail up front.
