// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { createKeyring } from '../src/keyring.ts'
import { parseRfc3339Utc } from '../src/rfc3339_utc.ts'
import { TOKEN_ERROR_CODES } from '../src/token_error.ts'
import { TOKEN_PURPOSES } from '../src/token_purpose.ts'
import { verifyPolicyToken, verifyTimeToken, verifyUnlockToken } from '../src/verify_token.ts'
import { hexBytes, loadTokenVectors, type TokenVector } from './token_vector_loader.ts'

const unlockVectors = loadTokenVectors('unlock-tokens')
const policyVectors = loadTokenVectors('policy-tokens')
const timeVectors = loadTokenVectors('time-tokens')

/** What every platform does with a vector: build the keyring (its failure is the result), then verify. */
function run(vector: TokenVector) {
  const { purpose } = vector.verify
  const keyring = createKeyring(
    TOKEN_PURPOSES[purpose].keyPurpose,
    vector.verify.keyring.map(({ kid, publicKeyHex }) => ({
      kid,
      publicKey: hexBytes(publicKeyHex),
    }))
  )
  if (!keyring.ok) return keyring
  const binding = {
    keyring: keyring.value,
    issuer: vector.verify.issuer,
    device: vector.verify.device,
  }
  if (purpose === 'time') {
    return verifyTimeToken(vector.token, {
      ...binding,
      nonce: vector.verify.nonce ?? '',
      boot: vector.verify.boot ?? '',
    })
  }
  const context = { ...binding, now: parseRfc3339Utc(vector.verify.now ?? '') ?? Number.NaN }
  return purpose === 'unlock'
    ? verifyUnlockToken(vector.token, context)
    : verifyPolicyToken(vector.token, context)
}

describe.each([
  ['unlock', unlockVectors],
  ['policy', policyVectors],
  ['time', timeVectors],
] as const)('shared %s-token vectors', (_purpose, vectors) => {
  it.each(vectors.map((vector) => [vector.id, vector] as const))('%s', (_id, vector) => {
    const result = run(vector)
    if (vector.expect.result === 'valid') {
      expect(result).toMatchObject({
        ok: true,
        value: { kid: vector.expect.kid, claims: vector.expect.claims },
      })
    } else {
      expect(result).toEqual({ ok: false, error: { code: vector.expect.error } })
    }
  })
})

describe('shared vector coverage', () => {
  const byId = new Map(unlockVectors.map((vector) => [vector.id, vector]))
  const expectations: [string, string][] = [
    ['valid_unlock_token', 'valid'],
    ['expired_unlock_token_is_rejected_offline', 'expired'],
    ['not_yet_valid_unlock_token_is_rejected', 'not_yet_valid'],
    ['tampered_payload_is_rejected', 'invalid_signature'],
    ['tampered_footer_is_rejected', 'invalid_signature'],
    ['token_for_other_device_fails_implicit_assertion', 'invalid_signature'],
    ['token_from_other_issuer_fails_implicit_assertion', 'invalid_signature'],
    ['unknown_kid_is_rejected', 'unknown_kid'],
    ['policy_claims_presented_as_unlock_fail_typ', 'wrong_typ'],
    ['unlock_token_lifetime_over_four_hours_is_rejected', 'lifetime_too_long'],
    ['malformed_base64url_with_padding_is_rejected', 'malformed_base64url'],
    ['v4_local_header_is_rejected', 'wrong_header'],
    ['v3_public_header_is_rejected', 'wrong_header'],
    ['capitalised_header_is_rejected', 'wrong_header'],
    ['footer_naming_one_pinned_key_signed_by_the_other_is_rejected', 'invalid_signature'],
    ['unlock_duration_below_sixty_seconds_is_rejected', 'invalid_claims'],
    ['unlock_duration_over_120_minutes_is_rejected', 'invalid_claims'],
    ['nbf_equal_to_exp_is_rejected', 'invalid_claims'],
    ['leap_second_is_rejected', 'invalid_claims'],
    ['leap_day_in_a_common_year_is_rejected', 'invalid_claims'],
    ['leap_day_in_a_leap_year_is_valid', 'valid'],
    ['year_before_1970_is_rejected', 'invalid_claims'],
    ['token_over_4096_bytes_is_rejected', 'malformed_token'],
    ['token_with_three_parts_after_the_header_is_rejected', 'malformed_token'],
    ['token_with_trailing_dot_is_rejected', 'malformed_token'],
    ['token_with_trailing_newline_is_rejected', 'malformed_token'],
    ['body_of_63_bytes_is_rejected', 'malformed_token'],
    ['signed_empty_message_is_rejected', 'invalid_claims'],
    ['footer_kid_of_15_characters_is_rejected', 'malformed_footer'],
    ['footer_kid_of_17_characters_is_rejected', 'malformed_footer'],
    ['footer_with_extra_member_is_rejected', 'malformed_footer'],
    ['signature_scalar_plus_group_order_is_rejected', 'invalid_signature'],
    ['small_order_pinned_key_is_refused', 'invalid_input'],
    ['non_canonical_claims_with_version_written_as_1_0_are_rejected', 'invalid_claims'],
    ['non_canonical_claims_with_version_written_as_1e0_are_rejected', 'invalid_claims'],
    ['non_canonical_claims_with_duplicate_member_are_rejected', 'invalid_claims'],
    ['non_canonical_claims_with_whitespace_are_rejected', 'invalid_claims'],
    ['non_canonical_claims_with_escaped_character_are_rejected', 'invalid_claims'],
    ['non_canonical_claims_with_reordered_members_are_rejected', 'invalid_claims'],
    ['path_scope_with_dot_segment_is_rejected', 'invalid_claims'],
    ['path_scope_with_dot_dot_segment_is_rejected', 'invalid_claims'],
    ['path_scope_with_percent_segment_is_rejected', 'invalid_claims'],
    ['path_scope_with_empty_segment_is_rejected', 'invalid_claims'],
    ['path_scope_with_backslash_is_rejected', 'invalid_claims'],
  ]

  it.each(expectations)('test_vector_%s_exists_and_expects_%s', (id, expected) => {
    const vector = byId.get(id)
    expect(vector).toBeDefined()
    const outcome = vector?.expect.result === 'valid' ? 'valid' : vector?.expect.error
    expect(outcome).toBe(expected)
  })

  it('test_every_expected_error_is_a_known_code', () => {
    for (const vector of [...unlockVectors, ...policyVectors, ...timeVectors]) {
      if (vector.expect.result === 'invalid') {
        expect(TOKEN_ERROR_CODES).toContain(vector.expect.error)
      }
    }
  })

  it('test_vector_ids_match_file_names_and_are_unique', () => {
    const ids = [...unlockVectors, ...policyVectors, ...timeVectors].map((vector) => vector.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
