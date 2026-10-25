// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { generateKeyPairSync } from 'node:crypto'
import { deriveKeyId, encodeBase64Url } from '@monki-focus/protocol'
import { parseEnvSigningKey } from '#domain/keys/env_signing_key'
import {
  checkStoredKey,
  exportPkcs8,
  signingKeyFromPkcs8,
  signingKeyFromSecret,
} from '#domain/keys/signing_key_material'
import type { SigningKeyRecord } from '#domain/keys/signing_key_record'
import { testOnlyKey } from '#tests/support/test_only_keys'

const keyA = testOnlyKey('test-key-not-real-unlock-a')
const keyB = testOnlyKey('test-key-not-real-unlock-b')

function recordOf(publicKey: Uint8Array, kid = deriveKeyId(publicKey)): SigningKeyRecord {
  return {
    kid,
    purpose: 'unlock',
    publicKey: encodeBase64Url(publicKey),
    status: 'active',
    createdAt: 0,
    retiredAt: null,
    endorsement: null,
  }
}

/** The identity point (small order) and a non-canonical encoding of y = p + 1 (both refused by spec §1.1). */
const SMALL_ORDER = Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? 1 : 0))
const NON_CANONICAL = Uint8Array.from({ length: 32 }, (_, i) =>
  i === 0 ? 0xee : i === 31 ? 0x7f : 0xff
)

test.group('Signing key material', () => {
  test('test_a_pkcs8_round_trip_keeps_the_key_and_its_kid', ({ assert }) => {
    const imported = signingKeyFromPkcs8('unlock', exportPkcs8(keyA))

    assert.isTrue(imported.ok)
    if (!imported.ok) return
    assert.equal(imported.value.kid, keyA.kid)
    assert.deepEqual(imported.value.publicKey, keyA.publicKey)
  })

  test('test_garbage_and_non_ed25519_private_keys_are_refused', ({ assert }) => {
    const x25519 = generateKeyPairSync('x25519').privateKey
    const p256 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey

    for (const pkcs8 of ['', 'not base64url!', 'AAAA', `${exportPkcs8(keyA)}=`]) {
      assert.deepEqual(signingKeyFromPkcs8('unlock', pkcs8), {
        ok: false,
        reason: 'malformed_private_key',
      })
    }
    for (const key of [x25519, p256]) {
      assert.deepEqual(signingKeyFromSecret('unlock', key), {
        ok: false,
        reason: 'malformed_private_key',
      })
      const der = encodeBase64Url(key.export({ format: 'der', type: 'pkcs8' }))
      assert.deepEqual(signingKeyFromPkcs8('unlock', der), {
        ok: false,
        reason: 'malformed_private_key',
      })
    }
  })

  test('test_strict_key_checks_refuse_small_order_and_non_canonical_public_keys', ({ assert }) => {
    assert.deepEqual(checkStoredKey(recordOf(SMALL_ORDER)), {
      ok: false,
      reason: 'weak_public_key',
    })
    assert.deepEqual(checkStoredKey(recordOf(NON_CANONICAL)), {
      ok: false,
      reason: 'weak_public_key',
    })
    assert.deepEqual(checkStoredKey({ ...recordOf(keyA.publicKey), publicKey: 'short' }), {
      ok: false,
      reason: 'weak_public_key',
    })
  })

  test('test_a_stored_kid_must_be_derived_from_its_public_key', ({ assert }) => {
    assert.deepEqual(checkStoredKey(recordOf(keyA.publicKey, keyB.kid)), {
      ok: false,
      reason: 'kid_mismatch',
    })
    assert.isTrue(checkStoredKey(recordOf(keyA.publicKey)).ok)
  })

  test('test_a_stored_private_key_must_match_its_public_key_and_purpose', ({ assert }) => {
    assert.deepEqual(checkStoredKey(recordOf(keyA.publicKey), keyB), {
      ok: false,
      reason: 'public_key_mismatch',
    })
    assert.deepEqual(
      checkStoredKey(recordOf(keyA.publicKey), testOnlyKey('test-key-not-real-unlock-a', 'policy')),
      { ok: false, reason: 'purpose_mismatch' }
    )
    assert.isTrue(checkStoredKey(recordOf(keyA.publicKey), keyA).ok)
  })

  test('test_env_signing_key_needs_both_variables_or_neither', ({ assert }) => {
    assert.deepEqual(parseEnvSigningKey({}), { ok: true, value: null })
    assert.deepEqual(parseEnvSigningKey({ key: ' ', kid: '' }), { ok: true, value: null })
    assert.deepEqual(parseEnvSigningKey({ key: exportPkcs8(keyA) }), {
      ok: false,
      reason: 'incomplete_pair',
    })
    assert.deepEqual(parseEnvSigningKey({ kid: keyA.kid }), {
      ok: false,
      reason: 'incomplete_pair',
    })
  })

  test('test_env_signing_key_kid_must_be_the_derived_kid', ({ assert }) => {
    const parsed = parseEnvSigningKey({ key: exportPkcs8(keyA), kid: keyA.kid })
    assert.isTrue(parsed.ok)
    if (parsed.ok) assert.equal(parsed.value?.kid, keyA.kid)

    assert.deepEqual(parseEnvSigningKey({ key: exportPkcs8(keyA), kid: keyB.kid }), {
      ok: false,
      reason: 'kid_mismatch',
    })
    assert.deepEqual(parseEnvSigningKey({ key: exportPkcs8(keyA), kid: 'short' }), {
      ok: false,
      reason: 'malformed_kid',
    })
    assert.deepEqual(parseEnvSigningKey({ key: 'garbage', kid: keyA.kid }), {
      ok: false,
      reason: 'malformed_private_key',
    })
  })
})
