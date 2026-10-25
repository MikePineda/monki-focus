// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { parseRfc3339Utc, verifyTimeToken, verifyUnlockToken } from '@monki-focus/protocol'
import { issueTime, selectRevocations, type TimeRequest } from '#domain/unlock/time_token_issuer'
import type { TokenSigningContext } from '#domain/unlock/token_signing_context'
import type { UnlockRevocation } from '#domain/unlock/unlock_token_ledger'
import { pinnedKeyring, protocolVector, testOnlyKey } from '#tests/support/test_only_keys'

const ISSUER = 'https://focus.example.org'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const NOW = parseRfc3339Utc('2026-01-05T09:05:00Z')!
const unlockKey = testOnlyKey('test-key-not-real-unlock-a')
const policyKey = testOnlyKey('test-key-not-real-policy-a')
const request: TimeRequest = { deviceUuid: DEVICE, nonce: 'AAECAwQFBgcICQoLDA0ODw', boot: '41' }

const context = (overrides: Partial<TokenSigningContext> = {}): TokenSigningContext => ({
  issuer: ISSUER,
  profile: 'release',
  signingKey: unlockKey,
  now: NOW,
  ...overrides,
})

const jti = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const revocation = (index: number, expiresAt: number): UnlockRevocation => ({
  jti: jti(index),
  expiresAt,
})

function verify(token: string, nonce = request.nonce, boot = request.boot) {
  return verifyTimeToken(token, {
    keyring: pinnedKeyring('unlock', unlockKey),
    issuer: ISSUER,
    device: DEVICE,
    nonce,
    boot,
  })
}

test.group('Time token issuer', () => {
  test('test_time_token_verifies_bound_to_the_nonce_and_boot_the_device_sent', ({ assert }) => {
    const outcome = issueTime(request, [], context())
    assert.isTrue(outcome.ok)
    if (!outcome.ok) return

    const verified = verify(outcome.value.token)
    assert.isTrue(verified.ok)
    if (verified.ok) assert.deepEqual(verified.value.claims, outcome.value.claims)
    assert.equal(outcome.value.claims.srv, '2026-01-05T09:05:00Z')
    assert.deepEqual(verify(outcome.value.token, 'DwAODQwLCgkIBwYFBAMCAQ'), {
      ok: false,
      error: { code: 'invalid_signature' },
    })
    assert.deepEqual(verify(outcome.value.token, request.nonce, '42'), {
      ok: false,
      error: { code: 'invalid_signature' },
    })
  })

  test('test_time_signing_matches_protocol_vector_bytes_exactly', ({ assert }) => {
    const vector = protocolVector('time-tokens', 'valid_time_token')
    const outcome = issueTime(
      request,
      [
        {
          jti: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
          expiresAt: parseRfc3339Utc('2026-01-05T09:40:00Z')!,
        },
      ],
      context()
    )

    assert.isTrue(outcome.ok)
    if (outcome.ok) assert.equal(outcome.value.token, vector.token)
  })

  test('test_revocations_list_only_tokens_still_usable_within_the_skew', ({ assert }) => {
    const outcome = issueTime(
      request,
      [revocation(1, NOW - 61), revocation(2, NOW - 60), revocation(3, NOW + 600)],
      context()
    )

    assert.isTrue(outcome.ok)
    if (!outcome.ok) return
    assert.deepEqual(
      outcome.value.claims.revoked.map((item) => item.jti),
      [jti(3), jti(2)]
    )
    assert.isTrue(outcome.value.claims.complete)
  })

  test('test_exactly_32_revocations_fit_and_the_list_is_complete', ({ assert }) => {
    const all = Array.from({ length: 32 }, (_, index) => revocation(index, NOW + 60 + index))
    const outcome = issueTime(request, all, context())

    assert.isTrue(outcome.ok)
    if (!outcome.ok) return
    assert.lengthOf(outcome.value.claims.revoked, 32)
    assert.isTrue(outcome.value.claims.complete)
    assert.isTrue(verify(outcome.value.token).ok)
  })

  test('test_more_than_32_revocations_set_complete_false_and_keep_the_longest_lived', ({
    assert,
  }) => {
    const all = Array.from({ length: 40 }, (_, index) => revocation(index, NOW + 60 + index))
    const outcome = issueTime(request, all, context())

    assert.isTrue(outcome.ok)
    if (!outcome.ok) return
    assert.lengthOf(outcome.value.claims.revoked, 32)
    assert.isFalse(outcome.value.claims.complete)
    assert.equal(outcome.value.claims.revoked[0].jti, jti(39))
    assert.equal(outcome.value.claims.revoked[31].jti, jti(8))
    assert.isTrue(verify(outcome.value.token).ok)
    assert.isBelow(outcome.value.token.length, 4096)
  })

  test('test_duplicate_revocations_count_once', ({ assert }) => {
    const all = Array.from({ length: 33 }, () => revocation(7, NOW + 600))

    assert.deepEqual(selectRevocations(all, NOW), {
      listed: [revocation(7, NOW + 600)],
      complete: true,
    })
  })

  test('test_a_malformed_nonce_or_boot_is_refused', ({ assert }) => {
    for (const bad of [
      { ...request, nonce: 'short' },
      { ...request, nonce: `${request.nonce}=` },
      { ...request, boot: '41|x' },
      { ...request, boot: '' },
    ]) {
      assert.deepEqual(issueTime(bad, [], context()), { ok: false, reason: 'invalid_binding' })
    }
  })

  test('test_time_tokens_are_signed_with_the_unlock_key_only', ({ assert }) => {
    assert.deepEqual(issueTime(request, [], context({ signingKey: policyKey })), {
      ok: false,
      reason: 'wrong_key_purpose',
    })
  })

  test('test_a_time_token_never_verifies_as_an_unlock_token', ({ assert }) => {
    const outcome = issueTime(request, [], context())
    assert.isTrue(outcome.ok)
    if (!outcome.ok) return

    const asUnlock = verifyUnlockToken(outcome.value.token, {
      keyring: pinnedKeyring('unlock', unlockKey),
      issuer: ISSUER,
      device: DEVICE,
      now: NOW,
    })
    assert.deepEqual(asUnlock, { ok: false, error: { code: 'invalid_signature' } })
  })
})
