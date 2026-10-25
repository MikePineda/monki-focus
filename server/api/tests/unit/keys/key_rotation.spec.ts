// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  adoptEndorsedKey,
  createKeyring,
  decodeBase64Url,
  encodeBase64Url,
  parseRfc3339Utc,
  verifyKeyEndorsement,
  verifyUnlockToken,
  type PinnedKey,
} from '@monki-focus/protocol'
import { planKeyRotation, type KeyRotationInput } from '#domain/keys/key_rotation'
import { prunableKeys } from '#domain/keys/key_ring'
import { publicKeySet } from '#domain/keys/key_set'
import type { SigningKeyRecord } from '#domain/keys/signing_key_record'
import type { SigningKeyMaterial } from '#domain/keys/signing_key_material'
import { issueUnlock } from '#domain/unlock/unlock_token_issuer'
import {
  pinnedKeyring,
  testOnlyKey,
  testOnlyPublicSuffixCheck,
} from '#tests/support/test_only_keys'

const ISSUER = 'https://focus.example.org'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const NOW = parseRfc3339Utc('2026-01-05T09:00:00Z')!
const keyA = testOnlyKey('test-key-not-real-unlock-a')
const keyB = testOnlyKey('test-key-not-real-unlock-b')
const keyC = testOnlyKey('test-key-not-real-untrusted', 'unlock')
const policyA = testOnlyKey('test-key-not-real-policy-a')

function record(
  key: SigningKeyMaterial,
  overrides: Partial<SigningKeyRecord> = {}
): SigningKeyRecord {
  return {
    kid: key.kid,
    purpose: key.purpose,
    publicKey: encodeBase64Url(key.publicKey),
    status: 'active',
    createdAt: NOW - 86400,
    retiredAt: null,
    endorsement: null,
    ...overrides,
  }
}

function input(overrides: Partial<KeyRotationInput> = {}): KeyRotationInput {
  return {
    purpose: 'unlock',
    records: [record(keyA), record(policyA)],
    successor: keyB,
    endorser: keyA,
    issuer: ISSUER,
    profile: 'release',
    now: NOW,
    ...overrides,
  }
}

/** Applies a plan the way the store does: retire the old key, insert the successor. */
function applied(
  records: readonly SigningKeyRecord[],
  successor: SigningKeyMaterial,
  plan: { retireKid: string | null; endorsement: string | null },
  now: number
): SigningKeyRecord[] {
  return [
    ...records.map((existing) =>
      existing.kid === plan.retireKid
        ? { ...existing, status: 'retired' as const, retiredAt: now }
        : existing
    ),
    record(successor, { createdAt: now, endorsement: plan.endorsement }),
  ]
}

const asPinned = (key: SigningKeyMaterial): PinnedKey => ({
  kid: key.kid,
  publicKey: key.publicKey,
})

test.group('Key rotation', () => {
  test('test_rotation_endorsement_verifies_against_the_previous_key', ({ assert }) => {
    const plan = planKeyRotation(input())
    assert.isTrue(plan.ok)
    if (!plan.ok) return
    assert.equal(plan.value.retireKid, keyA.kid)

    const verified = verifyKeyEndorsement(plan.value.endorsement, {
      keyring: pinnedKeyring('unlock', keyA),
      issuer: ISSUER,
      now: NOW,
    })
    assert.isTrue(verified.ok)
    if (!verified.ok) return
    assert.equal(verified.value.endorserKid, keyA.kid)
    assert.equal(verified.value.claims.kid, keyB.kid)
    assert.equal(verified.value.claims.use, 'unlock')
    assert.equal(verified.value.times.exp - verified.value.times.iat, 90 * 86400)
  })

  test('test_endorsement_chain_carries_a_client_across_two_rotations', ({ assert }) => {
    // A -> B, then (after pruning A) B -> C: a client that pinned A follows both.
    const first = planKeyRotation(input())
    assert.isTrue(first.ok)
    if (!first.ok) return
    let records = applied(input().records, keyB, first.value, NOW)
    const later = NOW + 2 * 86400
    records = records.filter((key) => !prunableKeys(records, later).includes(key))
    const second = planKeyRotation(input({ records, successor: keyC, endorser: keyB, now: later }))
    assert.isTrue(second.ok)
    if (!second.ok) return

    const afterFirst = adoptEndorsedKey('unlock', [asPinned(keyA)], first.value.endorsement, {
      issuer: ISSUER,
      now: later,
    })
    assert.isTrue(afterFirst.ok)
    if (!afterFirst.ok) return
    const afterSecond = adoptEndorsedKey(
      'unlock',
      afterFirst.value.pinned,
      second.value.endorsement,
      {
        issuer: ISSUER,
        now: later,
      }
    )
    assert.isTrue(afterSecond.ok)
    if (!afterSecond.ok) return
    assert.deepEqual(
      afterSecond.value.pinned.map((key) => key.kid),
      [keyB.kid, keyC.kid]
    )
  })

  test('test_an_endorsement_never_lets_a_client_skip_a_rotation', ({ assert }) => {
    const first = planKeyRotation(input())
    assert.isTrue(first.ok)
    if (!first.ok) return
    let records = applied(input().records, keyB, first.value, NOW)
    records = records.filter((key) => !prunableKeys(records, NOW, { force: true }).includes(key))
    const second = planKeyRotation(input({ records, successor: keyC, endorser: keyB }))
    assert.isTrue(second.ok)
    if (!second.ok) return

    // A client that pins only A cannot adopt C directly: B endorsed C.
    assert.deepEqual(
      adoptEndorsedKey('unlock', [asPinned(keyA)], second.value.endorsement, {
        issuer: ISSUER,
        now: NOW,
      }),
      { ok: false, error: { code: 'unknown_kid' } }
    )
  })

  test('test_a_retired_key_still_verifies_its_tokens_until_pruned', ({ assert }) => {
    const token = issueUnlock(
      {
        subject: 'user-1',
        deviceUuid: DEVICE,
        rule: 'social.video-feed',
        scope: { kind: 'app', value: 'com.example.video' },
        durationSeconds: 900,
        requestUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        policyHash: 'FhXbYQzF27g8nyglmbU0-t5tCOlmD2PshdAxmVZsGuI',
      },
      {
        issuer: ISSUER,
        profile: 'release',
        signingKey: keyA,
        now: NOW,
        lifetimeCapSeconds: 3600,
        isRegistrableDomain: testOnlyPublicSuffixCheck(),
        newTokenId: () => '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b',
      }
    )
    assert.isTrue(token.ok)
    if (!token.ok) return
    const plan = planKeyRotation(input())
    assert.isTrue(plan.ok)
    if (!plan.ok) return
    const records = applied(input().records, keyB, plan.value, NOW + 60)

    // A device building its keyring from the published set still verifies A's token.
    const published = publicKeySet(ISSUER, records).keys.filter((key) => key.purpose === 'unlock')
    assert.deepEqual(
      published.map((key) => [key.kid, key.status]),
      [
        [keyB.kid, 'active'],
        [keyA.kid, 'retired'],
      ]
    )
    const keyring = createKeyring(
      'unlock',
      published.map((key) => ({ kid: key.kid, publicKey: decodeBase64Url(key.x)! }))
    )
    assert.isTrue(keyring.ok)
    if (!keyring.ok) return
    const verified = verifyUnlockToken(token.value.token, {
      keyring: keyring.value,
      issuer: ISSUER,
      device: DEVICE,
      now: NOW + 120,
    })
    assert.isTrue(verified.ok)
  })

  test('test_rotation_is_refused_while_a_retired_key_is_still_published', ({ assert }) => {
    const records = [
      record(keyB),
      record(keyA, { status: 'retired', retiredAt: NOW - 60 }),
      record(policyA),
    ]

    assert.deepEqual(planKeyRotation(input({ records, successor: keyC, endorser: keyB })), {
      ok: false,
      reason: 'retired_key_pending',
    })
  })

  test('test_the_first_key_of_a_purpose_needs_no_endorsement', ({ assert }) => {
    assert.deepEqual(planKeyRotation(input({ records: [], endorser: null })), {
      ok: true,
      value: { retireKid: null, endorsement: null },
    })
  })

  test('test_an_unendorsed_rotation_retires_the_key_without_an_endorsement', ({ assert }) => {
    assert.deepEqual(planKeyRotation(input({ endorser: null })), {
      ok: true,
      value: { retireKid: keyA.kid, endorsement: null },
    })
  })

  test('test_only_the_active_key_of_the_purpose_endorses', ({ assert }) => {
    assert.deepEqual(planKeyRotation(input({ endorser: keyC })), {
      ok: false,
      reason: 'endorser_not_active',
    })
    assert.deepEqual(planKeyRotation(input({ endorser: policyA })), {
      ok: false,
      reason: 'purpose_mismatch',
    })
    assert.deepEqual(
      planKeyRotation(input({ successor: testOnlyKey('test-key-not-real-policy-b') })),
      { ok: false, reason: 'purpose_mismatch' }
    )
  })

  test('test_a_key_the_instance_already_has_is_never_a_successor', ({ assert }) => {
    assert.deepEqual(planKeyRotation(input({ successor: keyA })), {
      ok: false,
      reason: 'successor_already_known',
    })
  })

  test('test_policy_rotation_never_touches_the_unlock_key', ({ assert }) => {
    const policyB = testOnlyKey('test-key-not-real-policy-b')
    const plan = planKeyRotation(
      input({ purpose: 'policy', successor: policyB, endorser: policyA })
    )

    assert.isTrue(plan.ok)
    if (!plan.ok) return
    assert.equal(plan.value.retireKid, policyA.kid)
    const verified = verifyKeyEndorsement(plan.value.endorsement, {
      keyring: pinnedKeyring('unlock', keyA),
      issuer: ISSUER,
      now: NOW,
    })
    assert.deepEqual(verified, { ok: false, error: { code: 'unknown_kid' } })
  })
})
