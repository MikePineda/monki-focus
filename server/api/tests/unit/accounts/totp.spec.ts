// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { base32Decode, base32Encode } from '#domain/auth/base32'
import { otpauthUri } from '#domain/auth/otpauth_uri'
import { formatRecoveryCode, normalizeRecoveryCode } from '#domain/auth/recovery_code'
import { hotp, matchTotpStep, totpCode, totpStep } from '#domain/auth/totp'

/** The RFC 6238 appendix B SHA-1 seed (ASCII "1234567890" twice). */
const RFC_SEED = Buffer.from('3132333435363738393031323334353637383930', 'hex')

test.group('TOTP (RFC 6238)', () => {
  test('test_codes_match_the_rfc_6238_sha1_vectors ({$self})')
    .with([
      { time: 59, eight: '94287082' },
      { time: 1111111109, eight: '07081804' },
      { time: 1234567890, eight: '89005924' },
      { time: 2000000000, eight: '69279037' },
    ])
    .run(({ assert }, vector) => {
      assert.equal(totpCode(RFC_SEED, vector.time, 8), vector.eight)
      assert.equal(totpCode(RFC_SEED, vector.time), vector.eight.slice(2))
    })

  test('test_hotp_matches_the_rfc_4226_vectors', ({ assert }) => {
    const expected = ['755224', '287082', '359152', '969429', '338314']
    assert.deepEqual(
      expected.map((_, counter) => hotp(RFC_SEED, counter)),
      expected
    )
  })

  test('test_a_code_one_step_early_or_late_is_accepted', ({ assert }) => {
    const now = 1_800_000_000
    const step = totpStep(now)

    assert.equal(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now - 30), now, null), step - 1)
    assert.equal(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now + 30), now, null), step + 1)
  })

  test('test_a_code_two_steps_away_is_rejected', ({ assert }) => {
    const now = 1_800_000_000

    assert.isNull(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now - 60), now, null))
    assert.isNull(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now + 60), now, null))
  })

  test('test_a_used_step_or_an_older_one_is_never_accepted_again', ({ assert }) => {
    const now = 1_800_000_000
    const step = totpStep(now)

    assert.isNull(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now), now, step))
    assert.isNull(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now - 30), now, step - 1))
    assert.equal(matchTotpStep(RFC_SEED, totpCode(RFC_SEED, now + 30), now, step), step + 1)
  })

  test('test_malformed_codes_are_rejected', ({ assert }) => {
    for (const code of ['', '12345', '1234567', 'abcdef', '12 34 5x']) {
      assert.isNull(matchTotpStep(RFC_SEED, code, 1_800_000_000, null), code)
    }
  })

  test('test_spaces_inside_a_code_are_ignored', ({ assert }) => {
    const now = 1_800_000_000
    const code = totpCode(RFC_SEED, now)

    assert.equal(
      matchTotpStep(RFC_SEED, `${code.slice(0, 3)} ${code.slice(3)}`, now, null),
      totpStep(now)
    )
  })
})

test.group('Base32, otpauth URI and recovery codes', () => {
  test('test_base32_matches_the_rfc_4648_vectors', ({ assert }) => {
    assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI')
    assert.equal(base32Decode('mzxw6ytboi======')?.toString(), 'foobar')
    assert.isNull(base32Decode('not base32!'))
  })

  test('test_base32_round_trips_random_lengths', ({ assert }) => {
    for (let length = 0; length < 25; length++) {
      const bytes = Buffer.from(Array.from({ length }, (_, index) => (index * 37 + 11) % 256))
      assert.deepEqual(base32Decode(base32Encode(bytes)), bytes)
    }
  })

  test('test_the_otpauth_uri_carries_issuer_label_and_parameters', ({ assert }) => {
    const uri = otpauthUri({
      issuer: 'monki-focus',
      account: 'user@example.com',
      secret: 'MZXW6YTBOI',
    })

    assert.equal(
      uri,
      'otpauth://totp/monki-focus:user%40example.com?secret=MZXW6YTBOI&issuer=monki-focus&algorithm=SHA1&digits=6&period=30'
    )
  })

  test('test_recovery_codes_are_four_groups_and_normalise_back', ({ assert }) => {
    const code = formatRecoveryCode(Buffer.alloc(10, 7))

    assert.match(code, /^[a-z2-7]{4}(-[a-z2-7]{4}){3}$/)
    assert.equal(
      normalizeRecoveryCode(code.toUpperCase().replace(/-/g, ' ')),
      code.replace(/-/g, '')
    )
    assert.isNull(normalizeRecoveryCode('too-short'))
  })
})
