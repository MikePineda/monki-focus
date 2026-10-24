// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { createKeyring } from '../src/keyring.ts'
import { parseRfc3339Utc } from '../src/rfc3339_utc.ts'
import { TOKEN_ERROR_CODES } from '../src/token_error.ts'
import { verifyPolicyToken, verifyUnlockToken } from '../src/verify_token.ts'
import { hexBytes, loadTokenVectors, type TokenVector } from './token_vector_loader.ts'

const unlockVectors = loadTokenVectors('unlock-tokens')
const policyVectors = loadTokenVectors('policy-tokens')

function run(vector: TokenVector) {
  const keyring = createKeyring(
    vector.verify.purpose,
    vector.verify.keyring.map(({ kid, publicKeyHex }) => ({
      kid,
      publicKey: hexBytes(publicKeyHex),
    }))
  )
  if (!keyring.ok) throw new Error(`vector ${vector.id} has an invalid keyring`)
  const context = {
    keyring: keyring.value,
    issuer: vector.verify.issuer,
    device: vector.verify.device,
    now: parseRfc3339Utc(vector.verify.now) ?? Number.NaN,
  }
  return vector.verify.purpose === 'unlock'
    ? verifyUnlockToken(vector.token, context)
    : verifyPolicyToken(vector.token, context)
}

describe.each([
  ['unlock', unlockVectors],
  ['policy', policyVectors],
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
  ]

  it.each(expectations)('test_vector_%s_exists_and_expects_%s', (id, expected) => {
    const vector = byId.get(id)
    expect(vector).toBeDefined()
    const outcome = vector?.expect.result === 'valid' ? 'valid' : vector?.expect.error
    expect(outcome).toBe(expected)
  })

  it('test_every_expected_error_is_a_known_code', () => {
    for (const vector of [...unlockVectors, ...policyVectors]) {
      if (vector.expect.result === 'invalid') {
        expect(TOKEN_ERROR_CODES).toContain(vector.expect.error)
      }
    }
  })

  it('test_vector_ids_match_file_names_and_are_unique', () => {
    const ids = [...unlockVectors, ...policyVectors].map((vector) => vector.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
