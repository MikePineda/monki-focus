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
])

/**
 * Named middleware, assigned to routes or groups explicitly.
 */
export const middleware = router.named({
  clientVersion: () => import('#middleware/client_version_middleware'),
})
