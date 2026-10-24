// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Claims of a signed policy token (`typ: "policy"`), equivalent to
 * `schema/policy-token.claims.schema.json`. The policy pins, for one device,
 * which rule set is in force (by hash), its monotonic version and the time
 * zone that "loosening applies tomorrow" is computed in. It is signed with
 * the `policy-signing` key, never with the unlock key.
 */
import {
  DEVICE_ID_PATTERN,
  ISSUER_MAX_LENGTH,
  ISSUER_PATTERN,
  SHA256_BASE64URL_PATTERN,
  SUBJECT_PATTERN,
  TIME_ZONE_MAX_LENGTH,
  TIME_ZONE_PATTERN,
  UUID_PATTERN,
} from './claim_formats.ts'
import {
  hasExactlyKeys,
  isIntegerInRange,
  isPatternString,
  isPlainObject,
  isRfc3339Utc,
} from './claim_shape.ts'

export interface PolicyClaims {
  readonly v: 1
  readonly typ: 'policy'
  readonly iss: string
  readonly sub: string
  readonly dev: string
  /** Monotonic policy version; clients refuse a lower one. */
  readonly ver: number
  /** IANA time zone of the policy. */
  readonly tz: string
  /** base64url SHA-256 of the canonical rule-set document in force. */
  readonly rules_sha256: string
  readonly iat: string
  readonly nbf: string
  readonly exp: string
  readonly jti: string
}

export const POLICY_CLAIM_KEYS = [
  'v',
  'typ',
  'iss',
  'sub',
  'dev',
  'ver',
  'tz',
  'rules_sha256',
  'iat',
  'nbf',
  'exp',
  'jti',
] as const satisfies readonly (keyof PolicyClaims)[]

export const POLICY_MAX_VERSION = 2_147_483_647

export function isPolicyClaims(value: unknown): value is PolicyClaims {
  return (
    isPlainObject(value) &&
    hasExactlyKeys(value, POLICY_CLAIM_KEYS) &&
    value.v === 1 &&
    value.typ === 'policy' &&
    isPatternString(value.iss, ISSUER_PATTERN, ISSUER_MAX_LENGTH) &&
    isPatternString(value.sub, SUBJECT_PATTERN, 64) &&
    isPatternString(value.dev, DEVICE_ID_PATTERN, 36) &&
    isIntegerInRange(value.ver, 1, POLICY_MAX_VERSION) &&
    isPatternString(value.tz, TIME_ZONE_PATTERN, TIME_ZONE_MAX_LENGTH) &&
    isPatternString(value.rules_sha256, SHA256_BASE64URL_PATTERN, 43) &&
    isRfc3339Utc(value.iat) &&
    isRfc3339Utc(value.nbf) &&
    isRfc3339Utc(value.exp) &&
    isPatternString(value.jti, UUID_PATTERN, 36)
  )
}

export function canonicalPolicyClaims(claims: PolicyClaims): string {
  return JSON.stringify({
    v: claims.v,
    typ: claims.typ,
    iss: claims.iss,
    sub: claims.sub,
    dev: claims.dev,
    ver: claims.ver,
    tz: claims.tz,
    rules_sha256: claims.rules_sha256,
    iat: claims.iat,
    nbf: claims.nbf,
    exp: claims.exp,
    jti: claims.jti,
  })
}
