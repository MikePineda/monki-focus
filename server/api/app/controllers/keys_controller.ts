// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import { keySetEtag, publicKeySet, type KeySet } from '#domain/keys/key_set'
import { tokenIssuerIdentity } from '#services/token_issuer_identity'

/**
 * `GET /api/v1/keys` (openapi.yaml `getKeys`): the public signing keys of
 * this instance, per purpose, with their status and endorsements. Public on
 * purpose (devices verify tokens offline with these keys), and it never
 * reads a private key. Clients pin keys at enrolment and adopt a new one
 * only through its endorsement.
 */
export default class KeysController {
  async index({ request, response }: HttpContext): Promise<KeySet | void> {
    const keys = await app.container.make('signingKeys')
    const keySet = publicKeySet(tokenIssuerIdentity().issuer, await keys.records())
    const etag = keySetEtag(keySet)

    response.header('ETag', etag)
    response.header('Cache-Control', 'max-age=300')
    if (request.header('if-none-match') === etag) {
      return response.notModified()
    }
    return keySet
  }
}
