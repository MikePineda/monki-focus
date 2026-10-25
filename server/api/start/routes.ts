// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Every route has a name (`.as()`). Layout:
|
| - /api/health, /api/health/live: infrastructure probes, outside /v1 on
|   purpose (Docker, Swarm and uptime monitors depend on them).
| - /api/v1: the versioned API, per-IP throttle.
|   - /api/v1/device/*: device API (packages/protocol openapi.yaml), Bearer
|     device tokens, `X-Client-Version` gate (426 for old clients), no CSRF.
|     Routes land with S3 (keys) and S4 (devices).
|   - everything else: dashboard routes with the session and CSRF (S2+).
| - /api/test/*: test support, NODE_ENV=test or E2E_MODE only.
|
| Routes with `:id`/`:uuid` load rows through the owning user only and
| answer 404 for anyone else's (a parameterised spec lands with S2).
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'
import { testSupportEnabled } from '#services/test_support'

const HealthChecksController = () => import('#controllers/health_checks_controller')
const TestSupportController = () => import('#controllers/test_support_controller')

router
  .group(() => {
    router.get('health', [HealthChecksController, 'ready']).as('health.ready')
    router.get('health/live', [HealthChecksController, 'live']).as('health.live')

    router
      .group(() => {
        router
          .group(() => {
            // Device API routes (S3, S4, S6, S7).
          })
          .prefix('device')
          .as('device')
          .use(middleware.clientVersion())
      })
      .prefix('v1')
      .as('v1')
      .use(apiThrottle)
  })
  .prefix('/api')

if (testSupportEnabled()) {
  router
    .group(() => {
      router.post('tick', [TestSupportController, 'tick']).as('tick')
    })
    .prefix('/api/test')
    .as('test')
}
