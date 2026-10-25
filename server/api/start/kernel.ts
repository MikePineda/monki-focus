// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| HTTP kernel
|--------------------------------------------------------------------------
|
| Server middleware runs on every request, routed or not (so a 404 is JSON
| and translated). Router middleware runs on matched routes only.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/detect_locale_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

/**
 * Every matched route: body parsing and the cookie-free half of Shield
 * (CSP, frame guard, HSTS, nosniff). No session and no CSRF here, so
 * `/api/v1/keys`, `/api/v1/device/*` and `/api/v1/actions/*` never set a
 * cookie.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('#middleware/security_headers_middleware'),
  // Lazy: it only builds `ctx.auth`; the session guard reads the session where `session` runs.
  () => import('@adonisjs/auth/initialize_auth_middleware'),
])

/**
 * Named middleware, assigned to routes or groups explicitly.
 */
export const middleware = router.named({
  /** Dashboard groups only: the session cookie. Always before `shield`. */
  session: () => import('@adonisjs/session/session_middleware'),
  /** Dashboard groups only, after `session`: CSRF (XSRF-TOKEN cookie) plus the headers. */
  shield: () => import('@adonisjs/shield/shield_middleware'),
  clientVersion: () => import('#middleware/client_version_middleware'),
  /** Session (`web`) by default, with the session-version check; S4 adds `device`. */
  auth: () => import('#middleware/auth_middleware'),
  /** After `auth`: admins only, 404 for anyone else. */
  admin: () => import('#middleware/admin_middleware'),
  /** After `auth`: the user's own language wins over Accept-Language. */
  userLocale: () => import('#middleware/user_locale_middleware'),
})
