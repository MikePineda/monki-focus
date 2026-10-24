// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Server-side issuance of unlock, policy and time tokens. The issuer signs
 * exactly the canonical serialisation (spec §4.0) and refuses anything a
 * verifier would reject on its claims (schema, time order, lifetime,
 * duration), and a signing key whose kid does not match.
 */
import type { KeyObject } from 'node:crypto'
import {
  canonicalPolicyMessage,
  canonicalTimeMessage,
  canonicalUnlockMessage,
} from './canonical_claims.ts'
import { checkClaimTimes } from './claim_times.ts'
import { isEd25519PrivateKey, rawPublicKey } from './ed25519_key.ts'
import {
  implicitAssertion,
  type AssertionBinding,
  type IssuerProfile,
} from './implicit_assertion.ts'
import { deriveKeyId } from './key_id.ts'
import { encodeKidFooter } from './kid_footer.ts'
import { isPolicyClaims, type PolicyClaims } from './policy_claims.ts'
import type { IsRegistrableDomain } from './registrable_domain.ts'
import { signV4Public } from './sign_v4_public.ts'
import { isTimeClaims, type TimeClaims } from './time_claims.ts'
import { fail, ok, type Result } from './token_error.ts'
import type { TokenPurpose } from './token_purpose.ts'
import { isUnlockClaims, unlockDurationFits, type UnlockClaims } from './unlock_claims.ts'

export interface IssueOptions {
  /** Defaults to `release` (https issuers only). */
  readonly profile?: IssuerProfile
  /**
   * Public Suffix List check, required to sign a domain scope with
   * `includeSubdomains: true` (without it such claims are refused).
   */
  readonly isRegistrableDomain?: IsRegistrableDomain
}

export interface SigningKey {
  readonly kid: string
  /** Ed25519 private key; keep it in env or a secret store, never in logs. */
  readonly secretKey: KeyObject
}

function signMessage(
  purpose: TokenPurpose,
  message: string | null,
  binding: AssertionBinding,
  key: SigningKey,
  profile: IssuerProfile
): Result<string> {
  if (message === null) {
    return fail('invalid_claims')
  }
  if (!isEd25519PrivateKey(key.secretKey) || deriveKeyId(rawPublicKey(key.secretKey)) !== key.kid) {
    return fail('invalid_input')
  }
  const assertion = implicitAssertion(purpose, binding, profile)
  if (!assertion.ok) {
    return assertion
  }
  return ok(
    signV4Public(
      key.secretKey,
      new TextEncoder().encode(message),
      encodeKidFooter(key.kid),
      assertion.value
    )
  )
}

export function issueUnlockToken(
  claims: UnlockClaims,
  key: SigningKey,
  options: IssueOptions = {}
): Result<string> {
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
    if (claims.scope.kind === 'domain' && claims.scope.includeSubdomains) {
      if (options.isRegistrableDomain === undefined) {
        return fail('invalid_input')
      }
      if (!options.isRegistrableDomain(claims.scope.value)) {
        return fail('invalid_claims')
      }
    }
    const binding = { issuer: claims.iss, device: claims.dev }
    return signMessage(
      'unlock',
      canonicalUnlockMessage(claims),
      binding,
      key,
      options.profile ?? 'release'
    )
  } catch {
    return fail('internal_error')
  }
}

export function issuePolicyToken(
  claims: PolicyClaims,
  key: SigningKey,
  options: IssueOptions = {}
): Result<string> {
  try {
    if (!isPolicyClaims(claims)) {
      return fail('invalid_claims')
    }
    const times = checkClaimTimes(claims, 'policy')
    if (!times.ok) {
      return times
    }
    const binding = { issuer: claims.iss, device: claims.dev }
    return signMessage(
      'policy',
      canonicalPolicyMessage(claims),
      binding,
      key,
      options.profile ?? 'release'
    )
  } catch {
    return fail('internal_error')
  }
}

export function issueTimeToken(
  claims: TimeClaims,
  key: SigningKey,
  options: IssueOptions = {}
): Result<string> {
  try {
    if (!isTimeClaims(claims)) {
      return fail('invalid_claims')
    }
    const binding = {
      issuer: claims.iss,
      device: claims.dev,
      nonce: claims.nonce,
      boot: claims.boot,
    }
    return signMessage(
      'time',
      canonicalTimeMessage(claims),
      binding,
      key,
      options.profile ?? 'release'
    )
  } catch {
    return fail('internal_error')
  }
}
