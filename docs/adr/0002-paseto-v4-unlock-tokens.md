# ADR 0002: PASETO v4.public for unlock and policy tokens

- Status: accepted
- Date: 2026-10-25
- Supersedes: an earlier draft that proposed compact JWS with EdDSA

## Context

When a guardian approves an unlock, the server issues a token that a client
must verify **offline**, on four platforms (WebCrypto in a browser service
worker, `node:crypto`, Kotlin, Swift). Signed policies use the same mechanism.
Mature token libraries do not exist on every platform, so each verifier is
written by hand, and a hand-written verifier must be hard to get wrong.

The first draft used compact JWS with `alg: EdDSA` (RFC 8037), with `alg`
pinned on clients and shared test vectors.

## Decision

Use **PASETO v4.public** (Ed25519) with a small purpose-built verifier on each
platform: pre-authentication encoding (PAE) plus the platform's Ed25519
primitive, tested against the official PASETO test vectors and the project's
own vectors in `packages/protocol`.

- The token carries a versioned footer with the key id and is verified with an
  **implicit assertion** `"monki-focus/unlock/v1|" + iss + "|" + dev`, which
  binds it to the instance and the device without putting that data in the
  token.
- Claims, clock and replay rules are specified in
  [threat-model.md](../threat-model.md) §3 and, from WP 0.3, in
  `docs/protocol/unlock-tokens.md`.
- Unlock and policy tokens use different `typ` values and different keys.

## Why not JWS

- **No algorithm header.** JWS verifiers read `alg` from attacker-controlled
  input; algorithm confusion (`none`, HMAC with a public key) is a classic
  failure of hand-rolled JWS. PASETO's version and purpose (`v4.public`) fix
  the algorithm, so there is nothing to negotiate or forget to pin.
- **Nothing to parse before verifying.** A JWS verifier must base64-decode and
  JSON-parse the header to find `alg` and `kid` before checking the signature.
  PASETO signs a PAE of the header, payload, footer and implicit assertion, so
  the verifier checks the signature over raw bytes first and parses claims only
  after it succeeds.
- **Implicit assertions** give device binding for free; JWS has no equivalent
  and would need an extra claim check that each platform could skip.
- The cost is the same either way: the verifier is written by hand on every
  platform. PASETO's verifier is shorter and its official vectors cover the
  edge cases.

## Consequences

- Four small verifiers to maintain, all driven by the same vectors; a vector
  change breaks every platform at once, by design.
- Server-side signing uses `node:crypto` without a library.
- Tooling such as JWT debuggers does not apply; the project ships its own
  vector generator and documentation.
