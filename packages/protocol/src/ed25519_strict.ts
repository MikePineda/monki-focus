// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The project's Ed25519 acceptance policy ("strict"), checked explicitly so
 * every platform agrees regardless of what its library tolerates:
 *
 *   - point encodings (public key A and signature R) must be canonical:
 *     the 255-bit y coordinate is below p = 2^255 - 19, and x = 0 points never
 *     carry the sign bit;
 *   - A and R must not be one of the 8 small-order points (checked on the
 *     encoding with the sign bit masked, which also catches the non-canonical
 *     "negative zero" forms) and must lie in the prime-order subgroup
 *     ([L]P = identity), which rejects mixed-order points;
 *   - the scalar S (last 32 bytes of the signature, little-endian) must be
 *     below the group order L;
 *   - then the platform primitive checks the (cofactorless) equation
 *     [S]B = R + [k]A.
 *
 * With A and R in the prime-order subgroup the cofactored and cofactorless
 * equations agree, so platform libraries cannot diverge on any vector.
 */
import { verify as nodeVerify, type KeyObject } from 'node:crypto'
import { isInPrimeOrderSubgroup } from './ed25519_subgroup.ts'

const ED25519_PUBLIC_KEY_BYTES = 32
const ED25519_SIGNATURE_BYTES = 64

const P = (1n << 255n) - 19n
const L = (1n << 252n) + 27742317777372353535851937790883648493n

/** Small-order point encodings with the sign bit (bit 255) cleared. */
const SMALL_ORDER_MASKED = [
  '0000000000000000000000000000000000000000000000000000000000000000', // order 4 (y = 0)
  '0100000000000000000000000000000000000000000000000000000000000000', // identity (y = 1)
  'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f', // order 2 (y = p - 1)
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05', // order 8
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a', // order 8
]

function littleEndian(bytes: Uint8Array): bigint {
  let value = 0n
  for (let index = bytes.byteLength - 1; index >= 0; index--) {
    value = (value << 8n) | BigInt(bytes[index] ?? 0)
  }
  return value
}

function masked(encoding: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(encoding)
  copy[31] = (copy[31] ?? 0) & 0x7f
  return copy
}

/** True when `encoding` is a canonical point of the prime-order subgroup other than the identity. */
export function isAcceptablePointEncoding(encoding: Uint8Array): boolean {
  if (encoding.byteLength !== ED25519_PUBLIC_KEY_BYTES) {
    return false
  }
  const y = masked(encoding)
  if (littleEndian(y) >= P) {
    return false
  }
  const hex = Buffer.from(y).toString('hex')
  return !SMALL_ORDER_MASKED.includes(hex) && isInPrimeOrderSubgroup(encoding)
}

/** True when the scalar half of a 64-byte signature is below L. */
export function isCanonicalScalar(signature: Uint8Array): boolean {
  return (
    signature.byteLength === ED25519_SIGNATURE_BYTES && littleEndian(signature.subarray(32)) < L
  )
}

/**
 * Strict Ed25519 verification of `message` under the raw public key and its
 * node KeyObject. Never throws.
 */
export function verifyEd25519Strict(
  rawPublicKey: Uint8Array,
  publicKey: KeyObject,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  try {
    if (
      !isAcceptablePointEncoding(rawPublicKey) ||
      signature.byteLength !== ED25519_SIGNATURE_BYTES ||
      !isAcceptablePointEncoding(signature.subarray(0, 32)) ||
      !isCanonicalScalar(signature)
    ) {
      return false
    }
    return nodeVerify(null, message, publicKey, signature)
  } catch {
    return false
  }
}
