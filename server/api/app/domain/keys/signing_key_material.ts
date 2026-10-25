// SPDX-License-Identifier: AGPL-3.0-or-later
import { createPrivateKey, type KeyObject } from 'node:crypto'
import {
  constantTimeEqual,
  decodeBase64Url,
  deriveKeyId,
  encodeBase64Url,
  isEd25519PrivateKey,
  publicKeyFromRaw,
  rawPublicKey,
  type KeyPurpose,
  type SigningKey,
} from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import type { SigningKeyRecord } from '#domain/keys/signing_key_record'

/**
 * A private signing key in memory, with the public key and kid derived from
 * it. Built only through the strict checks below; never logged, never
 * serialised except as the encrypted PKCS#8 that goes to the database.
 */
export interface SigningKeyMaterial extends SigningKey {
  readonly purpose: KeyPurpose
  /** Raw 32-byte public key. */
  readonly publicKey: Uint8Array
}

export type KeyMaterialFailure =
  | 'malformed_private_key'
  | 'weak_public_key'
  | 'kid_mismatch'
  | 'public_key_mismatch'
  | 'purpose_mismatch'

/**
 * Wraps an Ed25519 private key. Refuses anything else, and a key whose
 * public half fails the strict checks of spec §1.1 (non-canonical,
 * small-order, outside the prime-order subgroup): no client could pin it.
 */
export function signingKeyFromSecret(
  purpose: KeyPurpose,
  secretKey: KeyObject
): Outcome<SigningKeyMaterial, KeyMaterialFailure> {
  if (!isEd25519PrivateKey(secretKey)) return refuse('malformed_private_key')
  const publicKey = rawPublicKey(secretKey)
  if (!publicKeyFromRaw(publicKey).ok) return refuse('weak_public_key')
  return succeed({ purpose, kid: deriveKeyId(publicKey), publicKey, secretKey })
}

/** Imports an unpadded base64url PKCS#8 DER Ed25519 private key (the env and at-rest format). */
export function signingKeyFromPkcs8(
  purpose: KeyPurpose,
  pkcs8: string
): Outcome<SigningKeyMaterial, KeyMaterialFailure> {
  const der = decodeBase64Url(pkcs8)
  if (der === null) return refuse('malformed_private_key')
  let secretKey: KeyObject
  try {
    secretKey = createPrivateKey({ key: Buffer.from(der), format: 'der', type: 'pkcs8' })
  } catch {
    return refuse('malformed_private_key')
  }
  return signingKeyFromSecret(purpose, secretKey)
}

/** The unpadded base64url PKCS#8 DER of a key: what is encrypted at rest. */
export function exportPkcs8(material: SigningKeyMaterial): string {
  return encodeBase64Url(material.secretKey.export({ format: 'der', type: 'pkcs8' }))
}

/**
 * Checks a stored public key strictly (canonical, prime-order, kid derived
 * from it) and, when its private key was loaded, that both halves belong
 * together. Run on every key the server loads, so a tampered row never
 * signs or gets published.
 */
export function checkStoredKey(
  record: SigningKeyRecord,
  material?: SigningKeyMaterial
): Outcome<SigningKeyRecord, KeyMaterialFailure> {
  const publicKey = decodeBase64Url(record.publicKey)
  if (publicKey === null || !publicKeyFromRaw(publicKey).ok) return refuse('weak_public_key')
  if (deriveKeyId(publicKey) !== record.kid) return refuse('kid_mismatch')
  if (material !== undefined) {
    if (material.purpose !== record.purpose) return refuse('purpose_mismatch')
    if (material.kid !== record.kid || !constantTimeEqual(material.publicKey, publicKey)) {
      return refuse('public_key_mismatch')
    }
  }
  return succeed(record)
}
