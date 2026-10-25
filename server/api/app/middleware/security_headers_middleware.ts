// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { cspFactory, frameGuardFactory, hstsFactory, noSniffFactory } from '@adonisjs/shield/guards'
import type { ShieldConfig } from '@adonisjs/shield/types'

/**
 * The header half of Shield (CSP, frame guard, HSTS, nosniff) on every
 * route, from config/shield.ts. CSRF and the session are not here: they
 * need a cookie, so only the dashboard groups get them (named middleware
 * `session` and `shield` in start/kernel.ts). `/api/v1/keys`, the device
 * API and the ntfy action URLs therefore never set a cookie and can be
 * cached publicly.
 */
export default class SecurityHeadersMiddleware {
  #guards: Array<(ctx: HttpContext) => unknown> | undefined

  #load() {
    const config = app.config.get<ShieldConfig>('shield')
    return [
      cspFactory(config.csp ?? {}),
      frameGuardFactory(config.xFrame ?? {}),
      hstsFactory(config.hsts ?? {}),
      noSniffFactory(config.contentTypeSniffing ?? {}),
    ]
  }

  async handle(ctx: HttpContext, next: NextFn) {
    this.#guards ??= this.#load()
    for (const guard of this.#guards) await guard(ctx)
    return next()
  }
}
