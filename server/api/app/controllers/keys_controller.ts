// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HttpContext } from '@adonisjs/core/http'
import type { KeySet } from '#domain/keys/key_set'
import { publishedKeys } from '#services/devices/published_keys'

/**
 * `GET /api/v1/keys` (openapi.yaml `getKeys`): the public signing keys of
 * this instance, per purpose, with their status and endorsements. Public on
 * purpose (devices verify tokens offline with these keys), and it never
 * reads a private key. Clients pin keys at enrolment and adopt a new one
 * only through its endorsement. The ETag is the heartbeat's `keysEtag`.
 */
export default class KeysController {
  async index({ request, response }: HttpContext): Promise<KeySet | void> {
    const { keySet, etag } = await publishedKeys()

    response.header('ETag', etag)
    // Shared caches may keep it only while nothing personal rides along: a
    // response that sets a cookie is never public.
    response.header(
      'Cache-Control',
      response.getHeader('set-cookie') === undefined ? 'public, max-age=300' : 'no-store'
    )
    if (request.header('if-none-match') === etag) {
      return response.notModified()
    }
    return keySet
  }
}
