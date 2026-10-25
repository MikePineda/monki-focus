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
| Dashboard API: guardians        | `server/api/start/routes.ts`, this file ([Guardians](#guardians-dashboard))                 | S5           | active  |
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
  `device_enrolled`, `device_revoked` and the guardian link events
  ([Guardians](#guardians-dashboard)) itself, under dedupe keys a device
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
  (`{ id, kind, source, deviceUuid, details, occurredAt, resolvedAt, createdAt }`),
  `guardianLinks` (`link` plus `revokedAt`, both sides, revoked ones too;
  see [Guardians](#guardians-dashboard)).
  Never a hash, seed, token, code, link or ntfy topic. Later packages add their
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

### Guardians (dashboard)

A ward invites a trusted person (the guardian) who approves unlocks and
sees only aggregates. Session and CSRF like every dashboard route, under
`/guardian` (plus `/auth/register-guardian`). Every `:id` is looked up
through the signed-in user, and a route meant for one side through that
side only: a stranger, a revoked or lapsed link, and the other side of a
one-sided route all answer 404 `E_ROW_NOT_FOUND`.

| Method | Path                                    | Who      | Body                                                                  | Answer                                                                    |
| ------ | --------------------------------------- | -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/guardian/pairing-codes`               | ward     |                                                                       | 201 `{ code, expiresAt, qrPayload }` (`Cache-Control: no-store`)          |
| POST   | `/guardian/pairings`                    | guardian | `{ code }`                                                            | 201 `{ link }`, pending                                                   |
| POST   | `/auth/register-guardian`               | guest    | `{ code, email, fullName, password, locale?, timeZone?, weekStart? }` | 201 `{ user, link }`, signed in, link pending                             |
| GET    | `/guardian/links`                       | both     |                                                                       | `{ links: link[] }`: pending and active, both directions, newest first    |
| POST   | `/guardian/links/:id/confirm`           | ward     | `{ password }`                                                        | `{ link }`, active                                                        |
| PATCH  | `/guardian/links/:id`                   | guardian | `{ maxUnlockMinutes?, allowNotificationActions? }`                    | `{ link }`                                                                |
| POST   | `/guardian/links/:id/revoke`            | both     |                                                                       | 204 when it ended; 200 `{ link }` (status `revoking`) when the ward waits |
| POST   | `/guardian/links/:id/cancel-revocation` | ward     |                                                                       | `{ link }`, active again                                                  |
| POST   | `/guardian/links/:id/rotate-topic`      | both     |                                                                       | `{ link }`; the guardian also gets `{ subscription }` (`no-store`)        |
| GET    | `/guardian/links/:id/subscribe`         | guardian |                                                                       | `{ subscription: { topic, url, deepLink, qrPayload } }` (`no-store`)      |
| GET    | `/guardian/wards/:wardUserId/summary`   | guardian |                                                                       | the guardian summary (below), `no-store`                                  |

- `link` is `{ id, role: ward|guardian, status: pending|active|revoking,
wardUserId, counterpart: { email, fullName }, guardianTwoFactorEnabled,
maxUnlockMinutes, allowNotificationActions, confirmedAt,
revocationRequestedAt, revocationEffectiveAt, createdAt }`, never the
  ntfy topic. `counterpart` is the other person, so the ward confirms
  exactly whom they let in. The export adds `guardianLinks` (both sides,
  revoked ones too, plus `revokedAt`), never a topic.
- **Pairing codes**: 6 digits, `PAIRING_CODE_TTL_MINUTES` (10), single use,
  one pending per ward (a new code replaces it; unique index and a lock on
  the ward's row), 10 per hour per ward. The first 3 digits find the code,
  all 6 prove it, both stored as HMACs keyed with `APP_KEY`. Each guess is
  charged before it is checked: 10 failures per hour per IP (shared by both
  redeeming routes), 10 per hour per account (signed in), and the code's
  own counter (the fifth wrong guess kills it, whatever the IP). Wrong,
  expired, used and locked codes answer the same 400
  `E_INVALID_PAIRING_CODE`. A typed space or dash (`123 456`) is fine.
- **QR payload**: `<APP_URL>/pair#<code>`, the server URL and the code only
  (the fragment never reaches a server log); the dashboard reads it and
  posts the code.
- **Guardian sign-up**: the only sign-up open while `REGISTRATION_OPEN` is
  off. A valid code creates an ordinary (never admin) account and its
  pending link in one transaction, consuming the code. Every refusal (any
  code problem, an email already registered) is the same 400
  `E_GUARDIAN_REGISTRATION_REJECTED`, the password hashed either way.
- **Activation**: a link stays `pending` (it grants nothing) until the ward
  confirms it with their password, and only once the guardian has two-step
  verification on (`/me/two-factor`, the regular flow); before that, 409
  `E_GUARDIAN_TWO_FACTOR_REQUIRED`. A guardian cannot turn two-step
  verification off while guarding (409 on `DELETE /me/two-factor`); if an
  operator does, the guardian reaches nothing until it is back on.
  Guardian-side settings, subscription and rotation need it too (409).
- **Rules**: never oneself (409 `E_PAIRING_WITH_SELF`), at most one live
  (pending or active) link per pair (409 `E_GUARDIAN_LINK_EXISTS`); a ward
  may have several guardians. `maxUnlockMinutes` starts at 30 (or the
  instance cap if lower) and takes whole minutes from 1 to
  `min(UNLOCK_TOKEN_MAX_MINUTES, 240)`; `allowNotificationActions` (default
  true) off means unlocks are decided in the dashboard only.
- **Leaving**: the guardian leaves at once (204). The ward of an active
  link asks and waits `WARD_REVOCATION_COOLDOWN_HOURS` (24; 0 means at
  once): 200 with `revocationEffectiveAt`; asking again keeps the first
  deadline, and `cancel-revocation` withdraws it (409
  `E_NO_REVOCATION_PENDING` otherwise). The guardian keeps the link until
  the deadline and loses it exactly then (every lookup reads the
  deadline); the `ward_revocation_effective` job stores the final state on
  its next tick. A pending link ends at once, whoever asks. Revoking
  changes only the link: devices, events and every other row of the ward
  stay. Deleting either account ends its links the same way first.
- **ntfy topic**: each link has its own capability topic,
  `NTFY_TOPIC_PREFIX` (`mf-`) plus 26 lowercase base32 characters (128
  random bits), told only to the guardian (`subscribe`, `rotate-topic`).
  `url` and `qrPayload` are the topic on `NTFY_PUBLIC_URL` (else
  `NTFY_BASE_URL`; 409 `E_NOTIFICATIONS_UNAVAILABLE` without either),
  `deepLink` the `ntfy://` link (`?secure=false` on plain http). Rotating
  (active links, 10 per hour per user) moves every unsent queued notice to
  the new topic; when the ward rotates, one neutral `topic_rotated` notice
  goes to the old topic (the last message it ever gets) so the guardian
  knows to subscribe again. A link not active yet has no subscription (409
  `E_GUARDIAN_LINK_NOT_ACTIVE`).
- **Notices to the guardian** are rows of `notification_outbox` (channel
  `ntfy`, the link's topic, a payload of reason codes and ids only:
  `{ type: "guardian_notice", kind, linkId, effectiveAt? }`), queued in the
  transaction of the change: `revocation_requested`, `revocation_cancelled`,
  `pairing_ended` (the ward's cooldown ran out, the ward left with no
  cooldown, or the ward deleted the account) and `topic_rotated`. The ntfy
  notifier (S6) publishes them in the guardian's language, neutrally
  ("pairing ended").
- **Ward's log**: link changes are server bypass events (`source:
"server"`, keys `s:<kind>:<link id>[:<instant>]`, details allowlisted to
  enums and bounded integers): `guardian_linked`,
  `guardian_revocation_requested` (`cooldownHours` 0-168),
  `guardian_revocation_cancelled`, `guardian_unlinked` (`endedBy`
  `ward|guardian`, `reason` `revoked|account_deleted`) and
  `guardian_topic_rotated` (by the ward). The notices above announce them;
  S6's `BypassAlerts` must not notify `guardian_*` kinds a second time.
- **Guardian summary**, an allowlist (never a URL, title, domain, app,
  device name or id, dedupe key or free text): `{ wardUserId, generatedAt,
score: { today, last7Days }, unlocks: { last7Days: { requested, approved,
denied } }, bypasses: { last7Days, openGaps, recent: [{ id, kind, source,
details, occurredAt, resolvedAt, acknowledgedAt }] } }`. `score` is null
  until activity sync exists (phase 4) and `unlocks` 0 until unlock
  requests exist (S6); `recent` covers the last 7 days, newest first, 50
  at most; `openGaps` counts open dead-man gaps. `details` keep only keys
  some kind's allowlist knows, each a boolean, a safe integer or a short
  code. Only through an active link whose guardian has two-step
  verification on; anything else is 404.

| Code                               | Status | When                                                         |
| ---------------------------------- | ------ | ------------------------------------------------------------ |
| `E_INVALID_PAIRING_CODE`           | 400    | Wrong, expired, used or locked pairing code                  |
| `E_GUARDIAN_REGISTRATION_REJECTED` | 400    | Any refused guardian sign-up (identical whatever the reason) |
| `E_PAIRING_WITH_SELF`              | 409    | Redeeming one's own code                                     |
| `E_GUARDIAN_LINK_EXISTS`           | 409    | The pair already has a pending or active link                |
| `E_GUARDIAN_TWO_FACTOR_REQUIRED`   | 409    | The guardian has no second factor (or wants to turn it off)  |
| `E_GUARDIAN_LINK_NOT_PENDING`      | 409    | Confirming a link that is already active                     |
| `E_GUARDIAN_LINK_NOT_ACTIVE`       | 409    | Subscribing or rotating before the ward confirmed            |
| `E_NO_REVOCATION_PENDING`          | 409    | Cancelling when the ward has not asked to leave              |
| `E_NOTIFICATIONS_UNAVAILABLE`      | 409    | Neither `NTFY_PUBLIC_URL` nor `NTFY_BASE_URL` is set         |
