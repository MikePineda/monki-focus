// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

/**
 * The dashboard guard (`web`): the encrypted cookie session of
 * config/session.ts, no remember-me tokens. Every session is stamped with
 * `users.session_version` at login (app/services/accounts/web_session.ts)
 * and the `auth` middleware rejects stale stamps. The device guard (Bearer
 * tokens) joins with the devices package (S4).
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
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
