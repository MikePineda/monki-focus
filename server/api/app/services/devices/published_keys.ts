// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import { keySetEtag, publicKeySet, type KeySet } from '#domain/keys/key_set'
import { kidsByPurpose, type KidsByPurpose } from '#domain/devices/key_pin_check'
import { tokenIssuerIdentity } from '#services/token_issuer_identity'

export interface PublishedKeys {
  readonly keySet: KeySet
  readonly etag: string
  readonly kids: KidsByPurpose
}

/**
 * The key set `GET /keys` publishes right now, with its ETag (the
 * heartbeat's `keysEtag`) and its kids per purpose (what enrolment returns
 * and heartbeats are compared with). Public material only.
 */
export async function publishedKeys(): Promise<PublishedKeys> {
  const keys = await app.container.make('signingKeys')
  const keySet = publicKeySet(tokenIssuerIdentity().issuer, await keys.records())
  return { keySet, etag: keySetEtag(keySet), kids: kidsByPurpose(keySet.keys) }
}
