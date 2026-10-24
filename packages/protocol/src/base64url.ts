// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Strict base64url (RFC 4648 §5) without padding, as PASETO requires.
 *
 * The decoder rejects anything a lenient decoder would silently accept:
 * padding, characters outside `A-Z a-z 0-9 - _`, a length of 4n+1, and
 * non-canonical encodings whose unused trailing bits are not zero. Without
 * the last rule two different strings decode to the same bytes, and two
 * platforms could disagree about whether a token is "the same token".
 */
const ALPHABET = /^[A-Za-z0-9_-]*$/

export function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64url')
}

/** Returns the decoded bytes, or `null` when `text` is not strict canonical base64url. */
export function decodeBase64Url(text: string): Uint8Array | null {
  if (!ALPHABET.test(text) || text.length % 4 === 1) {
    return null
  }
  const bytes = Uint8Array.from(Buffer.from(text, 'base64url'))
  // Canonical check: re-encoding must give back the exact input.
  if (encodeBase64Url(bytes) !== text) {
    return null
  }
  return bytes
}
