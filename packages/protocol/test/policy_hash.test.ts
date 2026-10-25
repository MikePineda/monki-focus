// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { PolicyClaims } from '../src/policy_claims.ts'
import { policyHash } from '../src/policy_hash.ts'
import { loadTokenVectors } from './token_vector_loader.ts'

const valid = loadTokenVectors('policy-tokens').find((vector) => vector.id === 'valid_policy_token')
if (valid === undefined) throw new Error('missing valid_policy_token')
const claims = JSON.parse(valid.construction.claimsJson) as PolicyClaims

describe('policyHash', () => {
  it('test_policy_hash_is_sha256_of_the_signed_message_bytes', () => {
    const expected = createHash('sha256').update(valid.construction.claimsJson).digest('base64url')
    expect(policyHash(claims)).toBe(expected)
  })

  it('test_policy_hash_does_not_depend_on_member_order_of_the_parsed_claims', () => {
    const reordered = Object.fromEntries(
      Object.entries(claims).reverse()
    ) as unknown as PolicyClaims
    expect(policyHash(reordered)).toBe(policyHash(claims))
  })

  it('test_policy_hash_changes_with_any_claim', () => {
    expect(policyHash({ ...claims, ver: claims.ver + 1 })).not.toBe(policyHash(claims))
  })

  it('test_invalid_policy_claims_have_no_hash', () => {
    expect(policyHash({ ...claims, tz: 'not a zone' })).toBeNull()
  })
})
