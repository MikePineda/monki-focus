// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  ENROLLMENT_CODE_PATTERN,
  enrollmentCodeDigests,
  enrollmentCodeFromBytes,
  isEnrollmentCode,
} from '#domain/devices/enrollment_code'

const PEPPER = 'test-pepper-not-real'

test.group('Enrolment code', () => {
  test('test_a_code_is_eight_base32_characters_from_forty_random_bits', ({ assert }) => {
    assert.equal(enrollmentCodeFromBytes(Uint8Array.of(0, 0, 0, 0, 0)), 'AAAAAAAA')
    assert.equal(enrollmentCodeFromBytes(Uint8Array.of(255, 255, 255, 255, 255)), '77777777')
    assert.match(enrollmentCodeFromBytes(Uint8Array.of(1, 2, 3, 4, 5)), ENROLLMENT_CODE_PATTERN)
    assert.throws(() => enrollmentCodeFromBytes(Uint8Array.of(1, 2, 3, 4)))
  })

  test('test_only_uppercase_base32_of_exactly_eight_characters_is_a_code', ({ assert }) => {
    assert.isTrue(isEnrollmentCode('ABCD2345'))
    for (const value of ['abcd2345', 'ABCD234', 'ABCD23456', 'ABCD2018', 'ABCD-234', 42, null]) {
      assert.isFalse(isEnrollmentCode(value), String(value))
    }
  })

  test('test_codes_sharing_the_lookup_part_share_the_lookup_digest_only', ({ assert }) => {
    const first = enrollmentCodeDigests('ABCDEFGH', PEPPER)
    const second = enrollmentCodeDigests('ABCZZZZZ', PEPPER)
    const other = enrollmentCodeDigests('XYZDEFGH', PEPPER)

    assert.equal(first.lookupHash, second.lookupHash)
    assert.notEqual(first.codeHash, second.codeHash)
    assert.notEqual(first.lookupHash, other.lookupHash)
    assert.match(first.codeHash, /^[0-9a-f]{64}$/)
  })

  test('test_digests_depend_on_the_instance_secret', ({ assert }) => {
    const here = enrollmentCodeDigests('ABCDEFGH', PEPPER)
    const elsewhere = enrollmentCodeDigests('ABCDEFGH', 'another-test-pepper')

    assert.notEqual(here.codeHash, elsewhere.codeHash)
    assert.notEqual(here.lookupHash, elsewhere.lookupHash)
    assert.notEqual(here.lookupHash, here.codeHash)
  })

  test('test_digesting_a_malformed_code_is_refused', ({ assert }) => {
    assert.throws(() => enrollmentCodeDigests('abcdefgh', PEPPER))
  })
})
