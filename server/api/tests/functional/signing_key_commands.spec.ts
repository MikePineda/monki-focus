// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import {
  createKeyring,
  decodeBase64Url,
  parseRfc3339Utc,
  verifyKeyEndorsement,
} from '@monki-focus/protocol'
import SigningKeyPrune from '#commands/signing_key_prune'
import SigningKeyRotate from '#commands/signing_key_rotate'
import { exportPkcs8 } from '#domain/keys/signing_key_material'
import { SIGNING_KEYS_TABLE } from '#services/signing_key_store'
import { tokenIssuerIdentity } from '#services/token_issuer_identity'

const LONG_AGO = parseRfc3339Utc('2026-01-05T09:00:00Z')!

async function run(command: typeof SigningKeyRotate | typeof SigningKeyPrune, argv: string[]) {
  const ace = await app.container.make('ace')
  const instance = await ace.create(command, argv)
  instance.ui.switchMode('raw')
  await instance.exec()
  const logs = instance.ui.logger.getLogs().map((log) => log.message)
  return { instance, logs, output: logs.join('\n') }
}

async function unlockRows() {
  return db.from(SIGNING_KEYS_TABLE).where('purpose', 'unlock').orderBy('id')
}

test.group('signing-key commands', () => {
  test('test_rotate_retires_the_active_key_and_endorses_its_successor', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)
    const [old] = await unlockRows()
    const oldMaterial = await keys.signingKey('unlock')

    const { instance, output } = await run(SigningKeyRotate, ['--purpose=unlock'])

    instance.assertSucceeded()
    const [retired, active] = await unlockRows()
    assert.equal(retired.kid, old.kid)
    assert.equal(retired.status, 'retired')
    assert.isNull(retired.private_key_encrypted)
    assert.isNotNull(retired.retired_at)
    assert.equal(active.status, 'active')
    assert.include(output, active.kid)
    assert.include(output, old.kid)

    const keyring = createKeyring('unlock', [
      { kid: old.kid, publicKey: decodeBase64Url(old.public_key)! },
    ])
    assert.isTrue(keyring.ok)
    if (!keyring.ok) return
    const verified = verifyKeyEndorsement(active.endorsement, {
      keyring: keyring.value,
      issuer: tokenIssuerIdentity().issuer,
      now: Math.floor(active.created_at.getTime() / 1000),
      issuerProfile: 'development',
    })
    assert.isTrue(verified.ok)
    if (verified.ok) assert.equal(verified.value.claims.kid, active.kid)

    // Kids only: no key material, ciphertext or token in the output.
    assert.notInclude(output, exportPkcs8(oldMaterial))
    assert.notInclude(output, active.private_key_encrypted)
    assert.notInclude(output, active.endorsement)
  })

  test('test_rotate_is_refused_while_a_retired_key_is_still_published', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)
    await run(SigningKeyRotate, ['--purpose=policy'])

    const { instance, output } = await run(SigningKeyRotate, ['--purpose=policy'])

    instance.assertFailed()
    assert.match(output, /signing-key:prune/)
    const policy = await db.from(SIGNING_KEYS_TABLE).where('purpose', 'policy')
    assert.lengthOf(policy, 2)
  })

  test('test_rotate_needs_a_known_purpose', async ({ assert }) => {
    const { instance, output } = await run(SigningKeyRotate, ['--purpose=time'])

    instance.assertFailed()
    assert.match(output, /unlock or policy/)
  })

  test('test_rotate_from_env_without_an_env_key_is_refused', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)

    const { instance, output } = await run(SigningKeyRotate, ['--purpose=unlock', '--from-env'])

    instance.assertFailed()
    assert.match(output, /UNLOCK_SIGNING_KEY/)
  })

  test('test_an_unendorsed_rotation_warns_that_devices_must_enrol_again', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)

    const { instance, output } = await run(SigningKeyRotate, ['--purpose=unlock', '--unendorsed'])

    instance.assertSucceeded()
    const [, active] = await unlockRows()
    assert.isNull(active.endorsement)
    assert.match(output, /enrolled again/)
  })

  test('test_prune_keeps_a_retired_key_until_its_tokens_have_expired', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)
    await run(SigningKeyRotate, ['--purpose=unlock'])

    const { instance, output } = await run(SigningKeyPrune, [])

    instance.assertSucceeded()
    assert.match(output, /No retired key/)
    assert.lengthOf(await unlockRows(), 2)
  })

  test('test_prune_deletes_a_retired_key_after_its_grace', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)
    const result = await keys.rotate('unlock', LONG_AGO, tokenIssuerIdentity(), {
      successor: 'generate',
      endorse: true,
    })

    const { instance, output } = await run(SigningKeyPrune, [])

    instance.assertSucceeded()
    assert.include(output, result.retiredKid!)
    const remaining = await unlockRows()
    assert.deepEqual(
      remaining.map((row) => [row.kid, row.status]),
      [[result.kid, 'active']]
    )
  })

  test('test_prune_force_deletes_every_retired_key_but_never_an_active_one', async ({ assert }) => {
    const keys = await app.container.make('signingKeys')
    await keys.ensureKeys(LONG_AGO)
    await run(SigningKeyRotate, ['--purpose=unlock'])
    await run(SigningKeyRotate, ['--purpose=policy'])

    const { instance } = await run(SigningKeyPrune, ['--force'])

    instance.assertSucceeded()
    const rows = await db.from(SIGNING_KEYS_TABLE).select('purpose', 'status')
    assert.sameDeepMembers(rows, [
      { purpose: 'unlock', status: 'active' },
      { purpose: 'policy', status: 'active' },
    ])
  })
})
