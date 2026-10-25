// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

/**
 * Dashboard sessions in an encrypted cookie (the server stays stateless).
 * In production the cookie carries the `__Host-` prefix: Secure, Path=/ and
 * no Domain, so no sibling subdomain can set or overwrite it.
 */
const sessionConfig = defineConfig({
  enabled: true,
  cookieName: app.inProduction ? '__Host-mf_session' : 'mf_session',
  clearWithBrowser: false,
  age: '30d',

  cookie: {
    path: '/',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },

  store: env.get('SESSION_DRIVER'),

  stores: {
    cookie: stores.cookie(),
  },
})

export default sessionConfig
