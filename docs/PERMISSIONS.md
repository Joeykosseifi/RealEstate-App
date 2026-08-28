# Workspaces, Ownership & Permissions

This document is the reference for the platform's core authorization
model. It is written ahead of implementation (Milestone 2) so every
milestone that touches professional data is built against the same rules.

## The four concepts

1. **Workspace** — the container all professional data belongs to.
   - An independent agent automatically gets a personal workspace on
     account activation.
   - A company has a company workspace.
   - A user may belong to multiple workspaces (e.g. their own personal
     workspace plus one or more company workspaces).
   - Personal and company data are never merged.

2. **Ownership** — which workspace owns an entity.
   - A property created in an agent's personal workspace belongs to that
     personal workspace, permanently.
   - A property created in a company workspace belongs to the company,
     even if a specific employee entered it.
   - Sharing a personal property with a company (collaboration) never
     transfers ownership — the company only gets explicitly granted
     permissions.
   - Ending a collaboration revokes future access but preserves
     historical/audit records and existing transaction records.

### Property ownership vs. authorship (Milestone 3)

`Property` has two distinct id fields, and they answer different
questions:

- **`workspaceId`** — the business owner. Set once at creation, never
  changeable afterward (`UpdatePropertyDto` has no `workspaceId` field
  at all — there is no request shape that could move a property to a
  different workspace).
- **`createdByUserId`** — who actually entered the record. Server-derived
  from the authenticated caller, never client-supplied.

Example: John, an employee of Confidence Real Estate, creates a
property while acting in Confidence's workspace.
`workspaceId = Confidence's workspace`, `createdByUserId = John`. The
property belongs to the company, not to John's own personal workspace
— removing John from Confidence later has no effect on the property.
This is the same design already used for `WorkspaceMember.invitedByUserId`
and friends in Milestone 2, applied to business data for the first time.

3. **Permissions** — granular, independent, default-deny grants.
4. **Publication Status** — separate from business status; see below.

## Membership vs. ownership vs. permission

Membership in a workspace grants **access to operate within it** (subject
to role/permissions) — it never implies ownership of any specific entity,
and it never bypasses collaboration-scoped restrictions on entities owned
by a different workspace.

## Property status model

Business status (independent of publication) — **implemented, Milestone
3**:

- `AVAILABLE`, `RESERVED`, `SOLD`, `RENTED`, `OFF_MARKET`, `ARCHIVED`

Allowed transitions (`PropertiesService.ALLOWED_STATUS_TRANSITIONS`),
via `POST .../properties/:id/status`:

| From | Can move to |
|---|---|
| `AVAILABLE` | `RESERVED`, `SOLD`, `RENTED`, `OFF_MARKET` |
| `RESERVED` | `AVAILABLE`, `SOLD`, `RENTED`, `OFF_MARKET` |
| `OFF_MARKET` | `AVAILABLE`, `RESERVED`, `SOLD`, `RENTED` |
| `SOLD` | `AVAILABLE`, `OFF_MARKET` (undoing a mistaken sale mark) |
| `RENTED` | `AVAILABLE`, `OFF_MARKET` |
| `ARCHIVED` | nothing — restore first |

Deliberately excluded: `SOLD ↔ RENTED` directly, and `SOLD`/`RENTED` →
`RESERVED` — both would skip back through `AVAILABLE` first, which
doesn't correspond to any real-world event. `ARCHIVED` is reachable only
via `POST .../properties/:id/archive`, never the generic status
endpoint — see "Archive, not delete" below.

Publication lifecycle (independent of business status, **not yet
built** — Milestone 5):

- `PRIVATE` → `PENDING_REVIEW` → `UNDER_REVIEW` →
  `CHANGES_REQUIRED` / `APPROVED` → `PUBLISHED`, or `REJECTED`;
  a published property can later be `UNPUBLISHED`.

A property can be, for example, `AVAILABLE` + `PRIVATE`,
`AVAILABLE` + `PUBLISHED`, or permanently `SOLD` while remaining in the
professional database as historical data.

Professionals can never directly publish — only submit for review.
Admins approve, reject, or request changes. A collaborating company may
submit on a freelance agent's behalf only with explicit `property.publish`
permission, and only for that specific property; this never transfers
ownership.

## Sensitive property fields (Milestone 3 — implemented for `property.view_owner`/`view_private_notes`/`view_commission`/`view_exact_location`; the rest remain foundation-only)

| Permission | Grants |
|---|---|
| `property.view` | Basic visibility into a property record |
| `property.edit` | Modify a property record |
| `property.share` | Share a property with another workspace (collaboration) — not built yet |
| `property.publish` | Submit a property for publication review — not built yet |
| `property.unpublish` | Remove a published property from the marketplace — not built yet |
| `property.create_presentation` | Build a presentation/PDF from a property — not built yet |
| `property.view_owner` | View **and edit** owner contact details |
| `property.view_private_notes` | View **and edit** private internal notes |
| `property.view_commission` | View **and edit** commission information (also requires `property.view_private_notes`, since commission lives inside the private-details record) |
| `property.view_exact_location` | View exact saved coordinates (vs. approximate) — read-only gate, see below |

`property.view` never implies any of the others — a caller with only
`property.view` gets the property's core fields and nothing from
`owners`/`privateDetails`/`location`; those keys are **omitted from the
response entirely**, never returned as `null` or masked, so there's no
way to distinguish "no data on file" from "not authorized to see it."
See `apps/api/src/properties/property.mapper.ts` and
`apps/api/test/property-sensitive-fields.e2e-spec.ts`.

**Write is gated the same as read, except for location.** A caller
can't write owner info, private notes, or commission notes without
holding the matching view permission — a user who can't see owner data
shouldn't be able to blindly overwrite it either
(`PropertiesService.assertCanWriteSensitiveSections`). Location is the
one deliberate exception: every property needs a location the moment
it's created, so writing it only needs `property.create`/`property.edit`;
only *reading the exact coordinates back* needs
`property.view_exact_location`. A caller can therefore save a location
they can't see the precise value of afterward — an intentional,
documented asymmetry, not a bug.

**Seeded role defaults (Milestone 3 update):** `WORKSPACE_OWNER` and
`COMPANY_ADMIN` hold all four sensitive-view permissions. `MANAGER` and
`AGENT` hold `property.view_owner`, `property.view_private_notes`, and
`property.view_exact_location` — core data needed to work a property
day-to-day, including the property they themselves just entered — but
**not** `property.view_commission`, kept restricted to owner/admin
roles as the one financially-sensitive field. `VIEWER` holds none of
the four, by design: it's the role that proves basic `property.view`
never implies sensitive access.

## Archive, not delete (Milestone 3)

Retiring a property never hard-deletes it — `POST
.../properties/:id/archive` sets `propertyStatus = ARCHIVED` and stamps
`archivedAt`/`archivedByUserId`, preserving the row and every related
`PropertyLocation`/`PropertyFeature`/`PropertyMedia`/`PropertyOwner`/
`PropertyPrivateDetails` record untouched. `property.archive` also
gates the inverse action, `POST .../properties/:id/restore` — the same
permission governs both halves of one reversible lifecycle capability,
so there's no separate "restore" permission to keep in sync. Restore
always lands on `OFF_MARKET`, never the property's prior status, so an
agent consciously decides to re-list rather than a property silently
reappearing as `AVAILABLE`. An archived property also can't be edited or
have its status changed through the ordinary endpoints (`409`) until
it's restored.

## Client archive/restore (Milestone 4)

The identical reversible pattern as property archive/restore, applied to
`ClientRecord`: `client.archive` gates both `POST .../clients/:id/archive`
(preserving the row and every requirement/shortlist/presentation
relationship untouched) and its inverse, `POST .../clients/:id/restore` —
no separate "restore" permission. Restore always lands on `INACTIVE`,
never the client's prior status, mirroring `Property.restore()`'s
fixed-default convention exactly: an agent consciously reactivates a
restored client's lifecycle rather than it silently reappearing as
`LEAD`/`ACTIVE`. An archived client also can't be edited or reassigned
through the ordinary endpoints (`409`) until it's restored.

## Client assignment (Milestone 4)

Assigning a `ClientRecord` to a workspace member (`POST
.../clients/:id/assign`, `client.assign`) never grants that member
additional workspace permissions — it only sets `assignedToUserId`,
purely a working-relationship marker consulted by client filtering. The
assignment target is re-verified server-side on every call: it must be
an **ACTIVE** member of the **same workspace** the client belongs to
(`409` otherwise) — a suspended or removed member, or a user from a
different workspace entirely, can never receive an assignment, even if
they held a stale valid id. Optionally assigning a client at creation
time (`CreateClientDto.assignedToUserId`) requires `client.assign` in
addition to `client.create` — the same "write requires the same
permission as the action it performs" principle used for property
owner/private-notes writes.

## Matching architecture (Milestone 4)

Property matching (`GET .../clients/:clientId/requirements/:requirementId/matches`)
requires **both** `client.view` and `property.view` — the guard checks
`client.view` (the route is nested under a client), and
`MatchingService.findMatches` explicitly checks `property.view` itself,
since `@RequireWorkspacePermission` only ever checks one permission.
Authorization is enforced **before** any property is read: the
candidate SQL query is scoped to `workspaceId` from the start, so an
unauthorized or another-workspace's property is never fetched, scored,
or filtered out after the fact. For Milestone 4, matching only
considers properties the ACTIVE workspace itself owns — cross-workspace
or freelance-collaboration inventory is a later milestone.

Only `AVAILABLE` properties are automatically matched — `SOLD`,
`RENTED`, and `ARCHIVED` are always excluded, and `RESERVED`/
`OFF_MARKET` are also excluded by the same default (a documented
choice: a requirement's whole point is finding something the client can
actually pursue right now). See docs/DATABASE.md "Design decisions
worth knowing (Milestone 4)" for the hard/soft criteria split, the
match-score formula, the currency rule, and the OR-combined location
matching.

Match results use `PresentationSafePropertySnapshot` — a fixed-shape
DTO with no owner/commission/private-notes/exact-coordinate fields at
all, structurally, not just by convention (see `property.mapper.ts`
`toPresentationSafeSnapshot`). This is the same safe-snapshot type PDF
presentation generation uses.

## Presentation authorization (Milestone 4)

Every presentation endpoint (`workspaces/:id/presentations/...`)
requires a single permission, `property.create_presentation` — create,
list, view, edit, generate, and access the generated PDF all gate on
it, per the "prefer the existing permission catalog" principle; there
is no separate `property.view_presentation`. Every
`clientId`/`requirementId`/`propertyId` in the request body is
independently re-verified against the caller's `workspaceId` inside
`PresentationsService` — a property or client from another workspace
can never enter a presentation, regardless of what the client-side
selection UI shows. Accessing the generated PDF itself works exactly
like private property media: `GET .../presentations/:id/access-url`
returns a short-lived HMAC-signed URL to the same `GET
/storage/access` endpoint property media already uses (see
docs/DATABASE.md "Property media storage") — never a permanent public
path.

## Google Maps strategy (Milestone 3)

- The saved `latitude`/`longitude` (`PropertyLocation`, `Decimal(9,6)`)
  are the **permanent source of truth** the moment a property is saved
  — reopening it years later shows the exact same pin, regardless of
  whether the Google Place behind it still exists or has moved.
  `googlePlaceId` is stored as a convenience reference only, never
  relied on exclusively.
- `locationSource` records how the agent captured the pin —
  `GOOGLE_SEARCH`, `MAP_PIN`, `CURRENT_LOCATION`, or `MANUAL` — for
  provenance, not authorization.
- The mobile location picker (`apps/mobile/src/location/MapLocationPicker.tsx`,
  see docs/PRODUCT.md "Mobile property flow") is a full interactive
  `react-native-maps` map — search/autocomplete, tap-to-drop,
  drag-to-move — and only requests device location permission for the
  explicit "Use current location" action, via `useCurrentLocation`.
  Opening the map, viewing a saved pin, or editing one via drag/drop
  never triggers a permission prompt.
- Dropping or dragging the pin moves it off whatever Google Place it
  was tied to, so `googlePlaceId` is cleared at that point — the new
  coordinates become the source of truth immediately, consistent with
  "saved lat/lng are permanent, Place ID is supplementary" above. See
  `apps/mobile/src/location/locationPayload.ts`.
- See docs/API.md "Google Maps setup" for the required Google Cloud
  APIs, the env vars (`GOOGLE_MAPS_ANDROID_API_KEY`,
  `GOOGLE_MAPS_IOS_API_KEY`, `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`), and
  why a development build (not Expo Go) is required. No real keys are
  configured in this environment — the picker still works fully for
  manual drop/drag/current-location without them; only native tile
  rendering and search/autocomplete need a real key.

## Location visibility

Independent of the permissions above, each property has a
`locationVisibility` column (`PropertyLocation.locationVisibility`,
Milestone 3) controlling what the *public marketplace* (not workspace
members) will eventually be able to see:

- `PRIVATE` (default), `WORKSPACE`, `PUBLIC_APPROXIMATE`, `PUBLIC_EXACT`

**Field exists, not yet enforced.** No public/client-facing endpoint
reads this field yet — that's Milestone 5/6. Today, professional-side
access to exact coordinates is governed entirely by
`property.view_exact_location` (see "Sensitive property fields" above),
which is independent of this column. Saved latitude/longitude/Google
Place ID are always the source of truth in the database regardless of
visibility setting; a future public DTO
(`PropertyLocationPublic`/`toPropertyPublicDetail`, already scaffolded
in `apps/api/src/properties/property.mapper.ts` as foundation) will read
`city`/`area` only, never exact coordinates.

## Collaboration lifecycle

`PENDING` → `ACTIVE` → (`DECLINED` | `REVOKED` | `ENDED`)

A collaboration grants a specific set of permissions (from the table
above) to a specific collaborating workspace, and may optionally carry a
commission agreement (percentage or fixed, potentially split across
multiple shares — not hard-coded to one model). Commission terms are
private professional data.

## Enforcement rule

Authorization is resolved server-side, in this order, for every
professional-data request:

authenticated user → current workspace → active membership → role →
required permission → entity ownership → collaboration grant (if the
entity belongs to a different workspace).

Default deny at every step. The frontend-provided workspace, role, or
permission is never trusted.

## Workspace scope vs. platform scope (Milestone 2)

Every `Role` and every `Permission` carries an `AuthorizationScope` —
`WORKSPACE` or `PLATFORM`. This is not descriptive metadata; it is
**structurally enforced**, not just a naming convention:

- A **workspace permission** (`workspace.*`, `team.*`, and the
  foundation-only `property.*`/`client.*`/`collaboration.*` keys) is
  resolved from a user's `WorkspaceMember` → `Role` → `RolePermission`
  chain for one specific workspace (`WorkspaceAuthorizationService`).
- A **platform permission** (`admin.*`) is resolved from a user's
  `UserPlatformRole` grants, entirely independent of any workspace
  membership (`PlatformAuthorizationService`). A `SUPER_ADMIN` does not
  need to join every workspace on the platform to administer user
  accounts — platform authority and workspace membership are two
  unrelated axes.
- `RolesService` (custom per-workspace role CRUD) refuses to attach a
  `PLATFORM`-scope permission to a `WORKSPACE`-scope role — the check is
  a `permission.scope !== 'WORKSPACE'` guard inside
  `resolveWorkspacePermissions()`, not a UI-only restriction. **A
  malicious company admin can never grant `admin.users.deactivate` (or
  any other platform permission) to a workspace role, no matter what
  they submit to `POST /workspaces/:id/roles`** — the API returns `403`
  and nothing is written. See
  `apps/api/test/workspace-permissions.e2e-spec.ts` (test 12) for the
  automated proof.
- There is no endpoint anywhere that lets a workspace-scoped actor grant
  a platform role. Platform roles (`SUPER_ADMIN`, `PLATFORM_ADMIN`, etc.)
  can only be granted/revoked via `POST/DELETE
  /admin/users/:id/platform-roles`, itself gated by the platform
  permission `admin.roles.manage` — which only `SUPER_ADMIN` is seeded
  with.

## Permission catalog (Milestone 2)

The full, single-source-of-truth catalog lives in
`apps/api/src/authorization/permissions.catalog.ts` — never hard-code a
raw permission string elsewhere; import the `PERMISSIONS` constant so a
typo is a compile error. It is grouped by domain:

| Group | Scope | Examples |
|---|---|---|
| Workspace | WORKSPACE | `workspace.view`, `workspace.manage_roles`, `workspace.view_audit` |
| Team | WORKSPACE | `team.view`, `team.invite`, `team.suspend`, `team.remove`, `team.assign_role` |
| Property (foundation only — enforced from Milestone 3) | WORKSPACE | `property.view`, `property.create`, `property.view_exact_location`, ... |
| Client CRM (enforced starting Milestone 4) | WORKSPACE | `client.view`, `client.create`, `client.edit`, `client.assign`, `client.archive` |
| Collaboration (foundation only — enforced from Milestone 9) | WORKSPACE | `collaboration.view`, `collaboration.manage`, ... |
| Admin / platform | PLATFORM | `admin.users.view`, `admin.users.view_email`, `admin.users.suspend`, `admin.roles.manage`, ... |

## Workspace roles (system, seeded)

Defined in `apps/api/src/authorization/roles.catalog.ts`, seeded by
`prisma/seed.ts`. A workspace's own custom roles (created via `POST
/workspaces/:id/roles`) are ordinary `WORKSPACE`-scope `Role` rows with
`workspaceId` set to that workspace, subject to the same platform-leak
guard above.

| Role | Summary |
|---|---|
| `WORKSPACE_OWNER` | Full control of their own workspace (team + all operational permissions). Not a platform administrator. |
| `COMPANY_ADMIN` | Manages day-to-day team/operations; cannot manage custom roles or view the workspace audit log. |
| `MANAGER` | Operational permissions (properties, clients); cannot change workspace/team structure. |
| `AGENT` | Ordinary professional permissions; no team-management permissions. |
| `VIEWER` | Read-only; no create/edit/archive/publish/invite permissions. |

## Platform roles (system, seeded)

| Role | Summary |
|---|---|
| `SUPER_ADMIN` | Full platform authority, including `admin.roles.manage` (the only role that can grant/revoke platform roles). Protected against total lockout — see below. |
| `PLATFORM_ADMIN` | Broad platform administration, excluding managing other platform admins. |
| `PROPERTY_MODERATOR` | Moderates published/public content only. |
| `USER_MODERATOR` | Moderates user and company accounts only. |
| `SUPPORT_ADMIN` | Account lookup + verification help; read-mostly. |
| `FINANCE_ADMIN` | Subscriptions and financial reporting only. |
| `ANALYST` | Read-only analytics/audit access. |

## Admin email access

`admin.users.view_email` is a distinct permission from `admin.users.view`.
An actor with `view` but not `view_email` gets a user summary/detail with
the `email`/`phone` fields **omitted entirely** — never masked, never a
placeholder — so there is no way to distinguish "no email on file" from
"not authorized to see it." An actor with `view_email` always receives
the real value. See `toAdminUserSummary`/`toAdminUserDetail` in
`apps/api/src/admin/admin-user.mapper.ts`, and tests 27/28 in
`apps/api/test/admin-platform.e2e-spec.ts`.

## Reversible moderation

Suspending, deactivating, or restoring a user, a company, or a workspace
member **never deletes a row.** Every action writes an append-only
`AuditLog` entry recording actor, action, target, and reason; restore is
always available from `SUSPENDED`/`DEACTIVATED` back to `ACTIVE`. See
`docs/SECURITY.md` "Reversible moderation."

## Company vs. user deactivation (Milestone 2)

These are two **independent** concepts, deliberately never linked:

- **Company deactivation** (`POST /admin/companies/:id/deactivate`,
  gated by `admin.companies.deactivate`) sets `Company.accountStatus =
  DEACTIVATED`. It does **not** touch the registering owner's
  `User.accountStatus`, does **not** revoke that user's sessions, and
  does **not** delete or reassign the company's `Workspace` or any
  `WorkspaceMember` row — the workspace, its roster, and its role
  assignments are preserved exactly as-is so restoration is a pure
  status flip. Ownership (`Company.createdByUserId`) is never
  transferred to the admin or the platform.
- **User deactivation** (`POST /admin/users/:id/deactivate`, gated by
  `admin.users.deactivate`) sets `User.accountStatus = DEACTIVATED` and
  immediately revokes that user's sessions. It has no effect on any
  company the user happens to have registered — a company continues to
  exist and continues to be usable by its other active members even if
  its registering owner's personal account is later deactivated for an
  unrelated reason.
- Deactivating a company therefore never locks out its owner's login,
  and deactivating a user therefore never changes a company's status.
  An admin who wants both must call both endpoints explicitly. See
  `apps/api/test/admin-company-moderation.e2e-spec.ts` for the automated
  proof that a company's owner-user and unrelated users' personal
  workspaces are untouched by company deactivation.
- Restoration for a company works through the same `POST
  /admin/companies/:id/restore` endpoint used for un-suspending — it
  accepts either prior state (`SUSPENDED` or `DEACTIVATED`) and flips
  back to `ACTIVE`.

## Content moderation lifecycle — property publications (Milestone 5)

Implemented, not foundation. `PropertyPublication` is a separate
visibility/review layer over `Property` — a property remains PRIVATE by
default (no `PropertyPublication` row at all is the PRIVATE state, never
a stored enum value) until a professional explicitly prepares and
submits a listing.

```
                 (property.publish, saveDraft)
PRIVATE ───────────────────────────────────────▶ DRAFT
                                                    │ (property.publish, submit)
                                                    ▼
                                            PENDING_REVIEW
                          ┌───────────────────────┼───────────────────────┐
        (admin.content.review,           (admin.content.review,    (admin.content.review,
         request-changes)                     reject)                  approve)
                          ▼                       ▼                       ▼
                CHANGES_REQUESTED             REJECTED               PUBLISHED
                          │                       │                       │
              (edit → new version,     (edit → new version,   ┌───────────┼───────────┐
               resubmit)                resubmit)             │           │           │
                          └──────────────┬────────┘   (property.unpublish) (admin.content.unpublish) (business status
                                         PENDING_REVIEW  OWNER_UNPUBLISHED  ADMIN_UNPUBLISHED   → SOLD/RENTED/ARCHIVED)
                                        (new version)          │                  │                     │
                                                      (property.publish, │  (admin.content.restore) OWNER_UNPUBLISHED
                                                       republish)        │        │                or ARCHIVED
                                                                ▼        ▼        ▼
                                                            PUBLISHED  ARCHIVED (terminal)
```

Every transition is server-side, resolved from the database, never a
hard delete — see `apps/api/src/publications/publications.service.ts`
(professional-initiated transitions: draft/submit/cancel/unpublish/
republish) and `admin-publications.service.ts` (admin-initiated:
approve/reject/request-changes/unpublish/restore). Reused permissions:
`property.publish`/`property.unpublish` (Milestone 3 foundation, now
enforced) plus a new `admin.content.review` (approve/reject/
request-changes — architecturally distinct from `admin.content.unpublish`,
which only governs taking an already-published listing down).

Preserved through every transition, exactly as the
`AdminUsersService`/`AdminCompaniesService` pattern already does for
users/companies:

- the listing's ownership (`Property.workspaceId` — never transferred to
  the admin or platform; approving a publication does not make the admin
  an owner — see `publication-admin-approval.e2e-spec.ts` test 45),
- its full review history (append-only `PropertyPublicationVersion` rows
  — one per submission, never overwritten; see "Publication versioning"
  below),
- the moderation/review reason for each reject/request-changes/
  admin-unpublish action,
- timestamps for each transition,
- every business relationship the property participates in (CRM
  shortlist, presentations, etc. — nothing cascades or gets orphaned by
  a moderation action).

### Publication versioning

`PropertyPublication` holds two independent pointers into its own
`PropertyPublicationVersion` history: `latestVersionId` (the version
currently being drafted/reviewed/most-recently-decided) and
`publishedVersionId` (the version currently live to the public). These
are deliberately different pointers — per the spec's "major public edits
after approval" rule, a professional editing an already-published
listing creates a **new** version in `PENDING_REVIEW` while the
previously-approved version stays the one the public marketplace serves,
until the new version is itself approved (which atomically swaps
`publishedVersionId`). A version is immutable from the moment it leaves
`DRAFT` status — editing while `PENDING_REVIEW` is rejected with `409`;
the professional must cancel back to `DRAFT` (same version, no new
version number, since nothing was reviewed yet) or wait.

Marketplace visibility is therefore **not** simply
`PropertyPublication.status === 'PUBLISHED'` — it's "has a
`publishedVersionId`, and nothing has explicitly taken it down"
(`status NOT IN (ADMIN_UNPUBLISHED, OWNER_UNPUBLISHED, ARCHIVED)`), so a
listing stays visible even while a newer edit is pending/changes-requested/
rejected. See `MarketplaceService.PUBLICATION_VISIBILITY_WHERE` — this
was a real bug found and fixed by `publication-security.e2e-spec.ts` test
11 during development, not a hypothetical.

### Business-status safety (Milestone 5)

If the underlying property's business status becomes `SOLD`, `RENTED`,
or the property is archived while its listing is `PUBLISHED`, two
independent defense layers apply (both required, not either/or):

1. **Layer A — automatic transition.** `PropertiesService` (inside the
   same status-change/archive call) transitions the publication to
   `OWNER_UNPUBLISHED` (business status change) or `ARCHIVED` (property
   archived), audited with `autoTransition: true` metadata so it's
   distinguishable from a manual action.
2. **Layer B — marketplace query filter.** Independently,
   `MarketplaceService`'s query also requires
   `property.propertyStatus IN (AVAILABLE, RESERVED)` on every read, so
   even if layer A were somehow bypassed, a sold/rented/archived property
   can never be returned to a marketplace browser.

**Documented product decision**: `RESERVED` properties remain publicly
visible (a "reserved but not yet sold" listing is still meaningful
marketplace content on most real platforms); only `SOLD`/`RENTED`/
`ARCHIVED` trigger the safety transition.

### Owner republish (deliberate, minimal addition beyond the spec's literal endpoint list)

`POST .../publication/republish` reverses an `OWNER_UNPUBLISHED` listing
back to `PUBLISHED` **without a new admin review**, since the content is
byte-for-byte the same previously-approved snapshot — only re-checked
against current business-status eligibility (same rule as admin
`restore()`). This exists because the spec provides no way to undo a
professional's own unpublish action, and "reversible wherever possible"
is a stated design principle throughout; it's the direct professional-side
analogue of admin `restore()`.

## Marketplace authorization (Milestone 5)

- **Marketplace authorization is not workspace authorization.** Browsing
  published listings (`MarketplaceController`/`FavoritesController`)
  requires only `JwtAuthGuard` — any authenticated platform user
  (CLIENT, AGENT, or COMPANY account), independent of workspace
  membership. It is deliberately never gated by
  `@RequireWorkspacePermission`. The existing product requires
  authentication everywhere else, so this stays consistent rather than
  introducing anonymous access.
- **Marketplace source of truth.** Every marketplace query reads
  `PropertyPublication`/`PropertyPublicationVersion`/
  `PropertyPublicationMedia` — never the raw `Property`/
  `PropertyLocation`/`PropertyMedia` tables. This is what makes the
  privacy guarantee structural rather than a mapping discipline: the
  marketplace mapper (`marketplace.mapper.ts`) has no code path that can
  reach `PropertyOwner`/`PropertyPrivateDetails` at all.
- **Marketplace identifier.** The public/client-facing identifier is
  always the `PropertyPublication` id (`publicationId`), never the
  private `propertyId` — a client can never use a marketplace URL to
  probe for or guess a professional's internal property id.
- **Admin moderation boundary.** `AdminPublicationsService` reads only
  the publication/version/media tables plus the submitter's display name
  and workspace name — never `PropertyOwner`/`PropertyPrivateDetails`.
  A platform moderator can approve, reject, or request changes on a
  listing without ever seeing owner contacts, commission notes, or
  internal reference numbers — preserving the Milestone 2
  admin/private-data boundary. `SUPER_ADMIN`'s broad platform access
  does not create an exception: the publication snapshot is the only
  data surface moderation needs, so there is nothing extra to expose.
- **Public location rules.** Reuses `PropertyLocationVisibility`
  (Milestone 3 foundation, now enforced): `PRIVATE`/`WORKSPACE` never
  populate any public location field at all (not even city/area);
  `PUBLIC_APPROXIMATE` exposes city/area only; only `PUBLIC_EXACT`
  populates `publicLatitude`/`publicLongitude`, and only when the
  property actually has a saved location — coordinates are never
  fabricated or silently copied from the private pin.
- **Public media rules.** Only `PropertyMediaType.IMAGE` rows explicitly
  selected via `PropertyPublicationMedia` are ever servable publicly.
  Selecting/deselecting a public image never deletes the underlying
  private `PropertyMedia` row — publication selection is a pure overlay.
  Public images are served through the same short-lived signed-URL
  mechanism as private media (`StorageService.getSignedAccessUrl`) —
  access control lives entirely in which media the marketplace query is
  even allowed to select, not in the URL-serving endpoint itself.
- **Marketplace favorite vs. CRM shortlist.** `MarketplaceFavorite`
  favorites a `PropertyPublication` (marketplace content, any
  authenticated user); `ClientPropertyShortlist` (Milestone 4) shortlists
  a `Property` for a specific CRM client (professional-only). These are
  deliberately separate models serving different audiences — never
  conflate them. A favorite whose listing later becomes unavailable
  returns `listing: null` in `GET /marketplace/favorites` rather than
  exposing stale or private data.

## Moderation reason: two-tier design (Milestone 2, intentional)

Reason is handled differently at the two moderation levels, on purpose:

- **Platform-admin moderation** (`ModerationActionDto` — user
  suspend/deactivate, company deactivate) **requires** a reason
  (`@IsString`, `@MinLength(3)`) — a platform admin acting on any
  account is a higher-stakes, formally-auditable action, and the reason
  is what makes it reviewable after the fact.
- **Workspace-level member moderation** (`ModerationReasonDto` —
  suspending/removing a member from one's own workspace)
  **leaves reason optional** — an owner suspending their own employee is
  a routine, lower-stakes team-management action, and the workspace's
  own audit trail (who did it, to whom, when) is already captured
  regardless of whether a reason string was supplied. Company restore
  (`RestoreActionDto`) is optional at both levels, matching user restore.

This distinction is deliberate, not an oversight — do not make
workspace-level reasons required unless a specific product requirement
calls for it.

## Owner & Super Admin lockout protection

Two structurally-enforced invariants, both implemented the same way —
lock every relevant row with `SELECT ... FOR UPDATE` inside a
transaction *before* counting survivors, so two concurrent requests can't
both observe "one other remains" and both succeed, leaving zero:

- **A workspace can never end up with zero active `OWNER` members.**
  `MembershipService.assertWontLeaveWorkspaceWithoutAnOwner` blocks
  suspending or removing the last active owner (`409 Conflict`); the
  reassignment path is deliberately not implemented yet ("use an
  ownership-transfer process instead").
- **The platform can never end up with zero active `SUPER_ADMIN`
  users.** `assertWontRemoveLastActiveSuperAdmin`
  (`apps/api/src/admin/super-admin-guard.util.ts`) is shared by
  suspend/deactivate (`AdminUsersService`) and platform-role revocation
  (`PlatformRolesService`) — the latter only applies the check when the
  role being revoked is `SUPER_ADMIN` itself, so revoking some other
  platform role from a user who separately also holds `SUPER_ADMIN` is
  unaffected.

Both invariants have dedicated concurrency tests
(`apps/api/test/workspace-membership.e2e-spec.ts`,
`apps/api/test/admin-platform.e2e-spec.ts`) that fire two conflicting
requests with `Promise.allSettled` and assert exactly one succeeds.

## Super Admin bootstrap

There is no HTTP endpoint that grants the first `SUPER_ADMIN` — that
would be a privilege-escalation surface with no legitimate caller. A
standalone script, `apps/api/scripts/bootstrap-super-admin.ts` (run via
`npm run admin:bootstrap` inside `apps/api`), reads
`SUPER_ADMIN_BOOTSTRAP_EMAIL`, requires the user to already exist
(registered through the normal flow), and idempotently grants the role,
writing an audit log entry with `actorUserId: null` (system action).

## Status (Milestone 5)

Implemented through Milestone 2: workspace isolation and switching,
membership lifecycle (invite → accept → suspend/remove/role-change),
the full permission catalog and system role seed above, the
workspace/platform scope separation and its structural enforcement,
custom per-workspace roles, the admin user directory and moderation
endpoints, company moderation (suspend/deactivate/restore), platform
role grant/revoke, both lockout protections, and pagination on `GET
/workspaces/:id/members`.

Milestone 3 adds: the full `Property` CRUD/search/archive lifecycle,
ownership-vs-authorship (`workspaceId`/`createdByUserId`), business
status transitions, the Google Maps location model, sensitive-field
permission enforcement (`property.view_owner`/`view_private_notes`/
`view_commission`/`view_exact_location`, each independently gated and
each omitted rather than masked when unauthorized), the flexible
feature/amenity catalog, private-media storage via a signed-URL
provider abstraction, and the first mobile screens (sign-in, bottom-tab
shell, Properties list/add/detail).

Milestone 4 adds: the full client CRM (`client.view`/`create`/`edit`/
`assign`/`archive`, now actually enforced), assignment with same-
workspace/ACTIVE-membership re-verification, per-client requirements
with an explicit hard/soft criteria split, the on-demand matching
engine (workspace-scoped candidate query, deterministic scoring,
non-generative explanations), the property shortlist relationship
(database-enforced no-duplicates), PDF client presentations
(`property.create_presentation`, every selected entity re-verified
against the caller's workspace, presentation-safe DTOs that
structurally cannot carry sensitive property data), and the mobile
Clients tab (client list/detail/add, requirement form, match results,
shortlist, presentation create/view/share).

Milestone 5 adds: the publication workflow (`property.publish`/
`property.unpublish`, now actually enforced, plus a new
`admin.content.review` for approve/reject/request-changes),
`PropertyPublication`/`PropertyPublicationVersion`/
`PropertyPublicationMedia` (private-by-default, versioned, immutable
snapshots reviewed by admin/professional/public from the exact same
data), business-status safety (two independent defense layers), the
client marketplace (`GET /marketplace/properties`, search/filter/sort,
publication-id-only, never the private `propertyId`), `MarketplaceFavorite`
(distinct from the CRM shortlist), a functional admin-web moderation UI
(login, review queue, review detail with approve/reject/request-changes/
unpublish/restore), and the mobile Home tab becoming the real client
marketplace (browse/search/detail/favorites) alongside a "Prepare
Listing" flow on the professional property detail screen.

Not yet built: messaging, viewings, collaboration, commission
agreements, subscriptions, payments — those remain future milestones,
and this document continues to define `collaboration.*`'s target
permission model above (the keys exist in the catalog today but are not
yet checked by any endpoint).
