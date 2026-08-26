# Security

This document records the security principles the platform is built
against. This file existed from Milestone 0 as a forward statement of
intent; the "Authentication" section below now describes what Milestone 1
actually implemented (with any deliberate deferrals called out).
Authorization (Milestone 2+) remains a forward statement.

## Authentication (Milestone 1 — implemented)

- **Password hashing:** Argon2id (`@node-rs/argon2`), OWASP-baseline
  parameters (m=19MiB, t=2, p=1), not configurable via env so a
  misconfigured deployment can't silently weaken it. Never logged,
  never returned in any API response, never embedded in a JWT.
- **Email verification:** high-entropy random token (256-bit,
  `crypto.randomBytes`), only its SHA-256 hash is stored, expires
  (`EMAIL_VERIFICATION_TTL_MINUTES`), one-time use, resend supported
  (rate-limited, no account-existence signal).
- **Phone OTP verification:** 6-digit `crypto.randomInt` code, only its
  SHA-256 hash is stored, expires (`PHONE_OTP_TTL_MINUTES`), one-time use,
  attempt-limited (`PHONE_OTP_MAX_ATTEMPTS`), resend supported
  (rate-limited, no account-existence signal).
- **Delivery is provider-abstracted** (`MailService`/`SmsService`). The
  only implementation today is a console dev provider that logs the
  content — and *only* when `NODE_ENV !== 'production'`. In production it
  logs a warning that no real provider is configured and does not log or
  send the secret. Wire a real provider (SendGrid/SES, Twilio/SNS, etc.)
  before launch — see `apps/api/src/mail` and `apps/api/src/sms`.
- **Tokens:** short-lived JWT access tokens (`JWT_ACCESS_TTL`, default
  15m; payload is only `{ sub, sid, iat, exp }` — no profile data) plus
  longer-lived opaque refresh tokens (`JWT_REFRESH_TTL`, default 30d).
- **Refresh token rotation & reuse detection (documented decision):** a
  refresh token is `${sessionId}.${secret}`; only `sha256(secret)` is
  stored, on the `UserSession` row keyed by `sessionId`. Every successful
  refresh overwrites that row's stored hash with a new one. If a
  presented token's secret doesn't match the session's *current* hash —
  meaning a stale, already-rotated-past token is being replayed — the
  session is immediately revoked and the caller must log in again. This
  is a single-slot design (no token-family table): simpler than tracking
  a full rotation chain, at the cost of a legitimate concurrent
  double-refresh also being treated as reuse and revoking the session.
  Accepted for Milestone 1; revisit if that tradeoff proves too costly in
  practice.
- **Sessions:** `UserSession` supports multiple concurrent devices per
  user. Logout revokes the current session (identified by the access
  token's `sid` claim — the request body is not trusted for this).
  Revoking a session blocks future refreshes immediately; it does *not*
  retroactively invalidate an already-issued access token, which is why
  access tokens are kept short-lived.
- **Account status enforcement:** `SUSPENDED`/`DEACTIVATED` accounts
  cannot log in and cannot use an existing access token (rechecked on
  every authenticated request, not just at login, so a mid-session
  suspension takes effect immediately rather than waiting out the
  token's TTL). `PENDING_VERIFICATION` accounts *can* authenticate — only
  suspension/deactivation blocks auth; verification gates specific
  product features, not login itself.
- **Password reset:** high-entropy token, hashed at rest, expiring
  (`PASSWORD_RESET_TTL_MINUTES`), one-time use. Successful reset revokes
  every existing session for that user (documented policy — see
  `PasswordResetService`): a reset is most often a response to suspected
  compromise, so sessions established under the old credentials should
  not be trusted to continue.
- **Login/reset enumeration resistance:** login returns the same generic
  "Invalid email or password" for an unknown email, a wrong password, and
  a suspended/deactivated account — including a dummy Argon2id verify
  against a fixed hash on the unknown-email path, so the response time
  doesn't leak which case occurred. `password/forgot`,
  `email/resend`, and `phone/request-otp` always return 204 regardless of
  whether the account exists.
- **Rate limiting:** Redis-backed fixed-window counters (safe across
  multiple API instances — see `RateLimitGuard`), keyed by IP and, where
  relevant, by the submitted email/phone, applied to registration, login,
  refresh, email verify/resend, OTP request/verify, and password
  forgot/reset.
- **DTO validation:** every auth endpoint validates via `class-validator`
  + a global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted:
  true`) — unknown fields are rejected outright, never mass-assigned into
  a Prisma model.
- **Not yet implemented (later milestones):** admin two-factor
  authentication (no admin role exists yet — Milestone 2/11), mobile
  secure token storage (Keychain/Keystore — `apps/mobile` has no auth UI
  yet), "view active sessions" / "logout all devices" endpoints
  (`SessionsService.revokeAllForUser` exists and is used internally by
  password reset, but isn't exposed as its own endpoint yet — deferred
  per the instruction to only build what naturally fits Milestone 1).

## Authorization (Milestone 2+)

- Enforced server-side only. The frontend is never trusted for
  ownership, role, workspace, or permission values.
- Default-deny: absence of a permission means no access.
- Every professional-data request resolves, in order: authenticated user
  → current workspace → active membership in that workspace → role →
  required permission → entity ownership → collaboration grant (if
  applicable).
- Permissions are independent and do not imply each other (e.g.
  `property.view` never implies `property.view_owner`). See
  `docs/PERMISSIONS.md`.

## Data isolation

- Clients can never query an agent's or company's private property
  database. Client-facing endpoints return only approved public fields
  for published properties, or fields explicitly authorized by a secure
  private share.
- Private professional fields (owner contact info, private notes,
  commission, private documents, exact coordinates) are enforced at the
  API/DTO layer — never merely hidden in the frontend.
- Admin publication moderators receive only the fields needed to review a
  listing, not the full private record.

## File storage

- Private S3-compatible object storage. No permanently public URLs for
  private files.
- Access via backend-issued, short-lived signed URLs.
- Separate access rules per category: public property media, private
  property media, owner documents, verification documents, generated
  PDFs.

## Audit logging

- Append-only `AuditLog` table (see `docs/DATABASE.md`), written via
  `AuditService.log()`. Milestone 1 records: `account.registered`,
  `account.activated`, `auth.login_success`, `auth.logout`,
  `auth.password_reset`, `email.verified`, `phone.verified`,
  `workspace.personal_created`, `workspace.company_created`.
- Never logged: passwords, access tokens, refresh tokens, OTP codes,
  reset tokens, full payment credentials. `AuditLog.metadata` is only
  ever given non-secret structured context (e.g. `{ accountType }`,
  `{ companyId }`).

## Secrets

- No secrets are ever committed. `.env` is gitignored; `.env.example`
  documents the required variable names only.
- All environment variables are validated at process startup (see
  `packages/config`); the process fails fast on missing/invalid config
  rather than running with undefined behavior.

## Reporting

If you find a security issue in this repository, do not open a public
issue with exploit details — contact the maintainers directly.
