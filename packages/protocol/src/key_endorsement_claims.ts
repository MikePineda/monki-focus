// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Claims of a key endorsement token (`typ: "key"`, spec §2 "Rotation").
 * When the server rotates the signing key of one purpose, the previous
 * active key of that purpose signs this token about the new key, so a
 * client that pins the old key can adopt the new one without trusting TLS
 * or the `/keys` response:
 *
 *   {"v":1,"typ":"key","iss":…,"use":…,"kid":…,"x":…,"iat":…,"nbf":…,"exp":…}
 *
 * `use` is the key purpose (`unlock` or `policy`), `x` the new raw 32-byte
 * public key in unpadded base64url and `kid` its key id. `exp - iat` is at
 * most 90 days.
 */
import { ISSUER_MAX_LENGTH, ISSUER_PATTERN, KEY_ID_PATTERN } from './claim_formats.ts'
import { hasExactlyKeys, isPatternString, isPlainObject, isRfc3339Utc } from './claim_shape.ts'
import type { KeyPurpose } from './token_purpose.ts'

export interface KeyEndorsementClaims {
  readonly v: 1
  readonly typ: 'key'
  /** Canonical origin of the issuing instance. */
  readonly iss: string
  /** Purpose of the endorsed key; equal to the endorsing key's purpose. */
  readonly use: KeyPurpose
  /** Key id of the endorsed key, derived from `x`. */
  readonly kid: string
  /** The endorsed raw 32-byte Ed25519 public key, unpadded base64url. */
  readonly x: string
  readonly iat: string
  readonly nbf: string
  readonly exp: string
}

/** Key order of the canonical serialisation (and of the schema). */
export const KEY_ENDORSEMENT_CLAIM_KEYS = [
  'v',
  'typ',
  'iss',
  'use',
  'kid',
  'x',
  'iat',
  'nbf',
  'exp',
] as const satisfies readonly (keyof KeyEndorsementClaims)[]

/** Longest `exp - iat` of an endorsement: 90 days. */
export const KEY_ENDORSEMENT_MAX_LIFETIME_SECONDS = 90 * 24 * 60 * 60

/** A raw 32-byte public key in unpadded base64url (43 characters). */
export const PUBLIC_KEY_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Versioned domain-separation prefix of the endorsement's implicit assertion. */
export const KEY_ENDORSEMENT_ASSERTION_PREFIX = 'monki-focus/key/v1'

/** Structural validation, equivalent to `schema/key-endorsement.claims.schema.json`. */
export function isKeyEndorsementClaims(value: unknown): value is KeyEndorsementClaims {
  return (
    isPlainObject(value) &&
    hasExactlyKeys(value, KEY_ENDORSEMENT_CLAIM_KEYS) &&
    value.v === 1 &&
    value.typ === 'key' &&
    isPatternString(value.iss, ISSUER_PATTERN, ISSUER_MAX_LENGTH) &&
    (value.use === 'unlock' || value.use === 'policy') &&
    isPatternString(value.kid, KEY_ID_PATTERN, 16) &&
    isPatternString(value.x, PUBLIC_KEY_BASE64URL_PATTERN, 43) &&
    isRfc3339Utc(value.iat) &&
    isRfc3339Utc(value.nbf) &&
    isRfc3339Utc(value.exp)
  )
}
