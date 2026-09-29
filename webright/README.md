# WEBRIGHT — website

The official website for **WEBRIGHT**, a specialist-led digital agency.
_Your digital presence. Done right._

Plain **HTML5 + CSS3 + vanilla JavaScript**. No framework, no build step, no runtime
dependencies. Every page in this folder is complete and can be deployed as-is.

> This folder is self-contained. It lives inside the `RealEstate-App` repository only
> because that is where it was developed; it has no connection to the other apps and can
> be moved into its own repository unchanged. Deploy **this folder** as the web root.

---

## Contents

1. [Run locally](#run-locally)
2. [Project structure](#project-structure)
3. [How shared markup works (`tools/sync.mjs`)](#how-shared-markup-works)
4. [Design system](#design-system)
5. [JavaScript](#javascript)
6. [Common edits](#common-edits) — contact details, domain, email, logo, services, team, projects
7. [Start a Project form](#start-a-project-form) — **backend still to connect**
8. [Analytics](#analytics) — **still to connect**
9. [SEO](#seo)
10. [Security](#security)
11. [Deployment](#deployment)
12. [Placeholder & outstanding content](#placeholder--outstanding-content) ← read before launch
13. [Notes on the original specification](#notes-on-the-original-specification)

---

## Run locally

JavaScript is loaded as ES modules, which browsers block on `file://` URLs, so use any
static server from this folder:

```bash
cd webright
npx http-server -c-1 .        # or: python3 -m http.server 8080
# → http://localhost:8080
```

Opening the files directly still shows all content (JS-only enhancements are skipped).

---

## Project structure

```
webright/
├── index.html                 Home
├── services.html              Services overview
├── about.html                 About (story, WEB+RIGHT / WE+BRIGHT, team)
├── contact.html               Contact
├── start-project.html         Multi-step project brief
├── privacy.html, terms.html   DRAFT legal pages (footer only, noindex)
├── 404.html                   Not-found page (root-absolute links)
├── services/                  5 service pages (identical structure)
├── projects/                  3 case-study pages (identical structure)
│
├── partials/                  Shared markup, stamped into pages by tools/sync.mjs
│   ├── head.html              canonical, OG/Twitter, icons, CSS, JS
│   ├── header.html            skip link, logo sprite, nav, Services dropdown, mobile menu
│   ├── footer.html
│   ├── cta.html               "What are you trying to build?" band
│   ├── contact-channels.html  WhatsApp / Instagram / (email) list
│   └── form-noscript.html     notice shown when JS is off and no form endpoint exists
├── tools/sync.mjs             Partial + config sync (Node 18+, zero dependencies)
├── site.config.json           ★ Business details: domain, WhatsApp, Instagram, email, form endpoint
│
├── css/
│   ├── variables.css          Design tokens (+ @font-face)
│   ├── reset.css
│   ├── base.css               Typography primitives, focus, a11y helpers
│   ├── layout.css             Containers, sections, section themes, grids
│   ├── components.css         Buttons, nav, footer, CTA, motion, brand components, forms…
│   ├── pages.css              Page-specific compositions
│   └── responsive.css         Nav breakpoint switch, no-JS fallbacks, print
├── js/
│   ├── main.js                Entry: core features + lazy page features
│   ├── config.js              GENERATED from site.config.json
│   ├── utils.js               Reduced-motion check, rAF throttle, safe DOM builder
│   ├── navigation.js          Sticky header, Services dropdown, mobile menu dialog
│   ├── animations.js          Reveal / alignment system
│   ├── wordplay.js            WEB|RIGHT ⇄ WE|BRIGHT
│   ├── showcase.js            Home services hover/focus stage
│   ├── project-form.js        Multi-step brief
│   └── analytics.js           Provider-agnostic tracking hooks
├── assets/
│   ├── logos/                 WB monogram + WEBRIGHT wordmark/lockup (SVG, light & dark)
│   ├── icons/                 favicon PNG, apple-touch, PWA icons
│   ├── fonts/                 Self-hosted Inter (variable) + Playfair Display italic (variable)
│   └── images/
│       ├── services/          Discipline illustrations (SVG)
│       ├── projects/          Project covers / placeholders
│       └── og/                Social sharing image (1200×630)
├── favicon.svg, site.webmanifest
├── robots.txt, sitemap.xml    GENERATED
└── _headers                   Security/caching headers (Netlify / Cloudflare Pages)
```

---

## How shared markup works

The header, footer, `<head>` boilerplate, CTA band and contact list live once in
`partials/`. Each page contains marker comments:

```html
<!-- partial:footer -->
…generated markup…
<!-- /partial:footer -->
```

After editing a partial **or** `site.config.json`, run:

```bash
node tools/sync.mjs
```

It is idempotent and:

- stamps every partial into every page, resolving relative paths (`../` for sub-folders)
  and marking the current nav item with `aria-current="page"`;
- rewrites the domain everywhere (canonical, Open Graph, JSON-LD) when `siteUrl` changes;
- writes `formEndpoint` into the Start a Project form's `action`;
- regenerates `sitemap.xml` (skipping `noindex` pages), `robots.txt` and `js/config.js`.

Always commit the synced HTML — the deployed site does not run the tool.
Partial syntax is documented at the top of `tools/sync.mjs`.

---

## Design system

All values are tokens in `css/variables.css`; don't hard-code colours or spacing.

| Token group | Notes |
| --- | --- |
| Palette | Midnight `#0B1220`, Electric Blue `#2563EB`, Bright Cyan `#22D3EE`, Off White `#F8FAFC`, White, Slate `#64748B`, Deep Ink `#111827`, Soft Border `#E2E8F0`, plus a few derived tints (documented inline). |
| Gradient | `--gradient-brand` (Blue → Cyan) is reserved for the **B**, key lines, active states and highlights. |
| Type | Inter (UI, body, display) · Playfair Display italic via `.serif` — max one phrase per heading. Fluid sizes `--fs-*` use `clamp()`. |
| Spacing | `--space-1…10` (4px base), `--section-pad`, `--gutter`, `--grid-gap`. |
| Shape | Radii 2–8px only. Shadows used sparingly. |
| Motion | `--dur-*`, `--ease-*`, `--align-distance` (shorter on mobile, 0 with reduced motion). |
| Layers | `--z-*`. |

**Section themes.** Add `theme-dark`, `theme-light`, `theme-white` or `theme-blue` to a
section. Themes only remap semantic tokens (`--surface`, `--text`, `--text-muted`,
`--line`, `--accent-text`…), so every component works on every background.

**Brand motifs.**
- `.b-mark` — gradient B (use inside WEBRIGHT wherever the name is set in type).
- `.label` — `01 / SECTION` markers.
- `.guides`, `.crop-marks`, `.rail` — alignment grid, registration marks, discipline rail.
- `.wordplay` — WEB | RIGHT ⇄ WE | BRIGHT.
- `.org` — specialist diagram (horizontal tree on desktop, vertical on mobile).

**Breakpoints** (kept few): 30rem, 48rem, 62rem (navigation switch), 64rem (desktop layouts).

---

## JavaScript

- `main.js` runs on every page; page features (`wordplay`, `showcase`, `project-form`) are
  **dynamically imported only if their markup exists**.
- No globals, no innerHTML with user data (DOM built with `el()` / `textContent`).
- Every enhancement is optional: without JS, content is visible, the nav wraps,
  FAQs use native `<details>`, and the form becomes a single standard POST form.
- An inline one-liner in `<head>` adds `.js` to `<html>` (hash-whitelisted in the CSP). If the
  module fails to load, a CSS fail-safe reveals any hidden content after 2.5s.
- `prefers-reduced-motion` is respected in CSS and JS.

---

## Common edits

### Contact details, domain and email → `site.config.json`

```jsonc
{
  "siteUrl": "https://webright.example",   // ← final domain, no trailing slash
  "siteUrlIsPlaceholder": true,            // ← set false once real
  "email": null,                           // ← "hello@yourdomain" once it exists
  "whatsapp": { "display": "+961 81 767 764", "number": "96181767764" },
  "instagram": { "handle": "@webright.lb", "url": "https://www.instagram.com/webright.lb/" },
  "formEndpoint": null
}
```

Then run `node tools/sync.mjs`. Setting `email` automatically adds Email to the footer and
contact page. The phone number also appears in JSON-LD `contactPoint` blocks in
`index.html` and `contact.html` — update those by hand if it changes.

### Logo / brand assets

`assets/logos/` holds the monogram (`webright-mark-*.svg`), wordmark
(`webright-wordmark-light|dark.svg`) and lockup with tagline. The header/footer use an
inline SVG **symbol** (`#wr-wordmark`) defined in `partials/header.html` so it inherits text
colour. To replace the logo: update the files in `assets/logos/`, replace the `<symbol>`
paths in `partials/header.html`, update `favicon.svg`, regenerate the PNGs in
`assets/icons/`, then run the sync.

> These marks were built from the brief's description of the selected identity (WB
> monogram, W white/dark, gradient B, differentiated B in the wordmark) because no logo
> files were present in the repository. **Swap in the official master files** if they differ.

### Services

- Dropdown, mobile menu and footer lists → `partials/header.html`, `partials/footer.html`.
- Overview → `services.html` (one `<article class="discipline">` per service).
- Home list → `index.html` (`#services`).
- Detail pages → `services/*.html`. They share one structure: hero, overview + "Who you'll
  work with", capabilities, (web: types of projects), approach, relevant work, works well
  with, FAQ, CTA. Copy an existing page to add a service, then add it to the sitemap via sync.
- **Photography** is intentionally not listed under Content Creation. Add it only once confirmed.

### Team

Team members appear in `index.html` and `about.html` (`.team`) and in the "Who you'll work
with" card on each service page. Each member is:

```html
<li class="member">
  <span class="member__monogram" aria-hidden="true">JK</span>
  <div><p class="member__name">Joey Kosseifi</p><p class="member__role">Founder &amp; Web Developer</p></div>
</li>
```

- **Photos:** place an optimised square image (e.g. `assets/images/team/joey-kosseifi.webp`,
  ≥ 224px) inside `.member__monogram` — `<img src="…" alt="" width="112" height="112">` —
  it fills the tile automatically.
- **Bios:** not published yet by design. Add a `<p class="member__bio">` once real bios exist.

### Projects / case studies

`projects/*.html` share one structure: hero + facts, cover, overview, **hidden**
Challenge / Approach / Design / Development / Outcome sections, gallery (commented out),
next project, CTA. To publish a section, write the copy and remove its `hidden` attribute.

**Charbel Saliba screenshot (priority):** capture the live site (1600×1000 or larger), export
AVIF + WebP + JPG into `assets/images/projects/charbel-saliba/`, and replace the placeholder
`<img>` in `index.html`, `about.html`, `services/web-design-development.html` and
`projects/charbel-saliba.html` (the `<picture>` snippet to use is in a comment next to it).
Always keep `width`/`height`.

**Concept projects 02/03** are placeholders marked `noindex` and labelled "Concept project"
everywhere. Replace them with real work (rename files, update links on the home, about and
service pages, remove `noindex`), or publish the finished concept keeping the label.

To add a project: copy a page in `projects/`, update the facts, add cards where relevant, and
set `data-project="slug"` on `<body>` for analytics.

---

## Start a Project form

`start-project.html` + `js/project-form.js`.

- **With JS:** seven steps, progress bar, back/next, per-step validation with announced
  errors, review summary, focus management, draft saved to `sessionStorage` (cleared on send).
- **Without JS:** one standard form showing all steps.
- **Spam protection:** honeypot field `website` + minimum fill time (3s). Suspected bots see a
  fake success. Add Cloudflare Turnstile / hCaptcha at the backend if spam appears.

### ⚠ Backend not connected yet

There is no backend. While `formEndpoint` is `null`, a completed brief is **handed off to
WhatsApp** with a prefilled message ("One last step"). Nothing claims to have been sent.

To connect:

1. Create an endpoint that accepts `multipart/form-data` POSTs and returns 2xx
   (Formspree, Basin, Getform, a Netlify/Cloudflare function, or your own server).
2. Set `"formEndpoint": "https://…"` in `site.config.json` and run `node tools/sync.mjs`
   (updates `js/config.js`, the form `action`, and removes the no-JS notice).
3. Add the endpoint's origin to `connect-src` **and** `form-action` in `_headers`.
4. Send a test brief end to end, then update `privacy.html`.

Fields: `services` (repeated), `name`*, `company`, `email`*, `phone`, `country`,
`description`*, `link`, `goals`, `budget`*, `timeline`*, `next_step`*, `source`,
`form_started_at`, `website` (honeypot — must be empty).

**The server must re-validate every field** (required fields, email format, length limits,
honeypot empty, rate limiting). Client-side validation is a usability feature, not security.

---

## Analytics

`js/analytics.js` — no IDs, no cookies, nothing sent until you connect a tool.
Events are pushed to `window.dataLayer` (if present) and dispatched as a `webright:track`
DOM event. Add `data-track="event_name"` to any link/button to track it.

| Event | When |
| --- | --- |
| `start_project_click` | any Start a Project CTA (`location` says which) |
| `service_view` | a service page loads |
| `project_click` / `project_view` | project links / case study loads |
| `whatsapp_click`, `instagram_click`, `email_click` | contact links |
| `project_form_start`, `project_form_step` | form interaction |
| **`project_form_submit`** | **primary conversion** — completed inquiry |
| `project_form_handoff`, `project_form_error` | WhatsApp handoff / failed send |

To connect: load your provider's script in `partials/head.html`, bridge the event (example
in the file header), update the CSP in `_headers`, add consent if required, update the privacy
page, then run the sync.

---

## SEO

- Unique `<title>` / description, one H1, logical headings, canonical, Open Graph and Twitter
  tags on every page (canonical/OG URLs come from `siteUrl`).
- JSON-LD: Organization + WebSite (home), Service + BreadcrumbList + FAQPage (service pages),
  AboutPage, ContactPage, CreativeWork (Charbel Saliba).
- `sitemap.xml` / `robots.txt` generated by the sync. `noindex` on concept projects, legal
  drafts and 404 until they're final.
- Social image: `assets/images/og/webright-og.png` (1200×630).

---

## Security

- No secrets anywhere; `js/config.js` is public by design.
- User input is never written with `innerHTML`; external links use `rel="noopener noreferrer"`.
- `_headers` ships a strict CSP (no inline scripts except the hashed `.js` one-liner, no inline
  styles), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, frame denial and HSTS.
- If you edit the inline `<script>` in `partials/head.html`, recompute its hash:
  `printf "%s" "document.documentElement.classList.add('js')" | openssl dgst -sha256 -binary | base64`

---

## Deployment

Any static host works. Recommended: **Cloudflare Pages** or **Netlify** (both read `_headers`,
serve `404.html`, give HTTPS and a CDN). Publish directory: `webright/`. No build command.

For other hosts, port `_headers`. nginx example:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-Du+OJKJSbdUgz5nrHeWWINvez6XKDDU/tyj/5c2uvwo='; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
error_page 404 /404.html;
```

Before launch: set the domain, run the sync, enable Brotli/gzip, and check the result with
PageSpeed Insights and a WAVE/axe accessibility scan.

---

## Placeholder & outstanding content

| Item | Where | Status |
| --- | --- | --- |
| Final domain | `site.config.json` → `siteUrl` | Placeholder `webright.example` |
| Business email | `site.config.json` → `email` | Not created — hidden everywhere |
| Form backend | `site.config.json` → `formEndpoint` | Not connected — WhatsApp handoff |
| Analytics | `js/analytics.js`, `partials/head.html` | Hooks only |
| Charbel Saliba screenshots | see [Projects](#projects--case-studies) | Neutral placeholder frame |
| Charbel Saliba case study details, year | `projects/charbel-saliba.html` | Sections hidden; only confirmed facts shown |
| Concept Projects 02 & 03 | `projects/concept-project-0*.html` | Labelled placeholders, `noindex` |
| Team bios | home, about, service pages | Omitted until supplied |
| Team photos | `.member__monogram` | Initials tiles |
| Official logo master files | `assets/logos/` | Recreated from the brief — verify |
| Photography capability | Content Creation | Not listed until confirmed |
| Privacy Policy | `privacy.html` | **Draft** — `[TODO]` markers, `noindex` |
| Terms | `terms.html` | **Draft** — `[TODO]` markers, `noindex` |

**Legal pages must be reviewed and finalised** based on the actual business setup, form
handling, analytics, cookies, hosting and applicable law, ideally with a qualified
professional. Remove the draft notice and `noindex` afterwards.

---

## Notes on the original specification

Decisions made where the brief left room, or where it conflicted with technical reality:

- **No logo files were in the project**, so the monogram and wordmark were constructed to match
  the described direction. Replace them with the official masters.
- **No duplicated markup vs. no build step:** plain HTML would mean editing the nav in 16 files.
  The small optional sync script resolves this without making a build step mandatory.
- **"Graceful behaviour without JS" vs. no backend:** a no-JS form can't send anywhere yet, so it
  shows an honest notice with direct contact options until an endpoint is configured.
- **"We've got it." success state** is only shown after a real successful submission. Until then
  the finished brief goes to WhatsApp instead, so nothing claims to have been sent.
- **Hero animation vs. performance:** above-the-fold text uses a CSS-only, transform-only entrance
  so it paints immediately (LCP ≈ first paint); scroll reveals are JS-driven below the fold.
- **"Work" is not in the navigation** (as specified), so project pages are reached from the home,
  about and service pages.
- **CTA band copy is shared across pages** for consistency; it can be varied per page by giving a
  page its own section instead of the partial.
- **Monogram tiles for two people share initials (TK).** Once photos exist this disappears.
