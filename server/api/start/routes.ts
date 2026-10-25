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
|   - /api/v1/keys: public signing keys (openapi.yaml `getKeys`), no auth,
|     `X-Client-Version` gate.
|   - /api/v1/device/*: device API (packages/protocol openapi.yaml), Bearer
|     device tokens (`auth` with the `device` guard only), `X-Client-Version`
|     gate (426 for old clients), no session, no CSRF, contract errors
|     `{ code, fields? }`. Enrolment, heartbeat, bypass events and token
|     rotation (S4); unlock requests land with S6.
|   - /api/v1/auth/*: login (two steps with TOTP), register, logout, me.
|   - /api/v1/me/*: the signed-in user's profile, password, two-factor,
|     export and deletion.
|   - /api/v1/devices/*: the signed-in user's devices and enrolment codes.
|   - /api/v1/admin/*: admins only; anyone else gets the 404 of an
|     unknown route.
|   Only these dashboard groups get the named `session` and `shield`
|   (CSRF) middleware, so nothing else sets a cookie; errors answer
|   `{ message, code }` (validation: 422 `{ errors }`).
| - /api/test/*: test support, NODE_ENV=test or E2E_MODE only.
|
| Routes with `:id`/`:uuid` constrain the param (`router.matchers`) and
| load rows through the owning user only (app/services/tenancy/owned_by.ts),
| answering 404 for anyone else's; tests/functional/tenant_isolation.spec.ts
| needs a case for every such route.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'
import { testSupportEnabled } from '#services/test_support'

const HealthChecksController = () => import('#controllers/health_checks_controller')
const KeysController = () => import('#controllers/keys_controller')
const TestSupportController = () => import('#controllers/test_support_controller')
const SessionsController = () => import('#controllers/sessions_controller')
const RegistrationsController = () => import('#controllers/registrations_controller')
const ProfileController = () => import('#controllers/profile_controller')
const AccountController = () => import('#controllers/account_controller')
const TwoFactorController = () => import('#controllers/two_factor_controller')
const AdminInvitationsController = () => import('#controllers/admin_invitations_controller')
const DevicesController = () => import('#controllers/devices_controller')
const DeviceApiController = () => import('#controllers/device_api_controller')

router
  .group(() => {
    router.get('health', [HealthChecksController, 'ready']).as('health.ready')
    router.get('health/live', [HealthChecksController, 'live']).as('health.live')

    router
      .group(() => {
        router
          .get('keys', [KeysController, 'index'])
          .as('keys.index')
          .use(middleware.clientVersion())

        router
          .group(() => {
            // Guests: the one-time code is the credential (throttled per IP and per code).
            router.post('enroll', [DeviceApiController, 'enroll']).as('enroll')

            router
              .group(() => {
                router.post('heartbeat', [DeviceApiController, 'heartbeat']).as('heartbeat')
                router
                  .post('bypass-events', [DeviceApiController, 'bypassEvents'])
                  .as('bypass_events')
                router.post('token/rotate', [DeviceApiController, 'rotateToken']).as('token.rotate')
                // Unlock requests land with S6.
              })
              .use(middleware.auth({ guards: ['device'] }))
          })
          .prefix('device')
          .as('device')
          .use(middleware.clientVersion())

        router
          .group(() => {
            // Guests: throttled per account and per IP inside the services.
            router.post('login', [SessionsController, 'store']).as('login')
            router.post('two-factor', [SessionsController, 'twoFactorStep']).as('two_factor')
            router.post('register', [RegistrationsController, 'store']).as('register')

            router
              .group(() => {
                router.get('me', [SessionsController, 'show']).as('me')
                router.post('logout', [SessionsController, 'destroy']).as('logout')
                router
                  .post('logout-everywhere', [SessionsController, 'destroyEverywhere'])
                  .as('logout_everywhere')
              })
              .use([middleware.auth(), middleware.userLocale()])
          })
          .prefix('auth')
          .as('auth')
          .use([middleware.session(), middleware.shield()])

        router
          .group(() => {
            router.patch('/', [ProfileController, 'update']).as('update')
            router.delete('/', [AccountController, 'destroy']).as('destroy')
            router.put('password', [ProfileController, 'password']).as('password')
            router.get('export', [AccountController, 'export']).as('export')
            router.post('two-factor', [TwoFactorController, 'store']).as('two_factor.store')
            router
              .post('two-factor/confirm', [TwoFactorController, 'confirm'])
              .as('two_factor.confirm')
            router
              .post('two-factor/recovery-codes', [TwoFactorController, 'recoveryCodes'])
              .as('two_factor.recovery_codes')
            router.delete('two-factor', [TwoFactorController, 'destroy']).as('two_factor.destroy')
          })
          .prefix('me')
          .as('me')
          .use([
            middleware.session(),
            middleware.shield(),
            middleware.auth(),
            middleware.userLocale(),
          ])

        router
          .group(() => {
            router.get('/', [DevicesController, 'index']).as('index')
            router
              .post('enrollment-codes', [DevicesController, 'storeEnrollmentCode'])
              .as('enrollment_codes.store')
            router
              .patch(':uuid', [DevicesController, 'update'])
              .where('uuid', router.matchers.uuid())
              .as('update')
            router
              .delete(':uuid', [DevicesController, 'destroy'])
              .where('uuid', router.matchers.uuid())
              .as('destroy')
          })
          .prefix('devices')
          .as('devices')
          .use([
            middleware.session(),
            middleware.shield(),
            middleware.auth(),
            middleware.userLocale(),
          ])

        router
          .group(() => {
            router.get('invitations', [AdminInvitationsController, 'index']).as('invitations.index')
            router
              .post('invitations', [AdminInvitationsController, 'store'])
              .as('invitations.store')
            router
              .delete('invitations/:id', [AdminInvitationsController, 'destroy'])
              .where('id', router.matchers.number())
              .as('invitations.destroy')
          })
          .prefix('admin')
          .as('admin')
          .use([
            middleware.session(),
            middleware.shield(),
            middleware.auth(),
            middleware.userLocale(),
            middleware.admin(),
          ])
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
    .use([middleware.session(), middleware.shield()])
}
