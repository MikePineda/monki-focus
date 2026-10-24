# Unlock, policy and time tokens (PASETO v4.public)

- Status: normative, version 1 (draft until the first server release)
- Reference implementation: [`packages/protocol/src`](../../packages/protocol/src)
- Conformance suite: [`packages/protocol/fixtures`](../../packages/protocol/fixtures)
- Decision record: [ADR 0002](../adr/0002-paseto-v4-unlock-tokens.md);
  threat model: [threat-model.md](../threat-model.md) §2 and §3

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

When a guardian approves an unlock, the optional server issues an **unlock
token**. The client verifies it **offline**, binds it to the device's clock,
records its id and only then relaxes a rule. The server also signs a
**policy token** per device that pins the rule set, its version and its time
zone, and answers every heartbeat and unlock poll with a **time token**: its
current time and the revoked unlock tokens of the device, bound to a fresh
client nonce. All three are PASETO v4.public tokens; this document defines
everything a platform needs to verify them with nothing but SHA-256,
Ed25519, big-integer arithmetic and a JSON parser.

Nothing here relies on TLS for integrity: the device owner may control the
network, the CA store or the OS. TLS protects confidentiality and the first
key pin; every value that decides an unlock (the token, trusted time,
revocations, key rotation) is signed.

## 1. Token format

```text
token     = "v4.public." base64url(message || signature) "." base64url(footer)
m2        = PAE("v4.public.", message, footer, implicit_assertion)
signature = Ed25519-Sign(secret_key, m2)          ; 64 bytes, RFC 8032
```

- **Bytes.** A token is at most **4096 bytes**, and any byte outside
  `0x21`–`0x7E` (space, control, non-ASCII) gives `malformed_token` before
  anything else is examined, including the header.
- **Header.** Exactly the ten bytes `v4.public.`. Any other header
  (`v4.local.`, `v3.public.`, `V4.public.`) MUST be rejected with
  `wrong_header` before anything else is decoded. There is no algorithm field
  to read or negotiate.
- **Message.** The claims, canonical JSON (§4.0). Not interpreted until the
  signature has verified.
- **Footer.** Always present, exactly `{"kid":"<kid>"}` (§2).
- **Encoding.** base64url per RFC 4648 §5, without padding, **canonical**:
  reject padding (`=`), characters outside `A-Z a-z 0-9 - _`, a part whose
  length is 4n+1, and any encoding whose unused trailing bits are not zero.
  The simplest correct check is "decode, re-encode without padding, compare".
  Exactly one `.` separates body and footer; more parts, an empty body or an
  empty footer after a trailing `.` is `malformed_token`. The decoded body is
  at least 64 bytes (the signature).
- **PAE** (pre-authentication encoding, PASETO spec):
  `PAE(p1..pn) = LE64(n) || LE64(len(p1)) || p1 || ... || LE64(len(pn)) || pn`,
  `LE64` being an unsigned 64-bit little-endian integer with the top bit
  cleared. Every vector carries `construction.paeHex`, the exact `m2` bytes.

### 1.1 Strict Ed25519

Platform libraries disagree on edge cases (non-canonical encodings,
small-order and mixed-order points, `S >= L`, cofactored versus cofactorless
equations). Every verifier therefore checks, **explicitly and before calling
its library**:

1. **Public key A** (at pinning, §2) and **signature R** (first 32 bytes of
   the signature): the encoding is canonical (the 255-bit y is below
   p = 2^255 − 19; an x = 0 point never carries the sign bit); it is not one
   of the 8 small-order points (compare the encoding with bit 255 cleared
   against the 5 masked values in
   [`ed25519_strict.ts`](../../packages/protocol/src/ed25519_strict.ts));
   and it lies in the prime-order subgroup, `[L]P = identity`
   ([`ed25519_subgroup.ts`](../../packages/protocol/src/ed25519_subgroup.ts):
   RFC 8032 §5.1.3 decoding plus a double-and-add with extended coordinates,
   about 80 lines of big-integer code to port).
2. **Scalar S** (last 32 bytes, little-endian) is below the group order
   L = 2^252 + 27742317777372353535851937790883648493.
3. Only then the library's Ed25519 verification of `m2`.

With A and R in the prime-order subgroup, cofactored and cofactorless
verification agree, so every platform gives the same verdict. A failing key
is `invalid_input` (the keyring refuses it); a failing R or S is
`invalid_signature`. The vendored Wycheproof EddsaVerify suite and the 12
"Taming the many EdDSAs" cases (`fixtures/ed25519-edge/`) pin the expected
verdicts: Wycheproof `valid` accept, `invalid` and `acceptable` reject; all 12
speccheck cases reject.

## 2. Key ids and keys

- A key id is the first 16 characters of the unpadded base64url SHA-256 of
  the raw 32-byte public key (`kid = b64url(SHA-256(pk))[0..16)`).
- The footer is matched **byte for byte** against
  `^\{"kid":"([A-Za-z0-9_-]{16})"\}$`: no whitespace, no other members, no
  JSON parser. It is the only part read before the signature check (to select
  the key), and it is authenticated because it is inside `m2`.
- **Separate keys per purpose.** `unlock-signing` signs unlock and time
  tokens; `policy-signing` signs policy tokens. A client keeps one keyring per
  key purpose and MUST NOT verify a token with the other keyring.
- **Keyring rules.** One or two keys per purpose ("at most two active
  kids"); each kid MUST be derived from its key; each key MUST pass §1.1.
  Anything else is `invalid_input`.
- **Pinning at enrolment.** The dashboard shows the one-time enrolment code
  together with the kid of every active key, and the enrolment QR code
  encodes `{code, issuer, kids}`. The device pins the keys from the enrolment
  response only if every kid equals one it was shown or scanned; otherwise it
  discards the enrolment. When the guardian pairs, the dashboard shows the
  guardian the same kids. Every heartbeat reports `pinnedKids`; the server
  raises a `key_pin_mismatch` bypass event for the guardian when they are not
  the instance's keys (a device that was enrolled through an interception
  proxy would pin the proxy's keys).
- **Rotation.** A new key is announced in `GET /keys` with an `endorsement`:
  a v4.public token of `typ: "key"`, signed by the **previous active key of
  the same purpose**, with footer `{"kid":"<old kid>"}`, implicit assertion
  `"monki-focus/key/v1|" + iss + "|" + purpose`, and canonical claims
  `{"v":1,"typ":"key","iss":…,"use":…,"kid":…,"x":…,"iat":…,"nbf":…,"exp":…}`
  (`x` is the new raw public key in base64url, `exp - iat` at most 90 days).
  A client adopts the new key only if the endorsement verifies (strictly)
  against a key it already pins, `kid` is derived from `x` and `x` passes
  §1.1; it then keeps the endorsing key and the new key and drops any other.
  Clients refresh `/keys` when the heartbeat's `keysEtag` changes, or once
  when a token names an unknown kid. _Endorsement tokens are specified here
  and in `openapi.yaml`; their reference implementation and vectors land
  with work package S3._
- **Compromise.** A leaked signing key cannot be rotated away (its holder could
  endorse a key of their own). Recovery is re-enrolling every device, which
  pins a fresh key and shows its kid again.

## 3. Implicit assertion

```text
unlock: "monki-focus/unlock/v1|" + iss + "|" + dev
policy: "monki-focus/policy/v1|" + iss + "|" + dev
time:   "monki-focus/time/v1|"   + iss + "|" + dev + "|" + nonce + "|" + boot
```

The verifier builds the assertion from **its own** pinned issuer, **its own**
device uuid and, for time tokens, the nonce and boot id **it just sent**,
never from the token. A token for another device, instance or request fails
the signature (`invalid_signature`); the prefixes separate the purposes even
though unlock and time tokens share a key. No value can contain `|` (the
formats forbid it), so the concatenation is unambiguous; a verifier given an
issuer, device, nonce or boot id that does not match its format fails with
`invalid_input`.

**Issuer profiles.** In the **release** profile (what clients ship) the
issuer is exactly `https://host`: lowercase, at least two labels, no port
(including no explicit `:443`), no path, no trailing slash. The
**development** profile additionally accepts `http://localhost` and
`http://127.0.0.1` with an optional port from 1 to 65535 that is not the
default `80`. Port 0 and ports above 65535 never match.

## 4. Claims

All claims are required and no others are allowed. Machine-readable schemas
(JSON Schema draft 2020-12, generated from the same patterns as the
reference validators):
[`unlock-token.claims.schema.json`](../../packages/protocol/schema/unlock-token.claims.schema.json),
[`policy-token.claims.schema.json`](../../packages/protocol/schema/policy-token.claims.schema.json),
[`time-token.claims.schema.json`](../../packages/protocol/schema/time-token.claims.schema.json).

### 4.0 Canonical serialisation

The message MUST be the canonical serialisation of its claims. After parsing
and before claim validation, verifiers rebuild the expected bytes from the
parsed claims (by string concatenation, not a JSON encoder) and compare them
byte for byte with the message; a mismatch is `invalid_claims`. Canonical is:

- UTF-8, no BOM, no whitespace outside strings;
- members in exactly the order of the claims tables below (`scope`: `kind`,
  `value`, then `includeSubdomains` for domain scopes; revocation items:
  `jti`, `exp`);
- strings written raw with no escapes (every permitted value is printable
  ASCII without `"`, `\` or controls; a parsed string containing anything
  else cannot be serialised and is `invalid_claims`);
- integers in shortest decimal form, without sign, leading zero, fraction or
  exponent; booleans as `true` / `false`; arrays as `[` items joined by `,`
  `]`.

Issuers produce exactly these bytes. Duplicate members, reordered members,
whitespace, escapes, `1.0` or `1e0` can therefore never verify, and every
platform's JSON parser sees the same document.

### 4.1 Unlock token (`typ: "unlock"`)

| Claim   | Type    | Format and meaning                                                                                        |
| ------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `v`     | integer | Always `1`.                                                                                               |
| `typ`   | string  | Always `"unlock"`.                                                                                        |
| `iss`   | string  | Instance origin (§3 issuer profiles).                                                                     |
| `sub`   | string  | User id on the instance, `^[A-Za-z0-9_-]{1,64}$`.                                                         |
| `dev`   | string  | Device uuid (lowercase canonical UUID). Equals the device verifying it.                                   |
| `rule`  | string  | Id of the rule being lifted, `^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`.                                        |
| `scope` | object  | `{kind, value[, includeSubdomains]}`, kinds `domain`, `path`, `app` (§4.5).                               |
| `dur_s` | integer | Length of the unlock once activated, 60 to 7200 seconds, and at most `exp - iat`.                         |
| `iat`   | string  | Issued at, server time. Only ever raises the trusted-time floor (§6), never anchors.                      |
| `nbf`   | string  | Not before, server time; `iat <= nbf`.                                                                    |
| `exp`   | string  | Expiry, server time; `nbf < exp` and `exp - iat <= 4 h`.                                                  |
| `jti`   | string  | Token id (UUID, 128 bits), the replay-store key.                                                          |
| `req`   | string  | Uuid of the unlock request this token answers.                                                            |
| `pol`   | string  | base64url SHA-256 of the signed policy in force when the request was made (the heartbeat's `policyHash`). |

### 4.2 Policy token (`typ: "policy"`)

| Claim                           | Type    | Format and meaning                                                         |
| ------------------------------- | ------- | -------------------------------------------------------------------------- |
| `v`, `typ`, `iss`, `sub`, `dev` |         | As for unlock tokens, `typ` is `"policy"`.                                 |
| `ver`                           | integer | Monotonic policy version, 1 to 2^31 − 1. A client MUST refuse a lower one. |
| `tz`                            | string  | IANA time zone the policy is evaluated in (`Etc/UTC`, `America/New_York`). |
| `rules_sha256`                  | string  | base64url SHA-256 of the canonical rule-set document in force.             |
| `iat`, `nbf`, `exp`, `jti`      |         | As for unlock tokens, but `exp - iat <= 30 days`.                          |

### 4.3 Time token (`typ: "time"`)

Signed with the unlock key; answers one request.

| Claim      | Type    | Format and meaning                                                                      |
| ---------- | ------- | --------------------------------------------------------------------------------------- |
| `v`, `typ` |         | `1` and `"time"`.                                                                       |
| `iss`      | string  | Instance origin.                                                                        |
| `dev`      | string  | Device uuid.                                                                            |
| `nonce`    | string  | The 16 random bytes the client sent with the request, base64url (22 characters).        |
| `boot`     | string  | The boot id the client sent, `^[A-Za-z0-9._:-]{1,64}$`.                                 |
| `srv`      | string  | Server time when the answer was signed.                                                 |
| `revoked`  | array   | Up to 32 `{jti, exp}`: every revoked, unexpired unlock token of the device.             |
| `complete` | boolean | `false` when more revocations exist than fit. The server never truncates silently (§9). |

A time token has no validity window: its freshness comes from the nonce
(single use, generated per request) and the round-trip limit (§6).

### 4.4 Time format

`iat`, `nbf`, `exp`, `srv` and revocation `exp` use one shape,
`YYYY-MM-DDTHH:MM:SSZ`: UTC, whole seconds, no offset or fraction, year 1970
or later, no leap second (`23:59:60` is invalid), and a day that exists in
its month (`2027-02-29` is invalid, `2028-02-29` is valid). Parse them with
the published pattern plus a calendar check, never with a lenient parser.

### 4.5 Scope formats and matching

- **`domain`**: `value` is an exact lowercase hostname with at least two
  labels; `includeSubdomains` is required (issuers default to `false`). It
  matches a host equal to `value`, and, only when `includeSubdomains` is
  `true`, a host ending in `"." + value`. Never a parent domain, never a
  lookalike suffix (`badexample.com` is not under `example.com`).
- **`path`**: `value` is an exact host plus one or more literal segments.
  Segments are non-empty, are not `.` or `..`, and contain no `%`, `\`, `*`,
  `?` or `#`; there is no trailing slash. It matches when the host is equal
  (never a subdomain) and the scope's segments are a prefix, segment by
  segment, of the target path's segments, compared case-sensitively and
  without percent-decoding (a scope cannot contain `%`, so an encoded
  segment in the target never matches).
- **`app`**: an Android package name or Apple bundle id, matched exactly.

Targets are normalised by the platform before matching: lowercase A-label
host without port or trailing dot, and the parsed URL path (dot segments
resolved, no query or fragment). Anything else does not match, which fails
closed. Shared cases: `fixtures/scope-match/cases.json`; reference:
[`scope_match.ts`](../../packages/protocol/src/scope_match.ts).

### 4.6 Semantic rules beyond the schema

1. `iat <= nbf < exp` (else `invalid_claims`).
2. `exp - iat <= 14400` for unlock and `<= 2592000` for policy tokens (else
   `lifetime_too_long`).
3. Unlock only: `dur_s <= exp - iat` (else `invalid_claims`).
4. `iss` equals the pinned issuer (`issuer_mismatch`), `dev` this device
   (`device_mismatch`), and for time tokens `nonce` and `boot` the request's
   (`binding_mismatch`). The implicit assertion already enforces all of
   them; the claim checks are defence in depth.
5. Unlock and policy: trusted now (§6) within `[nbf - 60 s, exp + 60 s]`
   (else `not_yet_valid` or `expired`). The ±60 s is the only skew tolerance.

## 5. Verification algorithm

Every platform MUST run these steps in this order and return the first
failing code, so all of them agree on every vector. Implementations MUST NOT
throw on any input: every failure, including unexpected internal errors
(`internal_error`), is a returned value treated as a rejection.

| #   | Step                                                                                  | Failure code                                             |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Inputs: keyring of the right key purpose, issuer/device (and nonce/boot), integer now | `invalid_input`                                          |
| 2   | A string of at most 4096 bytes, every byte in `0x21`–`0x7E`                           | `malformed_token`                                        |
| 3   | Header is exactly `v4.public.`                                                        | `wrong_header`                                           |
| 4   | One body and at most one footer part; strict base64url; body at least 64 bytes        | `malformed_token`, `malformed_base64url`                 |
| 5   | Footer present and exactly `{"kid":"<16 chars>"}`                                     | `malformed_footer`                                       |
| 6   | Kid is in the keyring                                                                 | `unknown_kid`                                            |
| 7   | Strict Ed25519 (§1.1) over `PAE(header, message, footer, assertion)`                  | `invalid_signature`                                      |
| 8   | Message is strict UTF-8 and parses as a JSON object                                   | `invalid_claims`                                         |
| 9   | `typ` equals the purpose                                                              | `wrong_typ`                                              |
| 10  | Message is byte-identical to the canonical serialisation of the parsed claims (§4.0)  | `invalid_claims`                                         |
| 11  | Claims match the schema (including the calendar check)                                | `invalid_claims`                                         |
| 12  | `iss`, `dev` (time: `nonce`, `boot`) equal the expected values                        | `issuer_mismatch`, `device_mismatch`, `binding_mismatch` |
| 13  | `iat <= nbf < exp`                                                                    | `invalid_claims`                                         |
| 14  | `exp - iat` within the purpose lifetime                                               | `lifetime_too_long`                                      |
| 15  | Unlock: `dur_s <= exp - iat`                                                          | `invalid_claims`                                         |
| 16  | Trusted now in `[nbf - 60 s, exp + 60 s]`                                             | `not_yet_valid`, `expired`                               |

Time tokens stop after step 12. **Nothing is parsed before step 7**: steps 2
to 6 only split, compare and decode bytes.

Error codes are stable reason codes (`TOKEN_ERROR_CODES` in
[`token_error.ts`](../../packages/protocol/src/token_error.ts)); clients map
them to i18n keys and never show raw codes or free text.

## 6. Trusted time

```text
trusted_now = max(wall_now, floor, anchor.srv + (mono_now - anchor.mono_sent))
```

- **Anchor.** Only a verified time token (§4.3) anchors time: the client
  sends a fresh nonce and its boot id with a heartbeat or an unlock poll,
  records the monotonic reading **when it sends**, and on the answer stores
  `(srv, mono_sent, boot)`. It refuses the answer (`stale_time`) if more than
  60 s of monotonic time passed between sending and verifying, or if the
  monotonic clock is behind `mono_sent`. Anchoring on the send instant makes
  network delay push trusted time ahead, never behind (fail closed). The
  anchor term counts only while `boot` equals the current boot and the
  monotonic clock has not gone back. The unsigned `serverTime` fields in API
  responses are informative only, and a token's `iat` is never an anchor.
- **Floor.** Persisted durably and only ever raised: to the anchored time on
  every anchor and at least every 60 s of monotonic progress while the anchor
  is current, and to the `iat` of every verified token. It is **never raised
  from the wall clock** (a clock set far ahead must not lock the device out
  forever), and it survives reboots and service-worker restarts, so a wall
  clock set back can never take trusted time below it.
- **Monotonic clock and boot id.** Android: `SystemClock.elapsedRealtime()`
  and `Settings.Global.BOOT_COUNT` (decimal). macOS: `mach_continuous_time()`
  and the boot session uuid (`kern.bootsessionuuid`). Extension:
  `performance.now()` in the service worker, with a boot id from
  `crypto.randomUUID()` generated **once per service-worker instance and kept
  only in memory** (never in storage), so every service-worker restart is a
  new boot; when the Mac app is present the extension uses the app's
  `trusted_time` instead.
- **Wall-only time.** Without an anchor from the current boot, trusted time
  is `max(wall, floor)`. It is enough to refuse tokens, but never enough to
  accept a first receipt or activation, to end entries on time or to purge
  the replay store (§7, §8): those wait for a fresh time token.

Reference: [`trusted_time.ts`](../../packages/protocol/src/trusted_time.ts).

## 7. Receipt and activation

- **Receipt.** A verified unlock token is recorded only with a current-boot
  anchor (`time_anchor_required` otherwise) and while trusted now is in
  `[nbf - 60 s, exp + 60 s]`. The receipt stores the boot id, the monotonic
  reading and a budget of `(exp - iat) + 60 s`.
- **Activation** needs a current-boot anchor and a receipt from the current
  boot. It stores the activation instant in trusted time (`activated_at`),
  the monotonic reading and the boot id, and fixes
  `end = min(activated_at + dur_s, exp + 60 s)`. The unlock is usable while
  trusted now is before `end` **and** at most `dur_s` of monotonic time has
  passed since activation in that boot. Activating again returns the
  **original** `end`; when either limit is reached the entry becomes
  `ended`.
- **Reboot or service-worker restart.** A received or active entry from
  another boot answers `revalidation_required`. Revalidation is online: the
  unlock-request poll (§9, `openapi.yaml`) returns the token again while it is
  valid and not revoked, together with a time token. The client then re-binds
  the entry to the current boot; the original `end` never moves and the new
  monotonic budget is what is left of it. Offline, it fails closed.

## 8. Replay store

A local ledger keyed by `jti` (Room on Android, SQLite/GRDB on macOS,
`storage.local` in the extension), persisted next to the trusted-time floor,
with the states `received → active → ended` plus `revoked`:

- receiving a jti that is already `received` or `active` is idempotent;
- an `ended` jti **never becomes active again** (`replayed`), and a `revoked`
  one never does either (`revoked`);
- entries are ended on time and **purged one day after `exp` only with a
  current-boot anchor**; on wall-only time nothing is ended on time or
  removed, so a clock jumped ahead cannot erase a jti that a clock set back
  would then let in again.

The shared state-machine vectors (`fixtures/state-machines/*.json`) replay
sequences of events `{wall, mono, boot, action}` and the expected outcome of
each; every platform's port of
[`unlock_session.ts`](../../packages/protocol/src/unlock_session.ts) must
match them. Actions: `time_response` (`srv`, `sentMono`, optional `revoked`
and `complete`), `unlock_received` (`jti`, `iat`, `nbf`, `exp`, `durS`),
`activate`, `deactivate`, `revalidate`, `purge`, `observe`. Before every
event the driver ratchets the floor. Expected fields (only those listed are
compared): `ok`, `error`, `end`, `trustedNow`, `status` (of the event's jti,
`absent` when not stored) and `entries` (sorted stored jtis).

## 9. Revocation

Revocations travel **only inside signed time tokens** (heartbeat and unlock
poll answers). Each lists every revoked, unexpired unlock token of the
device, at most 32 per token (which keeps the token under 4096 bytes). The
client marks each listed jti `revoked`, even one it has not received yet, so a
late delivery is refused. When `complete` is `false` the server had more
than fit: the client marks every `received` or `active` entry as needing
revalidation (`revalidation_required`) until the unlock poll confirms it.
Revocation still needs connectivity; an offline device cannot learn of it,
which is why unlock lifetimes are short (residual risk).

## 10. Test vectors

| Directory                                | What                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `fixtures/paseto-official/v4.json`       | Official PASETO v4 vectors (ISC); platforms run the `v4.public` cases.  |
| `fixtures/unlock-tokens/*.json`          | Unlock-token vectors, one file per case.                                |
| `fixtures/policy-tokens/*.json`          | Policy-token vectors.                                                   |
| `fixtures/time-tokens/*.json`            | Time-token vectors (`verify` has `nonce` and `boot` instead of `now`).  |
| `fixtures/state-machines/*.json`         | Trusted time, receipt, activation and ledger event sequences (§8).      |
| `fixtures/scope-match/cases.json`        | Scope matching (§4.5).                                                  |
| `fixtures/ed25519-edge/`                 | Wycheproof EddsaVerify and speccheck cases with strict verdicts (§1.1). |
| `fixtures/keys/TEST-ONLY-*.ed25519.json` | The TEST-ONLY keys that sign the token vectors (`test-key-not-real-*`). |

Each token vector has `id` (also the file name), `token`, `verify`
(`purpose`, `keyring` of `{kid, publicKeyHex}`, `issuer`, `device`, and `now`
or `nonce` + `boot`), `expect` (`{result: "valid", kid, claims}` or
`{result: "invalid", error}`) and an informative `construction` (signing key
name, exact `claimsJson`, `footer`, `implicitAssertion`, `paeHex`, and a
`tampering` note). A platform conforms when, for every file, building the
keyring from `verify.keyring` (its failure is the result) and verifying
`token` gives exactly `expect`. The keys are public on purpose and MUST NOT
be pinned by a real client.

Token vectors are regenerated deterministically with
`node packages/protocol/scripts/gen-vectors.mjs` (`--check` reports drift; a
test fails on drift); the schemas with `scripts/gen-schemas.mjs`. The
state-machine and scope-match vectors are written by hand.

## 11. Platform notes

All platforms: check bytes and split first, verify strictly (§1.1), then
parse, rebuild the canonical message (§4.0) and compare, then validate. Run
every fixture directory in the platform's test suite. Persist the floor and
the ledger together and atomically.

### WebCrypto (extension service worker)

```js
const key = await crypto.subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, [
  'verify',
])
const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, m2)
```

- Ed25519 in WebCrypto is available in current Chromium-based browsers;
  check `importKey` support at startup and fail closed if it is missing. Run
  the §1.1 checks with `BigInt` before `verify`.
- base64url: translate `-`/`_`, pad, `atob`, then re-encode and compare.
- Generate the boot id with `crypto.randomUUID()` when the service worker
  starts and keep it in a module variable only.

### Kotlin (Android)

- Ed25519: Tink's `com.google.crypto.tink.subtle.Ed25519Verify(publicKey)`
  (`verify` throws `GeneralSecurityException`; return `invalid_signature`).
  On a JVM 15+ (unit tests) `Signature.getInstance("Ed25519")` with the X.509
  wrapping `302a300506032b6570032100 || pk` also works. Port §1.1 with
  `java.math.BigInteger`.
- base64url: `java.util.Base64.getUrlDecoder()` is lenient; check alphabet and
  length, then re-encode with `getUrlEncoder().withoutPadding()` and compare.
- `LE64`: `ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(n and Long.MAX_VALUE)`.
- Boot id: `Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT)`.

### Swift (macOS)

```swift
let key = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyBytes)
let ok = key.isValidSignature(signature, for: m2)
```

- Port §1.1 with a small big-integer type (or `[UInt64]` limbs); CryptoKit
  exposes no subgroup check.
- `Data(base64Encoded:)` needs the standard alphabet and padding: translate,
  pad, decode, then re-encode and compare.
- CryptoKit _signing_ is randomised, so Swift only verifies the vectors.

### Node (server)

The reference implementation uses `node:crypto` without a PASETO library.
The server signs through `issueUnlockToken`, `issuePolicyToken` and
`issueTimeToken`, which emit the canonical message and refuse claims a
verifier would reject and a kid that does not match the key. Never log a
token, a nonce, a key or a footer.

## 12. Decisions

1. **Footer matched as bytes, not parsed as JSON.**
2. **SHA-256 kids, not PASERK `k4.pid`** (BLAKE2b is on no client platform).
3. **Strict time format** (`YYYY-MM-DDTHH:MM:SSZ`, year >= 1970).
4. **Canonical base64url and canonical claims** (§4.0), so two byte strings
   never mean the same token and every parser sees the same document.
5. **Purposes separated** by `typ` and assertion prefix, and unlock and
   policy also by key. Time tokens share the unlock key (they carry the
   unlock revocation list), so no third key has to be pinned.
6. **Strict Ed25519** including a prime-order subgroup check on A and R, so
   cofactored and cofactorless libraries agree.
7. **`dur_s` capped at 7200 s** (the largest guardian-link cap) and at
   `exp - iat`.
8. **Release issuers are `https://host` without a port**; self-hosters on a
   non-default port put a reverse proxy in front.
9. **Floor raised only from signed time** (anchors and `iat`), never from the
   wall clock.
10. **Anchor taken at the send instant** of a nonce-bound request, accepted
    within 60 s.
11. **At most 32 revocations per time token**, with `complete: false` instead
    of truncation; an incomplete list forces revalidation of everything.
12. **`includeSubdomains` is a required member** of domain scopes rather than
    an optional one, so the canonical form has a single spelling.

## 13. Open questions

1. Policy token lifetime (30 days) and what a client enforces once its last
   policy has expired offline (proposal: keep enforcing it; only tightening
   is ever applied without a fresh policy).
2. Whether an unlock `scope` of kind `rule` (lift one rule everywhere) is
   wanted; it is deliberately absent from v1.
3. The exact content of `pol` (proposal: SHA-256 of the policy token's
   message bytes) is fixed by work package S3.
4. Exact QR payload format for enrolment (`{code, issuer, kids}`) is fixed by
   the dashboard work package.
