# Security

This document records the security principles the platform is built
against. Most of the controls below are implemented starting Milestone 1
(auth) and Milestone 2 (authorization); this file exists from Milestone 0
so every later milestone is held to the same standard from day one.

## Authentication (Milestone 1)

- Passwords hashed with a strong, slow hash (argon2id or bcrypt with a
  modern cost factor) — never reversible encryption.
- Email verification and phone OTP verification required before full
  account activation.
- Short-lived access tokens (JWT), rotating refresh tokens.
- Only refresh token **hashes** are stored server-side, never the raw
  token.
- Session/refresh-token revocation supported (logout, "log out other
  sessions", admin-forced revocation).
- Secure, single-use, expiring password reset tokens (hashed at rest).
- Rate limiting and login throttling on auth endpoints (Redis-backed).
- Generic error messages on login/reset flows (never reveal whether an
  email is registered).
- Admin accounts require two-factor authentication.
- Mobile stores tokens in secure OS-backed storage (Keychain / Keystore),
  never plain `AsyncStorage`.

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

- Immutable-style audit records for sensitive actions (see the list in
  the product spec / root README section 19).
- Never logged: passwords, access tokens, refresh tokens, OTP codes,
  reset tokens, full payment credentials.

## Secrets

- No secrets are ever committed. `.env` is gitignored; `.env.example`
  documents the required variable names only.
- All environment variables are validated at process startup (see
  `packages/config`); the process fails fast on missing/invalid config
  rather than running with undefined behavior.

## Reporting

If you find a security issue in this repository, do not open a public
issue with exploit details — contact the maintainers directly.
