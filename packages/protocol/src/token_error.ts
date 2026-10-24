// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Every way token handling can fail, as a stable reason code. Verifiers
 * return one of these codes and never throw; platforms map the code to an
 * i18n key, never to free text. The same codes appear in the shared vectors
 * (`fixtures/unlock-tokens/*.json`, `expect.error`), so every platform must
 * produce the exact code for each vector.
 */
export const TOKEN_ERROR_CODES = [
  /** Not a string, too long, wrong number of `.`-separated parts, or too short. */
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
  /** The signed payload is not UTF-8 JSON matching the claims schema. */
  'invalid_claims',
  /** The signed `typ` claim is not the purpose being verified. */
  'wrong_typ',
  /** The signed `iss` differs from the pinned issuer (defence in depth). */
  'issuer_mismatch',
  /** The signed `dev` differs from this device (defence in depth). */
  'device_mismatch',
  /** `exp - iat` exceeds the maximum lifetime for the purpose. */
  'lifetime_too_long',
  /** Trusted now is earlier than `nbf - skew`. */
  'not_yet_valid',
  /** Trusted now is later than `exp + skew`. */
  'expired',
  /** Receipt check: the device rebooted since receipt; revalidate online (offline: fail closed). */
  'reboot_revalidation_required',
  /** Replay store: the `jti` was already used and deactivated or expired. */
  'replayed',
  /** Replay store: the `jti` is in a `revokedTokens` list from a heartbeat. */
  'revoked',
  /** The caller passed an invalid keyring, issuer, device, key or clock value. */
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
