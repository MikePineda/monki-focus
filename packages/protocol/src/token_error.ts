// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Every way token handling can fail, as a stable reason code. Verifiers
 * return one of these codes and never throw; platforms map the code to an
 * i18n key, never to free text. The same codes appear in the shared vectors
 * (`fixtures/unlock-tokens/*.json`, `expect.error`), so every platform must
 * produce the exact code for each vector.
 */
export const TOKEN_ERROR_CODES = [
  /**
   * Not a string, longer than 4096 bytes, a byte outside 0x21-0x7E, a wrong
   * number of `.`-separated parts, or a body shorter than a signature.
   */
  'malformed_token',
  /** The header is not exactly `v4.public.` (for example `v4.local.` or `v3.public.`). */
  'wrong_header',
  /** A part is not strict, unpadded, canonical base64url. */
  'malformed_base64url',
  /** The footer is missing or is not exactly `{"kid":"<16 base64url chars>"}`. */
  'malformed_footer',
  /** Low-level verification only: the footer differs from the expected footer. */
  'footer_mismatch',
  /** The footer names a key id that is not in the pinned keyring. */
  'unknown_kid',
  /** The Ed25519 signature over PAE(header, message, footer, implicit assertion) fails. */
  'invalid_signature',
  /** The signed message is not the canonical serialisation of claims matching the schema. */
  'invalid_claims',
  /** The signed `typ` claim is not the purpose being verified. */
  'wrong_typ',
  /** The signed `iss` differs from the pinned issuer (defence in depth). */
  'issuer_mismatch',
  /** The signed `dev` differs from this device (defence in depth). */
  'device_mismatch',
  /**
   * Time token: the signed `nonce` or `boot` differs from the request; key
   * endorsement: the signed `use` differs from the keyring purpose (defence in depth).
   */
  'binding_mismatch',
  /** `exp - iat` exceeds the maximum lifetime for the purpose. */
  'lifetime_too_long',
  /** Trusted now is earlier than `nbf - skew`. */
  'not_yet_valid',
  /** Trusted now is later than `exp + skew`. */
  'expired',
  /**
   * Replay store: the entry was received or activated in another boot, or a
   * revocation list was incomplete; revalidate online (offline: fail closed).
   */
  'revalidation_required',
  /** Trusted time: no time anchor from the current boot; get one online first. */
  'time_anchor_required',
  /** Trusted time: a time response arrived too late (or from another boot) to anchor time. */
  'stale_time',
  /** Replay store: the `jti` was already used and deactivated or expired. */
  'replayed',
  /** Replay store: the `jti` is in the revocation list of a verified time token. */
  'revoked',
  /** The caller passed an invalid keyring, key (non-canonical or small-order), issuer, device, nonce, boot or clock value. */
  'invalid_input',
  /** An unexpected internal failure; treated as a rejection (fail closed). */
  'internal_error',
] as const

export type TokenErrorCode = (typeof TOKEN_ERROR_CODES)[number]

export interface TokenError {
  readonly code: TokenErrorCode
}

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: TokenError }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T = never>(code: TokenErrorCode): Result<T> {
  return { ok: false, error: { code } }
}
