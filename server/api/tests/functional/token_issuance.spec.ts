// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  createKeyring,
  decodeBase64Url,
  parseRfc3339Utc,
  verifyPolicyToken,
  verifyTimeToken,
  verifyUnlockToken,
} from '@monki-focus/protocol'
import type { UnlockGrant } from '#domain/unlock/unlock_token_issuer'
import { unlockTokenHash } from '#domain/unlock/unlock_token_ledger'
import { isRegistrableDomain } from '#services/public_suffix_list'
import SigningKeyStore from '#services/signing_key_store'
import TokenIssuance from '#services/token_issuance'
import UnlockTokenLedgerStore, { UNLOCK_TOKENS_TABLE } from '#services/unlock_token_ledger_store'

const ISSUER = 'http://127.0.0.1:3333'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const T0 = parseRfc3339Utc('2026-01-05T09:00:00Z')!
const NONCE = 'AAECAwQFBgcICQoLDA0ODw'

const grant: UnlockGrant = {
  subject: 'user-1',
  deviceUuid: DEVICE,
  rule: 'social.video-feed',
  scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: false },
  durationSeconds: 900,
  requestUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  policyHash: 'FhXbYQzF27g8nyglmbU0-t5tCOlmD2PshdAxmVZsGuI',
}

async function setup() {
  const keys = new SigningKeyStore()
  await keys.ensureKeys(T0)
  let now = T0
  let counter = 0
  const issuance = new TokenIssuance({
    keys,
    ledger: new UnlockTokenLedgerStore(),
    identity: { issuer: ISSUER, profile: 'development' },
    now: () => now,
    lifetimeCapSeconds: 30 * 60,
    isRegistrableDomain,
    newTokenId: () => `00000000-0000-4000-8000-${(++counter).toString(16).padStart(12, '0')}`,
  })
  const published = async (purpose: 'unlock' | 'policy') => {
    const records = await keys.records()
    const keyring = createKeyring(
      purpose,
      records
        .filter((record) => record.purpose === purpose)
        .map((record) => ({ kid: record.kid, publicKey: decodeBase64Url(record.publicKey)! }))
    )
    if (!keyring.ok) throw new Error('published keys refused')
    return keyring.value
  }
  return { keys, issuance, published, advance: (seconds: number) => (now += seconds) }
}

test.group('Token issuance', () => {
  test('test_an_issued_unlock_token_verifies_and_is_recorded_by_hash_only', async ({ assert }) => {
    const { issuance, published } = await setup()

    const issued = await issuance.issueUnlock(grant)
    assert.isTrue(issued.ok)
    if (!issued.ok) return
    const verified = verifyUnlockToken(issued.value.token, {
      keyring: await published('unlock'),
      issuer: ISSUER,
      device: DEVICE,
      now: T0,
      issuerProfile: 'development',
    })
    assert.isTrue(verified.ok)

    const rows = await db.from(UNLOCK_TOKENS_TABLE).select('*')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].jti, issued.value.claims.jti)
    assert.equal(rows[0].token_hash, unlockTokenHash(issued.value.token))
    assert.equal(rows[0].device_uuid, DEVICE)
    assert.equal(rows[0].kid, issued.value.ledger.kid)
    assert.isNull(rows[0].revoked_at)
    assert.notInclude(JSON.stringify(rows), issued.value.token)
    assert.equal(rows[0].expires_at.getTime() - rows[0].issued_at.getTime(), 30 * 60 * 1000)
  })

  test('test_a_revoked_token_is_listed_in_the_next_time_token_until_it_expires', async ({
    assert,
  }) => {
    const { issuance, published, advance } = await setup()
    const issued = await issuance.issueUnlock(grant)
    assert.isTrue(issued.ok)
    if (!issued.ok) return

    const revoked = await issuance.revokeUnlock(issued.value.claims.jti)
    assert.isTrue(revoked.ok)
    assert.deepEqual(await issuance.revokeUnlock(issued.value.claims.jti), {
      ok: false,
      reason: 'already_revoked',
    })

    const answer = await issuance.issueTime({ deviceUuid: DEVICE, nonce: NONCE, boot: '41' })
    assert.isTrue(answer.ok)
    if (!answer.ok) return
    const verified = verifyTimeToken(answer.value.token, {
      keyring: await published('unlock'),
      issuer: ISSUER,
      device: DEVICE,
      nonce: NONCE,
      boot: '41',
      issuerProfile: 'development',
    })
    assert.isTrue(verified.ok)
    if (!verified.ok) return
    assert.deepEqual(verified.value.claims.revoked, [
      { jti: issued.value.claims.jti, exp: issued.value.claims.exp },
    ])
    assert.isTrue(verified.value.claims.complete)

    advance(30 * 60 + 61)
    const later = await issuance.issueTime({ deviceUuid: DEVICE, nonce: NONCE, boot: '41' })
    assert.isTrue(later.ok)
    if (later.ok) assert.deepEqual(later.value.claims.revoked, [])
  })

  test('test_revoking_an_unknown_or_malformed_jti_answers_unknown_token', async ({ assert }) => {
    const { issuance } = await setup()

    for (const jti of ['00000000-0000-4000-8000-0000000000ff', 'not-a-uuid', "' OR 1=1 --"]) {
      assert.deepEqual(await issuance.revokeUnlock(jti), { ok: false, reason: 'unknown_token' })
    }
  })

  test('test_time_tokens_list_only_this_devices_revocations', async ({ assert }) => {
    const { issuance } = await setup()
    const other = await issuance.issueUnlock({
      ...grant,
      deviceUuid: '0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a',
    })
    assert.isTrue(other.ok)
    if (!other.ok) return
    await issuance.revokeUnlock(other.value.claims.jti)

    const answer = await issuance.issueTime({ deviceUuid: DEVICE, nonce: NONCE, boot: '41' })
    assert.isTrue(answer.ok)
    if (answer.ok) assert.deepEqual(answer.value.claims.revoked, [])
  })

  test('test_policy_tokens_are_signed_with_the_policy_key', async ({ assert }) => {
    const { issuance, published } = await setup()

    const issued = await issuance.issuePolicy({
      subject: 'user-1',
      deviceUuid: DEVICE,
      version: 1,
      timeZone: 'Etc/UTC',
      rulesSha256: grant.policyHash,
    })
    assert.isTrue(issued.ok)
    if (!issued.ok) return
    const context = {
      issuer: ISSUER,
      device: DEVICE,
      now: T0,
      issuerProfile: 'development' as const,
    }

    assert.isTrue(
      verifyPolicyToken(issued.value.token, { ...context, keyring: await published('policy') }).ok
    )
    assert.deepEqual(
      verifyPolicyToken(issued.value.token, { ...context, keyring: await published('unlock') }),
      { ok: false, error: { code: 'invalid_input' } }
    )
  })

  test('test_after_a_rotation_new_tokens_use_the_new_key_and_old_ones_still_verify', async ({
    assert,
  }) => {
    const { keys, issuance, published } = await setup()
    const before = await issuance.issueUnlock(grant)
    assert.isTrue(before.ok)
    if (!before.ok) return

    const rotation = await keys.rotate(
      'unlock',
      T0,
      { issuer: ISSUER, profile: 'development' },
      { successor: 'generate', endorse: true }
    )
    const after = await issuance.issueUnlock({
      ...grant,
      requestUuid: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    })
    assert.isTrue(after.ok)
    if (!after.ok) return

    assert.equal(after.value.ledger.kid, rotation.kid)
    assert.equal(before.value.ledger.kid, rotation.retiredKid)
    const keyring = await published('unlock')
    for (const token of [before.value.token, after.value.token]) {
      assert.isTrue(
        verifyUnlockToken(token, {
          keyring,
          issuer: ISSUER,
          device: DEVICE,
          now: T0,
          issuerProfile: 'development',
        }).ok
      )
    }
  })

  test('test_the_ledger_refuses_rows_longer_than_four_hours', async ({ assert }) => {
    await assert.rejects(
      () =>
        new UnlockTokenLedgerStore().record({
          jti: '00000000-0000-4000-8000-000000000001',
          requestUuid: grant.requestUuid,
          deviceUuid: DEVICE,
          kid: 'TBcVoSLeuybFEOuV',
          tokenHash: unlockTokenHash('synthetic'),
          issuedAt: T0,
          notBefore: T0,
          expiresAt: T0 + 4 * 3600 + 1,
          revokedAt: null,
        }),
      /unlock_tokens_lifetime_check/
    )
  })
  test('test_the_ledger_row_rolls_back_with_the_callers_transaction', async ({ assert }) => {
    const { issuance } = await setup()

    await assert.rejects(() =>
      db.transaction(async (trx) => {
        const issued = await issuance.issueUnlock(grant, trx)
        assert.isTrue(issued.ok)
        throw new Error('decision rolled back')
      })
    )
    assert.lengthOf(await db.from(UNLOCK_TOKENS_TABLE).select('id'), 0)
  })
})
