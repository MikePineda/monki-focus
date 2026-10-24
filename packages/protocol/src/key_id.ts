// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Key id (`kid`) of an Ed25519 public key: the first 16 characters of the
 * unpadded base64url SHA-256 of the raw 32-byte key (96 bits).
 *
 * SHA-256 rather than a PASERK `k4.pid` (BLAKE2b) because every client
 * platform ships SHA-256 natively (WebCrypto, CryptoKit, `java.security`) and
 * none ships BLAKE2b. The kid is an index, not a security boundary: the
 * signature is always checked with the pinned key the kid points to, and
 * keyrings refuse a kid that does not match its key.
 */
import { createHash } from 'node:crypto'
import { encodeBase64Url } from './base64url.ts'

export const KEY_ID_LENGTH = 16

export function deriveKeyId(rawPublicKey: Uint8Array): string {
  const digest = createHash('sha256').update(rawPublicKey).digest()
  return encodeBase64Url(digest).slice(0, KEY_ID_LENGTH)
}
