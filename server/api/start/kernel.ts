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

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
])

/**
 * Named middleware, assigned to routes or groups explicitly.
 */
export const middleware = router.named({
  clientVersion: () => import('#middleware/client_version_middleware'),
  /** Session (`web`) by default, with the session-version check; S4 adds `device`. */
  auth: () => import('#middleware/auth_middleware'),
  /** After `auth`: admins only, 404 for anyone else. */
  admin: () => import('#middleware/admin_middleware'),
  /** After `auth`: the user's own language wins over Accept-Language. */
  userLocale: () => import('#middleware/user_locale_middleware'),
})
