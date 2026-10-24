// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Splits a `v4.public` token into its raw parts without interpreting any of
 * them: `header || base64url(message || signature) [ || "." || base64url(footer) ]`.
 *
 * Nothing here parses JSON. The header is compared byte for byte, so any
 * other version or purpose (`v4.local.`, `v3.public.`, `V4.public.`) is
 * rejected before a single byte of the body is decoded.
 */
import { decodeBase64Url } from './base64url.ts'
import { ED25519_SIGNATURE_BYTES } from './ed25519_key.ts'
import { fail, ok, type Result } from './token_error.ts'

export const V4_PUBLIC_HEADER = 'v4.public.'

/**
 * Upper bound on the token, in bytes. Every valid token is printable ASCII,
 * so bytes and string characters coincide. Unlock and policy tokens are well
 * under 1 KiB; the bound keeps hostile input from costing more than a fixed
 * amount.
 */
export const MAX_TOKEN_LENGTH = 4096

/** Only bytes 0x21-0x7E can appear in a token (no space, no control, no non-ASCII). */
const PRINTABLE = /^[\x21-\x7e]*$/

export interface TokenParts {
  /** The header bytes, always `v4.public.`. */
  readonly header: Uint8Array
  /** The signed message (the claims JSON for monki-focus tokens), not yet trusted. */
  readonly message: Uint8Array
  /** The 64-byte Ed25519 signature. */
  readonly signature: Uint8Array
  /** The footer bytes (empty when the token has no footer), not yet trusted. */
  readonly footer: Uint8Array
}

const HEADER_BYTES = new TextEncoder().encode(V4_PUBLIC_HEADER)

export function parseTokenParts(token: unknown): Result<TokenParts> {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || !PRINTABLE.test(token)) {
    return fail('malformed_token')
  }
  if (!token.startsWith(V4_PUBLIC_HEADER)) {
    return fail('wrong_header')
  }
  const segments = token.slice(V4_PUBLIC_HEADER.length).split('.')
  if (segments.length > 2) {
    return fail('malformed_token')
  }
  const [encodedBody = '', encodedFooter] = segments
  // A trailing "." with an empty footer is not a canonical encoding: the
  // spec omits the separator when the footer is empty.
  if (encodedBody === '' || encodedFooter === '') {
    return fail('malformed_token')
  }
  const body = decodeBase64Url(encodedBody)
  const footer = encodedFooter === undefined ? new Uint8Array(0) : decodeBase64Url(encodedFooter)
  if (body === null || footer === null) {
    return fail('malformed_base64url')
  }
  if (body.byteLength < ED25519_SIGNATURE_BYTES) {
    return fail('malformed_token')
  }
  const split = body.byteLength - ED25519_SIGNATURE_BYTES
  return ok({
    header: HEADER_BYTES,
    message: body.subarray(0, split),
    signature: body.subarray(split),
    footer,
  })
}
