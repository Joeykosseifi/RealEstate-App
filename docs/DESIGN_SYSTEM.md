# ProBase Design System (Milestone 7)

This document is the single source of truth for ProBase's visual language
and interaction conventions across the mobile app (professional + client)
and the admin-web moderation console. A future contributor should be able
to build a new screen without inventing a new color, spacing value, or
component by reading this file and `apps/mobile/src/theme/` /
`apps/mobile/src/components/ui/` directly.

## Product framing

ProBase is a **private real-estate database and CRM with matching,
presentation, and optional controlled publishing** — not a public property
portal. Every screen should read as **Professional / Secure / Modern /
Premium / Simple / Fast**. It should never feel childish, overly colorful,
flashy, crypto-app-like, luxury-gold-themed, generic-admin-template-like,
Instagram-like, or like a bare property-listing site.

## Color system (locked)

Defined in `apps/mobile/src/theme/colors.ts` (mobile) and
`apps/admin-web/src/app/globals.css` (admin-web, as CSS variables + a
Tailwind v4 `@theme inline` block). Do not add new brand hues.

| Token | Value | Usage |
|---|---|---|
| Deep Navy | `#0F1F33` | Darkest brand anchor (rarely a background by itself) |
| Primary Action Navy | `#163A5F` | Primary buttons, active nav, links, headers |
| Warm Gold Accent | `#C9942F` | **Accent only** — the single highest-value CTA per screen (e.g. the tab-bar "+", an active filter chip). Never a full screen background, never body text, never every button, no gold gradients |
| App Background | `#F6F7F9` | Screen background |
| Surface | `#FFFFFF` | Cards, inputs, sheets |
| Main Text | `#17212B` | Primary text |
| Secondary Text | `#667085` | Captions, helper text, placeholders |

Navy is the dominant color; gold is a deliberate scarcity — see
`Button.tsx`'s own doc comment ("gold is reserved for the single
highest-value CTA on a screen").

### Semantic status colors

Status colors represent **state, not brand**, and are always a
foreground/background pair (`{ fg, bg }`) for a pill-style badge — see
`colors.status.*` in `colors.ts`:

| Status | Color family |
|---|---|
| AVAILABLE | green |
| PENDING / PENDING REVIEW | orange |
| SOLD | red |
| RENTED | blue |
| RESERVED | blue-ish |
| PRIVATE | navy/neutral |
| PUBLISHED | blue/green |
| ARCHIVED | gray |
| REJECTED | red |
| CHANGES REQUESTED | orange |

**Critical rule — never merge business status with publication status.**
A property's business lifecycle (AVAILABLE / RESERVED / SOLD / RENTED) and
its publication lifecycle (PRIVATE / PENDING REVIEW / PUBLISHED / ADMIN
UNPUBLISHED) are always rendered as **two separate badges** — see
`StatusBadge.tsx`'s `BusinessStatusBadge` and `PublicationStatusBadge`.
Example: `🔒 PRIVATE` next to `AVAILABLE`, never a single merged badge.
`PropertyDetailScreen` and `PropertiesListScreen`/`PropertyCard` both
follow this pattern unconditionally.

Admin-web mirrors the same semantics via CSS variables
(`--color-status-{available,pending,sold,rented,archived}-{fg,bg}`) in
`publications/page.tsx`'s `STATUS_STYLE` record and
`publications/[id]/page.tsx`'s action button colors (approve = green,
request-changes = orange, reject/unpublish = red, restore = navy).

## Typography

`apps/mobile/src/theme/typography.ts`. Uses the OS default system font
(no added font dependency — deliberate, since the app already has a clean
native look and a new webfont would only add bundle size and a FOUT risk
for no visual gain the spec asked for). Tokens: `display`, `h1`, `h2`,
`h3`, `body`, `bodySmall`, `label`, `caption`, plus a dedicated
`priceText` token used everywhere a price is the visual anchor of a card
or header (prominent but never oversized).

## Spacing & radii

`apps/mobile/src/theme/spacing.ts`.

- Spacing scale (4/8-based): `xs=4, sm=8, smd=12, md=16, lg=20, xl=24,
  xxl=32, xxxl=40`. Screen horizontal padding is `screenPadding=20`
  (`theme/index.ts`).
- Radii: `control=8` (small controls), `input=10`, `button=12`,
  `card=14`, `cardLarge=16`, `image=16`, `pill=999` (fully rounded, for
  chips/badges). Deliberately restrained — not everything is maximally
  rounded.
- Shadows (`shadows.ts`): `none`, `sm`, `md` — soft-only, no heavy
  floating shadows. Cards use a soft border plus at most `shadows.sm`.

## Icons

One consistent library: `@expo/vector-icons` (`Ionicons` outline set) on
mobile. Icons support comprehension (nav tabs, action buttons, status
badges' lock icon) — they are never purely decorative.

## Reusable component library

`apps/mobile/src/components/ui/` (barrel-exported from `index.ts`):

| Component | Purpose |
|---|---|
| `AppScreen` | Standard screen chrome — background color, horizontal padding, optional pull-to-refresh `ScrollView`, and **built-in `KeyboardAvoidingView`** (iOS `padding` behavior) so every screen built on it gets keyboard-safe forms for free without wrapping itself individually |
| `AppHeader` | Screen title header |
| `SectionHeader` | Section title + optional "View all" action |
| `Card` | Single surface container (`onPress` optional) |
| `Button` / `IconButton` | The one button component — variants `primary` / `secondary` / `destructive` / `gold` (gold reserved per screen); `IconButton` always requires an `accessibilityLabel` since it has no visible text fallback |
| `TextField` | Persistent label (never placeholder-only), built-in show/hide for secure fields, inline error + optional-field support |
| `SearchInput` | Clearable search box |
| `StatusBadge` / `BusinessStatusBadge` / `PublicationStatusBadge` | Status pills — business and publication status always rendered as two separate badges (see above) |
| `PropertyCard` | Compact professional-list property card |
| `EmptyState` / `ErrorState` / `LoadingState` + `SkeletonCard` / `SkeletonList` | The only loading/empty/error patterns used app-wide — see "States" below |
| `FilterChip` | Toggleable filter pill (primary filters, tab-style switchers) |
| `ActionSheet` | The one bottom-sheet pattern (used by the "+" quick-create menu and Properties' "Filters" sheet) |
| `confirmDestructive` | Wraps native `Alert` for destructive-action confirmations |

Screens should reach for these primitives first; a new one-off style is a
sign something belongs in this list instead.

## Loading / empty / error states

- **Loading**: skeleton property cards (`SkeletonCard`/`SkeletonList`) or
  a centered `LoadingState` spinner for non-list screens; button-level
  loading (`Button`'s `loading` prop swaps the label for a spinner and
  disables the control) for in-flight submits. Never a blank screen or a
  stray unstyled spinner.
- **Empty**: `EmptyState` explains what happened and offers a next action
  where one exists (e.g. Properties: "No properties yet" + "Add your
  first property"; Clients: "No clients yet" + "Add your first client";
  Favorites: "No favorites yet" + browsing hint). Never a decorative
  full-screen illustration.
- **Error**: `ErrorState` explains simply and offers **Retry** — it never
  surfaces a raw backend/internal error string, and a network failure is
  visually distinct from "the list is genuinely empty."

## Mobile navigation

- **Professional**: bottom tabs `Home | Properties | + | Clients | More`.
  The center "+" (`QuickCreateButton.tsx`) is gold, intercepts the tab
  press (`e.preventDefault()`), and opens an `ActionSheet` exposing only
  existing actions — Add Property, New Client, New Requirement. It never
  invents functionality beyond what those screens already do.
- **Client**: bottom tabs `Home | Search | Favorites | Account` — more
  visual/property-focused, no in-app messaging, and the professional
  CRM navigation is never shown to a client account.
- **Company** accounts get the exact same professional app and
  navigation as an independent agent; only the workspace and its
  permissions differ (see `docs/PERMISSIONS.md`). The workspace switcher
  always shows the real workspace name (e.g. "ABC Real Estate ▼"), never
  a generic "Personal Workspace ▼" placeholder — `DashboardScreen`'s
  workspace pill and `AccountScreen`'s workspace rows both render
  `currentWorkspace.name` verbatim.

## Add Property — 5-step workflow

`AddPropertyScreen.tsx` is a five-step wizard (not the property model's
full field set exposed flat):

1. **Basic Information** — type, sale/rent, title, price, currency,
   bedrooms, bathrooms, area, floor, optional description.
2. **Location** — the existing Google Maps flow (search, map, pin,
   area/city, address, current-location button). This step never asks
   about marketplace/public visibility — that belongs entirely to the
   separate publication flow (see below).
3. **Details & Features** — furnishing/parking/condition, features
   catalog (`apps/mobile/src/properties/featureKeys.ts`, mirroring the
   backend's `PROPERTY_FEATURE_KEYS`), additional details; uncommon
   fields sit behind "More details."
4. **Photos & Private Information** — multi-select photo picking (queued
   locally as `PendingPhoto[]`, not yet uploaded — the media API needs a
   `propertyId` that doesn't exist until Step 5's Save), reorder,
   remove, main/cover selection; then a clearly separated 🔒 **Private
   Information** section (owner name/contact, internal notes,
   commission) with an explicit "Only authorized workspace members can
   access this information" notice.
5. **Review & Save** — a read-only summary of every section, each with
   an "Edit" link back to its step, plus a "🔒 This property will be
   saved privately to your workspace" notice. Saving calls
   `createProperty(...)` once, then uploads the queued photos
   sequentially via `uploadPropertyMedia` (first upload becomes the
   primary photo, per existing backend behavior). A single photo upload
   failure does not lose the property — it can be retried from Property
   Detail's Photos tab.

**Saving is never publishing.** Every new property is private by default
(`publicationStatus: null`); publication is a fully separate, later
workflow initiated from an existing property (see below).

## Publication UX

"Prepare for Publication" (`PublishPropertyScreen.tsx`) is reached from
an existing private property, not from Add Property. It collects
public-safe fields only (public title/description, selected public
photos, public location visibility, price) into a `SavePublicationDraftDto`
that is structurally separate from the private `owners`/`privateDetails`
sections — the smoke test in this milestone explicitly verified that no
private field (owner name, notes, commission) leaks into a saved draft or
an admin's review snapshot. The screen shows a live preview card and the
full lifecycle (Private → Pending Review → Published, plus
Changes-Requested/Rejected/Unpublished) via `PropertyDetailScreen`'s
publication-status Card.

## CRM / matching / presentation UX

`ClientsListScreen` → `ClientDetailScreen` → `AddRequirementScreen` →
`MatchResultsScreen` → `ShortlistScreen` → `CreatePresentationScreen` /
`PresentationDetailScreen` form one visually consistent chain using the
same primitives as Properties. Match results show the property, a
numeric score, and an explicit matched-vs-missing-preferred-criteria
breakdown (`MatchExplanation`) — the deterministic matching engine itself
was not touched for this redesign, only its presentation.

## Admin-web conventions

Admin-web stays desktop/web-oriented (it is a moderation console, not a
mobile dashboard). `apps/admin-web/src/app/globals.css` defines the same
locked palette as CSS variables plus Tailwind v4 `@theme inline` tokens
(`bg-navy`, `text-deep-navy`, `bg-gold`, `border-border`, etc.). The
dark-mode media-query override was deliberately removed in favor of one
consistent branded light theme — the palette is a brand identity, not a
light/dark-adaptive system, and no dark-mode requirement was specified.
Tables/panels are the right pattern for a review queue and are used as-is
(no attempt to reskin this as card-based mobile UI). All existing
authorization boundaries (which admin actions require which platform
role) are unchanged — this milestone only restyled the pages.

## Motion

Subtle only: `Button`'s `activeOpacity={0.8}` press feedback, tab
transitions and `ActionSheet`'s slide-up animation use React Navigation's
and React Native's own default transitions — no added animation library,
no decorative motion.

## Known limitations (honest disclosure)

- **No per-item professional-list thumbnails.** `PropertiesListScreen`
  intentionally renders `PropertyCard` with `imageUrl={null}` (a
  placeholder) for every row, because fetching a signed media URL per
  list item would be an N+1 client-side request pattern on a paginated
  list. Full photos remain visible on Property Detail and on the client
  marketplace's `ListingCard` (which gets `mainImage.url` for free from
  the public marketplace API's existing shape).
- **No literal visual/screenshot rendering was performed in this
  environment.** Screen review for this milestone was conducted via
  source-level inspection, TypeScript compilation, and the full
  automated test suites (unit, e2e, and the committed admin-web
  Playwright regression suite, which does render real pages in a real
  headless browser and assert on their content) — not interactive manual
  visual QA on physical devices or a range of viewport sizes. See
  `docs/PRODUCT.md` "Real-device testing checklist" for what remains
  device-only.
