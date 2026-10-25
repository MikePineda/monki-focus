// SPDX-License-Identifier: AGPL-3.0-or-later
import { errors } from '@adonisjs/auth'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { SESSION_VERSION_KEY } from '#services/accounts/web_session'

/**
 * Authenticates the request (default: the `web` session guard) and answers
 * 401 `{ message, code: 'E_UNAUTHORIZED_ACCESS' }` otherwise. For `web`
 * it also checks the session's stamped version against
 * `users.session_version`, in the same step so no route can authenticate
 * without it: a session stamped before "log out everywhere" or a password
 * change (or never stamped) is destroyed and answers 401.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: (keyof Authenticators)[] } = {}
  ) {
    const guards = options.guards ?? ['web']
    await ctx.auth.authenticateUsing(guards)

    if (ctx.auth.authenticatedViaGuard === 'web') {
      const user = ctx.auth.use('web').getUserOrFail()
      if (ctx.session.get(SESSION_VERSION_KEY) !== user.sessionVersion) {
        await ctx.auth.use('web').logout()
        throw new errors.E_UNAUTHORIZED_ACCESS('Session revoked', { guardDriverName: 'session' })
      }
    }

    return next()
  }
}
