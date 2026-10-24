// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Claims of a signed time token (`typ: "time"`), equivalent to
 * `schema/time-token.claims.schema.json`. The server answers a client's
 * fresh nonce with its current time and the unlock tokens it has revoked for
 * the device, signed with the unlock key, so neither the time anchor nor the
 * revocation list depends on TLS alone.
 */
import {
  BOOT_ID_PATTERN,
  DEVICE_ID_PATTERN,
  ISSUER_MAX_LENGTH,
  ISSUER_PATTERN,
  NONCE_PATTERN,
  UUID_PATTERN,
} from './claim_formats.ts'
import { hasExactlyKeys, isPatternString, isPlainObject, isRfc3339Utc } from './claim_shape.ts'

export interface RevokedToken {
  readonly jti: string
  /** The revoked token's `exp`; the client keeps the revocation until `exp + 1 day`. */
  readonly exp: string
}

export interface TimeClaims {
  readonly v: 1
  readonly typ: 'time'
  readonly iss: string
  readonly dev: string
  /** The client's nonce from the request (16 random bytes, base64url). */
  readonly nonce: string
  /** The client's boot id from the request. */
  readonly boot: string
  /** Server time when the response was signed. */
  readonly srv: string
  /** Revoked, not yet expired unlock tokens of this device. */
  readonly revoked: readonly RevokedToken[]
  /** False when the server had more revocations than fit; the client then revalidates everything. */
  readonly complete: boolean
}

export const TIME_CLAIM_KEYS = [
  'v',
  'typ',
  'iss',
  'dev',
  'nonce',
  'boot',
  'srv',
  'revoked',
  'complete',
] as const satisfies readonly (keyof TimeClaims)[]

export const MAX_REVOKED_PER_TIME_TOKEN = 32

function isRevokedToken(value: unknown): value is RevokedToken {
  return (
    isPlainObject(value) &&
    hasExactlyKeys(value, ['jti', 'exp']) &&
    isPatternString(value.jti, UUID_PATTERN, 36) &&
    isRfc3339Utc(value.exp)
  )
}

export function isTimeClaims(value: unknown): value is TimeClaims {
  return (
    isPlainObject(value) &&
    hasExactlyKeys(value, TIME_CLAIM_KEYS) &&
    value.v === 1 &&
    value.typ === 'time' &&
    isPatternString(value.iss, ISSUER_PATTERN, ISSUER_MAX_LENGTH) &&
    isPatternString(value.dev, DEVICE_ID_PATTERN, 36) &&
    isPatternString(value.nonce, NONCE_PATTERN, 22) &&
    isPatternString(value.boot, BOOT_ID_PATTERN, 64) &&
    isRfc3339Utc(value.srv) &&
    Array.isArray(value.revoked) &&
    value.revoked.length <= MAX_REVOKED_PER_TIME_TOKEN &&
    (value.revoked as unknown[]).every(isRevokedToken) &&
    typeof value.complete === 'boolean'
  )
}
