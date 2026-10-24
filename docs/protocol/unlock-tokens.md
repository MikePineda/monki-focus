# Unlock and policy tokens (PASETO v4.public)

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
zone. Both are PASETO v4.public tokens; this document defines everything a
platform needs to verify them with nothing but SHA-256, Ed25519 and a JSON
parser.

## 1. Token format

```text
token  = "v4.public." base64url(message || signature) "." base64url(footer)
m2     = PAE("v4.public.", message, footer, implicit_assertion)
signature = Ed25519-Sign(secret_key, m2)          ; 64 bytes, RFC 8032
```

- **Header.** Exactly the ten bytes `v4.public.`. Any other header
  (`v4.local.`, `v3.public.`, `V4.public.`) MUST be rejected with
  `wrong_header` before anything else is decoded. There is no algorithm field
  to read or negotiate.
- **Message.** The claims, UTF-8 JSON (section 4). It is not interpreted until
  the signature has verified.
- **Footer.** Always present, exactly `{"kid":"<kid>"}` (section 2).
- **Encoding.** base64url per RFC 4648 §5, without padding, **canonical**:
  verifiers MUST reject padding (`=`), characters outside `A-Z a-z 0-9 - _`,
  a part whose length is 4n+1, and any encoding whose unused trailing bits are
  not zero. The simplest correct check is "decode, re-encode without padding,
  compare with the input". Exactly one `.` separates body and footer; a token
  with more parts, an empty body or an empty footer after a trailing `.` is
  `malformed_token`.
- **Length.** A token is at most 4096 characters; longer input is
  `malformed_token` without further work. The decoded body is at least 64
  bytes (the signature).
- **PAE** (pre-authentication encoding, from the PASETO spec):
  `PAE(p1..pn) = LE64(n) || LE64(len(p1)) || p1 || ... || LE64(len(pn)) || pn`,
  where `LE64` is an unsigned 64-bit little-endian integer with the top bit
  cleared. Every vector carries `construction.paeHex`, the exact `m2` bytes,
  so an implementation can compare its PAE before it compares signatures.

## 2. Key ids and keys

- A key id is the first 16 characters of the unpadded base64url SHA-256 of
  the raw 32-byte Ed25519 public key (`kid = b64url(SHA-256(pk))[0..16)`).
- The footer is matched **byte for byte** against
  `^\{"kid":"([A-Za-z0-9_-]{16})"\}$`: no whitespace, no other keys, no JSON
  parser. It is the only part read before the signature check (to select the
  key), and it is still authenticated because the footer is inside `m2`.
- **Separate keys per purpose.** `unlock-signing` signs unlock tokens and
  `policy-signing` signs policy tokens. A client keeps one keyring per
  purpose and MUST NOT verify a token with a keyring of another purpose.
- **Pinning.** The first key of each purpose is pinned at enrolment (trust on
  first use over TLS; the dashboard and the device both show the kid so the
  user can compare). A keyring entry whose kid is not derived from its key
  MUST be refused.
- **At most two active kids** per purpose. A keyring with zero or more than two
  keys is invalid input.
- **Rotation.** A new key is announced in `GET /keys` with an `endorsement`: a
  v4.public token of `typ: "key"`, signed by the **previous active key of the
  same purpose**, with footer `{"kid":"<old kid>"}` and implicit assertion
  `"monki-focus/key/v1|" + iss + "|" + purpose`, whose claims are
  `{v: 1, typ: "key", iss, use: purpose, kid, x, iat, nbf, exp}` (`x` is the
  new raw public key in base64url, `exp - iat` at most 90 days). A client
  adopts the new key only if the endorsement verifies against a key it
  already pins and `kid` is derived from `x`; it then keeps the endorsing key
  and the new key and drops any other. Clients refresh `/keys` when the
  heartbeat's `keysEtag` changes, or once when a token names an unknown kid.
  The server keeps a retired key published for the longest token lifetime
  plus 24 hours. _Endorsement tokens are specified here and in `openapi.yaml`;
  their reference implementation and vectors land with work package S3._
- **Compromise.** A leaked signing key cannot be rotated away (its holder could
  endorse a key of their own). Recovery is re-pairing every device, which
  pins a fresh key over TLS.

## 3. Implicit assertion

```text
unlock: "monki-focus/unlock/v1|" + iss + "|" + dev
policy: "monki-focus/policy/v1|" + iss + "|" + dev
```

The verifier builds the assertion from **its own** pinned issuer and **its
own** device uuid, never from the token. A token issued for another device or
by another instance therefore fails the signature check
(`invalid_signature`), and the prefix separates the purposes even if a key
were ever shared by mistake. `iss` and `dev` cannot contain `|` (their
formats forbid it), so the concatenation is unambiguous; a verifier given an
issuer or device that does not match its format MUST fail with
`invalid_input`.

## 4. Claims

All claims are required and no others are allowed (`additionalProperties:
false`). Machine-readable schemas (JSON Schema draft 2020-12):
[`unlock-token.claims.schema.json`](../../packages/protocol/schema/unlock-token.claims.schema.json),
[`policy-token.claims.schema.json`](../../packages/protocol/schema/policy-token.claims.schema.json).

### 4.1 Unlock token (`typ: "unlock"`)

| Claim   | Type    | Format and meaning                                                                                                |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `v`     | integer | Always `1`.                                                                                                       |
| `typ`   | string  | Always `"unlock"`.                                                                                                |
| `iss`   | string  | Canonical instance origin: lowercase `https://host[:port]`, no path or trailing slash (`http` only for loopback). |
| `sub`   | string  | User id on the instance, `^[A-Za-z0-9_-]{1,64}$`.                                                                 |
| `dev`   | string  | Device uuid (lowercase canonical UUID). Equals the device verifying it.                                           |
| `rule`  | string  | Id of the rule being lifted, `^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`.                                                |
| `scope` | object  | `{kind, value}`: `domain` (exact hostname, two or more labels), `path` (exact host plus literal segments), `app`. |
| `dur_s` | integer | Length of the unlock once activated, 60 to 7200 seconds, and at most `exp - iat`.                                 |
| `iat`   | string  | Issued at, server time.                                                                                           |
| `nbf`   | string  | Not before, server time; `iat <= nbf`.                                                                            |
| `exp`   | string  | Expiry, server time; `nbf < exp` and `exp - iat <= 4 h`.                                                          |
| `jti`   | string  | Token id (UUID, 128 bits), the replay-store key.                                                                  |
| `req`   | string  | Uuid of the unlock request this token answers.                                                                    |
| `pol`   | string  | base64url SHA-256 of the signed policy in force when the request was made (the heartbeat's `policyHash`).         |

A scope is always exact: no `*`, no query string, no fragment, no trailing
slash, no single-label host. There is no "unlock everything" scope.

### 4.2 Policy token (`typ: "policy"`)

| Claim                      | Type    | Format and meaning                                                         |
| -------------------------- | ------- | -------------------------------------------------------------------------- |
| `v`, `typ`                 |         | `1` and `"policy"`.                                                        |
| `iss`, `sub`, `dev`, `jti` |         | As for unlock tokens.                                                      |
| `ver`                      | integer | Monotonic policy version, 1 to 2^31 - 1. A client MUST refuse a lower one. |
| `tz`                       | string  | IANA time zone the policy is evaluated in (`Etc/UTC`, `America/New_York`). |
| `rules_sha256`             | string  | base64url SHA-256 of the canonical rule-set document in force.             |
| `iat`, `nbf`, `exp`        | string  | As for unlock tokens, but `exp - iat <= 30 days`.                          |

### 4.3 Time format

`iat`, `nbf` and `exp` are PASETO registered claims, which the PASETO spec
defines as ISO 8601 date-times. monki-focus restricts them to one shape,
`YYYY-MM-DDTHH:MM:SSZ`: UTC, whole seconds, no offset, no fraction, year
1970 or later, no leap second, and a day that exists in its month
(`2026-02-30` is invalid). Parse them with the published pattern plus a
calendar check, not with a lenient date parser.

### 4.4 Semantic rules beyond the schema

1. `iat <= nbf < exp` (else `invalid_claims`).
2. `exp - iat <= 14400` for unlock and `<= 2592000` for policy tokens (else
   `lifetime_too_long`).
3. Unlock only: `dur_s <= exp - iat` (else `invalid_claims`).
4. `iss` equals the pinned issuer (`issuer_mismatch`) and `dev` equals this
   device (`device_mismatch`). The implicit assertion already enforces both;
   the claim check is defence in depth against an issuer bug.
5. Trusted now (section 6) is within `[nbf - 60 s, exp + 60 s]` (else
   `not_yet_valid` or `expired`). The ±60 s is the only clock-skew tolerance.

## 5. Verification algorithm

Every platform MUST run these steps in this order and return the first
failing code, so that all of them agree on every vector. Implementations MUST
NOT throw on any input: every failure, including unexpected internal errors
(`internal_error`), is a returned value and is treated as a rejection.

| #   | Step                                                                             | Failure code                             |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Inputs: keyring of this purpose, issuer and device in their formats, integer now | `invalid_input`                          |
| 2   | Token is a string of at most 4096 characters                                     | `malformed_token`                        |
| 3   | Header is exactly `v4.public.`                                                   | `wrong_header`                           |
| 4   | One body and at most one footer part; strict base64url; body at least 64 bytes   | `malformed_token`, `malformed_base64url` |
| 5   | Footer present and exactly `{"kid":"<16 chars>"}`                                | `malformed_footer`                       |
| 6   | Kid is in the keyring                                                            | `unknown_kid`                            |
| 7   | Ed25519 verify of the signature over `PAE(header, message, footer, assertion)`   | `invalid_signature`                      |
| 8   | Message is UTF-8 (strict) and parses as a JSON object                            | `invalid_claims`                         |
| 9   | `typ` equals the purpose                                                         | `wrong_typ`                              |
| 10  | Claims match the schema (including the calendar check)                           | `invalid_claims`                         |
| 11  | `iss` and `dev` equal the pinned issuer and this device                          | `issuer_mismatch`, `device_mismatch`     |
| 12  | `iat <= nbf < exp`                                                               | `invalid_claims`                         |
| 13  | `exp - iat` within the purpose lifetime                                          | `lifetime_too_long`                      |
| 14  | Unlock: `dur_s <= exp - iat`                                                     | `invalid_claims`                         |
| 15  | Trusted now in `[nbf - 60 s, exp + 60 s]`                                        | `not_yet_valid`, `expired`               |

**Nothing is parsed before step 7.** Steps 2 to 6 only split, compare and
decode bytes. A verifier that parses the claims (or anything but the footer
shape) before the signature verifies is non-conforming.

Error codes are stable reason codes (`TOKEN_ERROR_CODES` in
[`token_error.ts`](../../packages/protocol/src/token_error.ts)). Clients map
them to i18n keys; they never show raw codes or free text.

## 6. Trusted time

The wall clock belongs to the user. Every client computes **trusted now**:

```text
trusted_now = max(wall_now, anchor.server_time + (mono_now - anchor.mono_at))
```

- The **anchor** is `(server_time, mono_at, boot_count)` from the last
  authenticated server response: the heartbeat's `serverTime`, or a verified
  token's `iat` on receipt (whichever is newer).
- **Monotonic time** is the boot-relative clock: Android
  `SystemClock.elapsedRealtime()`, macOS `mach_continuous_time()` (counts
  through sleep), the extension's `trusted_time` from the Mac app, or
  `performance.now()` when the extension runs alone (residual risk: the
  service worker can be restarted, which resets it).
- **Boot count** ties monotonic readings to one boot: Android
  `Settings.Global.BOOT_COUNT`; macOS the boot session uuid
  (`kern.bootsessionuuid`), compared for equality. An anchor from another
  boot, or a monotonic reading lower than the anchor's, is ignored and
  trusted now falls back to the wall clock.
- Rewinding the wall clock therefore never makes a token look younger;
  moving it forward only makes tokens expire sooner (fails closed).

Reference: [`trusted_time.ts`](../../packages/protocol/src/trusted_time.ts).

## 7. Receipt anchoring

On receipt of a verified unlock token the client stores
`(jti, iat, nbf, exp, mono_at_receipt, boot_count)`. From then on the token
is usable only while all three hold:

1. `boot_count` equals the stored one. After a reboot the token MUST be
   revalidated online (`GET /device/unlock-requests/{uuid}` answers with the
   token again if it is still valid); offline it fails closed
   (`reboot_revalidation_required`).
2. `0 <= mono_now - mono_at_receipt <= (exp - iat) + 60 s`. This bounds the
   unlock by real elapsed time even if both the wall clock and the anchor are
   wrong.
3. Trusted now is in `[nbf - 60 s, exp + 60 s]`.

An activated unlock lasts `min(activation + dur_s, exp + 60 s)` in trusted
time. Reference: [`unlock_receipt.ts`](../../packages/protocol/src/unlock_receipt.ts).

## 8. Replay store

Clients keep a local ledger keyed by `jti` (Room on Android, SQLite/GRDB on
macOS, `storage.local` in the extension) with the states
`received → active → ended`, plus `revoked`:

- Receiving or activating a jti that is already `received` or `active` is
  **idempotent** (a retried long-poll or a second tab is not an error).
- An `ended` jti (deactivated by the user, or expired) **never becomes active
  again**: `replayed`.
- Activating after `exp + 60 s` fails with `expired`.
- Entries are purged one day after `exp`.

Reference: [`replay_ledger.ts`](../../packages/protocol/src/replay_ledger.ts).

## 9. Revocation

Every heartbeat response carries `revokedTokens: [{jti, exp}]`: unlock tokens
for this device that the server revoked and that have not expired. The client
marks each one `revoked` in the ledger, **even if it has not received that
jti yet**, so a late delivery is refused; a revoked jti is never activated
(`revoked`). Revocation needs connectivity: an offline device cannot learn of
it, which is why unlock lifetimes are short (residual risk, threat model §2).

## 10. Test vectors

| Directory                                | What                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `fixtures/paseto-official/v4.json`       | Official PASETO v4 vectors (ISC); platforms run the `v4.public` cases. |
| `fixtures/unlock-tokens/*.json`          | Unlock-token vectors, one file per case.                               |
| `fixtures/policy-tokens/*.json`          | Policy-token vectors.                                                  |
| `fixtures/keys/TEST-ONLY-*.ed25519.json` | The TEST-ONLY keys that sign the vectors (`test-key-not-real-*`).      |

Each vector file has:

- `id`: the spec-style name, also the file name;
- `token`: the exact token string;
- `verify`: `purpose`, `keyring` (`kid` and `publicKeyHex`), `issuer`,
  `device` and `now` (trusted now, RFC 3339 UTC) to verify with;
- `expect`: either `{result: "valid", kid, claims}` or
  `{result: "invalid", error}` with one code from section 5;
- `construction`: how the token was built (signing key name, the exact
  `claimsJson`, `footer`, `implicitAssertion`, `paeHex` and, for tampered
  tokens, a `tampering` note). It is informative; verifiers only need
  `token`, `verify` and `expect`.

A platform conforms when, for every file, building the keyring from
`verify.keyring` and verifying `token` gives exactly `expect`. The keys are
public on purpose: they sign nothing but these vectors and MUST NOT be pinned
by a real client.

Regenerate with `node packages/protocol/scripts/gen-vectors.mjs` (Ed25519 is
deterministic, so the output is stable); `--check` reports drift, and a test
fails when the committed files differ from the generator.

## 11. Platform notes

All platforms: split and compare bytes first, verify, then parse. Keep the
header check, the footer pattern and the base64url canonical check exactly
as above, run the official and the project vectors in the platform's test
suite, and use a constant-time comparison where bytes are compared against
an expected value.

### WebCrypto (extension service worker)

```js
const key = await crypto.subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, [
  'verify',
])
const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, m2)
```

- Ed25519 in WebCrypto is available in current Chromium-based browsers;
  check `importKey` support at startup and fail closed if it is missing.
- base64url: `atob` takes the standard alphabet with padding; translate
  `-`/`_`, add padding, decode, then re-encode and compare with the input to
  enforce canonical form.
- Parse claims with `JSON.parse` on `new TextDecoder('utf-8', { fatal: true })`
  output, only after `verify` resolves `true`.

### Kotlin (Android)

- Ed25519: Tink's `com.google.crypto.tink.subtle.Ed25519Verify(publicKey)`
  works on every supported API level (`verify(signature, m2)` throws
  `GeneralSecurityException` on failure; catch it and return
  `invalid_signature`). On a JVM 15+ (unit tests) `Signature.getInstance("Ed25519")`
  with the key wrapped as X.509 (`302a300506032b6570032100 || pk`) also works.
- base64url: `java.util.Base64.getUrlDecoder()` accepts padding and
  non-canonical trailing bits; check the alphabet and length first, then
  re-encode with `getUrlEncoder().withoutPadding()` and compare.
- `LE64`: `ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(n and Long.MAX_VALUE)`.
- Run the vectors with JUnit4 `Parameterized` over the fixture files.

### Swift (macOS)

```swift
let key = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyBytes)
let ok = key.isValidSignature(signature, for: m2)
```

- `Data(base64Encoded:)` needs the standard alphabet and padding: translate,
  pad, decode, then re-encode and compare with the input.
- CryptoKit _signing_ is randomised, so Swift cannot reproduce the vector
  tokens by signing; it only verifies them, which is all a client does.
- Run the vectors with `@Test(arguments:)` reading the fixture files via
  `#filePath`.

### Node (server)

The reference implementation uses `node:crypto` (`crypto.sign(null, m2, key)`
and `crypto.verify(null, m2, key, signature)`) with no PASETO library. The
server signs through `issueUnlockToken` / `issuePolicyToken`, which refuse
claims a verifier would reject and a kid that does not match the key. Never
log a token, a key or a footer-plus-token pair.

## 12. Decisions

Conservative choices made while writing this spec:

1. **Footer matched as bytes, not parsed as JSON.** It is read before the
   signature check; a fixed pattern leaves nothing for a parser to get wrong.
2. **SHA-256 kids, not PASERK `k4.pid`.** PASERK ids need BLAKE2b, which no
   client platform ships; the kid is an index and is checked against its key.
3. **Strict time format** (`YYYY-MM-DDTHH:MM:SSZ`) instead of general
   ISO 8601, to keep PASETO's registered-claim semantics while making
   parsing identical everywhere.
4. **Canonical base64url only**, so two strings never decode to one token.
5. **Policy and unlock purposes separated three ways:** `typ`, implicit
   assertion prefix and signing key.
6. **`dur_s` capped at 7200 s** (the largest guardian-link cap) and at
   `exp - iat`.
7. **`iss` is an origin only** (no path prefix), and plain `http` is limited
   to loopback for development.
8. **Hand-written claims validators** mirror the JSON Schemas; a test runs
   both on the same inputs so they cannot drift.
9. **Footer required** on every monki-focus token, even though PASETO makes it
   optional.

## 13. Open questions

1. Policy token lifetime (30 days) and what a client enforces once its last
   policy has expired offline (proposal: keep enforcing it; only tightening
   is ever applied without a fresh policy).
2. Whether an unlock `scope` of kind `rule` (lift one rule everywhere) is
   wanted; it is deliberately absent from v1.
3. The exact content of `pol` (proposal: SHA-256 of the policy token's
   message bytes) is fixed by work package S3.
