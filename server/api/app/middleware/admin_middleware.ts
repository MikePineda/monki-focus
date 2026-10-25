// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { CodedError } from '#exceptions/coded_error'

/**
 * Admin-only routes (runs after `auth`). Anyone else gets exactly the 404
 * of an unknown route, never 403: the admin surface is not advertised.
 */
export default class AdminMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.auth.getUserOrFail().isAdmin) {
      throw new CodedError('E_ROUTE_NOT_FOUND', 404, 'Not found')
    }
    return next()
  }
}
