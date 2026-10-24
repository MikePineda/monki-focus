// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Server-side issuance of unlock and policy tokens. The issuer refuses to
 * sign anything a verifier would reject on its claims (schema, time order,
 * lifetime, duration), and refuses a signing key whose kid does not match.
 */
import type { KeyObject } from 'node:crypto'
import { checkClaimTimes } from './claim_times.ts'
import { isEd25519PrivateKey, rawPublicKey } from './ed25519_key.ts'
import { implicitAssertion } from './implicit_assertion.ts'
import { deriveKeyId } from './key_id.ts'
import { encodeKidFooter } from './kid_footer.ts'
import { canonicalPolicyClaims, isPolicyClaims, type PolicyClaims } from './policy_claims.ts'
import { signV4Public } from './sign_v4_public.ts'
import { fail, ok, type Result } from './token_error.ts'
import {
  canonicalUnlockClaims,
  isUnlockClaims,
  unlockDurationFits,
  type UnlockClaims,
} from './unlock_claims.ts'

export interface SigningKey {
  readonly kid: string
  /** Ed25519 private key; keep it in env or a secret store, never in logs. */
  readonly secretKey: KeyObject
}

function signClaims(
  purpose: 'unlock' | 'policy',
  claimsJson: string,
  claims: { readonly iss: string; readonly dev: string },
  key: SigningKey
): Result<string> {
  if (!isEd25519PrivateKey(key.secretKey) || deriveKeyId(rawPublicKey(key.secretKey)) !== key.kid) {
    return fail('invalid_input')
  }
  const assertion = implicitAssertion(purpose, claims.iss, claims.dev)
  if (!assertion.ok) {
    return assertion
  }
  return ok(
    signV4Public(
      key.secretKey,
      new TextEncoder().encode(claimsJson),
      encodeKidFooter(key.kid),
      assertion.value
    )
  )
}

export function issueUnlockToken(claims: UnlockClaims, key: SigningKey): Result<string> {
  try {
    if (!isUnlockClaims(claims)) {
      return fail('invalid_claims')
    }
    const times = checkClaimTimes(claims, 'unlock')
    if (!times.ok) {
      return times
    }
    if (!unlockDurationFits(claims, times.value)) {
      return fail('invalid_claims')
    }
    return signClaims('unlock', canonicalUnlockClaims(claims), claims, key)
  } catch {
    return fail('internal_error')
  }
}

export function issuePolicyToken(claims: PolicyClaims, key: SigningKey): Result<string> {
  try {
    if (!isPolicyClaims(claims)) {
      return fail('invalid_claims')
    }
    const times = checkClaimTimes(claims, 'policy')
    if (!times.ok) {
      return times
    }
    return signClaims('policy', canonicalPolicyClaims(claims), claims, key)
  } catch {
    return fail('internal_error')
  }
}
