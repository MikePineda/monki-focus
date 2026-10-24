// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ed25519 key handling on `node:crypto`. Keys travel as raw bytes (a 32-byte
 * public key, a 32-byte private seed); Node wants DER, so the fixed RFC 8410
 * prefixes are prepended. The same prefixes work for `java.security`
 * (X.509 / PKCS#8 encodings); CryptoKit and WebCrypto import raw bytes.
 */
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto'
import { isAcceptablePointEncoding } from './ed25519_strict.ts'
import { fail, ok, type Result } from './token_error.ts'

export const ED25519_PUBLIC_KEY_BYTES = 32
export const ED25519_SEED_BYTES = 32
export const ED25519_SIGNATURE_BYTES = 64

// SubjectPublicKeyInfo { AlgorithmIdentifier { id-Ed25519 }, BIT STRING (32 bytes) }
const SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
])
// OneAsymmetricKey { version 0, AlgorithmIdentifier { id-Ed25519 }, OCTET STRING { OCTET STRING (32 bytes) } }
const PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])

function concat(a: Uint8Array, b: Uint8Array): Buffer {
  return Buffer.concat([a, b])
}

/** A verification key: the raw encoding (for the strict checks) and Node's key object. */
export interface Ed25519PublicKey {
  readonly raw: Uint8Array
  readonly key: KeyObject
}

/**
 * Imports a raw public key, refusing non-canonical encodings, the
 * small-order points and points outside the prime-order subgroup
 * (`invalid_input`).
 */
export function publicKeyFromRaw(raw: Uint8Array): Result<Ed25519PublicKey> {
  if (raw.byteLength !== ED25519_PUBLIC_KEY_BYTES || !isAcceptablePointEncoding(raw)) {
    return fail('invalid_input')
  }
  try {
    const key = createPublicKey({ key: concat(SPKI_PREFIX, raw), format: 'der', type: 'spki' })
    return ok({ raw: Uint8Array.from(raw), key })
  } catch {
    return fail('invalid_input')
  }
}

export function privateKeyFromSeed(seed: Uint8Array): Result<KeyObject> {
  if (seed.byteLength !== ED25519_SEED_BYTES) {
    return fail('invalid_input')
  }
  try {
    return ok(createPrivateKey({ key: concat(PKCS8_PREFIX, seed), format: 'der', type: 'pkcs8' }))
  } catch {
    return fail('invalid_input')
  }
}

export function isEd25519PrivateKey(key: KeyObject): boolean {
  return key.type === 'private' && key.asymmetricKeyType === 'ed25519'
}

/** The raw 32-byte public key of an Ed25519 private or public key. */
export function rawPublicKey(key: KeyObject): Uint8Array {
  const spki = createPublicKey(key).export({ format: 'der', type: 'spki' })
  return Uint8Array.from(spki.subarray(SPKI_PREFIX.byteLength))
}
