// SPDX-License-Identifier: AGPL-3.0-or-later
import type User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Session key holding the `users.session_version` the session was created
 * with. The `auth` middleware compares it on every request; bumping the
 * column revokes every older session.
 */
export const SESSION_VERSION_KEY = 'sv'

/**
 * Logs the user into the `web` guard (which regenerates the session id, so
 * a planted session id is useless) and stamps the session version. The only
 * way a dashboard session starts: login, two-factor login, registration.
 */
export async function startWebSession(ctx: Pick<HttpContext, 'auth' | 'session'>, user: User) {
  await ctx.auth.use('web').login(user)
  ctx.session.put(SESSION_VERSION_KEY, user.sessionVersion)
}

/** Keeps the current session valid after its own user's session_version changed. */
export function refreshSessionVersion(ctx: Pick<HttpContext, 'session'>, user: User) {
  ctx.session.put(SESSION_VERSION_KEY, user.sessionVersion)
}
