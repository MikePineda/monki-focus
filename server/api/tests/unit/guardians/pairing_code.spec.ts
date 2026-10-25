// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  PAIRING_CODE_MAX_ATTEMPTS,
  PAIRING_CODE_PATTERN,
  isPairingCode,
  normalizePairingCode,
  pairingCodeDigests,
  pairingCodeFromInteger,
  pairingCodeState,
  pairingCodeTtlMinutes,
} from '#domain/guardians/pairing_code'

const PEPPER = 'test-pepper-not-real'
const T0 = new Date('2026-01-05T09:00:00Z')
const minutes = (count: number) => new Date(T0.getTime() + count * 60_000)

test.group('Pairing code', () => {
  test('test_code_is_six_digits_zero_padded', ({ assert }) => {
    assert.equal(pairingCodeFromInteger(0), '000000')
    assert.equal(pairingCodeFromInteger(42), '000042')
    assert.equal(pairingCodeFromInteger(999_999), '999999')
    assert.match(pairingCodeFromInteger(123_456), PAIRING_CODE_PATTERN)
    for (const bad of [-1, 1_000_000, 1.5, Number.NaN]) {
      assert.throws(() => pairingCodeFromInteger(bad), RangeError)
    }
  })

  test('test_only_six_ascii_digits_are_a_code', ({ assert }) => {
    assert.isTrue(isPairingCode('012345'))
    for (const value of ['12345', '1234567', '12345a', '١٢٣٤٥٦', '123 456', 123456, null]) {
      assert.isFalse(isPairingCode(value), String(value))
    }
  })

  test('test_a_typed_code_may_carry_spaces_or_a_dash', ({ assert }) => {
    assert.equal(normalizePairingCode(' 123 456 '), '123456')
    assert.equal(normalizePairingCode('123-456'), '123456')
    assert.isNull(normalizePairingCode('12 34 5'))
    assert.isNull(normalizePairingCode('abcdef'))
  })

  test('test_code_locks_after_five_failed_attempts', ({ assert }) => {
    const code = { expiresAt: minutes(10), usedAt: null }

    assert.equal(PAIRING_CODE_MAX_ATTEMPTS, 5)
    assert.equal(pairingCodeState({ ...code, attempts: 4 }, T0), 'pending')
    assert.equal(pairingCodeState({ ...code, attempts: 5 }, T0), 'locked')
  })

  test('test_pairing_code_expires_after_10_minutes', ({ assert }) => {
    const code = { expiresAt: minutes(pairingCodeTtlMinutes(undefined)), usedAt: null, attempts: 0 }

    assert.equal(pairingCodeTtlMinutes(undefined), 10)
    assert.equal(pairingCodeTtlMinutes(3), 3)
    assert.equal(pairingCodeState(code, minutes(9)), 'pending')
    assert.equal(pairingCodeState(code, minutes(10)), 'expired')
  })

  test('test_a_used_code_never_works_again', ({ assert }) => {
    assert.equal(
      pairingCodeState({ expiresAt: minutes(10), usedAt: minutes(1), attempts: 1 }, minutes(2)),
      'used'
    )
  })

  test('test_codes_sharing_the_lookup_part_share_the_lookup_digest_only', ({ assert }) => {
    const first = pairingCodeDigests('123456', PEPPER)
    const second = pairingCodeDigests('123999', PEPPER)
    const other = pairingCodeDigests('999456', PEPPER)

    assert.equal(first.lookupHash, second.lookupHash)
    assert.notEqual(first.codeHash, second.codeHash)
    assert.notEqual(first.lookupHash, other.lookupHash)
    assert.match(first.codeHash, /^[0-9a-f]{64}$/)
  })

  test('test_pairing_digests_depend_on_the_secret_and_differ_from_enrolment', ({ assert }) => {
    const here = pairingCodeDigests('123456', PEPPER)
    const elsewhere = pairingCodeDigests('123456', 'another-test-pepper')

    assert.notEqual(here.codeHash, elsewhere.codeHash)
    assert.notEqual(here.lookupHash, here.codeHash)
    assert.throws(() => pairingCodeDigests('12345', PEPPER))
  })
})
