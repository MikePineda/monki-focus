// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The policy hash a device reports in its heartbeat (`policyHash`) and an
 * unlock token carries as `pol`: the unpadded base64url SHA-256 of the
 * signed policy token's message, i.e. of the canonical serialisation of its
 * claims (spec §4.0). Server and clients compute it from the same bytes, so
 * a device that runs anything but the signed policy reports a different
 * hash.
 */
import { createHash } from 'node:crypto'
import { canonicalPolicyMessage } from './canonical_claims.ts'
import { isPolicyClaims, type PolicyClaims } from './policy_claims.ts'

/** `null` when `claims` are not valid policy claims. */
export function policyHash(claims: PolicyClaims): string | null {
  if (!isPolicyClaims(claims)) {
    return null
  }
  const message = canonicalPolicyMessage(claims)
  return message === null ? null : createHash('sha256').update(message, 'utf8').digest('base64url')
}
