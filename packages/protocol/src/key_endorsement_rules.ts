// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Semantic rules of a key endorsement beyond its schema, shared by the
 * issuer (which refuses to sign a violation) and the verifier:
 *
 *   1. `x` is a canonical 32-byte key that passes the strict Ed25519 key
 *      checks (§1.1), and `kid` is derived from it;
 *   2. a key never endorses itself;
 *   3. `iat <= nbf < exp` (`invalid_claims`) and `exp - iat <= 90 days`
 *      (`lifetime_too_long`).
 */
import type { ClaimTimes } from './claim_times.ts'
import { decodeBase64Url } from './base64url.ts'
import { publicKeyFromRaw } from './ed25519_key.ts'
import { deriveKeyId } from './key_id.ts'
import {
  KEY_ENDORSEMENT_MAX_LIFETIME_SECONDS,
  type KeyEndorsementClaims,
} from './key_endorsement_claims.ts'
import { parseRfc3339Utc } from './rfc3339_utc.ts'
import { fail, ok, type Result } from './token_error.ts'

export interface EndorsedKey {
  /** The endorsed raw 32-byte public key. */
  readonly publicKey: Uint8Array
  readonly times: ClaimTimes
}

export function checkKeyEndorsementRules(
  claims: KeyEndorsementClaims,
  endorserKid: string
): Result<EndorsedKey> {
  const publicKey = decodeBase64Url(claims.x)
  if (
    publicKey === null ||
    !publicKeyFromRaw(publicKey).ok ||
    deriveKeyId(publicKey) !== claims.kid ||
    claims.kid === endorserKid
  ) {
    return fail('invalid_claims')
  }
  const iat = parseRfc3339Utc(claims.iat)
  const nbf = parseRfc3339Utc(claims.nbf)
  const exp = parseRfc3339Utc(claims.exp)
  if (iat === null || nbf === null || exp === null || iat > nbf || nbf >= exp) {
    return fail('invalid_claims')
  }
  if (exp - iat > KEY_ENDORSEMENT_MAX_LIFETIME_SECONDS) {
    return fail('lifetime_too_long')
  }
  return ok({ publicKey, times: { iat, nbf, exp } })
}
