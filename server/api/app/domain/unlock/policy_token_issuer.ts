// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  formatRfc3339Utc,
  issuePolicyToken,
  policyHash,
  TOKEN_PURPOSES,
  type PolicyClaims,
  type TokenErrorCode,
} from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import { isEpochSeconds, type TokenSigningContext } from '#domain/unlock/token_signing_context'

/** The policy in force for one device. */
export interface PolicyGrant {
  readonly subject: string
  readonly deviceUuid: string
  /** Monotonic version (`ver`); the caller guarantees it never decreases for a device. */
  readonly version: number
  /** IANA time zone the policy is evaluated in (`tz`). */
  readonly timeZone: string
  /** base64url SHA-256 of the canonical rule-set document (`rules_sha256`). */
  readonly rulesSha256: string
  /** `exp - iat`; defaults to and never exceeds 30 days. */
  readonly validForSeconds?: number
}

export interface PolicyIssuerContext extends TokenSigningContext {
  readonly newTokenId: () => string
}

export interface IssuedPolicyToken {
  readonly token: string
  readonly claims: PolicyClaims
  /** What the device reports as `policyHash` and unlock tokens carry as `pol`. */
  readonly policyHash: string
}

export type PolicyIssueFailure =
  | 'wrong_key_purpose'
  | 'lifetime_over_cap'
  /** `tz` is shaped like a zone but no such IANA zone exists. */
  | 'unknown_time_zone'
  | TokenErrorCode

export const POLICY_TOKEN_MAX_LIFETIME_SECONDS = TOKEN_PURPOSES.policy.maxLifetimeSeconds

/**
 * Signs a device's policy token (spec §4.2) with the policy-signing key,
 * never the unlock key: a client verifies it with its policy keyring only.
 */
export function issuePolicy(
  grant: PolicyGrant,
  context: PolicyIssuerContext
): Outcome<IssuedPolicyToken, PolicyIssueFailure> {
  const { now, signingKey } = context
  if (!isEpochSeconds(now)) return refuse('invalid_input')
  if (signingKey.purpose !== 'policy') return refuse('wrong_key_purpose')
  const validFor = grant.validForSeconds ?? POLICY_TOKEN_MAX_LIFETIME_SECONDS
  if (
    !Number.isSafeInteger(validFor) ||
    validFor < 1 ||
    validFor > POLICY_TOKEN_MAX_LIFETIME_SECONDS
  ) {
    return refuse('lifetime_over_cap')
  }
  if (!isKnownTimeZone(grant.timeZone)) return refuse('unknown_time_zone')

  const iat = formatRfc3339Utc(now)
  const claims: PolicyClaims = {
    v: 1,
    typ: 'policy',
    iss: context.issuer,
    sub: grant.subject,
    dev: grant.deviceUuid,
    ver: grant.version,
    tz: grant.timeZone,
    rules_sha256: grant.rulesSha256,
    iat,
    nbf: iat,
    exp: formatRfc3339Utc(now + validFor),
    jti: context.newTokenId(),
  }
  const signed = issuePolicyToken(claims, signingKey, { profile: context.profile })
  if (!signed.ok) return refuse(signed.error.code)
  const hash = policyHash(claims)
  if (hash === null) return refuse('invalid_claims')
  return succeed({ token: signed.value, claims, policyHash: hash })
}

/** Whether the runtime's time-zone database knows `zone` (pure: no clock, no I/O). */
function isKnownTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}
