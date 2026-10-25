// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/** A JSON API: errors are always rendered as JSON, whatever the client accepts. */
export default class ForceJsonResponseMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    ctx.request.request.headers.accept = 'application/json'
    return next()
  }
}
