// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Claims of an unlock token (`typ: "unlock"`), equivalent to
 * `schema/unlock-token.claims.schema.json`. A guardian-approved unlock lets
 * one exact scope through for `dur_s` seconds; it is valid to activate in
 * `[nbf, exp]` (with clock skew) and is bound to one device.
 */
import {
  DEVICE_ID_PATTERN,
  ISSUER_MAX_LENGTH,
  ISSUER_PATTERN,
  RULE_ID_PATTERN,
  SCOPE_APP_MAX_LENGTH,
  SCOPE_APP_PATTERN,
  SCOPE_DOMAIN_MAX_LENGTH,
  SCOPE_DOMAIN_PATTERN,
  SCOPE_PATH_MAX_LENGTH,
  SCOPE_PATH_PATTERN,
  SHA256_BASE64URL_PATTERN,
  SUBJECT_PATTERN,
  UUID_PATTERN,
} from './claim_formats.ts'
import type { ClaimTimes } from './claim_times.ts'
import {
  hasExactlyKeys,
  isIntegerInRange,
  isPatternString,
  isPlainObject,
  isRfc3339Utc,
} from './claim_shape.ts'

export type UnlockScope =
  | { readonly kind: 'domain'; readonly value: string }
  | { readonly kind: 'path'; readonly value: string }
  | { readonly kind: 'app'; readonly value: string }

export interface UnlockClaims {
  /** Claims format version. */
  readonly v: 1
  readonly typ: 'unlock'
  /** Canonical origin of the issuing instance. */
  readonly iss: string
  /** User id on the instance. */
  readonly sub: string
  /** Device uuid the unlock is for. */
  readonly dev: string
  /** Rule id the unlock lifts. */
  readonly rule: string
  /** Exactly what is unlocked; never a wildcard. */
  readonly scope: UnlockScope
  /** Length of the unlock once activated, in seconds. */
  readonly dur_s: number
  readonly iat: string
  readonly nbf: string
  readonly exp: string
  /** Token id (UUID), the replay-store key. */
  readonly jti: string
  /** Unlock request uuid this token answers. */
  readonly req: string
  /** base64url SHA-256 of the signed policy the request was made under. */
  readonly pol: string
}

/** Key order of the canonical serialisation (and of the schema). */
export const UNLOCK_CLAIM_KEYS = [
  'v',
  'typ',
  'iss',
  'sub',
  'dev',
  'rule',
  'scope',
  'dur_s',
  'iat',
  'nbf',
  'exp',
  'jti',
  'req',
  'pol',
] as const satisfies readonly (keyof UnlockClaims)[]

export const UNLOCK_MIN_DURATION_SECONDS = 60
export const UNLOCK_MAX_DURATION_SECONDS = 2 * 60 * 60

const SCOPE_FORMATS = {
  domain: { pattern: SCOPE_DOMAIN_PATTERN, maxLength: SCOPE_DOMAIN_MAX_LENGTH },
  path: { pattern: SCOPE_PATH_PATTERN, maxLength: SCOPE_PATH_MAX_LENGTH },
  app: { pattern: SCOPE_APP_PATTERN, maxLength: SCOPE_APP_MAX_LENGTH },
} as const

function isUnlockScope(value: unknown): value is UnlockScope {
  if (!isPlainObject(value) || !hasExactlyKeys(value, ['kind', 'value'])) {
    return false
  }
  const kind = value.kind
  if (kind !== 'domain' && kind !== 'path' && kind !== 'app') {
    return false
  }
  const format = SCOPE_FORMATS[kind]
  return isPatternString(value.value, format.pattern, format.maxLength)
}

/** Structural validation, equivalent to the JSON Schema. */
export function isUnlockClaims(value: unknown): value is UnlockClaims {
  return (
    isPlainObject(value) &&
    hasExactlyKeys(value, UNLOCK_CLAIM_KEYS) &&
    value.v === 1 &&
    value.typ === 'unlock' &&
    isPatternString(value.iss, ISSUER_PATTERN, ISSUER_MAX_LENGTH) &&
    isPatternString(value.sub, SUBJECT_PATTERN, 64) &&
    isPatternString(value.dev, DEVICE_ID_PATTERN, 36) &&
    isPatternString(value.rule, RULE_ID_PATTERN, 64) &&
    isUnlockScope(value.scope) &&
    isIntegerInRange(value.dur_s, UNLOCK_MIN_DURATION_SECONDS, UNLOCK_MAX_DURATION_SECONDS) &&
    isRfc3339Utc(value.iat) &&
    isRfc3339Utc(value.nbf) &&
    isRfc3339Utc(value.exp) &&
    isPatternString(value.jti, UUID_PATTERN, 36) &&
    isPatternString(value.req, UUID_PATTERN, 36) &&
    isPatternString(value.pol, SHA256_BASE64URL_PATTERN, 43)
  )
}

/** Semantic rule beyond the schema: the unlock cannot outlast the token. */
export function unlockDurationFits(claims: UnlockClaims, times: ClaimTimes): boolean {
  return claims.dur_s <= times.exp - times.iat
}

/** The claims serialised in canonical key order (what the issuer signs). */
export function canonicalUnlockClaims(claims: UnlockClaims): string {
  return JSON.stringify({
    v: claims.v,
    typ: claims.typ,
    iss: claims.iss,
    sub: claims.sub,
    dev: claims.dev,
    rule: claims.rule,
    scope: { kind: claims.scope.kind, value: claims.scope.value },
    dur_s: claims.dur_s,
    iat: claims.iat,
    nbf: claims.nbf,
    exp: claims.exp,
    jti: claims.jti,
    req: claims.req,
    pol: claims.pol,
  })
}
