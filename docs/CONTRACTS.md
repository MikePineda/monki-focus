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
| Device API                      | `packages/protocol/openapi.yaml` (`/api/v1`, `X-Client-Version`)                            | 0.3, S4      | active  |
| Native messaging bridge         | `macos` bridge contract (length-prefixed JSON, five methods)                                | M5           | planned |
| Dashboard API: accounts         | `server/api/start/routes.ts`, this file ([Dashboard API](#dashboard-api-server))            | S2           | active  |
| Dashboard API: devices          | `server/api/start/routes.ts`, this file ([Devices](#devices-dashboard))                     | S4           | active  |
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

The source of truth is `packages/protocol/openapi.yaml`; the server's
contract test (`server/api/tests/functional/devices/device_api_contract.spec.ts`)
fails when an implemented `/api/v1/keys` or `/api/v1/device/*` route is not
an operation of it, or an operation is neither implemented nor owned by a
later package. Implemented (S3, S4): `GET /keys`, `POST /device/enroll`,
`POST /device/heartbeat`, `POST /device/bypass-events`,
`POST /device/token/rotate`. Unlock requests land with S6.

- **Auth**: Bearer device tokens `mfd_<id>.<secret>` (`@adonisjs/auth`
  access tokens whose tokenable is a device), about 288 random bits, stored
  as SHA-256 only, returned once (enrolment, rotation), ability `device:*`.
  No session, no cookie, no CSRF; a session cookie is ignored (401) and the
  dashboard refuses a device token (401). Revoking a device deletes its
  tokens and the guard also refuses a revoked device.
- **Errors**: always `{ code, fields? }` with snake_case codes, never text:
  `validation_failed` (422, `fields: { <path>: <rule> }`), `unauthorized`
  (401), `not_found` (404), `too_many_requests` (429, `Retry-After`),
  `client_upgrade_required` (426), `invalid_enrollment_code` (400),
  `device_limit_reached` (409), `internal_error` (5xx).
- **Enrolment**: the dashboard's code is 8 base32 characters, 10 minutes,
  single use, one pending per user, 20 active devices per user. The first 3
  characters find the code, all 8 prove it; both are stored as HMACs keyed
  with `APP_KEY`. Each guess is charged before it is checked, twice: 10
  failures per 15 minutes per IP, and the code's own counter (the fifth
  wrong guess kills it, whatever the IP). Wrong, expired, used and locked
  codes answer the same 400. The response carries the key set the device
  pins (only if every kid equals one the dashboard showed).
- **Heartbeat**: every 15 minutes and on wake, at most 60 per hour per
  device. Answers a signed time token bound to the device, the request's
  nonce and boot id (with the device's pending revocations), the key-set
  ETag, `rulesVersion` (0 until rule sets exist) and `tokenRotationDue`
  (the token is 30 days old). Pinned kids the instance does not publish
  raise one `key_pin_mismatch` per distinct set. The nonce is never stored.
- **Bypass events**: batches of 1 to 100, 120 batches per hour per device,
  idempotent per device and `dedupeKey`. Client kinds only (the schema's
  enum); the server raises `heartbeat_missing`, `heartbeat_resumed`,
  `key_pin_mismatch`, `protection_disabled`, `deadman_threshold_raised`,
  `device_enrolled` and `device_revoked` itself, under dedupe keys a device
  cannot write. `details` are a strict allowlist per kind, enum values and
  bounded integers only, never a free string (so no domain, path, title or
  slug fits): `emergency_override` takes `scope` (`rule`, `bedtime`),
  `waitSeconds` (0-3600) and `durationSeconds` (0-86400); `time_changed`
  and `clock_changed` take `deltaSeconds` (±31536000); `time_floor_lowered`
  takes `loweredBySeconds` (0-31536000); every other kind takes none.
  Anything else is 422 `validation_failed` (`events.<i>.details`).
- **Token rotation**: `POST /device/token/rotate` (10 per hour) returns a
  new token; every other token is deleted and the calling one works 10
  more minutes. An atomic claim on the calling token plus a lock on the
  device row make concurrent calls mint exactly one token; a token in its
  grace can never rotate again (409 `token_rotation_refused`).
- **Dead-man switch**: every 5-minute window (one claim per window), a
  protected, unrevoked device silent for its `deadmanHours` (default
  `DEADMAN_DEFAULT_HOURS`, 6) gets one `heartbeat_missing` per gap; the next
  heartbeat resolves it and stores `heartbeat_resumed` with `gapSeconds`. An
  announced shutdown (`goingOffline`) labels the alert (`announced: true`),
  never suppresses it. A heartbeat that turns protection off raises
  `protection_disabled` instead, since the switch only watches protected
  devices. Already alerted devices are left out of the scan (a backlog of
  silent devices never starves new alerts), and each alert is inserted only
  while the locked device row still has the scanned `last_seen_at`, so a
  heartbeat that just landed never gets a false alert. Raising
  `deadmanHours` from the dashboard takes effect at once and stores
  `deadman_threshold_raised` (`fromHours`, `toHours`); lowering it does not. New events go to the `BypassAlerts` port (guardian
  notifications arrive with S6).
- **Retention**: a daily job prunes heartbeats older than
  `HEARTBEAT_RETENTION_DAYS` (30), enrolment codes a day after expiry and
  expired tokens. Bypass events are kept.

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
  bumping it (logout, "log out everywhere", a password change, enabling
  two-step verification, `user:reset-password`) ends every session stamped
  before. Because the cookie is stateless, plain logout bumps it too: a copy
  of the cookie dies with it, and so do the account's other sessions.
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
| POST   | `/auth/logout`                  |                                                                              | 204, every session ends (copies too)                                  |
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
- **Login throttles** (only failures count; each attempt is charged before
  it is checked, so a concurrent burst never evaluates more than the limit): 5 per minute per email and IP,
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
  `invitationsCreated`, `devices` (`device[]`), `bypassEvents`
  (`{ id, kind, source, deviceUuid, details, occurredAt, resolvedAt, createdAt }`).
  Never a hash, seed, token, code or link. Later packages add their
  sections; `?format=aw` (ActivityWatch) arrives with analytics.
- **Operators**: `node ace user:reset-password <email>` (prompts twice, or
  `--generate`; `--disable-two-factor` for a lost authenticator) signs the
  account out everywhere.

### Devices (dashboard)

Session and CSRF like every dashboard route; a device token is refused.
Another user's or a revoked device's `:uuid` answers 404 `E_ROW_NOT_FOUND`.

| Method | Path                        | Body                       | Answer                                                      |
| ------ | --------------------------- | -------------------------- | ----------------------------------------------------------- |
| GET    | `/devices`                  |                            | `{ devices: device[] }`, active first, then revoked         |
| POST   | `/devices/enrollment-codes` |                            | 201 `{ code, expiresAt, issuer, kids: { unlock, policy } }` |
| PATCH  | `/devices/:uuid`            | `{ name?, deadmanHours? }` | `{ device }`                                                |
| DELETE | `/devices/:uuid`            |                            | 204; tokens deleted, `device_revoked` stored                |

- `device` is `{ uuid, name, platform, clientVersion, status: active|revoked,
protectionActive, a11yEnabled, riskState, deadmanHours, enrolledKids,
pinnedKids, keyPinMismatch, clockOffsetMs, lastSeenAt, announcedOfflineAt,
revokedAt, createdAt }`. Never a token, hash or boot id. `enrolledKids`
  and `pinnedKids` are shown so the user (and later the guardian) can
  compare them with the instance's keys.
- The code is shown once (`Cache-Control: no-store`) with the issuer and
  the kid of every published key; the dashboard displays them and encodes
  `{ code, issuer, kids }` in the QR code. 10 codes per hour per user; a new
  code replaces the pending one (one pending code per user, enforced by a
  unique index and a lock on the user row); 409 `E_DEVICE_LIMIT_REACHED` at 20 active
  devices. `name`: 1 to 64 characters, no control characters;
  `deadmanHours`: whole hours from 1 to 48.

| Code                     | Status | When                               |
| ------------------------ | ------ | ---------------------------------- |
| `E_DEVICE_LIMIT_REACHED` | 409    | A code while 20 devices are active |
