// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import { encodeBase64Url, parseRfc3339Utc } from '@monki-focus/protocol'
import { exportPkcs8 } from '#domain/keys/signing_key_material'
import SigningKeyStore, { SIGNING_KEYS_TABLE, SigningKeyError } from '#services/signing_key_store'
import { testOnlyKey } from '#tests/support/test_only_keys'

const NOW = parseRfc3339Utc('2026-01-05T09:00:00Z')!
const IDENTITY = { issuer: 'http://127.0.0.1:3333', profile: 'development' } as const
const envKey = testOnlyKey('test-key-not-real-unlock-a')

async function rows() {
  return db.from(SIGNING_KEYS_TABLE).select('*').orderBy('id')
}

async function rejection(promise: Promise<unknown>): Promise<SigningKeyError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof SigningKeyError) return error
    throw error
  }
  throw new Error('expected a SigningKeyError')
}

test.group('Signing key store', () => {
  test('test_boot_creates_one_active_key_per_purpose_once', async ({ assert }) => {
    const store = new SigningKeyStore()

    const created = await store.ensureKeys(NOW)
    assert.lengthOf(created, 2)
    assert.deepEqual(await store.ensureKeys(NOW + 60), [])

    const all = await rows()
    assert.deepEqual(
      all.map((row) => [row.purpose, row.status, row.algorithm]),
      [
        ['unlock', 'active', 'EdDSA'],
        ['policy', 'active', 'EdDSA'],
      ]
    )
    assert.notEqual(all[0].kid, all[1].kid)
    const [unlock, policy] = [await store.signingKey('unlock'), await store.signingKey('policy')]
    assert.equal(unlock.kid, all[0].kid)
    assert.equal(policy.kid, all[1].kid)
  })

  test('test_private_keys_are_encrypted_at_rest_and_bound_to_their_kid', async ({ assert }) => {
    const store = new SigningKeyStore()
    await store.ensureKeys(NOW)
    const unlock = await store.signingKey('unlock')
    const [unlockRow, policyRow] = await rows()

    assert.notInclude(unlockRow.private_key_encrypted, exportPkcs8(unlock))
    assert.isNull(encryption.decrypt(unlockRow.private_key_encrypted))
    assert.equal(
      encryption.decrypt(unlockRow.private_key_encrypted, `signing-key:unlock:${unlockRow.kid}`),
      exportPkcs8(unlock)
    )

    // Moving a ciphertext to another row never makes it decrypt as that key.
    await db
      .from(SIGNING_KEYS_TABLE)
      .where('kid', policyRow.kid)
      .update({ private_key_encrypted: unlockRow.private_key_encrypted })
    const error = await rejection(new SigningKeyStore().signingKey('policy'))
    assert.equal(error.reason, 'undecryptable')
  })

  test('test_a_key_encrypted_under_another_app_key_fails_closed', async ({ assert }) => {
    const store = new SigningKeyStore()
    await store.ensureKeys(NOW)
    await db
      .from(SIGNING_KEYS_TABLE)
      .where('purpose', 'unlock')
      .update({ private_key_encrypted: 'gcm.v1:AAAA.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA' })

    const error = await rejection(new SigningKeyStore().ensureKeys(NOW))
    assert.equal(error.reason, 'undecryptable')
    assert.match(error.message, /APP_KEY/)
  })

  test('test_a_tampered_public_key_stops_the_store', async ({ assert }) => {
    const store = new SigningKeyStore()
    await store.ensureKeys(NOW)
    await db
      .from(SIGNING_KEYS_TABLE)
      .where('purpose', 'unlock')
      .update({ public_key: encodeBase64Url(testOnlyKey('test-key-not-real-untrusted').publicKey) })

    const error = await rejection(new SigningKeyStore().records())
    assert.equal(error.reason, 'kid_mismatch')
  })

  test('test_a_small_order_public_key_is_refused_on_load', async ({ assert }) => {
    const store = new SigningKeyStore()
    await store.ensureKeys(NOW)
    const identity = encodeBase64Url(Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? 1 : 0)))
    await db.from(SIGNING_KEYS_TABLE).where('purpose', 'unlock').update({ public_key: identity })

    const error = await rejection(new SigningKeyStore().records())
    assert.equal(error.reason, 'weak_public_key')
  })

  test('test_the_database_allows_one_active_key_per_purpose', async ({ assert }) => {
    const store = new SigningKeyStore()
    await store.ensureKeys(NOW)
    const other = testOnlyKey('test-key-not-real-unlock-b')

    await assert.rejects(
      () =>
        db.table(SIGNING_KEYS_TABLE).insert({
          kid: other.kid,
          purpose: 'unlock',
          public_key: encodeBase64Url(other.publicKey),
          status: 'active',
          created_at: new Date(NOW * 1000),
        }),
      /signing_keys_one_active_per_purpose/
    )
  })

  test('test_a_retired_key_cannot_keep_its_private_key', async ({ assert }) => {
    const store = new SigningKeyStore()
    await store.ensureKeys(NOW)

    await assert.rejects(
      () =>
        db
          .from(SIGNING_KEYS_TABLE)
          .where('purpose', 'unlock')
          .update({ status: 'retired', retired_at: new Date(NOW * 1000) }),
      /signing_keys_retired_private_key_erased_check/
    )
  })

  test('test_the_env_key_becomes_the_unlock_key_without_its_private_half', async ({ assert }) => {
    const store = new SigningKeyStore({ envKey })

    assert.include(await store.ensureKeys(NOW), envKey.kid)
    const all = await rows()
    const unlockRow = all.find((row) => row.purpose === 'unlock')
    assert.equal(unlockRow.kid, envKey.kid)
    assert.isNull(unlockRow.private_key_encrypted)
    const signing = await store.signingKey('unlock')
    assert.equal(signing.kid, envKey.kid)

    // Without the env key the server cannot sign with it, and says so.
    const error = await rejection(new SigningKeyStore().signingKey('unlock'))
    assert.equal(error.reason, 'private_key_missing')
  })

  test('test_boot_refuses_an_env_key_that_is_not_the_active_unlock_key', async ({ assert }) => {
    await new SigningKeyStore().ensureKeys(NOW)

    const error = await rejection(new SigningKeyStore({ envKey }).ensureKeys(NOW))
    assert.equal(error.reason, 'env_key_not_active')
    assert.include(error.message, envKey.kid)
    assert.notInclude(error.message, exportPkcs8(envKey))
  })

  test('test_rotation_to_the_env_key_is_endorsed_by_the_current_key', async ({ assert }) => {
    const store = new SigningKeyStore({ envKey: null })
    await store.ensureKeys(NOW)
    const before = await store.signingKey('unlock')

    const result = await new SigningKeyStore({ envKey }).rotate('unlock', NOW + 60, IDENTITY, {
      successor: 'env',
      endorse: true,
    })

    assert.deepEqual(result, { kid: envKey.kid, retiredKid: before.kid, endorsed: true })
    const all = await rows()
    const unlockRows = all.filter((row) => row.purpose === 'unlock')
    assert.deepEqual(
      unlockRows.map((row) => [row.kid, row.status, row.private_key_encrypted]),
      [
        [before.kid, 'retired', null],
        [envKey.kid, 'active', null],
      ]
    )
    assert.deepEqual(await new SigningKeyStore({ envKey }).ensureKeys(NOW + 120), [])
  })

  test('test_from_env_needs_an_env_key_and_the_unlock_purpose', async ({ assert }) => {
    await new SigningKeyStore().ensureKeys(NOW)

    for (const [store, purpose] of [
      [new SigningKeyStore(), 'unlock'],
      [new SigningKeyStore({ envKey }), 'policy'],
    ] as const) {
      const error = await rejection(
        store.rotate(purpose, NOW, IDENTITY, { successor: 'env', endorse: true })
      )
      assert.equal(error.reason, 'env_key_unavailable')
    }
  })
})
