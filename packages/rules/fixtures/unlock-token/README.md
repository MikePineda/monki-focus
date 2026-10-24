# `unlock-token` fixtures: placeholder

`unlock-token` is a reserved fixture kind. Its vectors (PASETO v4.public unlock
tokens with a test public key, `now`, `deviceId` and the expected verdict
`valid | expired | bad_signature | wrong_device | wrong_scope | replayed_nonce`)
live in **`packages/protocol`** (`@monki-focus/protocol`), next to the token
schemas, so that the token format has one source of truth.

This directory stays empty on purpose:

- `fixture.schema.json` rejects any fixture whose `kind` is `unlock-token`;
- `loadFixtures('unlock-token')` throws and points to `packages/protocol`;
- a test asserts that this README is the only file here.

The decision engine never verifies tokens. Adapters verify them first and pass
only verified unlocks (`VerifiedUnlock` in `decision-context.schema.json`); see
the `decision.valid_unlock_allows_blocked_target` and
`decision.expired_unlock_is_ignored` fixtures.
