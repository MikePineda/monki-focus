// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import {
  canonicalPolicyMessage,
  parseRfc3339Utc,
  verifyPolicyToken,
  verifyUnlockToken,
} from '@monki-focus/protocol'
import {
  issuePolicy,
  type PolicyGrant,
  type PolicyIssuerContext,
} from '#domain/unlock/policy_token_issuer'
import { pinnedKeyring, protocolVector, testOnlyKey } from '#tests/support/test_only_keys'

const ISSUER = 'https://focus.example.org'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const NOW = parseRfc3339Utc('2026-01-05T08:00:00Z')!
const policyKey = testOnlyKey('test-key-not-real-policy-a')
const unlockKey = testOnlyKey('test-key-not-real-unlock-a')

const grant: PolicyGrant = {
  subject: 'user-1',
  deviceUuid: DEVICE,
  version: 7,
  timeZone: 'Etc/UTC',
  rulesSha256: createHash('sha256').update('monki-focus synthetic rule set v1').digest('base64url'),
}

function context(overrides: Partial<PolicyIssuerContext> = {}): PolicyIssuerContext {
  return {
    issuer: ISSUER,
    profile: 'release',
    signingKey: policyKey,
    now: NOW,
    newTokenId: () => '9c8b7a6f-5e4d-4c3b-8a29-18f7e6d5c4b3',
    ...overrides,
  }
}

test.group('Policy token issuer', () => {
  test('test_policy_token_verifies_with_the_policy_keyring_and_binds_every_claim', ({ assert }) => {
    const outcome = issuePolicy(grant, context())
    assert.isTrue(outcome.ok)
    if (!outcome.ok) return
    const verified = verifyPolicyToken(outcome.value.token, {
      keyring: pinnedKeyring('policy', policyKey),
      issuer: ISSUER,
      device: DEVICE,
      now: NOW,
    })

    assert.isTrue(verified.ok)
    if (!verified.ok) return
    assert.deepEqual(verified.value.claims, outcome.value.claims)
    assert.deepInclude(verified.value.claims, {
      sub: 'user-1',
      ver: 7,
      tz: 'Etc/UTC',
      rules_sha256: grant.rulesSha256,
      iat: '2026-01-05T08:00:00Z',
      nbf: '2026-01-05T08:00:00Z',
      exp: '2026-02-04T08:00:00Z',
    })
  })

  test('test_policy_signing_matches_protocol_vector_bytes_exactly', ({ assert }) => {
    const vector = protocolVector('policy-tokens', 'valid_policy_token')
    const outcome = issuePolicy({ ...grant, validForSeconds: 7 * 24 * 60 * 60 }, context())

    assert.isTrue(outcome.ok)
    if (outcome.ok) assert.equal(outcome.value.token, vector.token)
  })

  test('test_policy_hash_is_the_sha256_of_the_canonical_message', ({ assert }) => {
    const outcome = issuePolicy(grant, context())
    assert.isTrue(outcome.ok)
    if (!outcome.ok) return
    const expected = createHash('sha256')
      .update(canonicalPolicyMessage(outcome.value.claims)!)
      .digest('base64url')

    assert.equal(outcome.value.policyHash, expected)
  })

  test('test_policy_tokens_are_never_signed_with_the_unlock_key', ({ assert }) => {
    assert.deepEqual(issuePolicy(grant, context({ signingKey: unlockKey })), {
      ok: false,
      reason: 'wrong_key_purpose',
    })
  })

  test('test_policy_token_never_verifies_with_the_unlock_keyring', ({ assert }) => {
    const outcome = issuePolicy(grant, context())
    assert.isTrue(outcome.ok)
    if (!outcome.ok) return

    const asUnlock = verifyUnlockToken(outcome.value.token, {
      keyring: pinnedKeyring('unlock', unlockKey),
      issuer: ISSUER,
      device: DEVICE,
      now: NOW,
    })
    assert.deepEqual(asUnlock, { ok: false, error: { code: 'unknown_kid' } })
  })

  test('test_policy_lifetime_is_capped_at_thirty_days', ({ assert }) => {
    assert.deepEqual(issuePolicy({ ...grant, validForSeconds: 30 * 86400 + 1 }, context()), {
      ok: false,
      reason: 'lifetime_over_cap',
    })
  })

  test('test_an_unknown_time_zone_is_refused', ({ assert }) => {
    assert.deepEqual(issuePolicy({ ...grant, timeZone: 'Nowhere/Example_Zone' }, context()), {
      ok: false,
      reason: 'unknown_time_zone',
    })
    assert.isTrue(issuePolicy({ ...grant, timeZone: 'America/New_York' }, context()).ok)
  })

  test('test_a_version_outside_1_to_2_pow_31_is_refused', ({ assert }) => {
    for (const version of [0, 2 ** 31, 1.5]) {
      assert.deepEqual(issuePolicy({ ...grant, version }, context()), {
        ok: false,
        reason: 'invalid_claims',
      })
    }
  })
})
