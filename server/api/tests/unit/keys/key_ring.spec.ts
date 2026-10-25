// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  activeKeyOf,
  prunableKeys,
  retiredKeyGraceSeconds,
  RETIRED_KEY_MARGIN_SECONDS,
} from '#domain/keys/key_ring'
import { keySetEtag, publicKeySet } from '#domain/keys/key_set'
import type { SigningKeyRecord } from '#domain/keys/signing_key_record'

const NOW = 1_767_603_600
const base = { createdAt: NOW - 1000, retiredAt: null, endorsement: null }
const unlockActive: SigningKeyRecord = {
  ...base,
  kid: 'cSp-101RbV5gF033',
  purpose: 'unlock',
  publicKey: 'L23rOqTypEZIepvzXn968SgiDvRhMC6Nhnoep16yh-M',
  status: 'active',
  endorsement: 'v4.public.synthetic-endorsement',
}
const unlockRetired: SigningKeyRecord = {
  ...base,
  kid: 'TBcVoSLeuybFEOuV',
  purpose: 'unlock',
  publicKey: 'ibDxdHNJceOTAtsk5y2uaEoedZYLDS9pmr8tPrjLOE0',
  status: 'retired',
  createdAt: NOW - 5000,
  retiredAt: NOW - 1000,
}
const policyActive: SigningKeyRecord = {
  ...base,
  kid: 'jAhwHvW_LqKC2uK3',
  purpose: 'policy',
  publicKey: 'TdnyPDA2J9dRFCn5BkJOIQH7pJDmqFj3RH74d1_yn_w',
  status: 'active',
}
const records = [policyActive, unlockRetired, unlockActive]

test.group('Key ring', () => {
  test('test_only_active_key_signs', ({ assert }) => {
    assert.equal(activeKeyOf(records, 'unlock')?.kid, unlockActive.kid)
    assert.equal(activeKeyOf(records, 'policy')?.kid, policyActive.kid)
    assert.isUndefined(activeKeyOf([unlockRetired], 'unlock'))
  })

  test('test_retired_key_is_published_until_pruned', ({ assert }) => {
    const set = publicKeySet('https://focus.example.org', records)

    assert.deepEqual(
      set.keys.map((key) => [key.purpose, key.status, key.kid]),
      [
        ['unlock', 'active', unlockActive.kid],
        ['unlock', 'retired', unlockRetired.kid],
        ['policy', 'active', policyActive.kid],
      ]
    )
  })

  test('test_retired_key_is_prunable_only_after_its_grace', ({ assert }) => {
    const unlockGrace = 4 * 3600 + 60 + RETIRED_KEY_MARGIN_SECONDS
    assert.equal(retiredKeyGraceSeconds('unlock'), unlockGrace)
    assert.equal(retiredKeyGraceSeconds('policy'), 30 * 86400 + 60 + RETIRED_KEY_MARGIN_SECONDS)

    const retiredAt = unlockRetired.retiredAt!
    assert.deepEqual(prunableKeys(records, retiredAt + unlockGrace - 1), [])
    assert.deepEqual(prunableKeys(records, retiredAt + unlockGrace), [unlockRetired])
  })

  test('test_force_prunes_every_retired_key_and_never_an_active_one', ({ assert }) => {
    assert.deepEqual(prunableKeys(records, NOW, { force: true }), [unlockRetired])
  })

  test('test_published_keys_carry_only_public_members_and_the_endorsement', ({ assert }) => {
    const set = publicKeySet('https://focus.example.org', records)

    assert.deepEqual(set.keys[0], {
      kid: unlockActive.kid,
      purpose: 'unlock',
      kty: 'OKP',
      crv: 'Ed25519',
      x: unlockActive.publicKey,
      status: 'active',
      endorsement: 'v4.public.synthetic-endorsement',
    })
    assert.notProperty(set.keys[1], 'endorsement')
  })

  test('test_key_set_etag_changes_with_every_key_change', ({ assert }) => {
    const etag = keySetEtag(publicKeySet('https://focus.example.org', records))

    assert.match(etag, /^"[A-Za-z0-9_-]{27}"$/)
    assert.equal(
      etag,
      keySetEtag(publicKeySet('https://focus.example.org', [...records].reverse()))
    )
    assert.notEqual(
      etag,
      keySetEtag(publicKeySet('https://focus.example.org', [unlockActive, policyActive]))
    )
  })
})
