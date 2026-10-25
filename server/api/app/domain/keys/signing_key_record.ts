// SPDX-License-Identifier: AGPL-3.0-or-later
import type { KeyPurpose } from '@monki-focus/protocol'

/**
 * Key purposes with their own Ed25519 signing key (spec §2): `unlock`
 * signs unlock and time tokens, `policy` signs policy tokens. They never
 * share a key, so a client never verifies one with the other keyring.
 */
export const SIGNING_KEY_PURPOSES = ['unlock', 'policy'] as const satisfies readonly KeyPurpose[]

/** The only algorithm (PASETO v4.public is Ed25519; there is nothing to negotiate). */
export const SIGNING_KEY_ALGORITHM = 'EdDSA'

/**
 * `active`: the one key of its purpose that signs. `retired`: no longer
 * signs (its private key is erased on retirement) but is still published in
 * `/keys` and verifies until it is pruned.
 */
export type SigningKeyStatus = 'active' | 'retired'

/** A row of `signing_keys` without its private part, times in epoch seconds. */
export interface SigningKeyRecord {
  readonly kid: string
  readonly purpose: KeyPurpose
  /** Raw 32-byte Ed25519 public key, unpadded base64url. */
  readonly publicKey: string
  readonly status: SigningKeyStatus
  readonly createdAt: number
  readonly retiredAt: number | null
  /** Key endorsement token by the previous active key; null for the first key of a purpose. */
  readonly endorsement: string | null
}

export function isKeyPurpose(value: unknown): value is KeyPurpose {
  return (SIGNING_KEY_PURPOSES as readonly unknown[]).includes(value)
}
