// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  pendingRevocations,
  revokeUnlockToken,
  unlockTokenHash,
  type UnlockLedgerEntry,
} from '#domain/unlock/unlock_token_ledger'
import { unlockLifetimeCapSeconds } from '#domain/unlock/unlock_lifetime'

const NOW = 1_767_603_600
const entry: UnlockLedgerEntry = {
  jti: '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b',
  requestUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  deviceUuid: '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5',
  kid: 'TBcVoSLeuybFEOuV',
  tokenHash: unlockTokenHash('v4.public.synthetic'),
  issuedAt: NOW,
  notBefore: NOW,
  expiresAt: NOW + 1800,
  revokedAt: null,
}

test.group('Unlock token ledger', () => {
  test('test_revoking_records_the_revocation_time', ({ assert }) => {
    assert.deepEqual(revokeUnlockToken(entry, NOW + 10), {
      ok: true,
      value: { ...entry, revokedAt: NOW + 10 },
    })
  })

  test('test_revoking_twice_is_refused_with_a_code', ({ assert }) => {
    assert.deepEqual(revokeUnlockToken({ ...entry, revokedAt: NOW }, NOW + 10), {
      ok: false,
      reason: 'already_revoked',
    })
  })

  test('test_a_token_past_exp_plus_skew_cannot_be_revoked_any_more', ({ assert }) => {
    assert.isTrue(revokeUnlockToken(entry, NOW + 1800 + 60).ok)
    assert.deepEqual(revokeUnlockToken(entry, NOW + 1800 + 61), {
      ok: false,
      reason: 'already_expired',
    })
  })

  test('test_pending_revocations_are_revoked_and_still_usable', ({ assert }) => {
    const entries = [
      { ...entry, jti: '00000000-0000-4000-8000-000000000001', revokedAt: NOW },
      { ...entry, jti: '00000000-0000-4000-8000-000000000002' },
      {
        ...entry,
        jti: '00000000-0000-4000-8000-000000000003',
        revokedAt: NOW,
        expiresAt: NOW - 61,
      },
    ]

    assert.deepEqual(pendingRevocations(entries, NOW), [
      { jti: '00000000-0000-4000-8000-000000000001', expiresAt: NOW + 1800 },
    ])
  })

  test('test_token_hash_is_lowercase_hex_sha256', ({ assert }) => {
    assert.equal(
      unlockTokenHash('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  test('test_unlock_lifetime_is_min_of_setting_and_240_minutes', ({ assert }) => {
    assert.equal(unlockLifetimeCapSeconds(undefined), 120 * 60)
    assert.equal(unlockLifetimeCapSeconds(30), 30 * 60)
    assert.equal(unlockLifetimeCapSeconds(240), 240 * 60)
    assert.equal(unlockLifetimeCapSeconds(10_000), 240 * 60)
    assert.equal(unlockLifetimeCapSeconds(0), 120 * 60)
  })
})
