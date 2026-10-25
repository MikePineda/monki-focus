// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'
import { isTrustedProxy } from '#http/trusted_proxy'

/**
 * The public URL of this instance (issuer of tokens, base of ntfy action
 * URLs, links in notifications). Only ever from APP_URL: domains never live
 * in code.
 */
export const appUrl = env.get('APP_URL')

export const http = defineConfig({
  /** A request id per request, to correlate log lines. */
  generateRequestId: true,

  /** No `_method` spoofing: an action is always the method it says. */
  allowMethodSpoofing: false,

  useAsyncLocalStorage: false,

  /**
   * Only the local reverse proxy (Traefik on the Docker network, or a
   * self-hoster's proxy on loopback) may set X-Forwarded-*. The client IP
   * behind a CDN comes from CLIENT_IP_HEADER: always read it through
   * `clientIp(ctx)` (app/http/client_ip.ts).
   */
  trustProxy: (address) => isTrustedProxy(address),

  router: {
    matcher: 'tree',
  },

  redirect: {
    forwardQueryString: true,
  },

  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
