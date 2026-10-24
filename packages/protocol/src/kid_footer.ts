// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The footer of every monki-focus token is exactly `{"kid":"<kid>"}`: no
 * whitespace, no other keys, a 16-character base64url kid.
 *
 * The footer is the one part a verifier must read before the signature is
 * checked (to pick the key), so it is matched byte for byte against that one
 * shape instead of being handed to a JSON parser. It is still authenticated:
 * the footer is part of the PAE that the signature covers.
 */
import { KEY_ID_PATTERN } from './claim_formats.ts'
import { fail, ok, type Result } from './token_error.ts'

const FOOTER_PATTERN = /^\{"kid":"([A-Za-z0-9_-]{16})"\}$/

export function encodeKidFooter(kid: string): Uint8Array {
  if (!KEY_ID_PATTERN.test(kid)) {
    throw new TypeError('kid must be 16 base64url characters')
  }
  return new TextEncoder().encode(`{"kid":"${kid}"}`)
}

export function parseKidFooter(footer: Uint8Array): Result<string> {
  // Every byte of a valid footer is ASCII; anything else cannot match.
  if (footer.byteLength > 64 || footer.some((byte) => byte > 0x7f)) {
    return fail('malformed_footer')
  }
  const match = FOOTER_PATTERN.exec(String.fromCharCode(...footer))
  if (match?.[1] === undefined) {
    return fail('malformed_footer')
  }
  return ok(match[1])
}
