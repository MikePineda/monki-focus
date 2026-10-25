// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { keysOf } from '#domain/keys/key_ring'
import {
  SIGNING_KEY_PURPOSES,
  type SigningKeyRecord,
  type SigningKeyStatus,
} from '#domain/keys/signing_key_record'
import type { KeyPurpose } from '@monki-focus/protocol'

/** One entry of `GET /keys` (openapi.yaml `PublicKey`). */
export interface PublishedKey {
  readonly kid: string
  readonly purpose: KeyPurpose
  readonly kty: 'OKP'
  readonly crv: 'Ed25519'
  readonly x: string
  readonly status: SigningKeyStatus
  readonly endorsement?: string
}

/** The body of `GET /keys` (openapi.yaml `KeySet`). */
export interface KeySet {
  readonly issuer: string
  readonly keys: readonly PublishedKey[]
}

/**
 * The public key set of the instance: per purpose (unlock first), the
 * active key and then the retired one, each with its endorsement when it
 * has one. Only public material: the records carry no private part.
 */
export function publicKeySet(issuer: string, records: readonly SigningKeyRecord[]): KeySet {
  const keys = SIGNING_KEY_PURPOSES.flatMap((purpose) =>
    keysOf(records, purpose).map((record): PublishedKey => ({
      kid: record.kid,
      purpose: record.purpose,
      kty: 'OKP',
      crv: 'Ed25519',
      x: record.publicKey,
      status: record.status,
      ...(record.endorsement === null ? {} : { endorsement: record.endorsement }),
    }))
  )
  return { issuer, keys }
}

/**
 * Strong ETag of a key set (also the heartbeat's `keysEtag`): it changes
 * whenever a key is added, retired, pruned or endorsed.
 */
export function keySetEtag(keySet: KeySet): string {
  const digest = createHash('sha256').update(JSON.stringify(keySet)).digest('base64url')
  return `"${digest.slice(0, 27)}"`
}
