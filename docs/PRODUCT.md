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
— Properties, Clients (Milestone 4), and, as of Milestone 5, Home
(now the client marketplace) all have business logic; only Inbox
remains a labeled placeholder, not a dead button — in-app messaging is
reserved for a later milestone), and three
Properties screens (list with search/status filters, add, detail). The
"Add Property" form
is a single scrollable form covering every field the product spec's
step list calls for (type/purpose, basics, price, rooms/area, features,
location, owner, private notes) rather than a literal multi-screen
wizard — a deliberate simplification, not a missing feature. Location
entry is a full interactive `react-native-maps` picker
(`apps/mobile/src/location/MapLocationPicker.tsx`): search-and-select,
tap-to-drop, drag-to-move, and an explicit "Use current location"
button (the only moment the app requests location permission). The
same picker, pre-filled with the saved pin, is reachable from an
existing property's detail screen via "Edit Location" — see
`docs/API.md` "Google Maps setup" for the required API keys and Google
Cloud APIs.

### Client CRM, matching & presentations (Milestone 4)

Milestone 4 turns the private property database into the daily
agent workflow the product is built around: a client contacts an
agent ("I need a 3-bedroom apartment in Jounieh, around $180,000, with
parking"), the agent saves the client and that requirement, instantly
sees ranked matching properties from their own authorized inventory,
selects the ones worth sharing, and generates a professional PDF to
send.

- **`ClientRecord`** — a professional's own customer, not a platform
  account. Belongs to a workspace (company employee's clients belong to
  the company, not their personal workspace) with a practical CRM
  lifecycle (`LEAD` → `ACTIVE`/`QUALIFIED`/`VIEWING`/`NEGOTIATING` →
  `WON`/`LOST`/`INACTIVE`), a source (referral/WhatsApp/Instagram/
  walk-in/etc.), and optional assignment to a workspace member.
- **`ClientRequirement`** — a client may have any number of saved
  searches at once (an apartment to buy AND land to invest in). Each
  one clearly separates **Must Have** (hard) criteria — budget,
  bedrooms/bathrooms, area, accepted locations, required features, all
  of which exclude a property when unmet — from **Preferred** (soft)
  criteria, which only raise a match's score.
- **Matching** is computed fresh on every request from the workspace's
  own current property data (never a stale stored result), returns a
  transparent 0-100 score, and explains exactly which criteria matched
  and which preferred ones didn't — no generative/AI-invented
  explanations.
- **Shortlist** — saving matched (or manually browsed) properties for a
  client, ready to turn into a presentation.
- **Presentations** — the agent selects shortlisted properties, orders
  them, adds an optional client-facing note per property, and generates
  a branded PDF built exclusively from safe, non-sensitive property
  data (never owner contacts, commission, private notes, or exact
  coordinates). The PDF is shared through the device's native share
  sheet (WhatsApp/email/etc.) — no in-app messaging yet.

See docs/API.md "Client CRM, matching & presentation endpoints" and
docs/PERMISSIONS.md "Matching architecture" / "Presentation
authorization" for the full technical detail.

### Publication workflow & client marketplace (Milestone 5)

Milestone 5 is the controlled bridge between the private professional
database (Milestones 3-4) and the "free to use, no subscription
required" public marketplace described in the central value proposition
above:

- **Private by default, always.** Creating a property never
  automatically publishes it. An agent/company explicitly chooses to
  prepare and submit a listing; a private property never appears in
  marketplace search, feeds, favorites, or any public endpoint —
  enforced structurally (the marketplace's only source of truth is the
  approved `PropertyPublication` snapshot, which simply has no field for
  owner/private data) and defensively (business status re-checked on
  every marketplace query, independent of the publication's own state).
- **Submit → review → approve**, not self-publish. A professional
  prepares public-facing content (title, description, price, features,
  location visibility, photos) — deliberately never the same object as
  the private property record — and submits it. A platform moderator
  reviews the exact frozen snapshot (never a live object the professional
  could quietly edit mid-review) and approves, rejects, or requests
  changes, each with a preserved reason and timestamp. Approval never
  transfers ownership: the property stays the workspace's own record.
- **Versioned, not overwritten.** Editing an already-published listing
  starts a new review round while the previously-approved version stays
  live to the public — approval atomically swaps which version the
  marketplace serves. Nothing the public sees changes without going
  through the same review.
- **The marketplace itself**: any authenticated user (client, agent, or
  company account — browsing has nothing to do with workspace
  membership) can search/filter/sort approved listings by price, type,
  purpose, rooms, area, location, and features, view a full listing
  detail with a photo gallery and safe-by-default location, and save
  favorites. A listing's location shows only what the professional
  chose to make public — an approximate city/area by default, exact
  coordinates only if explicitly opted in.
- **Reversible moderation, throughout.** A professional can unpublish
  their own live listing (and republish it later without a new review,
  since nothing changed); a platform moderator can take a listing down
  with a reason and restore it later, as long as the property is still
  genuinely available. Nothing here is a hard delete.

See docs/API.md "Publication, moderation & marketplace endpoints" and
docs/PERMISSIONS.md "Content moderation lifecycle — property
publications" / "Marketplace authorization" for the full technical
detail.

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
