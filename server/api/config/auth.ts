// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

/**
 * Two guards, never mixed on one route (tests/functional/route_guards.spec.ts):
 *
 * - `web` (default), the dashboard: the encrypted cookie session of
 *   config/session.ts, no remember-me tokens. Every session is stamped with
 *   `users.session_version` at login (app/services/accounts/web_session.ts)
 *   and the `auth` middleware rejects stale stamps.
 * - `device`, the device API (`/api/v1/device/*`): Bearer access tokens
 *   (`mfd_…`) whose tokenable is a **Device**, not a user
 *   (app/models/device.ts). No cookie is read or set.
 */
const authConfig = defineConfig({
  default: 'web',

  guards: {
    web: sessionGuard({
      useRememberMeTokens: false,

      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),

    device: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/device'),
      }),
    }),
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
