# `@monki-focus/protocol`

The cross-platform contract between monki-focus clients and the optional
server:

- [`openapi.yaml`](openapi.yaml): the device API (OpenAPI 3.1): enrolment,
  heartbeat, keys, unlock requests (create, long-poll, cancel) and bypass
  events.
- PASETO v4.public **unlock** and **policy** tokens: the normative spec is
  [`docs/protocol/unlock-tokens.md`](../../docs/protocol/unlock-tokens.md);
  `src/` is the reference implementation on `node:crypto` (no PASETO
  library), used by the server and as the model for the hand-written
  verifiers in the extension, Android and macOS.
- [`schema/`](schema): JSON Schemas (draft 2020-12) of the token claims.
- [`fixtures/`](fixtures): the conformance suite every platform runs: the
  official PASETO v4 vectors (`paseto-official/`, ISC) and the project's own
  unlock and policy vectors, signed with **TEST-ONLY** keys
  (`fixtures/keys/`, `test-key-not-real-*`).

```bash
npm test -w @monki-focus/protocol          # vectors, schemas, OpenAPI, clock and replay rules
node packages/protocol/scripts/gen-vectors.mjs          # regenerate the vectors
node packages/protocol/scripts/gen-vectors.mjs --check  # fail if they drifted
```

One concept per file in `src/`: `base64url.ts`, `pae.ts`,
`sign_v4_public.ts`, `verify_v4_public.ts`, `unlock_claims.ts`,
`policy_claims.ts`, `verify_token.ts`, `issue_token.ts`, `keyring.ts`,
`trusted_time.ts`, `unlock_receipt.ts`, `replay_ledger.ts` and friends.
Verifiers never throw; they return `{ ok: false, error: { code } }` with a
stable code from `token_error.ts`.
