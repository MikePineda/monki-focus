// SPDX-License-Identifier: AGPL-3.0-or-later

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
/** Largest multiple of 26 that fits in a byte; bytes at or above it are redrawn. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length)

export type RandomBytes = (size: number) => Uint8Array

export const webCryptoBytes: RandomBytes = (size) => crypto.getRandomValues(new Uint8Array(size))

/**
 * `count` lowercase letters drawn uniformly: bytes that would bias the modulo
 * (>= 234) are rejected and redrawn instead of being folded onto the alphabet.
 */
export function randomLetters(count: number, randomBytes: RandomBytes = webCryptoBytes): string {
  let letters = ''
  while (letters.length < count) {
    for (const byte of randomBytes(count - letters.length)) {
      if (byte < UNBIASED_LIMIT) letters += ALPHABET[byte % ALPHABET.length]
    }
  }
  return letters
}
