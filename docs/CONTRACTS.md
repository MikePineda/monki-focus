# Contracts

The platforms share data contracts, not code. Each contract has one source of
truth in the repo and a conformance suite that every consumer runs. A change to
a contract is a change to its fixtures first.

| Contract                        | Source of truth (planned)                                                                   | Work package | Status  |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------ | ------- |
| Rule set schema v1              | `packages/rules/schema/v1/*.schema.json`                                                    | 0.2          | planned |
| Surfaces and site profiles      | `packages/rules/data/surfaces.json`, `data/sites/*.json`                                    | 0.2          | planned |
| Decision fixtures               | `packages/rules/fixtures/` (`given/when/then`, one `id` per spec)                           | 0.2          | planned |
| Analytics fixtures              | `packages/rules/fixtures/analytics/*.json`                                                  | 0.2, E3      | planned |
| Unlock token (PASETO v4.public) | `packages/protocol` schemas and `fixtures/unlock-tokens/`, `docs/protocol/unlock-tokens.md` | 0.3          | planned |
| Signed policy token             | `packages/protocol` (separate `typ` and key)                                                | 0.3, S3      | planned |
| Device API                      | `packages/protocol/openapi.yaml` (`/api/v1`, `X-Client-Version`)                            | 0.3          | planned |
| Native messaging bridge         | `macos` bridge contract (length-prefixed JSON, five methods)                                | M5           | planned |
| Dashboard API: accounts         | `server/api/start/routes.ts`, this file ([Dashboard API](#dashboard-api-server))            | S2           | active  |
| Rules feed signature            | detached Ed25519 signature, offline `rules-signing` key                                     | 0.2          | planned |

## Rules

To be written by work package 0.2: the `Ruleset`, `Rule`, `Target`,
`Schedule`, `Bedtime` and `CategoryAssignment` shapes; the two decision axes
(`access`, `content`); specificity order; overlays; fixture envelope format.

## Decision fixtures

To be written by work package 0.2: the fixture envelope, the `kind`s
(`decision`, `specificity`, `url-normalize`, `schedule`, `escalation`,
`rule-change`, `activity`, `unlock-token`) and how each platform loads them.

## Unlock token

To be written by work package 0.3: PASETO v4.public claims, footer, implicit
assertion, clock and replay rules, key pinning and rotation. See
[ADR 0002](adr/0002-paseto-v4-unlock-tokens.md) and
[threat-model.md](threat-model.md).

## Device API

To be written by work package 0.3: enrolment, heartbeat, activity blocks,
bypass events, unlock requests and long-poll, keys, versioning (`426` for
outdated clients).

## Native messaging

To be written by work package M5: message framing, size limit, the
`status`, `ping`, `trusted_time`, `signed_policy` and `report_event` methods,
`allowed_origins`, peer validation.

## Dashboard API (server)

What the web dashboard (`server/web`) talks to. Same origin as the
dashboard, JSON only, under `/api/v1`. The device API (`/api/v1/device/*`,
Bearer tokens) is a separate contract in `packages/protocol/openapi.yaml`.

### Session, CSRF and errors

- **Session**: an encrypted cookie (`SESSION_DRIVER=cookie`), named
  `__Host-mf_session` in production (Secure, `Path=/`, no `Domain`),
  HttpOnly, SameSite=Lax, 30 days. Nothing auth-related lives in
  `localStorage`. Each session is stamped with `users.session_version`;
  bumping it ("log out everywhere", a password change, enabling two-step
  verification, `user:reset-password`) ends every session stamped before.
- **CSRF**: any GET sets the `XSRF-TOKEN` cookie; every POST, PUT, PATCH and
  DELETE sends it back as `X-XSRF-TOKEN`. Missing or wrong: 403
  `E_BAD_CSRF_TOKEN`.
- **Errors**: `{ "message": string, "code": "E_*" }`, the message already
  translated into the user's language (signed in) or `Accept-Language`.
  Validation failures are 422 `{ "errors": [{ "field", "rule", "message" }] }`;
  throttles are 429 `{ "errors": [...] }` with `Retry-After`.
- **Tenancy**: every row hangs from a user; someone else's id answers
  404 `E_ROW_NOT_FOUND`, never 403. Admin routes answer non-admins with the
  404 `E_ROUTE_NOT_FOUND` of an unknown route.

| Code                             | Status | When                                                               |
| -------------------------------- | ------ | ------------------------------------------------------------------ |
| `E_UNAUTHORIZED_ACCESS`          | 401    | No session, or a revoked one                                       |
| `E_INVALID_CREDENTIALS`          | 400    | Login: wrong password or unknown email (identical answers)         |
| `E_TWO_FACTOR_CHALLENGE_EXPIRED` | 400    | Code step without a password step in the last 5 minutes            |
| `E_INVALID_TWO_FACTOR_CODE`      | 400    | Wrong, reused or out-of-window code; used or unknown recovery code |
| `E_TWO_FACTOR_ALREADY_ENABLED`   | 409    | Enrolling while two-step verification is on                        |
| `E_TWO_FACTOR_NOT_PENDING`       | 409    | Confirming without an enrolment                                    |
| `E_TWO_FACTOR_NOT_ENABLED`       | 409    | Turning off or regenerating codes while it is off                  |
| `E_REAUTH_FAILED`                | 400    | Sensitive action with a wrong current password                     |
| `E_REGISTRATION_REJECTED`        | 400    | Any refused sign-up (identical whatever the reason)                |

### Routes

`user` is `{ id, email, fullName, locale, timeZone, weekStart, isAdmin, twoFactorEnabled, createdAt }`
(`locale` `en`/`es`; `timeZone` an IANA name; `weekStart` an ISO weekday,
1 = Monday ... 7 = Sunday; timestamps ISO 8601 UTC).

| Method | Path                            | Body / query                                                                 | Answer                                                                |
| ------ | ------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/auth/login`                   | `{ email, password }`                                                        | `{ twoFactorRequired: false, user }` or `{ twoFactorRequired: true }` |
| POST   | `/auth/two-factor`              | `{ code }` or `{ recoveryCode }`                                             | `{ user }`                                                            |
| POST   | `/auth/register`                | `{ invitation?, email, fullName, password, locale?, timeZone?, weekStart? }` | 201 `{ user }`, signed in                                             |
| GET    | `/auth/me`                      |                                                                              | `{ user }`                                                            |
| POST   | `/auth/logout`                  |                                                                              | 204                                                                   |
| POST   | `/auth/logout-everywhere`       |                                                                              | 204, every session ends                                               |
| PATCH  | `/me`                           | `{ fullName?, locale?, timeZone?, weekStart? }`                              | `{ user }`                                                            |
| PUT    | `/me/password`                  | `{ currentPassword, password }`                                              | 204; other sessions end, this one stays                               |
| GET    | `/me/export`                    | `?format=native` (default)                                                   | JSON download (below)                                                 |
| DELETE | `/me`                           | `{ password }`                                                               | 204; the account and its rows are gone                                |
| POST   | `/me/two-factor`                | `{ password }`                                                               | `{ secret, otpauthUrl }` (not active yet)                             |
| POST   | `/me/two-factor/confirm`        | `{ code }`                                                                   | `{ recoveryCodes: string[10] }`, shown once                           |
| POST   | `/me/two-factor/recovery-codes` | `{ password, code }` or `{ password, recoveryCode }`                         | `{ recoveryCodes }`; the old ones stop working                        |
| DELETE | `/me/two-factor`                | `{ password, code }` or `{ password, recoveryCode }`                         | 204                                                                   |
| GET    | `/admin/invitations`            |                                                                              | `{ invitations: invitation[] }`, the admin's own                      |
| POST   | `/admin/invitations`            | `{ email? }`                                                                 | 201 `{ invitation, url }`, the link shown once                        |
| DELETE | `/admin/invitations/:id`        |                                                                              | 204                                                                   |

- **Passwords**: 12 to 128 characters, not a common word dressed up with
  digits or symbols (`passwordTooCommon`), at least 5 distinct characters
  (`passwordTooRepetitive`), not containing the email's local part
  (`passwordContainsEmail`). Hashed with scrypt.
- **Login throttles** (only failures count): 5 per minute per email and IP,
  then 20 minutes blocked; 30 per 15 minutes per IP. Codes: 5 per minute per
  user. Password re-checks: 5 per minute per user. Refused sign-ups: 10 per
  hour per IP. Invitations: 20 per hour per admin.
- **Registration**: closed unless `REGISTRATION_OPEN=true`; an invitation
  always works. The first admin comes from `SEED_ADMIN_*` (`SEED_USERS=true`).
- **Invitations**: the link is `<APP_URL>/invite#<random>`; the dashboard
  sends the fragment as `invitation`. 256 random bits, stored as SHA-256,
  valid 7 days, single use; with `email`, only that address may accept it.
  `invitation` is `{ id, email, status: pending|used|expired, expiresAt, usedAt, createdAt }`.
- **Two-step verification (TOTP)**: RFC 6238, SHA-1, 6 digits, 30 s, a code
  accepted one step early or late and never twice. The seed is encrypted
  with `APP_KEY`; recovery codes (`xxxx-xxxx-xxxx-xxxx`, any case, dashes
  or spaces optional) are stored as SHA-256 and work once.
- **Export** (`format: "monki-focus.export"`, `version: 1`): `exportedAt`,
  `user` (plus `updatedAt`), `twoFactor { enabled, enabledAt, recoveryCodesRemaining }`,
  `invitationsCreated`. Never a hash, seed or link. Later packages add their
  sections; `?format=aw` (ActivityWatch) arrives with analytics.
- **Operators**: `node ace user:reset-password <email>` (prompts twice, or
  `--generate`; `--disable-two-factor` for a lost authenticator) signs the
  account out everywhere.
